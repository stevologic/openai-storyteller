import type { Settings } from '../types';
import { describeHttpError, sleep } from './util';

/** Best-effort short clip for a page. Video generation is slow (minutes) and
 *  async; on any failure we resolve to undefined so the reader falls back to
 *  cinematic Ken Burns motion. */
export async function generateVideo(
  settings: Settings,
  prompt: string,
  onTick?: (msg: string) => void,
): Promise<string | undefined> {
  if (!settings.video.enabled || settings.video.provider === 'none') return undefined;
  try {
    if (settings.video.provider === 'google') {
      return await veo(settings.keys.google, settings.video.model, prompt, onTick);
    }
    if (settings.video.provider === 'openai') {
      return await sora(settings.keys.openai, settings.video.model, prompt, onTick);
    }
  } catch (err) {
    console.warn('Video generation failed, falling back to motion:', err);
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
  if (!key) throw new Error('Google AI key required for Veo.');
  const startRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:predictLongRunning?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instances: [{ prompt }], parameters: { aspectRatio: '16:9' } }),
    },
  );
  if (!startRes.ok) throw await describeHttpError(startRes, 'Google Veo');
  const op = await startRes.json();
  const opName: string = op.name;

  for (let i = 0; i < 40; i++) {
    onTick?.(`Rendering video… (${i * 6}s)`);
    await sleep(6000);
    const pollRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${opName}?key=${encodeURIComponent(key)}`,
    );
    if (!pollRes.ok) throw await describeHttpError(pollRes, 'Google Veo');
    const status = await pollRes.json();
    if (status.done) {
      const uri = findUri(status.response);
      if (!uri) return undefined;
      const dl = await fetch(uri.includes('key=') ? uri : `${uri}&key=${encodeURIComponent(key)}`);
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
  if (!key) throw new Error('OpenAI key required for Sora.');
  const startRes = await fetch('https://api.openai.com/v1/videos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, prompt, size: '1280x720', seconds: '4' }),
  });
  if (!startRes.ok) throw await describeHttpError(startRes, 'OpenAI Sora');
  const job = await startRes.json();
  const id: string = job.id;

  for (let i = 0; i < 60; i++) {
    onTick?.(`Rendering video… (${i * 5}s)`);
    await sleep(5000);
    const pollRes = await fetch(`https://api.openai.com/v1/videos/${id}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!pollRes.ok) throw await describeHttpError(pollRes, 'OpenAI Sora');
    const status = await pollRes.json();
    if (status.status === 'completed') {
      const contentRes = await fetch(`https://api.openai.com/v1/videos/${id}/content`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!contentRes.ok) throw await describeHttpError(contentRes, 'OpenAI Sora');
      const blob = await contentRes.blob();
      return URL.createObjectURL(blob);
    }
    if (status.status === 'failed') throw new Error('Sora reported the job failed.');
  }
  return undefined;
}
