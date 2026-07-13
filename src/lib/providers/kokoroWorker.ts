/* On-device neural narration (Kokoro TTS) in a Web Worker. Produces real audio
   (WAV) so the selected voice can be played in the reader AND captured into the
   exported video. Weights stream from the Hugging Face hub on first use. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { KokoroTTS } from 'kokoro-js';

let ttsPromise: Promise<any> | null = null;
let loadedKey = '';

const post = (m: any, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(m, transfer);

async function getTTS(model: string, dtype: any): Promise<any> {
  const key = `${model}:${dtype}`;
  if (ttsPromise && loadedKey === key) return ttsPromise;
  loadedKey = key;
  const device = (navigator as any).gpu ? 'webgpu' : 'wasm';
  ttsPromise = KokoroTTS.from_pretrained(model, {
    dtype,
    device,
    progress_callback: (p: any) => {
      if (p.status === 'progress' && typeof p.progress === 'number') {
        post({ type: 'progress', message: `Downloading voice model — ${Math.round(p.progress)}%` });
      } else if (p.status === 'ready') {
        post({ type: 'progress', message: `Voice ready (${device}) — narrating…` });
      }
    },
  }).catch((err: any) => {
    ttsPromise = null;
    throw err;
  });
  return ttsPromise;
}

self.onmessage = async (e: MessageEvent) => {
  const { id, text, voice, model, dtype } = e.data ?? {};
  try {
    const tts = await getTTS(model, dtype);
    const audio = await tts.generate(text, { voice });
    const wav: ArrayBuffer = audio.toWav();
    post({ type: 'result', id, wav }, [wav]);
  } catch (err: any) {
    post({ type: 'error', id, message: err?.message ?? String(err) });
  }
};
/* eslint-enable @typescript-eslint/no-explicit-any */
