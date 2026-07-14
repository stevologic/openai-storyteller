import type { Settings } from '../types';
import { base64ToDataUrl, describeHttpError, fetchWithRetry, normalizeApiKey } from './util';

/** Generate one illustration; returns a data URL, or undefined if disabled. */
export async function generateImage(
  settings: Settings,
  prompt: string,
  _styleKey?: string,
): Promise<string | undefined> {
  const { provider, model } = settings.image;
  switch (provider) {
    case 'openai':
      return openaiImage(settings.keys.openai, model, prompt);
    case 'google':
      return googleImagen(settings.keys.google, model, prompt);
    case 'xai':
      return xaiImage(settings.keys.xai, model, prompt);
    case 'none':
      return undefined;
    default:
      return undefined;
  }
}

async function xaiImage(key: string, model: string, prompt: string): Promise<string> {
  key = normalizeApiKey(key);
  if (!key) throw new Error('Add your xAI API key in Settings to generate illustrations.');
  const res = await fetchWithRetry('https://api.x.ai/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      response_format: 'b64_json',
      aspect_ratio: '16:9',
      resolution: '2k',
    }),
  });
  if (!res.ok) throw await describeHttpError(res, 'xAI Images');
  const data = await res.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('xAI Imagine returned no image data.');
  return base64ToDataUrl(b64, 'image/jpeg');
}

async function openaiImage(key: string, model: string, prompt: string): Promise<string> {
  key = normalizeApiKey(key);
  if (!key) throw new Error('Add your OpenAI API key in Settings to generate illustrations.');
  const isDalle = model.startsWith('dall-e');
  const body: Record<string, unknown> = {
    model,
    prompt,
    n: 1,
    size: isDalle ? '1792x1024' : '1536x1024',
  };
  // gpt-image-1 always returns b64 and rejects response_format; DALL·E needs it.
  if (isDalle) body.response_format = 'b64_json';
  if (model.startsWith('gpt-image')) body.quality = 'high';

  const res = await fetchWithRetry('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await describeHttpError(res, 'OpenAI Images');
  const data = await res.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI returned no image data.');
  return base64ToDataUrl(b64, 'image/png');
}

async function googleImagen(key: string, model: string, prompt: string): Promise<string> {
  if (!key) throw new Error('Add your Google AI API key in Settings to generate illustrations.');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:predict?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: '16:9', personGeneration: 'allow_all' },
    }),
  });
  if (!res.ok) throw await describeHttpError(res, 'Google Imagen');
  const data = await res.json();
  const b64 = data.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error('Imagen returned no image data.');
  return base64ToDataUrl(b64, 'image/png');
}
