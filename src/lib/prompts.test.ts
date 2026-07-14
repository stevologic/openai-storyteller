import { describe, expect, it } from 'vitest';
import { buildWriterPrompt, WRITER_SYSTEM } from './prompts';
import type { StoryBrief } from './types';

const brief: StoryBrief = {
  idea: 'A moon moth learns to ask the fireflies for help finding home.',
  heroName: 'Mina',
  ageRange: '4–7',
  artStyle: 'Soft watercolor and colored pencil',
  pageCount: 6,
  lesson: 'Asking for help can be brave.',
  tone: 'Warm and whimsical',
  language: 'English (US)',
};

describe('story writer prompt', () => {
  it('requires a complete narrative arc before the end screen', () => {
    const prompt = buildWriterPrompt(brief);

    expect(WRITER_SYSTEM).toContain('complete, cohesive narrative arc');
    expect(prompt).toContain('SECOND-TO-LAST page is the turning point');
    expect(prompt).toContain("LAST page is the story's resolution and conclusion");
    expect(prompt).toContain('Never rely on the separate moral or “The End” screen to finish the plot');
    expect(prompt).toContain('no unresolved central problem');
  });

  it('preserves the requested page count while assigning ending beats', () => {
    const prompt = buildWriterPrompt(brief);

    expect(prompt).toContain('Write exactly 6 pages');
    expect(prompt).toContain('It must clearly lead into the final page');
  });

  it('requests a localized YouTube package without a second generation call', () => {
    const prompt = buildWriterPrompt(brief);

    expect(prompt).toContain('Prepare a tasteful YouTube package in English (US)');
    expect(prompt).toContain('"youtubeTitle"');
    expect(prompt).toContain('"youtubeDescription"');
    expect(prompt).toContain('"youtubeHashtags"');
    expect(prompt).toContain('Do not include timestamps or hashtags here');
  });
});
