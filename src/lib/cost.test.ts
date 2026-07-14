import { describe, expect, it } from 'vitest';
import { estimateStoryCost, getGenerationConfigurationErrors } from './cost';
import type { Settings, StoryBrief } from './types';

const brief: StoryBrief = {
  idea: 'A worried fox learns to ask the moon for help finding home.',
  heroName: 'Milo',
  ageRange: '4–7',
  artStyle: 'Soft watercolor',
  pageCount: 6,
  lesson: 'Asking for help can be brave.',
  tone: 'Cozy and reassuring',
  language: 'English (US)',
};

const settings: Settings = {
  keys: { openai: 'sk-test', anthropic: '', google: '', xai: '' },
  text: { provider: 'openai', model: 'gpt-5.1' },
  youtube: { provider: 'openai', model: 'gpt-4o' },
  image: { provider: 'openai', model: 'gpt-image-1' },
  video: { provider: 'none', model: 'none', enabled: false },
  tts: { provider: 'openai', model: 'gpt-4o-mini-tts', voice: 'nova' },
  storyVideo: { enabled: true },
};

describe('story cost estimate', () => {
  it('quotes each planned provider call before generation', () => {
    const estimate = estimateStoryCost(settings, brief);

    expect(estimate.hasUnknownCosts).toBe(false);
    expect(estimate.knownTotal).toBeGreaterThan(1.7); // seven high-quality images alone cost $1.75
    expect(estimate.lines.find((line) => line.label === 'Illustrations')?.basis).toContain('7 images');
    expect(estimate.lines.find((line) => line.label === 'Book video export')?.amount).toBe(0);
    expect(estimate.assumptions.join(' ')).toContain('6,000');
  });

  it('does not hide a custom or unpriced model inside the total', () => {
    const estimate = estimateStoryCost(
      { ...settings, image: { provider: 'google', model: 'custom-imagen-model' } },
      brief,
    );

    expect(estimate.hasUnknownCosts).toBe(true);
    expect(estimate.unknownReasons.join(' ')).toContain('custom-imagen-model');
    expect(estimate.lines.find((line) => line.label === 'Illustrations')?.amount).toBeUndefined();
  });
});

describe('generation preflight', () => {
  it('requires every enabled provider credential before work starts', () => {
    const errors = getGenerationConfigurationErrors({
      ...settings,
      keys: { openai: '', anthropic: '', google: '', xai: '' },
      image: { provider: 'xai', model: 'grok-imagine-image' },
      video: { provider: 'google', model: 'veo-3.1-fast-generate-preview', enabled: true },
      tts: { provider: 'xai', model: 'text-to-speech', voice: 'eve' },
    });

    expect(errors.join(' ')).toContain('Story text needs your OpenAI API key');
    expect(errors.join(' ')).toContain('Illustrations needs your xAI API key');
    expect(errors.join(' ')).toContain('Page video clips needs your Google AI API key');
    expect(errors.join(' ')).toContain('Narration needs your xAI API key');
  });

  it('blocks retired Veo model ids before any provider request', () => {
    const errors = getGenerationConfigurationErrors({
      ...settings,
      keys: { ...settings.keys, google: 'AIza-test' },
      video: { provider: 'google', model: 'veo-3.0-generate-001', enabled: true },
    });

    expect(errors.join(' ')).toContain('retired');
  });
});
