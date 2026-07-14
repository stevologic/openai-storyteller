import { createElement } from 'react';
import type { RenderedStory, YouTubeMetadata } from './types';
import { DemoScene } from '../sample/scenes';
import { buildYouTubeMetadata } from './youtube';

/* Renders a storybook to a .webm video fully in the browser: each page is drawn
   to a canvas with Ken Burns motion + text, an ambient pad (and pre-rendered
   narration audio when available) is mixed through Web Audio, and the whole
   thing is captured with MediaRecorder in real time. */

const CW = 1280;
const CH = 720;
const SERIF = 'Fraunces, Georgia, serif';
const MEDIA_LOAD_TIMEOUT_MS = 20_000;
const FONT_LOAD_TIMEOUT_MS = 5_000;

export type VideoProgress = (info: { message: string; ratio: number }) => void;

export function videoExportSupported(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    'captureStream' in HTMLCanvasElement.prototype
  );
}

interface Slide {
  kind: 'cover' | 'page' | 'end';
  eyebrow: string;
  title: string;
  sub: string;
  body: string;
  motion: string;
  img: HTMLImageElement | null;
  /** Optional generated page clip; it is drawn into the canvas export too. */
  video: HTMLVideoElement | null;
  audioUrl?: string;
  duration: number;
}

/* ---------- media helpers ---------- */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      if (error) reject(error);
      else resolve(img);
    };
    const timer = window.setTimeout(() => {
      img.src = '';
      finish(new Error('Image loading timed out.'));
    }, MEDIA_LOAD_TIMEOUT_MS);
    img.crossOrigin = 'anonymous';
    img.onload = () => finish();
    img.onerror = () => finish(new Error('Image failed to load.'));
    img.src = src;
  });
}

function loadVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      video.onloadeddata = null;
      video.onerror = null;
      if (error) reject(error);
      else resolve(video);
    };
    const timer = window.setTimeout(() => {
      video.pause();
      video.removeAttribute('src');
      video.load();
      finish(new Error('Video loading timed out.'));
    }, MEDIA_LOAD_TIMEOUT_MS);
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onloadeddata = () => finish();
    video.onerror = () => finish(new Error('Video failed to load.'));
    video.src = src;
    video.load();
  });
}

async function sceneImage(sceneId: string): Promise<HTMLImageElement | null> {
  try {
    const { renderToStaticMarkup } = await import('react-dom/server');
    let svg = renderToStaticMarkup(createElement(DemoScene, { sceneId }));
    if (!svg.includes('width=')) svg = svg.replace('<svg ', '<svg width="1600" height="900" ');
    return await loadImage('data:image/svg+xml,' + encodeURIComponent(svg));
  } catch {
    return null;
  }
}

async function resolveImage(url?: string, sceneId?: string): Promise<HTMLImageElement | null> {
  if (url) {
    try {
      return await loadImage(url);
    } catch {
      /* fall through to scene / null */
    }
  }
  if (sceneId) return sceneImage(sceneId);
  return null;
}

async function resolveVideo(url?: string): Promise<HTMLVideoElement | null> {
  if (!url) return null;
  try {
    return await loadVideo(url);
  } catch {
    return null;
  }
}

function audioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const a = new Audio();
    let settled = false;
    const cancelLoad = () => {
      a.pause();
      a.removeAttribute('src');
      a.load();
    };
    const finish = (duration = 5) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      a.onloadedmetadata = null;
      a.onerror = null;
      resolve(duration);
    };
    const timer = window.setTimeout(() => {
      finish();
      cancelLoad();
    }, MEDIA_LOAD_TIMEOUT_MS);
    a.preload = 'metadata';
    a.onloadedmetadata = () => finish(Number.isFinite(a.duration) && a.duration > 0 ? a.duration : 5);
    a.onerror = () => {
      finish();
      cancelLoad();
    };
    a.src = url;
  });
}

function waitFor<T>(promise: Promise<T>, timeoutMs: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(undefined), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      () => {
        window.clearTimeout(timer);
        resolve(undefined);
      },
    );
  });
}

function waitForResult<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Decode narration for capture without calling HTMLMediaElement.play(). That
 * keeps automatic exports from depending on a user-activation token that has
 * expired while the story's remote media was being generated. */
