/* Runs a small instruct model fully in-browser via Transformers.js, off the
   main thread. Weights stream from the Hugging Face hub on first use and are
   then cached by the browser. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;

let generatorPromise: Promise<any> | null = null;
let captionerPromise: Promise<any> | null = null;
let loadedModel = '';

const post = (m: any) => (self as unknown as Worker).postMessage(m);

async function getCaptioner(): Promise<any> {
  if (captionerPromise) return captionerPromise;
  const device = (navigator as any).gpu ? 'webgpu' : 'wasm';
  captionerPromise = pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning', {
    device,
    progress_callback: (p: any) => {
      if (p.status === 'progress' && typeof p.progress === 'number') {
        const file = (p.file ?? '').split('/').pop();
        post({ type: 'progress', message: `Downloading vision model ${file} — ${Math.round(p.progress)}%` });
      } else if (p.status === 'ready') {
        post({ type: 'progress', message: 'Looking at your photo…' });
      }
    },
  }).catch((err: any) => {
    captionerPromise = null;
    throw err;
  });
  return captionerPromise;
}

async function getGenerator(model: string): Promise<any> {
  if (generatorPromise && loadedModel === model) return generatorPromise;
  loadedModel = model;
  const device = (navigator as any).gpu ? 'webgpu' : 'wasm';
  generatorPromise = pipeline('text-generation', model, {
    dtype: 'q4',
    device,
    progress_callback: (p: any) => {
      if (p.status === 'progress' && typeof p.progress === 'number') {
        const file = (p.file ?? '').split('/').pop();
        post({ type: 'progress', message: `Downloading ${file} — ${Math.round(p.progress)}%` });
      } else if (p.status === 'ready') {
        post({ type: 'progress', message: `Model ready (${device}) — writing…` });
      }
    },
  }).catch((err: any) => {
    generatorPromise = null;
    throw err;
  });
  return generatorPromise;
}

self.onmessage = async (e: MessageEvent) => {
  const { id, system, user, maxTokens, model, type, imageUrl } = e.data ?? {};

  if (type === 'caption') {
    try {
      const captioner = await getCaptioner();
      const out: any = await captioner(imageUrl);
      const text = Array.isArray(out) ? (out[0]?.generated_text ?? '') : (out?.generated_text ?? '');
      post({ type: 'result', id, text });
    } catch (err: any) {
      post({ type: 'error', id, message: err?.message ?? String(err) });
    }
    return;
  }

  try {
    const generator = await getGenerator(model);
    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ];
    const output: any = await generator(messages, {
      max_new_tokens: maxTokens ?? 1536,
      do_sample: true,
      temperature: 0.7,
      top_p: 0.9,
      return_full_text: false,
    });
    const gen = output?.[0]?.generated_text;
    let text = '';
    if (Array.isArray(gen)) text = gen[gen.length - 1]?.content ?? '';
    else if (typeof gen === 'string') text = gen;
    post({ type: 'result', id, text });
  } catch (err: any) {
    post({ type: 'error', id, message: err?.message ?? String(err) });
  }
};
/* eslint-enable @typescript-eslint/no-explicit-any */
