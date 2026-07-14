import type { Settings } from '../types';
import { describeHttpError, fetchWithRetry, normalizeApiKey, sleep } from './util';

/** Generate a short clip for a page. Failures are deliberately surfaced so an
 * enabled paid feature can never silently produce a degraded book. */
export async function generateVideo(
  settings: Settings,
  prompt: string,
  onTick?: (msg: string) => void,
): Promise<string | undefined> {
  if (!settings.video.enabled || settings.video.provider === 'none') return undefined;
  if (settings.video.provider === 'google') {
    return veo(settings.keys.google, settings.video.model, prompt, onTick);
  }
  if (settings.video.provider === 'openai') {
    return sora(settings.keys.openai, settings.video.model, prompt, onTick);
  }
  if (settings.video.provider === 'xai') {
    return grokImagine(settings.keys.xai, settings.video.model, prompt, onTick);
  }
  return undefined;
}

async function grokImagine(
  key: string,
  model: string,
  prompt: string,
  onTick?: (msg: string) => void,
): Promise<string | undefined> {
  key = normalizeApiKey(key);
  if (!key) throw new Error('xAI API key required for Grok Imagine video.');
  const startRes = await fetchWithRetry('https://api.x.ai/v1/videos/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, prompt, duration: 6, aspect_ratio: '16:9', resolution: '720p' }),
  });
  if (!startRes.ok) throw await describeHttpError(startRes, 'xAI Grok Imagine');
  const requestId: string | undefined = (await startRes.json()).request_id;
  if (!requestId) throw new Error('xAI Grok Imagine returned no request id.');

  for (let i = 0; i < 60; i++) {
    onTick?.(`Rendering video… (${i * 5}s)`);
    await sleep(5000);
    const pollRes = await fetchWithRetry(`https://api.x.ai/v1/videos/${encodeURIComponent(requestId)}`, {
      headers: { Authorization: `Bearer ${key}` },
    }, { timeoutMs: 30_000 });
    if (!pollRes.ok) throw await describeHttpError(pollRes, 'xAI Grok Imagine');
    const status = await pollRes.json();
    if (status.status === 'done') {
      const url = status.video?.url ?? findUri(status.video);
      if (!url) return undefined;
      const download = await fetchWithRetry(url, {}, { timeoutMs: 120_000 });
      if (!download.ok) throw await describeHttpError(download, 'xAI Grok Imagine download');
      return URL.createObjectURL(await download.blob());
    }
    if (status.status === 'expired' || status.status === 'failed') {
      throw new Error(`xAI Grok Imagine reported the job ${status.status}.`);
    }
  }
  return undefined;
}

/** Recursively find the first string property named `uri`/`url` in an object. */
function findUri(obj: unknown): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if ((k === 'uri' || k === 'url') && typeof v === 'string') return v;
    if (typeof v === 'object') {
      const nested = findUri(v);
      if (nested) return nested;
    }
  }
  return undefined;
}

async function veo(
  key: string,
  model: string,
  prompt: string,
  onTick?: (msg: string) => void,
): Promise<string | undefined> {
  key = normalizeApiKey(key);
  if (!key) throw new Error('Google AI key required for Veo.');
  const startRes = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:predictLongRunning?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Pin the duration and resolution so the quote shown before generation
      // matches the provider request. Veo 3.1 accepts 4/6/8-second clips.
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { aspectRatio: '16:9', durationSeconds: '4', resolution: '720p' },
      }),
    },
  );
  if (!startRes.ok) throw await describeHttpError(startRes, 'Google Veo');
  const op = await startRes.json();
  const opName: string = op.name;

  for (let i = 0; i < 40; i++) {
    onTick?.(`Rendering video… (${i * 6}s)`);
    await sleep(6000);
    const pollRes = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/${opName}?key=${encodeURIComponent(key)}`,
      {},
      { timeoutMs: 30_000 },
    );
    if (!pollRes.ok) throw await describeHttpError(pollRes, 'Google Veo');
    const status = await pollRes.json();
    if (status.done) {
      const uri = findUri(status.response);
      if (!uri) return undefined;
      const dl = await fetchWithRetry(
        uri.includes('key=') ? uri : `${uri}&key=${encodeURIComponent(key)}`,
        {},
        { timeoutMs: 120_000 },
      );
      if (!dl.ok) throw await describeHttpError(dl, 'Google Veo download');
      const blob = await dl.blob();
      return URL.createObjectURL(blob);
    }
  }
  return undefined;
}

async function sora(
  key: string,
  model: string,
  prompt: string,
  onTick?: (msg: string) => void,
): Promise<string | undefined> {
  key = normalizeApiKey(key);
  if (!key) throw new Error('OpenAI key required for Sora.');
  const form = new FormData();
  form.set('model', model);
  form.set('prompt', prompt);
  form.set('size', '1280x720');
  form.set('seconds', '4');
  const startRes = await fetchWithRetry('https://api.openai.com/v1/videos', {
    method: 'POST',
    // The Videos API is multipart even when no reference image is attached.
    // Let fetch set the boundary-bearing Content-Type header for FormData.
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!startRes.ok) throw await describeHttpError(startRes, 'OpenAI Sora');
  const job = await startRes.json();
  const id: string | undefined = job.id;
  if (!id) throw new Error('OpenAI Sora returned no video id.');

  for (let i = 0; i < 60; i++) {
    onTick?.(`Rendering video… (${i * 5}s)`);
    await sleep(5000);
    const pollRes = await fetchWithRetry(`https://api.openai.com/v1/videos/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${key}` },
    }, { timeoutMs: 30_000 });
    if (!pollRes.ok) throw await describeHttpError(pollRes, 'OpenAI Sora');
    const status = await pollRes.json();
    if (status.status === 'completed') {
      const contentRes = await fetchWithRetry(`https://api.openai.com/v1/videos/${encodeURIComponent(id)}/content`, {
        headers: { Authorization: `Bearer ${key}` },
      }, { timeoutMs: 120_000 });
      if (!contentRes.ok) throw await describeHttpError(contentRes, 'OpenAI Sora');
      const blob = await contentRes.blob();
      return URL.createObjectURL(blob);
    }
    if (status.status === 'failed') throw new Error('Sora reported the job failed.');
  }
  return undefined;
}
