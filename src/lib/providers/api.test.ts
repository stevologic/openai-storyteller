import { afterEach, describe, expect, it, vi } from 'vitest';
import { XAI_VOICES } from '../catalog';
import type { Settings } from '../types';
import { generateNarration } from './tts';
import { describeHttpError, fetchWithRetry, normalizeApiKey } from './util';
import { generateVideo } from './video';

const baseSettings: Settings = {
  keys: { openai: '  sk-test  ', anthropic: '', google: '', xai: '  xai-test  ' },
  text: { provider: 'openai', model: 'gpt-5.1' },
  youtube: { provider: 'openai', model: 'gpt-4o' },
  image: { provider: 'none', model: 'none' },
  video: { provider: 'none', model: 'none', enabled: false },
  tts: { provider: 'openai', model: 'gpt-4o-mini-tts', voice: 'nova' },
  storyVideo: { enabled: false },
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('provider request handling', () => {
  it('normalizes keys copied from .env files or with invisible characters', () => {
    expect(normalizeApiKey('export XAI_API_KEY="\u200Bxai-new-key-Wf\uFEFF"')).toBe('xai-new-key-Wf');
  });

  it('retries an explicit 429 and preserves the request', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('limited', { status: 429, headers: { 'retry-after': '0' } }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchWithRetry('https://example.test/models', {}, { attempts: 2 });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps plain-text errors and provider request IDs', async () => {
    const error = await describeHttpError(
      new Response('upstream unavailable', {
        status: 503,
        headers: { 'request-id': 'req_123' },
      }),
      'Anthropic',
    );

    expect(error.status).toBe(503);
    expect(error.requestId).toBe('req_123');
    expect(error.message).toContain('upstream unavailable');
    expect(error.message).toContain('req_123');
  });

  it('does not retry non-transient OpenAI billing quota errors', async () => {
    const response = Response.json(
      { error: { type: 'insufficient_quota', message: 'You exceeded your current quota.' } },
      { status: 429 },
    );
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchWithRetry('https://api.openai.com/v1/audio/speech', { method: 'POST' });
    const error = await describeHttpError(result, 'OpenAI Speech');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(error.message).toContain('add API credits or enable API billing');
    expect(error.message).toContain('ChatGPT subscriptions do not include API usage');
  });

  it('explains when xAI rejects a non-inference credential', async () => {
    const error = await describeHttpError(
      Response.json(
        { code: 'Client specified an invalid argument', error: 'Incorrect API key provided: xa***Wf.' },
        { status: 400 },
      ),
      'xAI Grok Voice',
    );

    expect(error.message).toContain('inference key');
    expect(error.message).toContain('not a Management API key');
  });
});

describe('voice API payloads', () => {
  it('omits unsupported instructions for legacy OpenAI TTS models', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(new Uint8Array([1]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');

    await generateNarration(
      { ...baseSettings, tts: { provider: 'openai', model: 'tts-1-hd', voice: 'nova' } },
      'Hello',
    );

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(init.body));
    expect(init.headers).toMatchObject({ Authorization: 'Bearer sk-test' });
    expect(body.instructions).toBeUndefined();
  });

  it('uses a current xAI voice ID and trims the key', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(new Uint8Array([1]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');

    const voice = XAI_VOICES[0].id;
    await generateNarration(
      { ...baseSettings, tts: { provider: 'xai', model: 'text-to-speech', voice } },
      'Hello',
    );

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(init.body));
    expect(init.headers).toMatchObject({ Authorization: 'Bearer xai-test' });
    expect(body.voice_id).toBe('eve');
    expect(XAI_VOICES.map((item) => item.id)).toEqual(['eve', 'ara', 'leo', 'rex', 'sal']);
  });
});

describe('video API payloads', () => {
  it('creates OpenAI Sora jobs with multipart form data', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ id: 'video_123' }))
      .mockResolvedValueOnce(Response.json({ status: 'failed' }));
    vi.stubGlobal('fetch', fetchMock);

    const pending = generateVideo(
      {
        ...baseSettings,
        video: { provider: 'openai', model: 'sora-2', enabled: true },
      },
      'A moonlit storybook forest',
    );
    await vi.advanceTimersByTimeAsync(5000);
    await pending;

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('model')).toBe('sora-2');
    expect((init.body as FormData).get('prompt')).toBe('A moonlit storybook forest');
    expect(init.headers).not.toHaveProperty('Content-Type');
  });
});
