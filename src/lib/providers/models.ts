import type { ModelOption, ProviderKeys } from '../types';
import { describeHttpError, fetchWithRetry } from './util';

/* Dynamically load each provider's live model list so the newest models show
   up in Settings automatically. The curated catalog is the offline fallback and
   supplies friendly labels; live ids are merged on top when a key is present. */

export type ProviderKey = keyof ProviderKeys; // 'openai' | 'anthropic' | 'google' | 'xai'
export type ModelCategory = 'text' | 'image' | 'tts' | 'video';

export interface RawModel {
  id: string;
  /** Human label from the provider, when it offers one (Anthropic/Google). */
  name?: string;
  /** Google only: which generation methods the model supports. */
  methods?: string[];
}

const TTL = 12 * 60 * 60 * 1000; // re-fetch at most twice a day
const CACHE_PREFIX = 'tbb.models.';
const mem = new Map<string, RawModel[]>();

/** Non-secret fingerprint so one API key never reuses another key's model access list. */
function keyFingerprint(key: string): string {
  let hash = 2166136261;
  for (const char of key.trim()) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function scopedCacheKey(p: ProviderKey, key: string): string {
  return `${p}.${keyFingerprint(key)}`;
}

function cacheGet(p: ProviderKey, key: string): RawModel[] | null {
  const cacheKey = scopedCacheKey(p, key);
  if (mem.has(cacheKey)) return mem.get(cacheKey)!;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; models: RawModel[] };
    if (!parsed?.models || Date.now() - parsed.ts > TTL) return null;
    mem.set(cacheKey, parsed.models);
    return parsed.models;
  } catch {
    return null;
  }
}

function cacheSet(p: ProviderKey, key: string, models: RawModel[]): void {
  const cacheKey = scopedCacheKey(p, key);
  mem.set(cacheKey, models);
  try {
    localStorage.setItem(CACHE_PREFIX + cacheKey, JSON.stringify({ ts: Date.now(), models }));
  } catch {
    /* localStorage full or unavailable — memory cache still works */
  }
}

async function fetchRaw(p: ProviderKey, key: string, signal?: AbortSignal): Promise<RawModel[]> {
  key = key.trim();
  if (p === 'openai' || p === 'xai') {
    const base = p === 'openai' ? 'https://api.openai.com/v1' : 'https://api.x.ai/v1';
    const res = await fetchWithRetry(
      `${base}/models`,
      { headers: { Authorization: `Bearer ${key}` }, signal },
      { timeoutMs: 20_000 },
    );
    if (!res.ok) throw await describeHttpError(res, p === 'openai' ? 'OpenAI Models' : 'xAI Models');
    const data = await res.json();
    return (data.data ?? []).map((m: { id: string }) => ({ id: m.id }));
  }
  if (p === 'anthropic') {
    const res = await fetchWithRetry(
      'https://api.anthropic.com/v1/models?limit=100',
      {
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        signal,
      },
      { timeoutMs: 20_000 },
    );
    if (!res.ok) throw await describeHttpError(res, 'Anthropic Models');
    const data = await res.json();
    return (data.data ?? []).map((m: { id: string; display_name?: string }) => ({ id: m.id, name: m.display_name }));
  }
  // google
  const res = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=${encodeURIComponent(key)}`,
    { signal },
    { timeoutMs: 20_000 },
  );
  if (!res.ok) throw await describeHttpError(res, 'Google Models');
  const data = await res.json();
  return (data.models ?? []).map((m: { name: string; displayName?: string; supportedGenerationMethods?: string[] }) => ({
    id: String(m.name ?? '').replace(/^models\//, ''),
    name: m.displayName,
    methods: m.supportedGenerationMethods,
  }));
}

/** Fetch (or return cached) live models for a provider. Throws on failure. */
export async function getProviderModels(p: ProviderKey, key: string, signal?: AbortSignal): Promise<RawModel[]> {
  key = key.trim();
  const cached = cacheGet(p, key);
  if (cached) return cached;
  const models = await fetchRaw(p, key, signal);
  cacheSet(p, key, models);
  return models;
}

const includesAny = (s: string, ...subs: string[]) => subs.some((x) => s.includes(x));

/** Pick out the models relevant to one generation category. */
function categorize(p: ProviderKey, models: RawModel[], cat: ModelCategory): RawModel[] {
  if (cat === 'text') {
    if (p === 'anthropic') return models.filter((m) => m.id.startsWith('claude'));
    if (p === 'google')
      return models.filter(
        (m) => m.methods?.includes('generateContent') && m.id.startsWith('gemini') && !includesAny(m.id, 'embedding'),
      );
    if (p === 'xai')
      return models.filter(
        (m) => m.id.startsWith('grok') && !includesAny(m.id, 'image', 'video', 'voice', 'audio'),
      );
    return models.filter(
      (m) =>
        /^(gpt-|o1|o3|o4|chatgpt)/.test(m.id) &&
        !includesAny(m.id, 'image', 'audio', 'realtime', 'tts', 'whisper', 'transcribe', 'embedding', 'moderation', 'search', 'instruct', 'dall-e'),
    );
  }
  if (cat === 'image') {
    if (p === 'openai') return models.filter((m) => includesAny(m.id, 'image') || m.id.startsWith('dall-e'));
    if (p === 'google') return models.filter((m) => m.id.startsWith('imagen'));
    if (p === 'xai') return models.filter((m) => includesAny(m.id, 'image'));
    return [];
  }
  if (cat === 'tts') {
    if (p === 'openai') return models.filter((m) => includesAny(m.id, 'tts'));
    return [];
  }
  // video
  if (p === 'openai') return models.filter((m) => includesAny(m.id, 'sora'));
  if (p === 'google') return models.filter((m) => includesAny(m.id, 'veo'));
  if (p === 'xai') return models.filter((m) => includesAny(m.id, 'imagine-video'));
  return [];
}

/**
 * Merge the live model list into the curated one for a provider + category.
 * Known ids keep their curated label/note; new live ids are appended. When no
 * live data is available (no key / fetch failed / nothing in this category),
 * the curated list is returned unchanged.
 */
export function resolveModels(
  catalog: ModelOption[],
  keyField: ProviderKey | null,
  category: ModelCategory,
  dyn: Partial<Record<ProviderKey, RawModel[]>>,
): { models: ModelOption[]; live: boolean } {
  if (!keyField || !dyn[keyField]) return { models: catalog, live: false };
  const live = categorize(keyField, dyn[keyField]!, category);
  if (!live.length) return { models: catalog, live: false };

  const liveById = new Map(live.map((m) => [m.id, m]));
  const curatedIds = new Set(catalog.map((m) => m.id));
  // Curated entries that really exist for this key, in curated order (flagships first).
  const kept = catalog.filter((m) => liveById.has(m.id));
  // Live ids the catalog doesn't know about yet, alphabetised for stability.
  const extras = live
    .filter((m) => !curatedIds.has(m.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((m) => ({ id: m.id, label: m.name || m.id }));

  const models = [...kept, ...extras];
  return models.length ? { models, live: true } : { models: catalog, live: false };
}
