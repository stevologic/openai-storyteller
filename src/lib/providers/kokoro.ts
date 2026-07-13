/* Main-thread client for the Kokoro narration worker. Returns an object URL to
   a WAV clip of the synthesized speech. */
import type { OnProgress } from './onDeviceText';

interface Pending {
  resolve: (url: string) => void;
  reject: (err: Error) => void;
  onProgress?: OnProgress;
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./kokoroWorker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent) => {
    const data = e.data ?? {};
    if (data.type === 'progress') {
      for (const p of pending.values()) p.onProgress?.(data.message);
      return;
    }
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    if (data.type === 'result') {
      const blob = new Blob([data.wav], { type: 'audio/wav' });
      entry.resolve(URL.createObjectURL(blob));
    } else {
      entry.reject(new Error(data.message || 'Voice synthesis failed.'));
    }
  };
  worker.onerror = (e) => {
    for (const [id, p] of pending) {
      p.reject(new Error(e.message || 'The narration worker crashed.'));
      pending.delete(id);
    }
  };
  return worker;
}

export function kokoroSupported(): boolean {
  return typeof Worker !== 'undefined';
}

export function kokoroSynthesize(
  model: string,
  voice: string,
  text: string,
  onProgress?: OnProgress,
): Promise<string> {
  const w = getWorker();
  const id = ++seq;
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    w.postMessage({ id, model: model || 'onnx-community/Kokoro-82M-v1.0-ONNX', dtype: 'q8', voice: voice || 'af_heart', text });
  });
}
