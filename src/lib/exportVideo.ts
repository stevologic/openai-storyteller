import { createElement } from 'react';
import type { RenderedStory } from './types';
import { DemoScene } from '../sample/scenes';

/* Renders a storybook to a .webm video fully in the browser: each page is drawn
   to a canvas with Ken Burns motion + text, an ambient pad (and pre-rendered
   narration audio when available) is mixed through Web Audio, and the whole
   thing is captured with MediaRecorder in real time. */

const CW = 1280;
const CH = 720;
const SERIF = 'Fraunces, Georgia, serif';

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
  audioUrl?: string;
  duration: number;
}

/* ---------- media helpers ---------- */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image failed to load'));
    img.src = src;
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

function audioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = 'metadata';
    a.onloadedmetadata = () => resolve(Number.isFinite(a.duration) && a.duration > 0 ? a.duration : 5);
    a.onerror = () => resolve(5);
    a.src = url;
  });
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
  const slides: Slide[] = [];
  onProgress({ message: 'Loading art…', ratio: 0.02 });

  slides.push({
    kind: 'cover',
    eyebrow: story.ageRange ? `Ages ${story.ageRange}` : '',
    title: story.title,
    sub: story.dedication ?? '',
    body: '',
    motion: 'zoom-in',
    img: await resolveImage(story.coverImageUrl, story.demo ? story.coverSceneId : undefined),
    duration: 4.5,
  });

  for (let i = 0; i < story.pages.length; i++) {
    const p = story.pages[i];
    onProgress({ message: `Loading page ${i + 1}…`, ratio: 0.02 + (0.3 * i) / story.pages.length });
    const dur = p.audioUrl ? (await audioDuration(p.audioUrl)) + 0.8 : Math.min(9, Math.max(4, words(p.text) * 0.34));
    slides.push({
      kind: 'page',
      eyebrow: p.header,
      title: '',
      sub: '',
      body: p.text,
      motion: p.motion,
      img: await resolveImage(p.imageUrl, story.demo ? p.sceneId : undefined),
      audioUrl: p.audioUrl,
      duration: dur,
    });
  }

  slides.push({
    kind: 'end',
    eyebrow: '',
    title: 'The End',
    sub: story.moral ? `“${story.moral}”` : '',
    body: '',
    motion: 'drift',
    img: await resolveImage(story.demo ? undefined : story.coverImageUrl, story.demo ? 'end' : undefined),
    duration: 5,
  });

  return slides;
}

/* ---------- drawing ---------- */

