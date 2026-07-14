import { StorySchema } from './types';
import type { RenderedStory } from './types';

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'storyteller-story'
  );
}

function triggerDownload(href: string, filename: string): void {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function isBlobUrl(url: string | undefined): url is string {
  return Boolean(url?.startsWith('blob:'));
}

function bytesToBase64(bytes: Uint8Array): string {
  // btoa accepts a binary string, not a Uint8Array. Chunking keeps the argument
  // list small enough for sizeable generated clips.
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function blobUrlToDataUrl(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error('One of this story\'s generated assets is no longer available. Re-generate it before saving a portable story file.');
  }
  if (!response.ok) {
    throw new Error('One of this story\'s generated assets could not be included in the saved file. Please try again.');
  }
  const blob = await response.blob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return `data:${blob.type || 'application/octet-stream'};base64,${bytesToBase64(bytes)}`;
}

/**
 * Turn browser-only object URLs into data URLs before writing a story file.
 * Image providers already return data URLs, while generated narration and
 * video clips use object URLs that stop working after the tab is closed.
 */
export async function makeStoryPortable(story: RenderedStory): Promise<RenderedStory> {
  const converted = new Map<string, Promise<string>>();
  const persistUrl = (url?: string): Promise<string | undefined> => {
    if (!isBlobUrl(url)) return Promise.resolve(url);
    let pending = converted.get(url);
    if (!pending) {
      pending = blobUrlToDataUrl(url);
      converted.set(url, pending);
    }
    return pending;
  };

  const [coverImageUrl, storyVideoUrl, pages] = await Promise.all([
    persistUrl(story.coverImageUrl),
    persistUrl(story.storyVideoUrl),
    Promise.all(
      story.pages.map(async (page) => {
        const [imageUrl, videoUrl, audioUrl] = await Promise.all([
          persistUrl(page.imageUrl),
          persistUrl(page.videoUrl),
          persistUrl(page.audioUrl),
        ]);
        return { ...page, imageUrl, videoUrl, audioUrl };
      }),
    ),
  ]);

  return { ...story, coverImageUrl, storyVideoUrl, pages };
}

/** Save the whole rendered story and its generated media as one portable JSON file.
 *  Round-trips through openStoryFile() across tabs and browser sessions. */
export async function saveStoryJson(story: RenderedStory): Promise<void> {
  const portableStory = await makeStoryPortable(story);
  const json = JSON.stringify(portableStory);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `${slugify(story.title)}.storyteller.json`);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Save the cover + every page illustration as individual PNG files. */
export async function downloadStoryImages(story: RenderedStory): Promise<number> {
  const slug = slugify(story.title);
  const items: { url: string; name: string }[] = [];
  if (story.coverImageUrl) items.push({ url: story.coverImageUrl, name: `${slug}-00-cover.png` });
  story.pages.forEach((p, i) => {
    if (p.imageUrl) items.push({ url: p.imageUrl, name: `${slug}-${String(i + 1).padStart(2, '0')}.png` });
  });
  for (const it of items) {
    triggerDownload(it.url, it.name);
    // Stagger so the browser accepts a batch of downloads.
    await new Promise((r) => setTimeout(r, 400));
  }
  return items.length;
}

export function storyHasImages(story: RenderedStory): boolean {
  return Boolean(story.coverImageUrl || story.pages.some((p) => p.imageUrl));
}

/** Read a previously saved .json back into a RenderedStory. */
export async function openStoryFile(file: File): Promise<RenderedStory> {
  const text = await file.text();
  const data = JSON.parse(text) as Record<string, unknown>;
  // Validate the story shape; media fields are passed through untouched.
  const parsed = StorySchema.safeParse(data);
  if (!parsed.success) {
    throw new Error('That file does not look like a Tiny Book Buddies story.');
  }
  return {
    ...(data as unknown as RenderedStory),
    createdAt: typeof data.createdAt === 'number' ? (data.createdAt as number) : Date.now(),
  };
}
