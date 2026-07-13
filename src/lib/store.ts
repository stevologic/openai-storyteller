import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SETTINGS, TEXT_PROVIDERS, IMAGE_PROVIDERS, VIDEO_PROVIDERS, TTS_PROVIDERS } from './catalog';
import type { GenerationProgress, RenderedStory, Settings, StoryBrief } from './types';

/** Persisted settings may reference providers that no longer exist (e.g. the
 *  retired on-device options). Snap any unknown provider back to the default so
 *  the app never boots into a broken configuration. */
function sanitizeSettings(raw: unknown): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(raw as Partial<Settings> | undefined) } as Settings;
  const keys = { ...DEFAULT_SETTINGS.keys, ...(s.keys ?? {}) };
  const valid = <T extends string>(list: { id: T }[], id: T) => list.some((p) => p.id === id);
  const text = valid(TEXT_PROVIDERS, s.text?.provider) ? s.text : DEFAULT_SETTINGS.text;
  const image = valid(IMAGE_PROVIDERS, s.image?.provider) ? s.image : DEFAULT_SETTINGS.image;
  const video = valid(VIDEO_PROVIDERS, s.video?.provider) ? s.video : DEFAULT_SETTINGS.video;
  const tts = valid(TTS_PROVIDERS, s.tts?.provider) ? s.tts : DEFAULT_SETTINGS.tts;
  return { ...s, keys, text, image, video, tts };
}

export type View = 'landing' | 'studio' | 'reader';

interface AppState {
  view: View;
  settingsOpen: boolean;
  settings: Settings;
  storyBrief: StoryBrief | null;
  story: RenderedStory | null;
  progress: GenerationProgress;
  error: string | null;

  setView: (v: View) => void;
  openSettings: () => void;
  closeSettings: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setSettings: (s: Settings) => void;
  setStoryBrief: (brief: StoryBrief | null) => void;
  setStory: (s: RenderedStory | null) => void;
  setProgress: (p: GenerationProgress) => void;
  setError: (e: string | null) => void;
  hasAnyKey: () => boolean;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      view: 'landing',
      settingsOpen: false,
      settings: DEFAULT_SETTINGS,
      storyBrief: null,
      story: null,
      progress: { stage: 'idle', message: '', ratio: 0 },
      error: null,

      setView: (view) => set({ view }),
      openSettings: () => set({ settingsOpen: true }),
      closeSettings: () => set({ settingsOpen: false }),
      updateSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
      setSettings: (settings) => set({ settings }),
      setStoryBrief: (storyBrief) => set({ storyBrief }),
      setStory: (story) => set({ story }),
      setProgress: (progress) => set({ progress }),
      setError: (error) => set({ error }),
      hasAnyKey: () => {
        const k = get().settings.keys;
        return Boolean(k.openai || k.anthropic || k.google || k.xai);
      },
    }),
    {
      name: 'storyteller-ai.v1',
      version: 2,
      // Only persist settings (which includes BYO keys). Stories hold large
      // data-URL images and are kept in memory only.
      partialize: (state) => ({ settings: state.settings }),
      // Retired on-device providers → snap back to a valid cloud default.
      migrate: (persisted) => {
        const p = persisted as { settings?: unknown } | undefined;
        return { settings: sanitizeSettings(p?.settings) };
      },
      merge: (persisted, current) => {
        const p = persisted as { settings?: unknown } | undefined;
        return { ...current, settings: sanitizeSettings(p?.settings) };
      },
    },
  ),
);
