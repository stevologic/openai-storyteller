/* Main-thread client for the Transformers.js worker. */
import type { OnProgress } from './onDeviceText';

interface Pending {
  resolve: (text: string) => void;
  reject: (err: Error) => void;
  onProgress?: OnProgress;
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./transformersWorker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent) => {
    const data = e.data ?? {};
    if (data.type === 'progress') {
      // Progress isn't request-scoped; forward to whatever is generating.
      for (const p of pending.values()) p.onProgress?.(data.message);
      return;
    }
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    if (data.type === 'result') entry.resolve(data.text ?? '');
    else entry.reject(new Error(data.message || 'On-device generation failed.'));
  };
  worker.onerror = (e) => {
    for (const [id, p] of pending) {
      p.reject(new Error(e.message || 'The on-device model worker crashed.'));
      pending.delete(id);
    }
  };
  return worker;
}

export function transformersSupported(): boolean {
  return typeof Worker !== 'undefined';
}

export function transformersText(
  model: string,
  system: string,
  user: string,
  maxTokens: number,
  onProgress?: OnProgress,
): Promise<string> {
  const w = getWorker();
  const id = ++seq;
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    w.postMessage({ id, model, system, user, maxTokens });
  });
}

/** On-device image captioning (used to describe an uploaded character photo). */
export function transformersCaption(imageUrl: string, onProgress?: OnProgress): Promise<string> {
  const w = getWorker();
  const id = ++seq;
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    w.postMessage({ id, type: 'caption', imageUrl });
  });
}
