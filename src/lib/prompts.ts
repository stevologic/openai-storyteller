import type { StoryBrief } from './types';

export const WRITER_SYSTEM = `You are Storyteller AI, a beloved children's picture-book author and art director.
You write warm, musical, age-appropriate stories that a parent would treasure reading aloud.
Your writing is concrete, sensory, and kind. You avoid anything frightening, violent, commercial, or unsafe.
You are also an art director: you invent a single consistent visual identity for the hero and world,
and you describe each page's illustration so vividly that an image model can render it beautifully and consistently.`;

export function buildWriterPrompt(brief: StoryBrief): string {
  const hero = brief.heroName.trim() || 'the hero';
  const look = brief.characterDescription?.trim();
  return `Write an original illustrated children's picture book.

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

/** A short system + prompt for small on-device models with tiny context windows
 *  (Chrome Gemini Nano, Transformers.js) — the full prompt overflows them. */
export const WRITER_SYSTEM_COMPACT =
  'You write warm, safe, age-appropriate children’s stories. Reply with ONLY a single valid JSON object.';

export function buildWriterPromptCompact(brief: StoryBrief): string {
  const hero = brief.heroName.trim() || 'the hero';
  const look = brief.characterDescription?.trim();
  return `Write a ${brief.pageCount}-page children's picture book as JSON.
Idea: ${brief.idea}. Hero: ${hero}. Ages: ${brief.ageRange}. Tone: ${brief.tone}. Art style: ${brief.artStyle}.${
    look ? ` The hero looks like: ${look}.` : ''
}${brief.lesson ? ` Lesson: ${brief.lesson}.` : ''}
Return ONLY this JSON (exactly ${brief.pageCount} pages):
{"title":"","dedication":"","characterBible":"the hero's fixed look","artStyle":"${brief.artStyle}","pages":[{"header":"2-4 words","text":"2-3 sentences","illustration":"the scene, no words in the image","motion":"drift"}],"moral":"one warm sentence"}`;
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
