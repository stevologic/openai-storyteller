import { StorySchema, type GenerationProgress, type RenderedStory, type Settings, type Story, type StoryBrief } from './types';
import { generateJson } from './providers/text';
import { generateImage } from './providers/image';
import { generateVideo } from './providers/video';
import { generateNarration } from './providers/tts';
import { renderStoryToVideo, videoExportSupported } from './exportVideo';
import { buildYouTubeMetadata } from './youtube';
import {
  buildWriterPrompt,
  buildYouTubePrompt,
  WRITER_SYSTEM,
  YOUTUBE_SYSTEM,
  composeIllustrationPrompt,
  composeCoverPrompt,
} from './prompts';

type ProgressFn = (p: GenerationProgress) => void;

export interface WeaveOptions {
  /** An AudioContext unlocked during the Create storybook click, when available. */
  audioContext?: AudioContext;
}

export interface ConcurrencyOptions {
  /** Stop before starting the next queued item when a related task has failed. */
  shouldStop?: () => boolean;
  /** Let parallel queues share one failure gate. */
  onError?: (error: unknown) => void;
}

/** Run independent requests in a bounded queue. A failed item prevents the
 * queue from starting further billable work, while already-running requests are
 * allowed to settle before its error reaches the caller. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
  options: ConcurrencyOptions = {},
): Promise<R[]> {
  const results = new Array<R>(items.length);
  if (!items.length) return results;

  let nextIndex = 0;
  let stopped = false;
  let firstError: unknown;
  const workerCount = Math.min(items.length, Math.max(1, Math.floor(concurrency)));
  const worker = async () => {
    while (!stopped && !options.shouldStop?.()) {
      const index = nextIndex++;
      if (index >= items.length) return;
      try {
        results[index] = await mapper(items[index], index);
      } catch (error) {
        firstError ??= error;
        stopped = true;
        options.onError?.(error);
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, worker));
  if (firstError) throw firstError;
  return results;
}

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
    youtubeTitle: String(loose.youtubeTitle ?? ''),
    youtubeDescription: String(loose.youtubeDescription ?? ''),
    youtubeHashtags: Array.isArray(loose.youtubeHashtags) ? loose.youtubeHashtags.map(String) : [],
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

function assertRequestedPageCount(story: Story, brief: StoryBrief): void {
  if (story.pages.length !== brief.pageCount) {
    throw new Error(
      `The writer returned ${story.pages.length} pages instead of the requested ${brief.pageCount}. No media was generated; please try again.`,
    );
  }
}

function estimatedPageDuration(text: string): number {
  const wordCount = (text.trim().match(/\S+/g) ?? []).length;
  return Math.min(9, Math.max(4, wordCount * 0.34));
}

/** Full pipeline: story and YouTube copy first, then independent illustration
 * and narration requests in bounded parallel queues. Video jobs run only after
 * those checks pass, one at a time within conservative provider limits. */
