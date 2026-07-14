import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeStoryPortable, openStoryFile } from './exportStory';
import type { RenderedStory } from './types';

const story: RenderedStory = {
  title: 'Milo and the Moon',
  dedication: '',
  ageRange: '4â€“7',
  characterBible: 'Milo is a small orange fox.',
  artStyle: 'Soft watercolor',
  moral: 'Kindness helps us find our way.',
  createdAt: 1,
  language: 'English (US)',
  coverImageUrl: 'blob:cover',
  storyVideoUrl: 'blob:book-video',
  storyVideoName: 'milo.mp4',
  pages: [
    {
      header: 'A Little Light',
      text: 'Milo saw a kind moon.',
      illustration: 'Milo looks at the moon.',
      motion: 'drift',
      imageUrl: 'data:image/png;base64,YWxyZWFkeQ==',
      videoUrl: 'blob:page-video',
      audioUrl: 'blob:narration',
    },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('portable story saves', () => {
  it('inlines generated blob media and reopens it as usable data URLs', async () => {
    const assets = new Map<string, Blob>([
      ['blob:cover', new Blob(['cover'], { type: 'image/png' })],
      ['blob:book-video', new Blob(['book'], { type: 'video/mp4' })],
      ['blob:page-video', new Blob(['clip'], { type: 'video/webm' })],
      ['blob:narration', new Blob(['voice'], { type: 'audio/mpeg' })],
    ]);
    const fetchMock = vi.fn<typeof fetch>(async (url) => {
      const asset = assets.get(String(url));
      return asset ? new Response(asset) : new Response('', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const portable = await makeStoryPortable(story);

    expect(portable.coverImageUrl).toBe('data:image/png;base64,Y292ZXI=');
    expect(portable.storyVideoUrl).toBe('data:video/mp4;base64,Ym9vaw==');
    expect(portable.pages[0].imageUrl).toBe(story.pages[0].imageUrl);
    expect(portable.pages[0].videoUrl).toBe('data:video/webm;base64,Y2xpcA==');
    expect(portable.pages[0].audioUrl).toBe('data:audio/mpeg;base64,dm9pY2U=');
    expect(fetchMock).toHaveBeenCalledTimes(4);

    const reopened = await openStoryFile(new File([JSON.stringify(portable)], 'milo.storyteller.json'));
    expect(reopened.pages[0].audioUrl).toBe(portable.pages[0].audioUrl);
    expect(reopened.pages[0].videoUrl).toBe(portable.pages[0].videoUrl);
  });

  it('fails clearly instead of saving dead object URLs', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(makeStoryPortable(story)).rejects.toThrow('generated assets is no longer available');
  });
});
