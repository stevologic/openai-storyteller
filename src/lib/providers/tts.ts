import type { Settings } from '../types';
import { describeHttpError, type OnProgress } from './util';

/** Pre-generate narration audio for a block of text.
 *  Returns an object URL, or undefined when narration plays live / is off. */
export async function generateNarration(
  settings: Settings,
  text: string,
  _onProgress?: OnProgress,
): Promise<string | undefined> {
  if (settings.tts.provider === 'xai') return xaiNarration(settings, text);
  if (settings.tts.provider !== 'openai') return undefined; // 'browser' narrates live; 'none' is silent
  const key = settings.keys.openai;
  if (!key) throw new Error('Add your OpenAI API key in Settings to generate narration.');
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: settings.tts.model,
      voice: settings.tts.voice,
      input: text,
      response_format: 'mp3',
      instructions: 'Read warmly and slowly, like a bedtime story for a young child.',
    }),
  });
  if (!res.ok) throw await describeHttpError(res, 'OpenAI Speech');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

async function xaiNarration(settings: Settings, text: string): Promise<string> {
  const key = settings.keys.xai;
  if (!key) throw new Error('Add your xAI API key in Settings to generate narration.');
  const res = await fetch('https://api.x.ai/v1/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      text,
      voice_id: settings.tts.voice,
      language: 'auto',
      output_format: { codec: 'mp3', sample_rate: 24000, bit_rate: 128000 },
    }),
  });
  if (!res.ok) throw await describeHttpError(res, 'xAI Grok Voice');
  return URL.createObjectURL(await res.blob());
}

/* ---------- Live browser narration (Web Speech API) ---------- */

let cachedVoices: SpeechSynthesisVoice[] = [];

export function primeBrowserVoices(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  cachedVoices = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

function pickWarmVoice(lang = 'en-US'): SpeechSynthesisVoice | undefined {
  if (!cachedVoices.length) cachedVoices = window.speechSynthesis?.getVoices() ?? [];
  const base = lang.slice(0, 2).toLowerCase();
  const matching = cachedVoices.filter((v) => v.lang.toLowerCase().startsWith(base));
  if (base === 'en') {
    // Prefer warm American voices for the free English narration.
    const preferred = ['Samantha', 'Google US English', 'Jenny', 'Aria', 'Zira', 'Female'];
    for (const name of preferred) {
      const found = matching.find((v) => v.name.includes(name));
      if (found) return found;
    }
  }
  return matching[0] ?? cachedVoices[0];
}

export interface BrowserNarration {
  speak: (text: string, opts?: { onEnd?: () => void; onBoundary?: (charIndex: number) => void; lang?: string }) => void;
  cancel: () => void;
  supported: boolean;
}

export function browserNarration(): BrowserNarration {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  return {
    supported,
    speak(text, opts) {
      if (!supported) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const lang = opts?.lang || 'en-US';
      u.lang = lang;
      const voice = pickWarmVoice(lang);
      if (voice) u.voice = voice;
      u.rate = 0.92;
      u.pitch = 1.05;
      if (opts?.onEnd) u.onend = opts.onEnd;
      if (opts?.onBoundary) u.onboundary = (e) => opts.onBoundary!(e.charIndex);
      window.speechSynthesis.speak(u);
    },
    cancel() {
      if (supported) window.speechSynthesis.cancel();
    },
  };
}
