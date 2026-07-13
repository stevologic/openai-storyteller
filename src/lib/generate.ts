import { StorySchema, type GenerationProgress, type RenderedStory, type Settings, type Story, type StoryBrief } from './types';
import { generateJson } from './providers/text';
import { generateImage } from './providers/image';
import { generateVideo } from './providers/video';
import { generateNarration } from './providers/tts';
import { renderStoryToVideo, videoExportSupported } from './exportVideo';
import {
  buildWriterPrompt,
  WRITER_SYSTEM,
  composeIllustrationPrompt,
  composeCoverPrompt,
} from './prompts';

type ProgressFn = (p: GenerationProgress) => void;

/** Coerce a loosely-shaped page into schema, rather than failing outright. */
function coercePage(p: unknown, i: number): Record<string, unknown> {
  const o = (p ?? {}) as Record<string, unknown>;
  const text = String(o.text ?? o.body ?? o.content ?? '');
  return {
    header: String(o.header ?? o.title ?? `Page ${i + 1}`),
    text: text || 'And the story went on.',
    illustration: String(o.illustration ?? o.image ?? o.scene ?? text),
    motion: typeof o.motion === 'string' ? o.motion : 'drift',
  };
}

/** Write + validate the story text. */
export async function writeStory(
  settings: Settings,
  brief: StoryBrief,
  onProgress?: (msg: string) => void,
): Promise<Story> {
  const data = await generateJson(
    settings,
    {
      system: WRITER_SYSTEM,
      user: buildWriterPrompt(brief),
      json: true,
      maxTokens: 6000,
    },
    onProgress,
  );
  const parsed = StorySchema.safeParse(data);
  if (parsed.success) return parsed.data;

  // Coerce loosely-shaped output rather than failing outright.
  const loose = data as Record<string, unknown>;
  const rawPages = Array.isArray(loose.pages) ? loose.pages : Array.isArray(loose.story) ? loose.story : [];
  const coerced = StorySchema.safeParse({
    title: String(loose.title ?? brief.idea),
    dedication: String(loose.dedication ?? ''),
    ageRange: String(loose.ageRange ?? brief.ageRange),
    characterBible: String(loose.characterBible ?? loose.character ?? ''),
    artStyle: String(loose.artStyle ?? brief.artStyle),
    pages: rawPages.map(coercePage),
    moral: String(loose.moral ?? loose.lesson ?? brief.lesson ?? ''),
  });
  if (!coerced.success) {
    throw new Error('The story came back malformed. Try again, or pick a stronger text model in Settings.');
  }
  return coerced.data;
}

/** Full pipeline: text → cover → per-page illustration → (video) → (narration). */
export async function weaveStory(
  settings: Settings,
  brief: StoryBrief,
  onProgress: ProgressFn,
): Promise<RenderedStory> {
  onProgress({ stage: 'writing', message: 'Writing your story…', ratio: 0.04 });
  const story = await writeStory(settings, brief, (msg) =>
    onProgress({ stage: 'writing', message: msg, ratio: 0.05 }),
  );

  const doImages = settings.image.provider !== 'none';
  const doVideo = settings.video.enabled && settings.video.provider !== 'none';
  // Pre-render narration to audio (captured into the exported video) when a
  // cloud voice is selected. The live "browser" voice can't be captured.
  const doNarration = settings.tts.provider === 'openai';

  // Weight the progress bar across the stages we'll actually run.
  const imageUnits = doImages ? story.pages.length + 1 : 0; // pages + cover
  const videoUnits = doVideo ? story.pages.length : 0;
  const narrationUnits = doNarration ? story.pages.length : 0;
  const totalUnits = Math.max(1, imageUnits + videoUnits + narrationUnits);
  let done = 0;
  const bump = () => 0.1 + 0.85 * (done / totalUnits);

  const rendered: RenderedStory = {
    ...story,
    pages: story.pages.map((p) => ({ ...p })),
    createdAt: Date.now(),
  };

  rendered.language = brief.language;

  // A user-supplied character look (from a photo or typed) is authoritative —
  // it drives the character bible fused into every illustration prompt.
  if (brief.characterDescription?.trim()) {
    rendered.characterBible = brief.characterDescription.trim();
  }

  // Cover
  if (doImages) {
    onProgress({ stage: 'illustrating', message: 'Painting the cover…', ratio: bump() });
    try {
      rendered.coverImageUrl = await generateImage(
        settings,
        composeCoverPrompt(story.title, story.artStyle, story.characterBible),
        story.artStyle,
      );
    } catch (err) {
      console.warn('Cover generation failed:', err);
    }
    done++;
  }

  // Per-page illustrations
  if (doImages) {
    for (let i = 0; i < story.pages.length; i++) {
      onProgress({
        stage: 'illustrating',
        message: `Illustrating “${story.pages[i].header}” (${i + 1}/${story.pages.length})…`,
        ratio: bump(),
      });
      try {
        rendered.pages[i].imageUrl = await generateImage(
          settings,
          composeIllustrationPrompt(story.artStyle, story.characterBible, story.pages[i].illustration),
          story.artStyle,
        );
      } catch (err) {
        console.warn(`Illustration ${i + 1} failed:`, err);
      }
      done++;
    }
  }

  // Optional per-page video
  if (doVideo) {
    for (let i = 0; i < story.pages.length; i++) {
      onProgress({
        stage: 'animating',
        message: `Animating page ${i + 1} of ${story.pages.length}…`,
        ratio: bump(),
      });
      rendered.pages[i].videoUrl = await generateVideo(
        settings,
        composeIllustrationPrompt(story.artStyle, story.characterBible, story.pages[i].illustration),
        (msg) => onProgress({ stage: 'animating', message: `Page ${i + 1}: ${msg}`, ratio: bump() }),
      );
      done++;
    }
  }

  // Optional narration
  if (doNarration) {
    for (let i = 0; i < story.pages.length; i++) {
      onProgress({
        stage: 'narrating',
        message: `Narrating “${story.pages[i].header}” (${i + 1}/${story.pages.length})…`,
        ratio: bump(),
      });
      try {
        rendered.pages[i].audioUrl = await generateNarration(settings, story.pages[i].text, (msg) =>
          onProgress({ stage: 'narrating', message: msg, ratio: bump() }),
        );
      } catch (err) {
        console.warn(`Narration ${i + 1} failed:`, err);
      }
      done++;
    }
  }

  // Render the whole book to a downloadable video (MP4 where supported).
  if (settings.storyVideo?.enabled !== false && videoExportSupported()) {
    onProgress({ stage: 'filming', message: 'Filming your storybook…', ratio: 0.9 });
    try {
      const { blob, filename } = await renderStoryToVideo(
        rendered,
        (p) => onProgress({ stage: 'filming', message: p.message, ratio: 0.9 + 0.09 * p.ratio }),
        { preferMp4: true },
      );
      rendered.storyVideoUrl = URL.createObjectURL(blob);
      rendered.storyVideoName = filename;
    } catch (err) {
      console.warn('Story video render failed:', err);
    }
  }

  onProgress({ stage: 'done', message: 'Your storybook is ready.', ratio: 1 });
  return rendered;
}
