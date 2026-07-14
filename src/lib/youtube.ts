import type { RenderedStory, YouTubeMetadata } from './types';

export interface YouTubeChapterInput {
  label: string;
  duration: number;
}

export function formatYouTubeTimestamp(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${minutes}:${String(secs).padStart(2, '0')}`;
}

function normalizeHashtag(value: string): string {
  const words = value
    .trim()
    .replace(/^#+/, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  const clean = words.join('').replace(/[^\p{L}\p{N}_]/gu, '');
  return clean ? `#${clean}` : '';
}

const EMOJI_RE = /\p{Extended_Pictographic}/u;

/** Models occasionally ignore formatting requests; guarantee that every final
 * YouTube title includes a small, family-friendly emoji treatment. */
export function ensureYouTubeTitleEmoji(value: string): string {
  const title = value.trim();
  if (EMOJI_RE.test(title)) return title;
  const suffix = ' 📚✨';
  return `${title.slice(0, Math.max(0, 90 - suffix.length)).trimEnd()}${suffix}`;
}

export function buildYouTubeMetadata(
  story: RenderedStory,
  chapters: YouTubeChapterInput[],
): YouTubeMetadata {
  let elapsed = 0;
  const timestamps = chapters.map((chapter) => {
    const line = `${formatYouTubeTimestamp(elapsed)} ${chapter.label}`;
    elapsed += Math.max(0, chapter.duration);
    return line;
  });

  const fallbackDescription = [story.dedication, story.moral].filter(Boolean).join(' ');
  const requestedTags = story.youtubeHashtags?.length
    ? story.youtubeHashtags
    : ['KidsStories', 'BedtimeStories', 'Storytime', 'ChildrensBooks', 'TinyBookBuddies'];
  const seen = new Set<string>();
  const hashtags = requestedTags
    .map(normalizeHashtag)
    .filter((tag) => {
      const key = tag.toLocaleLowerCase();
      if (!tag || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);

  return {
    title: ensureYouTubeTitleEmoji(story.youtubeTitle?.trim() || story.title),
    description: story.youtubeDescription?.trim() || fallbackDescription || story.title,
    timestamps: timestamps.join('\n'),
    hashtags: hashtags.join(' '),
  };
}

export function youtubePackageText(metadata: YouTubeMetadata): string {
  return [
    metadata.title,
    metadata.description,
    `Slide timestamps\n${metadata.timestamps}`,
    metadata.hashtags,
  ]
    .filter(Boolean)
    .join('\n\n');
}
