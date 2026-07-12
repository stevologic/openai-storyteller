import type {
  ImageProviderId,
  ModelOption,
  ProviderCatalogEntry,
  Settings,
  TextProviderId,
  TtsProviderId,
  VideoProviderId,
} from './types';

/* The catalog powers the Settings UI. Model ids reflect the current
   frontier lineups; new models can be typed in freely via "Custom model". */

export const TEXT_PROVIDERS: ProviderCatalogEntry<TextProviderId>[] = [
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    keyField: 'anthropic',
    docsUrl: 'https://docs.anthropic.com/en/docs/about-claude/models',
    models: [
      { id: 'claude-opus-4-8', label: 'Claude Opus 4.8', note: 'Most vivid prose' },
      { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', note: 'Balanced' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', note: 'Fast & cheap' },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI GPT',
    keyField: 'openai',
    docsUrl: 'https://platform.openai.com/docs/models',
    models: [
      { id: 'gpt-5.1', label: 'GPT-5.1', note: 'Flagship' },
      { id: 'gpt-5', label: 'GPT-5' },
      { id: 'gpt-4.1', label: 'GPT-4.1' },
      { id: 'gpt-4o', label: 'GPT-4o', note: 'Fast' },
    ],
  },
  {
    id: 'google',
    label: 'Google Gemini',
    keyField: 'google',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/models',
    models: [
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', note: 'Deep reasoning' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', note: 'Fast' },
    ],
  },
];

export const IMAGE_PROVIDERS: ProviderCatalogEntry<ImageProviderId>[] = [
  {
    id: 'openai',
    label: 'OpenAI Images',
    keyField: 'openai',
    docsUrl: 'https://platform.openai.com/docs/guides/image-generation',
    models: [
      { id: 'gpt-image-1', label: 'gpt-image-1', note: 'Best character consistency' },
      { id: 'dall-e-3', label: 'DALL·E 3' },
    ],
  },
  {
    id: 'google',
    label: 'Google Imagen',
    keyField: 'google',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/imagen',
    models: [
      { id: 'imagen-4.0-generate-001', label: 'Imagen 4', note: 'Painterly detail' },
      { id: 'imagen-3.0-generate-002', label: 'Imagen 3' },
    ],
  },
  {
    id: 'none',
    label: 'None (skip illustrations)',
    keyField: null,
    models: [{ id: 'none', label: '—' }],
  },
];

export const VIDEO_PROVIDERS: ProviderCatalogEntry<VideoProviderId>[] = [
  {
    id: 'none',
    label: 'None — cinematic motion only',
    keyField: null,
    models: [{ id: 'none', label: 'Ken Burns motion (free, instant)' }],
  },
  {
    id: 'google',
    label: 'Google Veo',
    keyField: 'google',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/video',
    models: [
      { id: 'veo-3.0-generate-001', label: 'Veo 3', note: 'With audio' },
      { id: 'veo-3.0-fast-generate-001', label: 'Veo 3 Fast' },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI Sora',
    keyField: 'openai',
    docsUrl: 'https://platform.openai.com/docs/guides/video-generation',
    models: [
      { id: 'sora-2', label: 'Sora 2' },
      { id: 'sora-2-pro', label: 'Sora 2 Pro' },
    ],
  },
];

export const TTS_PROVIDERS: ProviderCatalogEntry<TtsProviderId>[] = [
  {
    id: 'browser',
    label: 'Browser narration (free)',
    keyField: null,
    models: [{ id: 'system', label: 'System voices' }],
  },
  {
    id: 'openai',
    label: 'OpenAI Speech',
    keyField: 'openai',
    docsUrl: 'https://platform.openai.com/docs/guides/text-to-speech',
    models: [
      { id: 'gpt-4o-mini-tts', label: 'gpt-4o-mini-tts', note: 'Steerable' },
      { id: 'tts-1-hd', label: 'tts-1-hd' },
    ],
  },
  {
    id: 'none',
    label: 'None (no narration)',
    keyField: null,
    models: [{ id: 'none', label: '—' }],
  },
];

export const OPENAI_VOICES: ModelOption[] = [
  { id: 'nova', label: 'Nova — warm, bright' },
  { id: 'shimmer', label: 'Shimmer — gentle' },
  { id: 'fable', label: 'Fable — storyteller' },
  { id: 'alloy', label: 'Alloy — neutral' },
  { id: 'onyx', label: 'Onyx — deep' },
];

export const ART_STYLE_PRESETS = [
  'Soft watercolor picture book, gentle washes, cozy',
  'Pixar-style 3D render, warm cinematic lighting',
  'Vintage 1960s storybook, gouache, textured paper',
  'Studio Ghibli-inspired hand painted, lush backgrounds',
  'Cut-paper collage, layered felt textures',
  'Dreamy pastel crayon, childlike and whimsical',
  'Golden-hour claymation, tactile and rounded',
];

export const TONE_PRESETS = [
  'Cozy and reassuring',
  'Playful and giggly',
  'Wondrous and adventurous',
  'Calm bedtime lull',
  'Brave and heartfelt',
];

export const DEFAULT_SETTINGS: Settings = {
  keys: { openai: '', anthropic: '', google: '' },
  text: { provider: 'anthropic', model: 'claude-sonnet-5' },
  image: { provider: 'openai', model: 'gpt-image-1' },
  video: { provider: 'none', model: 'none', enabled: false },
  tts: { provider: 'browser', model: 'system', voice: 'nova' },
};

export function providerLabel<T extends string>(
  list: ProviderCatalogEntry<T>[],
  id: T,
): string {
  return list.find((p) => p.id === id)?.label ?? id;
}
