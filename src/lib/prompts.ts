import type { StoryBrief } from './types';

export const WRITER_SYSTEM = `You are Tiny Book Buddies AI, a beloved children's picture-book author and art director.
You write warm, musical, age-appropriate stories that a parent would treasure reading aloud.
Your writing is concrete, sensory, and kind. You avoid anything frightening, violent, commercial, or unsafe.
You are also an art director: you invent a single consistent visual identity for the hero and world,
and you describe each page's illustration so vividly that an image model can render it beautifully and consistently.`;

export function buildWriterPrompt(brief: StoryBrief): string {
  const hero = brief.heroName.trim() || 'the hero';
  const look = brief.characterDescription?.trim();
  const lang = brief.language || 'English (US)';
  return `Write an original illustrated children's picture book.

Write ALL text (title, dedication, page prose, moral) in ${lang}. Keep the JSON keys in English, and write the "illustration" scene descriptions in English (they go to an image model). Everything the reader sees must be in ${lang}.

BRIEF
- Big idea: ${brief.idea}
- Hero's name: ${hero}
- Reading age: ${brief.ageRange}
- Desired length: ${brief.pageCount} illustrated pages (spreads)
- Tone: ${brief.tone}
- Gentle lesson to land softly by the end: ${brief.lesson || 'let it emerge naturally'}
- Art style for every illustration: ${brief.artStyle}
${look ? `- The hero's exact appearance (use this — do not invent a different look): ${look}` : ''}

REQUIREMENTS
1. Give it a short, evocative TITLE.
2. Write a one-line DEDICATION in the spirit of the story.
3. Write a "characterBible": 2–3 sentences fixing the hero's exact, unchanging appearance
   (species/kind, age, hair, clothing colors, distinctive features). This EXACT text will be pasted
   into every illustration prompt to keep the character identical across pages, so be specific and concise.
   ${look ? 'Base it faithfully on the appearance given in the brief above.' : ''}
4. Restate the "artStyle" as one tight art-direction sentence (medium, palette, lighting, mood).
5. Write exactly ${brief.pageCount} pages. Each page has:
   - "header": 2–5 words, lyrical, like an old storybook chapter title (no character names).
   - "text": 2–4 sentences of story prose to be read aloud on this spread. Simple, rhythmic, vivid.
   - "illustration": a rich, self-contained scene description of ONE moment (setting, action, emotion,
     time of day, composition). Do NOT restate the art style or character bible here — just the scene.
     Never ask for text/words/letters in the image.
   - "motion": one of "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "drift" — the camera move
     that best suits this moment.
6. End with a short "moral": one warm sentence stating the gentle lesson.

Return ONLY a JSON object with this exact shape:
{
  "title": string,
  "dedication": string,
  "ageRange": string,
  "characterBible": string,
  "artStyle": string,
  "pages": [{ "header": string, "text": string, "illustration": string, "motion": string }],
  "moral": string
}`;
}

/** Compose the final illustration prompt sent to the image model, fusing the
 *  global art direction + character bible with the per-page scene. */
export function composeIllustrationPrompt(
  artStyle: string,
  characterBible: string,
  scene: string,
): string {
  return [
    artStyle.trim(),
    characterBible.trim() ? `The recurring character, kept identical every time: ${characterBible.trim()}` : '',
    `Scene: ${scene.trim()}`,
    'Full-bleed children’s picture-book illustration, rich background, cinematic composition.',
    'Absolutely no text, no words, no letters, no captions, no watermark anywhere in the image.',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Cover art prompt — a poster-like establishing shot. */
export function composeCoverPrompt(
  title: string,
  artStyle: string,
  characterBible: string,
): string {
  return [
    artStyle.trim(),
    characterBible.trim() ? `Hero: ${characterBible.trim()}.` : '',
    `A gorgeous book-cover establishing shot that captures the spirit of a story titled “${title}”.`,
    'Hero centered and charming, magical inviting background, poster composition, plenty of sky/negative space at the top.',
    'No text, no words, no letters, no title typography in the image.',
  ]
    .filter(Boolean)
    .join(' ');
}
