import type { ProviderKeys, Settings, StoryBrief, TextProviderId } from './types';
import { normalizeApiKey } from './providers/util';

/**
 * A deliberately local price book. Provider model lists can be refreshed in
 * Settings, but no provider exposes a reliable, browser-safe pricing API for
 * arbitrary custom model IDs. Unknown models are never folded into a total.
 */
export const PRICE_BOOK_DATE = '2026-07-14';

export type CostLineStatus = 'estimated' | 'exact-plan' | 'unknown' | 'free';

export interface CostEstimateLine {
  label: string;
  basis: string;
  amount?: number;
  status: CostLineStatus;
}

export interface StoryCostEstimate {
  currency: 'USD';
  pricedAt: string;
  pageCount: number;
  /** Sum of only the components with an available rate. */
  knownTotal: number;
  /** A total is non-binding whenever a selected model has no known rate. */
  hasUnknownCosts: boolean;
  lines: CostEstimateLine[];
  unknownReasons: string[];
  assumptions: string[];
}

interface TokenRate {
  inputPerMillion: number;
  outputPerMillion: number;
}

const TEXT_RATES: Partial<Record<TextProviderId, Record<string, TokenRate>>> = {
  openai: {
    'gpt-5.1': { inputPerMillion: 1.25, outputPerMillion: 10 },
    'gpt-5': { inputPerMillion: 1.25, outputPerMillion: 10 },
    'gpt-4.1': { inputPerMillion: 2, outputPerMillion: 8 },
    'gpt-4o': { inputPerMillion: 2.5, outputPerMillion: 10 },
  },
  anthropic: {
    'claude-fable-5': { inputPerMillion: 10, outputPerMillion: 50 },
    'claude-opus-4-8': { inputPerMillion: 5, outputPerMillion: 25 },
    'claude-opus-4-7': { inputPerMillion: 5, outputPerMillion: 25 },
    // Current rate through Aug. 31, 2026; update this versioned price book
    // when the announced September rate change takes effect.
    'claude-sonnet-5': { inputPerMillion: 2, outputPerMillion: 10 },
    'claude-haiku-4-5': { inputPerMillion: 1, outputPerMillion: 5 },
  },
  google: {
    'gemini-2.5-pro': { inputPerMillion: 1.25, outputPerMillion: 10 },
    'gemini-2.5-flash': { inputPerMillion: 0.3, outputPerMillion: 2.5 },
  },
  xai: {
    // These configured aliases currently resolve to the same current Grok
    // family price. Treat other live/custom IDs as unknown rather than guess.
    'grok-4': { inputPerMillion: 1.25, outputPerMillion: 2.5 },
    'grok-4-fast': { inputPerMillion: 1.25, outputPerMillion: 2.5 },
    'grok-3': { inputPerMillion: 1.25, outputPerMillion: 2.5 },
    'grok-3-mini': { inputPerMillion: 1.25, outputPerMillion: 2.5 },
  },
};

const KEY_FOR_PROVIDER: Record<'openai' | 'anthropic' | 'google' | 'xai', keyof ProviderKeys> = {
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'google',
  xai: 'xai',
};

const RETIRED_VEO_MODELS = new Set(['veo-3.0-generate-001', 'veo-3.0-fast-generate-001', 'veo-2.0-generate-001']);

function modelLabel(provider: string, model: string): string {
  return `${provider} / ${model || 'no model selected'}`;
}

function estimateTokens(chars: number): number {
  // A transparent, conservative English-text heuristic. The generated story
  // does not exist before the call, so a quote cannot be an invoice.
  return Math.max(1, Math.ceil(chars / 3.5));
}

function addUnknown(lines: CostEstimateLine[], reasons: string[], label: string, reason: string): void {
  lines.push({ label, basis: reason, status: 'unknown' });
  reasons.push(`${label}: ${reason}`);
}

function addTextLine(
  lines: CostEstimateLine[],
  reasons: string[],
  label: string,
  provider: TextProviderId,
  model: string,
  inputTokens: number,
  outputTokens: number,
): void {
  const rate = TEXT_RATES[provider]?.[model];
  if (!rate) {
    addUnknown(lines, reasons, label, `No current standard rate is in the local price book for ${modelLabel(provider, model)}.`);
    return;
  }
  const amount = (inputTokens / 1_000_000) * rate.inputPerMillion + (outputTokens / 1_000_000) * rate.outputPerMillion;
  lines.push({
    label,
    basis: `Estimated ${inputTokens.toLocaleString()} input + ${outputTokens.toLocaleString()} output tokens with ${model}.`,
    amount,
    status: 'estimated',
  });
}

