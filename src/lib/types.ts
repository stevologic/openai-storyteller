import { z } from 'zod';

/* ---------- Story data model ---------- */

export const StoryPageSchema = z.object({
  /** A few-word poetic page header, storybook style. */
  header: z.string(),
  /** The prose read aloud on this page (2–5 sentences). */
  text: z.string(),
  /** A self-contained illustration prompt for the image model. */
  illustration: z.string(),
  /** How the camera should move over the art, for the cinematic reader. */
  motion: z.enum(['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'drift']).default('drift'),
});
export type StoryPage = z.infer<typeof StoryPageSchema>;

export const StorySchema = z.object({
  title: z.string(),
  /** One-line dedication, e.g. "For everyone who looks up at night." */
  dedication: z.string().default(''),
  /** Reading age band, echoed back for the cover. */
  ageRange: z.string().default('4–7'),
  /** Short consistent description of the hero, reused across every illustration. */
  characterBible: z.string().default(''),
  /** The art direction applied to every page (style, palette, medium). */
  artStyle: z.string().default(''),
  pages: z.array(StoryPageSchema).min(1),
  /** The gentle lesson, shown on the closing page. */
  moral: z.string().default(''),
});
export type Story = z.infer<typeof StorySchema>;

/** A story enriched with rendered media (data URLs / remote URLs). */
export interface RenderedPage extends StoryPage {
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  /** Demo-only: id of a bundled animated vector scene to render instead of an image. */
  sceneId?: string;
}
export interface RenderedStory extends Omit<Story, 'pages'> {
  coverImageUrl?: string;
  coverSceneId?: string;
  pages: RenderedPage[];
  createdAt: number;
  /** A whole-book video rendered during generation (object URL + filename). */
  storyVideoUrl?: string;
  storyVideoName?: string;
  /** Present only for the bundled demo; renders vector scenes instead of images. */
  demo?: boolean;
}

/* ---------- Creation brief ---------- */

export interface StoryBrief {
  idea: string;
  heroName: string;
  ageRange: string;
  artStyle: string;
  pageCount: number;
  lesson: string;
  tone: string;
}

/* ---------- Provider configuration ---------- */

export type TextProviderId = 'ondevice' | 'chrome' | 'transformers' | 'openai' | 'anthropic' | 'google';
export type ImageProviderId = 'procedural' | 'openai' | 'google' | 'none';
export type VideoProviderId = 'google' | 'openai' | 'none';
export type TtsProviderId = 'kokoro' | 'openai' | 'browser' | 'none';

export interface ProviderKeys {
  openai: string;
  anthropic: string;
  google: string;
}

export interface Settings {
  keys: ProviderKeys;
  text: { provider: TextProviderId; model: string };
  image: { provider: ImageProviderId; model: string };
  video: { provider: VideoProviderId; model: string; enabled: boolean };
  tts: { provider: TtsProviderId; model: string; voice: string };
  /** Render the whole book to a downloadable video while generating. */
  storyVideo: { enabled: boolean };
}

/* ---------- Model catalog entry ---------- */

export interface ModelOption {
  id: string;
  label: string;
  note?: string;
}
export interface ProviderCatalogEntry<TId extends string> {
  id: TId;
  label: string;
  keyField: keyof ProviderKeys | null;
  models: ModelOption[];
  docsUrl?: string;
}

export type GenerationStage =
  | 'idle'
  | 'writing'
  | 'illustrating'
  | 'animating'
  | 'narrating'
  | 'filming'
  | 'done'
  | 'error';

export interface GenerationProgress {
  stage: GenerationStage;
  message: string;
  /** 0..1 across the whole pipeline. */
  ratio: number;
}
