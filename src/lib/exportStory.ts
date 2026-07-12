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

/** Save the whole rendered story (text + inlined media) as a single JSON file.
 *  Round-trips through openStoryFile() and is the cleanest way to hand off assets. */
export function saveStoryJson(story: RenderedStory): void {
  const json = JSON.stringify(story);
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
    throw new Error('That file does not look like a Storyteller story.');
  }
  return {
    ...(data as unknown as RenderedStory),
    createdAt: typeof data.createdAt === 'number' ? (data.createdAt as number) : Date.now(),
  };
}