function addImageLine(lines: CostEstimateLine[], reasons: string[], settings: Settings, imageCount: number): void {
  if (settings.image.provider === 'none') {
    lines.push({ label: 'Illustrations', basis: 'Skipped in Settings.', amount: 0, status: 'free' });
    return;
  }

  const { provider, model } = settings.image;
  const perImage =
    provider === 'openai' && model === 'gpt-image-1'
      ? 0.25 // 1536x1024, quality high (the configured request)
      : provider === 'openai' && model === 'dall-e-3'
        ? 0.08 // 1792x1024, standard quality (the configured request)
        : provider === 'google' && model === 'imagen-4.0-generate-001'
          ? 0.04
          : provider === 'xai' && model === 'grok-imagine-image'
            ? 0.02
            : provider === 'xai' && model === 'grok-imagine-image-quality'
              ? 0.07
              : undefined;
  if (perImage === undefined) {
    addUnknown(lines, reasons, 'Illustrations', `No current standard per-image rate is in the local price book for ${modelLabel(provider, model)}.`);
    return;
  }
  // GPT Image also charges text-input tokens. The prompt contains the shared
  // art direction and character bible, so quote a small disclosed allowance
  // rather than pretending the flat image price is the entire request.
  const promptInputAmount = provider === 'openai' && model === 'gpt-image-1' ? (imageCount * 320 * 5) / 1_000_000 : 0;
  lines.push({
    label: 'Illustrations',
    basis:
      `${imageCount} images (cover + pages) × ${formatUsd(perImage)} with ${model}.` +
      (promptInputAmount ? ' Includes an estimate of 320 prompt tokens per image.' : ''),
    amount: imageCount * perImage + promptInputAmount,
    status: promptInputAmount ? 'estimated' : 'exact-plan',
  });
}

function addVideoLine(lines: CostEstimateLine[], reasons: string[], settings: Settings, pageCount: number): void {
  if (!settings.video.enabled || settings.video.provider === 'none') {
    lines.push({ label: 'Page video clips', basis: 'Cinematic motion only; no provider video requests.', amount: 0, status: 'free' });
    return;
  }

  const { provider, model } = settings.video;
  if (provider === 'google' && RETIRED_VEO_MODELS.has(model)) {
    addUnknown(lines, reasons, 'Page video clips', `${model} is retired. Select a Veo 3.1 model before creating.`);
    return;
  }
  const perClip =
    provider === 'openai' && model === 'sora-2'
      ? 0.4 // 4 seconds at 1280×720
      : provider === 'openai' && model === 'sora-2-pro'
        ? 1.2 // 4 seconds at 1280×720
        : provider === 'xai' && model === 'grok-imagine-video'
          ? 0.42 // 6 seconds at 720p
          : provider === 'google' && model === 'veo-3.1-generate-preview'
            ? 1.6 // 4 seconds at 720p
            : provider === 'google' && model === 'veo-3.1-fast-generate-preview'
              ? 0.4 // 4 seconds at 720p
              : provider === 'google' && model === 'veo-3.1-lite-generate-preview'
                ? 0.2 // 4 seconds at 720p
                : undefined;
  if (perClip === undefined) {
    addUnknown(lines, reasons, 'Page video clips', `No current standard per-clip rate is in the local price book for ${modelLabel(provider, model)}.`);
    return;
  }
  lines.push({
    label: 'Page video clips',
    basis: `${pageCount} clips × ${formatUsd(perClip)} with ${model}.`,
    amount: pageCount * perClip,
    status: 'exact-plan',
  });
}

function addNarrationLine(lines: CostEstimateLine[], reasons: string[], settings: Settings, pageCount: number): void {
  const estimatedCharacters = pageCount * 550;
  if (settings.tts.provider === 'none' || settings.tts.provider === 'browser') {
    lines.push({
      label: 'Narration',
      basis: settings.tts.provider === 'browser' ? 'Browser voice plays live; it is not a cloud API call.' : 'Skipped in Settings.',
      amount: 0,
      status: 'free',
    });
    return;
  }

  const { provider, model } = settings.tts;
  if (provider === 'xai' && model === 'text-to-speech') {
    lines.push({
      label: 'Narration',
      basis: `Estimated ${estimatedCharacters.toLocaleString()} characters across ${pageCount} pages at $15 / 1M characters.`,
      amount: (estimatedCharacters / 1_000_000) * 15,
      status: 'estimated',
    });
    return;
  }
  if (provider === 'openai' && model === 'tts-1-hd') {
    lines.push({
      label: 'Narration',
      basis: `Estimated ${estimatedCharacters.toLocaleString()} characters across ${pageCount} pages at $30 / 1M characters.`,
      amount: (estimatedCharacters / 1_000_000) * 30,
      status: 'estimated',
    });
    return;
  }
  if (provider === 'openai' && model === 'gpt-4o-mini-tts') {
    // OpenAI bills output audio tokens rather than characters. The one-token-per-
    // character assumption is deliberately displayed in the UI and is not a cap.
    const inputTokens = estimateTokens(estimatedCharacters);
    const amount = (inputTokens / 1_000_000) * 0.6 + (estimatedCharacters / 1_000_000) * 12;
    lines.push({
      label: 'Narration',
      basis: `Estimated ${estimatedCharacters.toLocaleString()} characters; roughly 1 audio token per character for ${model}.`,
      amount,
      status: 'estimated',
    });
    return;
  }
  addUnknown(lines, reasons, 'Narration', `No current standard narration rate is in the local price book for ${modelLabel(provider, model)}.`);
}

