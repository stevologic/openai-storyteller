import type { Settings } from '../types';
import { describeHttpError, extractJson, fetchWithRetry, normalizeApiKey, type OnProgress } from './util';

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
  _onProgress?: OnProgress,
): Promise<string> {
  const { provider, model } = settings.text;
  const maxTokens = req.maxTokens ?? 4096;
  switch (provider) {
    case 'openai':
      return openaiChat('https://api.openai.com/v1', settings.keys.openai, 'OpenAI', 'OpenAI', 'max_completion_tokens', model, req, maxTokens);
    case 'xai':
      return openaiChat('https://api.x.ai/v1', settings.keys.xai, 'xAI', 'Grok', 'max_tokens', model, req, maxTokens);
    case 'anthropic':
      return anthropicText(settings.keys.anthropic, model, req, maxTokens);
    case 'google':
      return googleText(settings.keys.google, model, req, maxTokens);
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

/** OpenAI-compatible chat completions (OpenAI and xAI share this shape). */
async function openaiChat(
  baseUrl: string,
  key: string,
  providerName: string,
  productName: string,
  tokenField: 'max_completion_tokens' | 'max_tokens',
  model: string,
  req: TextRequest,
  maxTokens: number,
): Promise<string> {
  key = normalizeApiKey(key);
  if (!key) throw new Error(`Add your ${providerName} API key in Settings to use ${productName}.`);
  const res = await fetchWithRetry(`${baseUrl}/chat/completions`, {
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
      [tokenField]: maxTokens,
      ...(req.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) throw await describeHttpError(res, providerName);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error(`${providerName} returned no text.`);
  }
  return content;
}

async function anthropicText(
  key: string,
  model: string,
  req: TextRequest,
  maxTokens: number,
): Promise<string> {
  key = normalizeApiKey(key);
  if (!key) throw new Error('Add your Anthropic API key in Settings to use Claude.');
  const system = req.json
    ? `${req.system}\n\nRespond with a single valid JSON object and nothing else.`
    : req.system;
  const res = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
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
  const content = parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text ?? '')
    .join('');
  if (!content.trim()) throw new Error('Anthropic returned no text.');
  return content;
}

async function googleText(
  key: string,
  model: string,
  req: TextRequest,
  maxTokens: number,
): Promise<string> {
  key = normalizeApiKey(key);
  if (!key) throw new Error('Add your Google AI API key in Settings to use Gemini.');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetchWithRetry(url, {
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