async function decodeNarration(context: AudioContext, url: string): Promise<AudioBuffer> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), MEDIA_LOAD_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Narration audio could not be loaded (${response.status}).`);
    const data = await response.arrayBuffer();
    return await waitForResult(
      context.decodeAudioData(data),
      MEDIA_LOAD_TIMEOUT_MS,
      'Narration audio decoding timed out.',
    );
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Narration audio loading timed out.');
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

function words(s: string): number {
  return (s.trim().match(/\S+/g) || []).length;
}
function slugify(s: string): string {
  return (
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'storyteller-story'
  );
}

/* ---------- slide model ---------- */

async function buildSlides(story: RenderedStory, onProgress: VideoProgress): Promise<Slide[]> {
  onProgress({ message: `Loading ${story.pages.length} page${story.pages.length === 1 ? '' : 's'} in parallel…`, ratio: 0.02 });
  let loadedPages = 0;
  const pageSlides = Promise.all(
    story.pages.map(async (page, index) => {
      const [img, video, narrationDuration] = await Promise.all([
        resolveImage(page.imageUrl, story.demo ? page.sceneId : undefined),
        resolveVideo(page.videoUrl),
        page.audioUrl ? audioDuration(page.audioUrl) : Promise.resolve(undefined),
      ]);
      loadedPages++;
      onProgress({
        message: `Loaded page ${index + 1} (${loadedPages}/${story.pages.length})…`,
        ratio: 0.02 + (0.3 * loadedPages) / Math.max(1, story.pages.length),
      });
      return {
        kind: 'page' as const,
        eyebrow: page.header,
        title: '',
        sub: '',
        body: page.text,
        // Let generated motion speak for itself rather than adding Ken Burns.
        motion: video ? 'still' : page.motion,
        img,
        video,
        audioUrl: page.audioUrl,
        duration: narrationDuration ? narrationDuration + 0.8 : Math.min(9, Math.max(4, words(page.text) * 0.34)),
      };
    }),
  );
  const coverImage = resolveImage(story.coverImageUrl, story.demo ? story.coverSceneId : undefined);
  const endImage = resolveImage(story.demo ? undefined : story.coverImageUrl, story.demo ? 'end' : undefined);
  const [cover, pages, end] = await Promise.all([coverImage, pageSlides, endImage]);

  return [
    {
      kind: 'cover',
      eyebrow: '',
      title: story.title,
      sub: story.dedication ?? '',
      body: '',
      motion: 'still',
      img: cover,
      video: null,
      duration: 4.5,
    },
    ...pages,
    {
      kind: 'end',
      eyebrow: '',
      title: 'The End',
      sub: story.moral ? `“${story.moral}”` : '',
      body: '',
      motion: 'drift',
      img: end,
      video: null,
      duration: 5,
    },
  ];
}

/* ---------- drawing ---------- */

function kenBurns(motion: string, t: number): { scale: number; ox: number; oy: number } {
  const e = t; // 0..1
  switch (motion) {
    case 'still':
      return { scale: 1, ox: 0, oy: 0 };
    case 'zoom-in':
      return { scale: 1.02 + 0.14 * e, ox: 0, oy: 0 };
    case 'zoom-out':
      return { scale: 1.16 - 0.14 * e, ox: 0, oy: 0 };
    case 'pan-left':
      return { scale: 1.12, ox: (0.5 - e) * CW * 0.08, oy: 0 };
    case 'pan-right':
      return { scale: 1.12, ox: (e - 0.5) * CW * 0.08, oy: 0 };
    default:
      return { scale: 1.08 + 0.06 * Math.sin(e * Math.PI), ox: (e - 0.5) * CW * 0.03, oy: 0 };
  }
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  video: HTMLVideoElement | null,
  motion: string,
  t: number,
): void {
  const media = video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA ? video : img;
  if (media) drawMedia(ctx, media, motion, t);
  else drawGradient(ctx);
}

function drawMedia(
  ctx: CanvasRenderingContext2D,
  media: HTMLImageElement | HTMLVideoElement,
  motion: string,
  t: number,
): void {
  const isVideo = 'videoWidth' in media;
  const iw = (isVideo ? media.videoWidth : media.naturalWidth) || CW;
  const ih = (isVideo ? media.videoHeight : media.naturalHeight) || CH;
  const { scale, ox, oy } = kenBurns(motion, t);
  const base = Math.max(CW / iw, CH / ih) * scale;
  const dw = iw * base;
  const dh = ih * base;
  const x = (CW - dw) / 2 + ox;
  const y = (CH - dh) / 2 + oy;
  if (isVideo) ctx.drawImage(media, x, y, dw, dh);
  else ctx.drawImage(media, x, y, dw, dh);
}

function drawGradient(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, 0, 0, CH);
  g.addColorStop(0, '#2a1c5c');
  g.addColorStop(1, '#0b0720');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CW, CH);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const w of para.split(/\s+/)) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        out.push(line);
        line = w;
      } else line = test;
    }
    if (line) out.push(line);
  }
  return out;
}

function drawLines(ctx: CanvasRenderingContext2D, lines: string[], cx: number, bottom: number, lh: number): number {
  let y = bottom - (lines.length - 1) * lh;
  for (const l of lines) {
    ctx.fillText(l, cx, y);
    y += lh;
  }
  return bottom - lines.length * lh;
}

function roundedPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
  ctx.fillStyle = 'rgba(15, 9, 34, 0.42)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.13)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function withGentleTextShadow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowColor = 'rgba(8, 3, 20, 0.9)';
  ctx.shadowBlur = 9;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
}

function drawSlide(ctx: CanvasRenderingContext2D, s: Slide, t: number, fade: number): void {
  ctx.fillStyle = '#05030f';
  ctx.fillRect(0, 0, CW, CH);
  ctx.save();
  ctx.globalAlpha = fade;

  drawCover(ctx, s.img, s.video, s.motion, t);

  // bottom scrim
  const g = ctx.createLinearGradient(0, CH * 0.4, 0, CH);
  g.addColorStop(0, 'rgba(3,2,12,0)');
  g.addColorStop(1, 'rgba(3,2,12,0.92)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CW, CH);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const cx = CW / 2;
  const maxW = CW * 0.82;

  if (s.kind === 'page') {
    ctx.font = `500 34px ${SERIF}`;
    const lines = wrap(ctx, s.body, maxW);
    const firstBaseline = CH - 70 - (lines.length - 1) * 46;
    const panelTop = firstBaseline - (s.eyebrow ? 74 : 42);
    roundedPanel(ctx, CW * 0.065, panelTop, CW * 0.87, CH - 30 - panelTop, 26);
    withGentleTextShadow(ctx);
    ctx.fillStyle = '#fdfbff';
    const top = drawLines(ctx, lines, cx, CH - 70, 46);
    if (s.eyebrow) {
      ctx.fillStyle = '#f4b860';
      ctx.font = `italic 600 24px ${SERIF}`;
      ctx.fillText(s.eyebrow, cx, top - 18);
    }
  } else if (s.kind === 'cover') {
    withGentleTextShadow(ctx);
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 68px ${SERIF}`;
    const lines = wrap(ctx, s.title, maxW);
    let top = drawLines(ctx, lines, cx, CH - 110, 72);
    if (s.sub) {
      ctx.fillStyle = '#eadfff';
      ctx.font = `italic 500 26px ${SERIF}`;
      const subs = wrap(ctx, s.sub, maxW);
      drawLines(ctx, subs, cx, CH - 60, 34);
    }
    if (s.eyebrow) {
      ctx.fillStyle = '#f4b860';
      ctx.font = `800 20px Nunito, sans-serif`;
      ctx.fillText(s.eyebrow.toUpperCase(), cx, top - 22);
    }
  } else {
    // end
    withGentleTextShadow(ctx);
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 84px ${SERIF}`;
    ctx.fillText(s.title, cx, CH / 2);
    if (s.sub) {
      ctx.fillStyle = '#eadfff';
      ctx.font = `italic 500 30px ${SERIF}`;
      const subs = wrap(ctx, s.sub, maxW);
      drawLines(ctx, subs, cx, CH / 2 + 90, 40);
    }
  }

  ctx.restore();
}

function fadeFor(localElapsed: number, duration: number): number {
  const f = 0.45;
  return Math.max(0, Math.min(1, localElapsed / f, (duration - localElapsed) / f));
}

function pickMime(preferMp4: boolean): string {
  const mp4 = [
    'video/mp4;codecs=avc1.640028,mp4a.40.2',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
  ];
  const webm = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const order = preferMp4 ? [...mp4, ...webm] : [...webm, ...mp4];
  for (const c of order) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

export interface VideoResult {
  blob: Blob;
  filename: string;
  mime: string;
  youtubeMetadata: YouTubeMetadata;
}

export interface VideoRenderOptions {
  preferMp4?: boolean;
  audio?: 'narration' | 'none';
  /** Context unlocked synchronously from the user's Create button, when one is available. */
  audioContext?: AudioContext;
}

/** Render the whole story to a video Blob (real-time capture). Prefers MP4
 *  (H.264/AAC) when the browser can record it, else falls back to WebM. */
export async function renderStoryToVideo(
  story: RenderedStory,
  onProgress: VideoProgress,
  opts: VideoRenderOptions = {},
): Promise<VideoResult> {
  if (!videoExportSupported()) throw new Error('Video export is not supported in this browser. Try Chrome, Edge, or Firefox.');

  onProgress({ message: 'Preparing…', ratio: 0 });
  const wantAudio = (opts.audio ?? 'narration') !== 'none';
  let actx: AudioContext | null = opts.audioContext ?? null;
  let resumeResult: Promise<boolean> | null = null;
  // This runs synchronously before the first await. For a manual export, it
  // preserves that button's user activation; automatic exports receive a
  // context unlocked by Studio when Create storybook was clicked.
  if (wantAudio && !actx) {
    const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtor) actx = new AudioCtor();
  }
  if (actx && actx.state !== 'running') {
    resumeResult = actx.resume().then(
      () => actx?.state === 'running',
      () => false,
    );
  }
  const audioBuffers = new Map<number, AudioBuffer>();
  const narrationSources = new Set<AudioBufferSourceNode>();
  let narrationDestination: MediaStreamAudioDestinationNode | null = null;
  let slides: Slide[] = [];
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;

  try {
  const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
  if (fonts?.ready) await waitFor(fonts.ready, FONT_LOAD_TIMEOUT_MS);

  slides = await buildSlides(story, onProgress);

  const canvas = document.createElement('canvas');
  canvas.width = CW;
  canvas.height = CH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create a drawing canvas.');

  // Audio: the selected narration voice only — no ambient/background track, so
  // the video is clean. Omit the audio track entirely for a silent file (or when
  // there's no narration), giving a social-ready, no-audio video.
  const hasNarration = slides.some((s) => s.audioUrl);
  const audioTracks: MediaStreamTrack[] = [];
  if (wantAudio && hasNarration) {
    if (!actx) {
      throw new Error('This browser cannot capture narration into the video. Export a silent video instead.');
    }
    const audioContext = actx;
    const narrationContextRunning = () => audioContext.state === 'running';
    if (!narrationContextRunning()) {
      const resumed = await (resumeResult ??
        audioContext.resume().then(
          () => actx?.state === 'running',
          () => false,
        ));
      if (!resumed || !narrationContextRunning()) {
        throw new Error('Narration capture needs a user click. Use “Re-generate video” from the final page to save a voiced video.');
      }
    }
    narrationDestination = audioContext.createMediaStreamDestination();
    onProgress({ message: 'Preparing narration for video…', ratio: 0.32 });
    await Promise.all(
      slides.map(async (slide, index) => {
        if (!slide.audioUrl) return;
        const buffer = await decodeNarration(audioContext, slide.audioUrl);
        audioBuffers.set(index, buffer);
        slide.duration = buffer.duration + 0.8;
      }),
    );
    if (!audioBuffers.size) throw new Error('Narration audio could not be prepared for this video.');
    audioTracks.push(...narrationDestination.stream.getAudioTracks());
  }

  const total = slides.reduce((sum, slide) => sum + slide.duration, 0);
  const youtubeMetadata = buildYouTubeMetadata(
    story,
    slides.map((slide, index) => ({
      label:
        slide.kind === 'cover'
          ? story.title
          : slide.kind === 'end'
            ? 'The End'
            : slide.eyebrow || `Page ${index}`,
      duration: slide.duration,
    })),
  );

  const videoStream = canvas.captureStream(30);
  const activeStream = new MediaStream([...videoStream.getVideoTracks(), ...audioTracks]);
  stream = activeStream;
  const mime = pickMime(opts.preferMp4 ?? true);
  const ext = mime.includes('mp4') ? 'mp4' : 'webm';
  const activeRecorder = new MediaRecorder(
    activeStream,
    mime ? { mimeType: mime, videoBitsPerSecond: 4_500_000 } : undefined,
  );
  recorder = activeRecorder;
  const chunks: BlobPart[] = [];
  let abortTimeline: ((error: Error) => void) | undefined;
  let recorderError: Error | undefined;
  activeRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const finished = new Promise<Blob>((resolve, reject) => {
    activeRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mime || 'video/webm' });
      if (!blob.size) {
        reject(new Error('The browser recorder finished without video data. Try exporting again.'));
        return;
      }
      resolve(blob);
    };
    activeRecorder.onerror = () => {
      const error = new Error('The browser video recorder failed.');
      recorderError = error;
      abortTimeline?.(error);
      reject(error);
    };
  });
  // The recorder can fail while the timeline is still running. Attach a
  // rejection handler immediately so it remains a visible, controlled error.
  void finished.catch(() => undefined);
  activeRecorder.start(250);

    // Draw the timeline in real time. A timer (not rAF) drives it so recording
    // keeps advancing even if the tab is backgrounded.
    await new Promise<void>((resolve, reject) => {
      const start = performance.now();
      const started = new Set<number>();
      const bounds: number[] = [];
      let activeVideo: HTMLVideoElement | null = null;
      let interval = 0;
      let complete = false;
      let acc = 0;
      for (const s of slides) {
        bounds.push(acc);
        acc += s.duration;
      }
      const finish = () => {
        if (complete) return;
        complete = true;
        activeVideo?.pause();
        window.clearInterval(interval);
        resolve();
      };
      const fail = (reason: unknown) => {
        if (complete) return;
        complete = true;
        activeVideo?.pause();
        window.clearInterval(interval);
        reject(reason instanceof Error ? reason : new Error('Video drawing failed.'));
      };
      abortTimeline = fail;
      if (recorderError) {
        fail(recorderError);
        return;
      }
      const tick = () => {
        try {
        const elapsed = (performance.now() - start) / 1000;
        if (elapsed >= total) {
          finish();
          return;
        }
        let idx = 0;
        while (idx < slides.length - 1 && elapsed >= bounds[idx + 1]) idx++;
        const s = slides[idx];
        const localElapsed = elapsed - bounds[idx];
        if (!started.has(idx)) {
          started.add(idx);
          const buffer = audioBuffers.get(idx);
          if (buffer) {
            if (!actx || !narrationDestination) throw new Error('Narration audio could not be mixed into this video.');
            const source = actx.createBufferSource();
            source.buffer = buffer;
            source.connect(narrationDestination);
            narrationSources.add(source);
            source.onended = () => narrationSources.delete(source);
            source.start(0);
          }
        }
        if (activeVideo !== s.video) {
          activeVideo?.pause();
          activeVideo = s.video;
          if (activeVideo) {
            try {
              activeVideo.currentTime = 0;
            } catch {
              /* The initial frame remains usable when seeking is unavailable. */
            }
            activeVideo.play().catch(() => {});
          }
        }
        drawSlide(ctx, s, Math.min(1, localElapsed / s.duration), fadeFor(localElapsed, s.duration));
        onProgress({ message: `Recording video… ${idx + 1}/${slides.length}`, ratio: 0.32 + 0.66 * (elapsed / total) });
        } catch (error) {
          fail(error);
        }
      };
      interval = window.setInterval(tick, 1000 / 30);
      tick();
    });

    abortTimeline = undefined;
    if (activeRecorder.state !== 'inactive') activeRecorder.stop();
    const blob = await waitForResult(
      finished,
      MEDIA_LOAD_TIMEOUT_MS,
      'The browser video recorder did not finish in time. Try exporting again.',
    );

    onProgress({ message: 'Done', ratio: 1 });
    return { blob, filename: `${slugify(story.title)}.${ext}`, mime: mime || 'video/webm', youtubeMetadata };
  } finally {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    narrationSources.forEach((source) => {
      try {
        source.stop();
      } catch {
        /* An already-ended source does not need cleanup. */
      }
    });
    slides.forEach((slide) => slide.video?.pause());
    stream?.getTracks().forEach((track) => track.stop());
    if (actx && actx.state !== 'closed') void actx.close().catch(() => {});
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