/** Create the quote shown before any story-generation provider call is made. */
export function estimateStoryCost(settings: Settings, brief: StoryBrief): StoryCostEstimate {
  const pageCount = Math.max(1, Math.round(brief.pageCount));
  const lines: CostEstimateLine[] = [];
  const unknownReasons: string[] = [];
  const briefChars = [brief.idea, brief.heroName, brief.artStyle, brief.lesson, brief.tone, brief.language, brief.characterDescription]
    .filter(Boolean)
    .join('\n').length;
  const storyInputTokens = 650 + estimateTokens(briefChars);
  const storyOutputTokens = Math.min(6000, 420 + pageCount * 260);
  const youtubeInputTokens = 450 + storyOutputTokens;
  const youtubeOutputTokens = 420;

  addTextLine(lines, unknownReasons, 'Story text', settings.text.provider, settings.text.model, storyInputTokens, storyOutputTokens);
  addTextLine(
    lines,
    unknownReasons,
    'YouTube title & description',
    settings.youtube.provider,
    settings.youtube.model,
    youtubeInputTokens,
    youtubeOutputTokens,
  );
  addImageLine(lines, unknownReasons, settings, pageCount + 1);
  addVideoLine(lines, unknownReasons, settings, pageCount);
  addNarrationLine(lines, unknownReasons, settings, pageCount);
  lines.push({ label: 'Book video export', basis: 'Rendered locally in this browser; no provider API call.', amount: 0, status: 'free' });

  return {
    currency: 'USD',
    pricedAt: PRICE_BOOK_DATE,
    pageCount,
    knownTotal: lines.reduce((sum, line) => sum + (line.amount ?? 0), 0),
    hasUnknownCosts: unknownReasons.length > 0,
    lines,
    unknownReasons,
    assumptions: [
      `Story text estimate uses about ${storyOutputTokens.toLocaleString()} output tokens (the request ceiling is 6,000).`,
      `YouTube copy estimate uses about ${youtubeOutputTokens.toLocaleString()} output tokens (the request ceiling is 900).`,
      'Media prices use the selected request settings. Actual provider charges, credits, taxes, and negotiated rates can vary.',
    ],
  };
}

/** Detect missing or unusable selected configurations before a user accepts a quote. */
export function getGenerationConfigurationErrors(settings: Settings): string[] {
  const errors: string[] = [];
  const providerName = (provider: keyof typeof KEY_FOR_PROVIDER) =>
    provider === 'openai' ? 'OpenAI' : provider === 'anthropic' ? 'Anthropic' : provider === 'google' ? 'Google AI' : 'xAI';
  const requireKey = (label: string, provider: keyof typeof KEY_FOR_PROVIDER, model: string) => {
    if (!model.trim()) errors.push(`${label} needs a model selected.`);
    if (!normalizeApiKey(settings.keys[KEY_FOR_PROVIDER[provider]])) errors.push(`${label} needs your ${providerName(provider)} API key.`);
  };

  requireKey('Story text', settings.text.provider, settings.text.model);
  requireKey('YouTube copy', settings.youtube.provider, settings.youtube.model);
  if (settings.image.provider !== 'none') requireKey('Illustrations', settings.image.provider, settings.image.model);
  if (settings.video.enabled && settings.video.provider !== 'none') {
    requireKey('Page video clips', settings.video.provider, settings.video.model);
    if (settings.video.provider === 'google' && RETIRED_VEO_MODELS.has(settings.video.model)) {
      errors.push('The selected Google Veo model is retired. Choose a Veo 3.1 model in Settings.');
    }
  }
  if (settings.tts.provider === 'openai' || settings.tts.provider === 'xai') {
    requireKey('Narration', settings.tts.provider, settings.tts.model);
    if (!settings.tts.voice.trim()) errors.push('Narration needs a voice selected.');
  }
  return errors;
}

export function formatUsd(amount: number): string {
  if (!Number.isFinite(amount)) return 'Unavailable';
  if (amount === 0) return '$0.00';
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}
