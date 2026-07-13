import type { Settings } from '../types';
import { describeHttpError } from './util';
import { transformersCaption } from './transformers';
import type { OnProgress } from './onDeviceText';

const DESCRIBE_PROMPT = `Look at this reference image and write a character description an illustrator could follow for a children's picture book.
In 2–3 sentences describe only the character's appearance: what kind of character (a child, a person, an animal, a toy…), approximate age, hair, skin/fur colour, notable features, and clothing colours.
Do NOT mention the background, the photo, or any name. Write it as a plain, concrete description.`;

/** Split a data URL into its mime type and base64 payload. */
function parseDataUrl(dataUrl: string): { mediaType: string; base64: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!m) throw new Error('Unsupported image format.');
  return { mediaType: m[1], base64: m[2] };
}

/** Describe the uploaded character. Uses a cloud vision model when a key is
 *  available, otherwise on-device image captioning. */
export async function describeCharacter(
  settings: Settings,
  imageDataUrl: string,
  onProgress?: OnProgress,
): Promise<string> {
  const { keys, text } = settings;
  // Prefer the selected cloud provider if it has a key (it's vision-capable).
  if (text.provider === 'openai' && keys.openai) return openaiVision(keys.openai, text.model, imageDataUrl);
  if (text.provider === 'anthropic' && keys.anthropic) return anthropicVision(keys.anthropic, text.model, imageDataUrl);
  if (text.provider === 'google' && keys.google) return googleVision(keys.google, text.model, imageDataUrl);
  // Otherwise any available cloud key, with a known vision model.
  if (keys.openai) return openaiVision(keys.openai, 'gpt-4o', imageDataUrl);
  if (keys.anthropic) return anthropicVision(keys.anthropic, 'claude-sonnet-5', imageDataUrl);
  if (keys.google) return googleVision(keys.google, 'gemini-2.5-flash', imageDataUrl);
  // Fully on-device.
  onProgress?.('Loading the vision model…');
  return transformersCaption(imageDataUrl, onProgress);
}

async function openaiVision(key: string, model: string, imageDataUrl: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      max_completion_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: DESCRIBE_PROMPT },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw await describeHttpError(res, 'OpenAI Vision');
  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? '').trim();
}

async function anthropicVision(key: string, model: string, imageDataUrl: string): Promise<string> {
  const { mediaType, base64 } = parseDataUrl(imageDataUrl);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: DESCRIBE_PROMPT },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw await describeHttpError(res, 'Anthropic Vision');
  const data = await res.json();
  const parts = (data.content ?? []) as Array<{ type: string; text?: string }>;
  return parts.filter((p) => p.type === 'text').map((p) => p.text ?? '').join('').trim();
}

async function googleVision(key: string, model: string, imageDataUrl: string): Promise<string> {
  const { mediaType, base64 } = parseDataUrl(imageDataUrl);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ inlineData: { mimeType: mediaType, data: base64 } }, { text: DESCRIBE_PROMPT }],
        },
      ],
    }),
  });
  if (!res.ok) throw await describeHttpError(res, 'Google Gemini Vision');
  const data = await res.json();
  const parts = (data.candidates?.[0]?.content?.parts ?? []) as Array<{ text?: string }>;
  return parts.map((p) => p.text ?? '').join('').trim();
}