export async function weaveStory(
  settings: Settings,
  brief: StoryBrief,
  onProgress: ProgressFn,
  options: WeaveOptions = {},
): Promise<RenderedStory> {
  onProgress({ stage: 'writing', message: 'Writing your story…', ratio: 0.04 });
  const story = await writeStory(settings, brief, (message) =>
    onProgress({ stage: 'writing', message, ratio: 0.05 }),
  );
  assertRequestedPageCount(story, brief);

  const doImages = settings.image.provider !== 'none';
  const doVideo = settings.video.enabled && settings.video.provider !== 'none';
  // Cloud narration is captured into the downloadable video. Browser speech is
  // intentionally live-only and therefore has no generation request here.
  const doNarration = settings.tts.provider === 'openai' || settings.tts.provider === 'xai';
  const narrationSettings: Settings = {
    ...settings,
    keys: { ...settings.keys },
    tts: { ...settings.tts },
  };
  const characterBible = brief.characterDescription?.trim() || story.characterBible;
  const rendered: RenderedStory = {
    ...story,
    characterBible,
    pages: story.pages.map((page) => ({ ...page })),
    createdAt: Date.now(),
    language: brief.language,
  };

  const imageUnits = doImages ? story.pages.length + 1 : 0;
  const videoUnits = doVideo ? story.pages.length : 0;
  const narrationUnits = doNarration ? story.pages.length : 0;
  const totalUnits = Math.max(1, 1 + imageUnits + videoUnits + narrationUnits); // YouTube copy + media
  let completedUnits = 0;
  let furthestRatio = 0.1;
  const report = (stage: GenerationProgress['stage'], message: string) => {
    const ratio = 0.1 + 0.76 * (completedUnits / totalUnits);
    furthestRatio = Math.max(furthestRatio, ratio);
    onProgress({ stage, message, ratio: furthestRatio });
  };
  const complete = (stage: GenerationProgress['stage'], message: string) => {
    completedUnits++;
    report(stage, message);
  };
  // Validate the dedicated YouTube model before launching paid media requests.
  // This keeps a revoked/invalid publishing key from starting a batch of art,
  // voice, and video work that can never produce a complete book.
  report('writing', 'Writing the YouTube title and description…');
  const youtubeSettings: Settings = { ...settings, text: { ...settings.youtube } };
  const youtube = await generateJson<Record<string, unknown>>(youtubeSettings, {
    system: YOUTUBE_SYSTEM,
    user: buildYouTubePrompt(story, brief.language),
    json: true,
    maxTokens: 900,
  });
  rendered.youtubeTitle = String(youtube.youtubeTitle ?? '').trim();
  rendered.youtubeDescription = String(youtube.youtubeDescription ?? '').trim();
  rendered.youtubeHashtags = Array.isArray(youtube.youtubeHashtags)
    ? youtube.youtubeHashtags.map(String).filter(Boolean)
    : [];
  complete('writing', 'YouTube package is ready.');

  const controller = new AbortController();
  let pipelineStopped = false;
  let pipelineError: unknown;
  const stopPipeline = (error?: unknown) => {
    pipelineStopped = true;
    pipelineError ??= error;
    if (!controller.signal.aborted) controller.abort();
  };
  const queueOptions: ConcurrencyOptions = {
    shouldStop: () => pipelineStopped,
    onError: stopPipeline,
  };
  const jobs: Promise<unknown>[] = [];

  if (doImages) {
    const imageJobs = [
      {
        label: 'the cover',
        prompt: composeCoverPrompt(story.title, story.artStyle, characterBible),
        save: (url: string) => {
          rendered.coverImageUrl = url;
        },
      },
      ...story.pages.map((page, index) => ({
        label: `“${page.header}” (${index + 1}/${story.pages.length})`,
        prompt: composeIllustrationPrompt(story.artStyle, characterBible, page.illustration),
        save: (url: string) => {
          rendered.pages[index].imageUrl = url;
        },
      })),
    ];
    jobs.push(
      mapWithConcurrency(imageJobs, 3, async (job) => {
        report('illustrating', `Painting ${job.label}…`);
        const url = await generateImage(settings, job.prompt, story.artStyle, controller.signal);
        if (!url) throw new Error(`The illustration for ${job.label} did not return an image.`);
        job.save(url);
        complete('illustrating', `Painted ${job.label}.`);
      }, queueOptions),
    );
  }

  if (doNarration) {
    jobs.push(
      mapWithConcurrency(story.pages, 3, async (page, index) => {
        report('narrating', `Narrating “${page.header}” (${index + 1}/${story.pages.length})…`);
        const url = await generateNarration(
          narrationSettings,
          page.text,
          (message) => report('narrating', message),
          controller.signal,
        );
        if (!url) throw new Error(`Narration did not return audio for page ${index + 1}.`);
        rendered.pages[index].audioUrl = url;
        complete('narrating', `Narrated page ${index + 1} of ${story.pages.length}.`);
      }, queueOptions),
    );
  }

  // A shared AbortController stops in-flight image/narration fetches promptly
  // after a sibling fails, and each queue declines to start its remaining work.
  const outcomes = await Promise.allSettled(jobs);
  if (pipelineError) throw pipelineError;
  const failed = outcomes.find((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
  if (failed) throw failed.reason;

  // Page-video jobs are expensive and can poll for several minutes. Start them
  // only after artwork and narration are healthy; those two API groups still
  // run together above, while this conservative queue prevents a known failed
  // book from continuing to create videos.
  if (doVideo) {
    await mapWithConcurrency(story.pages, 1, async (page, index) => {
      report('animating', `Animating page ${index + 1} of ${story.pages.length}…`);
      const url = await generateVideo(
        settings,
        composeIllustrationPrompt(story.artStyle, characterBible, page.illustration),
        (message) => report('animating', `Page ${index + 1}: ${message}`),
      );
      if (!url) throw new Error(`Video generation did not return a clip for page ${index + 1}.`);
      rendered.pages[index].videoUrl = url;
      complete('animating', `Animated page ${index + 1} of ${story.pages.length}.`);
    });
  }

  // Publishing copy remains available even when the optional local export is
  // off or a browser recorder cannot complete. A successful renderer replaces
  // these estimated timings with exact media durations below.
  rendered.youtubeMetadata = buildYouTubeMetadata(rendered, [
    { label: rendered.title, duration: 4.5 },
    ...rendered.pages.map((page, index) => ({
      label: page.header || `Page ${index + 1}`,
      duration: estimatedPageDuration(page.text),
    })),
    { label: 'The End', duration: 5 },
  ]);

  if (settings.storyVideo?.enabled !== false && videoExportSupported()) {
    onProgress({ stage: 'filming', message: 'Filming your storybook…', ratio: 0.9 });
    try {
      const { blob, filename, youtubeMetadata } = await renderStoryToVideo(
        rendered,
        (progress) => onProgress({ stage: 'filming', message: progress.message, ratio: 0.9 + 0.09 * progress.ratio }),
        { preferMp4: true, audioContext: options.audioContext },
      );
      rendered.storyVideoUrl = URL.createObjectURL(blob);
      rendered.storyVideoName = filename;
      rendered.youtubeMetadata = youtubeMetadata;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The browser could not render the downloadable video.';
      rendered.generationWarnings = [`Video export was skipped: ${message}`];
    }
  }

  onProgress({ stage: 'done', message: 'Your storybook is ready.', ratio: 1 });
  return rendered;
}
