import type { Settings } from '../types';
import { describeHttpError } from './util';

/** Pre-generate narration audio for a block of text.
 *  Returns an object URL, or undefined when using live browser narration. */
export async function generateNarration(
  settings: Settings,
  text: string,
): Promise<string | undefined> {
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

/* ---------- Live browser narration (Web Speech API) ---------- */

let cachedVoices: SpeechSynthesisVoice[] = [];

export function primeBrowserVoices(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  cachedVoices = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

function pickWarmVoice(): SpeechSynthesisVoice | undefined {
  if (!cachedVoices.length) cachedVoices = window.speechSynthesis?.getVoices() ?? [];
  const en = cachedVoices.filter((v) => v.lang.startsWith('en'));
  const preferred = ['Samantha', 'Google US English', 'Jenny', 'Aria', 'Zira', 'Female'];
  for (const name of preferred) {
    const found = en.find((v) => v.name.includes(name));
    if (found) return found;
  }
  return en[0] ?? cachedVoices[0];
}

export interface BrowserNarration {
  speak: (text: string, opts?: { onEnd?: () => void; onBoundary?: (charIndex: number) => void }) => void;
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
      const voice = pickWarmVoice();
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