function kenBurns(motion: string, t: number): { scale: number; ox: number; oy: number } {
  const e = t; // 0..1
  switch (motion) {
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

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, motion: string, t: number): void {
  if (img) drawMedia(ctx, img, motion, t);
  else drawGradient(ctx);
}

function drawMedia(ctx: CanvasRenderingContext2D, img: HTMLImageElement, motion: string, t: number): void {
  const iw = img.naturalWidth || CW;
  const ih = img.naturalHeight || CH;
  const { scale, ox, oy } = kenBurns(motion, t);
  const base = Math.max(CW / iw, CH / ih) * scale;
  const dw = iw * base;
  const dh = ih * base;
  ctx.drawImage(img, (CW - dw) / 2 + ox, (CH - dh) / 2 + oy, dw, dh);
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

function drawSlide(ctx: CanvasRenderingContext2D, s: Slide, t: number, fade: number): void {
  ctx.fillStyle = '#05030f';
  ctx.fillRect(0, 0, CW, CH);
  ctx.save();
  ctx.globalAlpha = fade;

  drawCover(ctx, s.img, s.motion, t);

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
    ctx.fillStyle = '#fdfbff';
    ctx.font = `500 34px ${SERIF}`;
    const lines = wrap(ctx, s.body, maxW);
    const top = drawLines(ctx, lines, cx, CH - 70, 46);
    if (s.eyebrow) {
      ctx.fillStyle = '#f4b860';
      ctx.font = `italic 600 24px ${SERIF}`;
      ctx.fillText(s.eyebrow, cx, top - 18);
    }
  } else if (s.kind === 'cover') {
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

/* ---------- ambient pad routed to the recording ---------- */

function startAmbient(actx: AudioContext, dest: AudioNode): { stop: () => void } {
  const master = actx.createGain();
  master.gain.value = 0;
  master.connect(dest);

  const filter = actx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 700;
  filter.connect(master);

  const nodes: AudioNode[] = [filter, master];
  [130.81, 196.0, 293.66, 329.63].forEach((f, i) => {
    const osc = actx.createOscillator();
    osc.type = i % 2 === 0 ? 'sine' : 'triangle';
    osc.frequency.value = f;
    osc.detune.value = (i - 1.5) * 4;
    const g = actx.createGain();
    g.gain.value = 0.1 / 4;
    osc.connect(g).connect(filter);
    osc.start();
    nodes.push(osc, g);
  });
  master.gain.setTargetAtTime(0.5, actx.currentTime, 1.2);

  return {
    stop() {
      master.gain.setTargetAtTime(0, actx.currentTime, 0.3);
      nodes.forEach((n) => {
        try {
          (n as OscillatorNode).stop?.();
        } catch {
          /* ignore */
        }
        n.disconnect();
      });
    },
  };
}

function pickMime(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

export interface VideoResult {
  blob: Blob;
  filename: string;
}

/** Render the whole story to a video Blob (real-time capture). */
export async function renderStoryToVideo(story: RenderedStory, onProgress: VideoProgress): Promise<VideoResult> {
  if (!videoExportSupported()) throw new Error('Video export is not supported in this browser. Try Chrome, Edge, or Firefox.');

  onProgress({ message: 'Preparing…', ratio: 0 });
  try {
    await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
  } catch {
    /* fonts optional */
  }

  const slides = await buildSlides(story, onProgress);
  const total = slides.reduce((a, s) => a + s.duration, 0);

  const canvas = document.createElement('canvas');
  canvas.width = CW;
  canvas.height = CH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create a drawing canvas.');

  const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const actx = new AudioCtor();
  await actx.resume().catch(() => {});
  const dest = actx.createMediaStreamDestination();
  const ambient = startAmbient(actx, dest);

  // Narration audio (only pre-rendered clips can be captured; browser TTS cannot).
  const audioEls = new Map<number, HTMLAudioElement>();
  slides.forEach((s, i) => {
    if (!s.audioUrl) return;
    try {
      const a = new Audio(s.audioUrl);
      a.crossOrigin = 'anonymous';
      const src = actx.createMediaElementSource(a);
      src.connect(dest);
      src.connect(actx.destination);
      audioEls.set(i, a);
    } catch {
      /* skip narration for this page */
    }
  });

  const videoStream = canvas.captureStream(30);
  const stream = new MediaStream([...videoStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const mime = pickMime();
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 4_500_000 } : undefined);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const finished = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime || 'video/webm' }));
  });
  recorder.start(250);

  // Draw the timeline in real time. A timer (not rAF) drives it so recording
  // keeps advancing even if the tab is backgrounded.
  await new Promise<void>((resolve) => {
    const start = performance.now();
    const started = new Set<number>();
    const bounds: number[] = [];
    let acc = 0;
    for (const s of slides) {
      bounds.push(acc);
      acc += s.duration;
    }
    const tick = () => {
      const elapsed = (performance.now() - start) / 1000;
      if (elapsed >= total) {
        window.clearInterval(iv);
        resolve();
        return;
      }
      let idx = 0;
      while (idx < slides.length - 1 && elapsed >= bounds[idx + 1]) idx++;
      const s = slides[idx];
      const localElapsed = elapsed - bounds[idx];
      if (!started.has(idx)) {
        started.add(idx);
        audioEls.get(idx)?.play().catch(() => {});
      }
      drawSlide(ctx, s, Math.min(1, localElapsed / s.duration), fadeFor(localElapsed, s.duration));
      onProgress({ message: `Recording video… ${idx + 1}/${slides.length}`, ratio: 0.32 + 0.66 * (elapsed / total) });
    };
    const iv = window.setInterval(tick, 1000 / 30);
    tick();
  });

  recorder.stop();
  const blob = await finished;

  audioEls.forEach((a) => a.pause());
  ambient.stop();
  setTimeout(() => actx.close().catch(() => {}), 300);

  onProgress({ message: 'Done', ratio: 1 });
  return { blob, filename: `${slugify(story.title)}.webm` };
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
