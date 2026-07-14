import { describe, expect, it } from 'vitest';
import type { RenderedStory } from './types';
import { buildYouTubeMetadata, ensureYouTubeTitleEmoji, formatYouTubeTimestamp, youtubePackageText } from './youtube';

const story: RenderedStory = {
  title: 'Mina and the Moonlit Way',
  youtubeTitle: 'Mina and the Moonlit Way | A Gentle Story About Asking for Help',
  youtubeDescription: 'Follow Mina as a circle of fireflies helps her find the courage to ask for help.',
  youtubeHashtags: ['#KidsStories', 'Bedtime Stories', '#KidsStories', 'Moon Moth'],
  language: 'English (US)',
  dedication: 'For every small light finding its way.',
  ageRange: '4–7',
  characterBible: '',
  artStyle: '',
  moral: 'Asking for help can be brave.',
  createdAt: 1,
  pages: [],
};

describe('YouTube metadata', () => {
  it('uses the real cumulative slide durations for every timestamp', () => {
    const metadata = buildYouTubeMetadata(story, [
      { label: 'Mina and the Moonlit Way', duration: 4.5 },
      { label: 'A Light Goes Missing', duration: 7.2 },
      { label: 'Fireflies Together', duration: 8.4 },
      { label: 'The End', duration: 5 },
    ]);

    expect(metadata.timestamps).toBe(
      '0:00 Mina and the Moonlit Way\n0:05 A Light Goes Missing\n0:12 Fireflies Together\n0:20 The End',
    );
  });

  it('normalizes hashtags and builds one copyable package', () => {
    const metadata = buildYouTubeMetadata(story, [{ label: story.title, duration: 5 }]);

    expect(metadata.hashtags).toBe('#KidsStories #BedtimeStories #MoonMoth');
    expect(youtubePackageText(metadata)).toContain(`Slide timestamps\n0:00 ${story.title}`);
  });

  it('formats hour-long videos without dropping the hour', () => {
    expect(formatYouTubeTimestamp(3661)).toBe('1:01:01');
  });

  it('always includes emojis in the final YouTube title', () => {
    expect(ensureYouTubeTitleEmoji('A Gentle Bedtime Story')).toBe('A Gentle Bedtime Story 📚✨');
    expect(ensureYouTubeTitleEmoji('Moonlight Magic 🌙')).toBe('Moonlight Magic 🌙');
    expect(buildYouTubeMetadata(story, []).title).toMatch(/\p{Extended_Pictographic}/u);
  });
});
