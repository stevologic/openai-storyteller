import type { Settings } from '../types';
import { describeHttpError, extractJson } from './util';
import { chromeAvailable, chromeText, type OnProgress } from './onDeviceText';
import { transformersText } from './transformers';
import { DEFAULT_TRANSFORMERS_MODEL } from '../catalog';

export interface TextRequest {
  system: string;
  user: string;
  /** Ask the provider to return strict JSON. */
  json: boolean;
  maxTokens?: number;
}

/** Returns raw model text. JSON parsing happens in the caller. */
export async function generateText(
  settings: Settings,
  req: TextRequest,
  onProgress?: OnProgress,
): Promise<string> {
  const { provider, model } = settings.text;
  const maxTokens = req.maxTokens ?? 4096;
  // On-device models need the JSON instruction folded into the system prompt.
  const onDeviceSystem = req.json
    ? `${req.system}\n\nReply with ONLY a single valid JSON object — no markdown, no commentary.`
    : req.system;
  switch (provider) {
    case 'openai':
      return openaiText(settings.keys.openai, model, req, maxTokens);
    case 'anthropic':
      return anthropicText(settings.keys.anthropic, model, req, maxTokens);
    case 'google':
      return googleText(settings.keys.google, model, req, maxTokens);
    case 'chrome':
      return chromeText(onDeviceSystem, req.user, onProgress);
    case 'transformers':
      return transformersText(model || DEFAULT_TRANSFORMERS_MODEL, onDeviceSystem, req.user, Math.min(maxTokens, 2048), onProgress);
    case 'ondevice':
      if (await chromeAvailable()) return chromeText(onDeviceSystem, req.user, onProgress);
      return transformersText(DEFAULT_TRANSFORMERS_MODEL, onDeviceSystem, req.user, Math.min(maxTokens, 2048), onProgress);
    default:
      throw new Error(`Unknown text provider: ${provider}`);
  }
}

/** Convenience: generate text and parse it as JSON. */
export async function generateJson<T = unknown>(
  settings: Settings,
  req: TextRequest,
  onProgress?: OnProgress,
): Promise<T> {
  const raw = await generateText(settings, { ...req, json: true }, onProgress);
  return extractJson(raw) as T;
}

async function openaiText(
  key: string,
  model: string,
  req: TextRequest,
  maxTokens: number,
): Promise<string> {
  if (!key) throw new Error('Add your OpenAI API key in Settings to use GPT.');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
      max_completion_tokens: maxTokens,
      ...(req.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) throw await describeHttpError(res, 'OpenAI');
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function anthropicText(
  key: string,
  model: string,
  req: TextRequest,
  maxTokens: number,
): Promise<string> {
  if (!key) throw new Error('Add your Anthropic API key in Settings to use Claude.');
  const system = req.json
    ? `${req.system}\n\nRespond with a single valid JSON object and nothing else.`
    : req.system;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      // Required to call the API directly from a browser.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: req.user }],
    }),
  });
  if (!res.ok) throw await describeHttpError(res, 'Anthropic');
  const data = await res.json();
  const parts = (data.content ?? []) as Array<{ type: string; text?: string }>;
  return parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text ?? '')
    .join('');
}

async function googleText(
  key: string,
  model: string,
  req: TextRequest,
  maxTokens: number,
): Promise<string> {
  if (!key) throw new Error('Add your Google AI API key in Settings to use Gemini.');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: 'user', parts: [{ text: req.user }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        ...(req.json ? { responseMimeType: 'application/json' } : {}),
      },
    }),
  });
  if (!res.ok) throw await describeHttpError(res, 'Google Gemini');
  const data = await res.json();
  const parts = (data.candidates?.[0]?.content?.parts ?? []) as Array<{ text?: string }>;
  return parts.map((p) => p.text ?? '').join('');
}
