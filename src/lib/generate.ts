import { StorySchema, type GenerationProgress, type RenderedStory, type Settings, type Story, type StoryBrief } from './types';
import { generateJson } from './providers/text';
import { generateImage } from './providers/image';
import { generateVideo } from './providers/video';
import { generateNarration } from './providers/tts';
import { buildWriterPrompt, WRITER_SYSTEM, composeIllustrationPrompt, composeCoverPrompt } from './prompts';

type ProgressFn = (p: GenerationProgress) => void;

/** Write + validate the story text. */
export async function writeStory(settings: Settings, brief: StoryBrief): Promise<Story> {
  const data = await generateJson(settings, {
    system: WRITER_SYSTEM,
    user: buildWriterPrompt(brief),
    json: true,
    maxTokens: 6000,
  });
  const parsed = StorySchema.safeParse(data);
  if (!parsed.success) {
    // Coerce loosely-shaped output rather than failing outright.
    const loose = data as Record<string, unknown>;
    const coerced = StorySchema.safeParse({
      title: String(loose.title ?? brief.idea),
      dedication: String(loose.dedication ?? ''),
      ageRange: String(loose.ageRange ?? brief.ageRange),
      characterBible: String(loose.characterBible ?? ''),
      artStyle: String(loose.artStyle ?? brief.artStyle),
      pages: Array.isArray(loose.pages) ? loose.pages : [],
      moral: String(loose.moral ?? brief.lesson ?? ''),
    });
    if (!coerced.success) {
      throw new Error('The story came back malformed. Try again, or switch to a stronger text model.');
    }
    return coerced.data;
  }
  return parsed.data;
}

/** Full pipeline: text → cover → per-page illustration → (video) → (narration). */
export async function weaveStory(
  settings: Settings,
  brief: StoryBrief,
  onProgress: ProgressFn,
): Promise<RenderedStory> {
  onProgress({ stage: 'writing', message: 'Writing your story…', ratio: 0.04 });
  const story = await writeStory(settings, brief);

  const doImages = settings.image.provider !== 'none';
  const doVideo = settings.video.enabled && settings.video.provider !== 'none';
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

  // Cover
  if (doImages) {
    onProgress({ stage: 'illustrating', message: 'Painting the cover…', ratio: bump() });
    try {
      rendered.coverImageUrl = await generateImage(
        settings,
        composeCoverPrompt(story.title, story.artStyle, story.characterBible),
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
        message: `Illustrating page ${i + 1} of ${story.pages.length}…`,
        ratio: bump(),
      });
      try {
        rendered.pages[i].imageUrl = await generateImage(
          settings,
          composeIllustrationPrompt(story.artStyle, story.characterBible, story.pages[i].illustration),
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
        message: `Recording narration ${i + 1} of ${story.pages.length}…`,
        ratio: bump(),
      });
      try {
        rendered.pages[i].audioUrl = await generateNarration(settings, story.pages[i].text);
      } catch (err) {
        console.warn(`Narration ${i + 1} failed:`, err);
      }
      done++;
    }
  }

  onProgress({ stage: 'done', message: 'Your storybook is ready.', ratio: 1 });
  return rendered;
}
