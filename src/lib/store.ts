import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SETTINGS } from './catalog';
import type { GenerationProgress, RenderedStory, Settings } from './types';

export type View = 'landing' | 'studio' | 'reader';

interface AppState {
  view: View;
  settingsOpen: boolean;
  settings: Settings;
  story: RenderedStory | null;
  progress: GenerationProgress;
  error: string | null;

  setView: (v: View) => void;
  openSettings: () => void;
  closeSettings: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setSettings: (s: Settings) => void;
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
      story: null,
      progress: { stage: 'idle', message: '', ratio: 0 },
      error: null,

      setView: (view) => set({ view }),
      openSettings: () => set({ settingsOpen: true }),
      closeSettings: () => set({ settingsOpen: false }),
      updateSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
      setSettings: (settings) => set({ settings }),
      setStory: (story) => set({ story }),
      setProgress: (progress) => set({ progress }),
      setError: (error) => set({ error }),
      hasAnyKey: () => {
        const k = get().settings.keys;
        return Boolean(k.openai || k.anthropic || k.google);
      },
    }),
    {
      name: 'storyloom.v1',
      // Only persist settings (which includes BYO keys). Stories hold large
      // data-URL images and are kept in memory only.
      partialize: (state) => ({ settings: state.settings }),
    },
  ),
);
