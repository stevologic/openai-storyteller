import type { RenderedStory } from './types';
import { makeStoryPortable } from './exportStory';

/* A generated book costs real API money, but stories only live in memory — an
   accidental refresh used to destroy them. The bookshelf keeps the most recent
   book in IndexedDB (localStorage is too small for data-URL illustrations) so
   it survives reloads and can be reopened from the Studio. */

const DB_NAME = 'tbb-bookshelf';
const STORE = 'books';
const LATEST_KEY = 'latest';

interface ShelfEntry {
  savedAt: number;
  story: RenderedStory;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'));
  });
}

function idbPut(key: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error('IndexedDB write failed'));
        };
      }),
  );
}

function idbGet<T>(key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => {
          db.close();
          resolve(req.result as T | undefined);
        };
        req.onerror = () => {
          db.close();
          reject(req.error ?? new Error('IndexedDB read failed'));
        };
      }),
  );
}

// Saves can be triggered back-to-back (finish weaving, then regenerate a
// slide). Chain them so an older snapshot can never overwrite a newer one.
let saveChain: Promise<void> = Promise.resolve();

/** Persist the latest real (non-demo) book. Fire-and-forget; failures are
 *  swallowed — persistence is a safety net, never a blocker. */
export function saveLatestBook(story: RenderedStory): void {
  if (story.demo || typeof indexedDB === 'undefined') return;
  saveChain = saveChain
    .then(async () => {
      const portable = await makeStoryPortable(story);
      // The whole-book video is by far the largest asset and can be re-rendered
      // from the reader at any time — keep the shelf lean without it.
      const { storyVideoUrl: _v, storyVideoName: _n, ...lean } = portable;
      const entry: ShelfEntry = { savedAt: Date.now(), story: lean as RenderedStory };
      await idbPut(LATEST_KEY, entry);
    })
    .catch(() => undefined);
}

/** Load the most recently saved book, or null when the shelf is empty. */
export async function loadLatestBook(): Promise<RenderedStory | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const entry = await idbGet<ShelfEntry>(LATEST_KEY);
    return entry?.story ?? null;
  } catch {
    return null;
  }
}
