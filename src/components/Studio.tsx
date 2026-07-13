import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../lib/store';
import { ART_STYLE_PRESETS, TONE_PRESETS, providerLabel, TEXT_PROVIDERS, IMAGE_PROVIDERS } from '../lib/catalog';
import { weaveStory } from '../lib/generate';
import { openStoryFile } from '../lib/exportStory';
import type { StoryBrief } from '../lib/types';
import { IconSpark, IconSettings } from './icons';
import './studio.css';

const AGE_BANDS = ['0–3', '3–6', '4–7', '6–9', '8–12'];
const CUSTOM = '__custom__';

export default function Studio() {
  const settings = useStore((s) => s.settings);
  const openSettings = useStore((s) => s.openSettings);
  const setStory = useStore((s) => s.setStory);
  const setView = useStore((s) => s.setView);
  const progress = useStore((s) => s.progress);
  const setProgress = useStore((s) => s.setProgress);

  const [brief, setBrief] = useState<StoryBrief>({
    idea: '',
    heroName: '',
    ageRange: '4–7',
    artStyle: ART_STYLE_PRESETS[0],
    pageCount: 6,
    lesson: '',
    tone: TONE_PRESETS[0],
  });
  const [customStyle, setCustomStyle] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onOpenFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const opened = await openStoryFile(file);
      setStory(opened);
      setView('reader');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open that file.');
    }
  }

  const textProvider = TEXT_PROVIDERS.find((p) => p.id === settings.text.provider);
  // On-device providers have no keyField, so they never need a key.
  const textKeyMissing = textProvider?.keyField ? !settings.keys[textProvider.keyField] : false;
  const onDeviceText = !textProvider?.keyField;

  const set = <K extends keyof StoryBrief>(k: K, v: StoryBrief[K]) => setBrief((b) => ({ ...b, [k]: v }));

  async function onWeave() {
    setError(null);
    if (!brief.idea.trim()) {
      setError('Tell me what the story is about first.');
      return;
    }
    if (textKeyMissing) {
      setError(`Add your ${providerLabel(TEXT_PROVIDERS, settings.text.provider)} API key in Settings.`);
      openSettings();
      return;
    }
    setBusy(true);
    setProgress({ stage: 'writing', message: 'Warming up the storyteller…', ratio: 0.02 });
    try {
      const story = await weaveStory(settings, brief, (p) => setProgress(p));
      setStory(story);
      setView('reader');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setProgress({ stage: 'error', message: '', ratio: 0 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="studio container">
      <div className="studio-head">
        <span className="eyebrow">Storyteller AI Studio</span>
        <h1>Create a new storybook</h1>
        <p>Describe the tale. Storyteller AI writes it, illustrates every page, and reads it aloud.</p>
        <p className="studio-open">
          or{' '}
          <button type="button" className="linklike" onClick={() => fileRef.current?.click()}>
            open a saved story
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onOpenFile} />
        </p>
      </div>

      <div className="studio-grid">
        <div className="card studio-form">
          <label className="field">
            <span className="field-label">What is the story about?</span>
            <textarea
              placeholder="A shy little lighthouse who is afraid of the dark, until the stars teach her to shine…"
              value={brief.idea}
              onChange={(e) => set('idea', e.target.value)}
              rows={3}
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span className="field-label">Hero's name</span>
              <input type="text" placeholder="Optional" value={brief.heroName} onChange={(e) => set('heroName', e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">Reading age</span>
              <select value={brief.ageRange} onChange={(e) => set('ageRange', e.target.value)}>
                {AGE_BANDS.map((a) => (
                  <option key={a} value={a}>
                    Ages {a}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span className="field-label">Art style</span>
            <select
              value={customStyle ? CUSTOM : brief.artStyle}
              onChange={(e) => {
                if (e.target.value === CUSTOM) {
                  setCustomStyle(true);
                  set('artStyle', '');
                } else {
                  setCustomStyle(false);
                  set('artStyle', e.target.value);
                }
              }}
            >
              {ART_STYLE_PRESETS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
              <option value={CUSTOM}>Custom style…</option>
            </select>
            {customStyle && (
              <input
                type="text"
                className="mt-8"
                placeholder="Describe the look you want"
                value={brief.artStyle}
                onChange={(e) => set('artStyle', e.target.value)}
              />
            )}
          </label>

          <div className="field-row">
            <label className="field">
              <span className="field-label">Tone</span>
              <select value={brief.tone} onChange={(e) => set('tone', e.target.value)}>
                {TONE_PRESETS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Pages: {brief.pageCount}</span>
              <input
                type="range"
                min={4}
                max={12}
                value={brief.pageCount}
                onChange={(e) => set('pageCount', Number(e.target.value))}
                className="slider"
              />
            </label>
          </div>

          <label className="field">
            <span className="field-label">A gentle lesson (optional)</span>
            <input
              type="text"
              placeholder="Being brave means being scared and trying anyway"
              value={brief.lesson}
              onChange={(e) => set('lesson', e.target.value)}
            />
          </label>

          {error && <div className="studio-error">{error}</div>}

          <button className="btn btn-primary btn-lg studio-weave" onClick={onWeave} disabled={busy}>
            <IconSpark />
            {busy ? 'Creating…' : 'Create my storybook'}
          </button>
        </div>

        <aside className="studio-side">
          <div className="card studio-models">
            <div className="studio-models-head">
              <h3>Your models</h3>
              <button className="btn btn-ghost btn-sm" onClick={openSettings}>
                <IconSettings /> Configure
              </button>
            </div>
            <ul className="model-summary">
              <li>
                <span>Text</span>
                <b>{providerLabel(TEXT_PROVIDERS, settings.text.provider)}</b>
                <em>{settings.text.model}</em>
              </li>
              <li>
                <span>Illustration</span>
                <b>{providerLabel(IMAGE_PROVIDERS, settings.image.provider)}</b>
                <em>{settings.image.model}</em>
              </li>
              <li>
                <span>Video</span>
                <b>{settings.video.enabled ? settings.video.model : 'Cinematic motion'}</b>
              </li>
              <li>
                <span>Narration</span>
                <b>{settings.tts.provider === 'openai' ? `OpenAI · ${settings.tts.voice}` : settings.tts.provider === 'browser' ? 'Browser voice' : 'Off'}</b>
              </li>
            </ul>
            {onDeviceText ? (
              <p className="studio-ondevice">
                ✓ Runs entirely on your device — no API key needed. The first on-device run downloads a
                small model, then it’s instant. Add a key in Settings for higher-quality writing and art.
              </p>
            ) : (
              textKeyMissing && (
                <p className="studio-nokey">
                  Add your {providerLabel(TEXT_PROVIDERS, settings.text.provider)} key in Settings — or switch
                  Text to “On-device” to run with no key.
                </p>
              )
            )}
          </div>

          <div className="card studio-tip">
            <h3>Tips for lovely books</h3>
            <ul>
              <li>Give the hero a small, specific problem — it makes a warmer arc.</li>
              <li>Pick an art style and keep it; consistency is the magic.</li>
              <li>Fewer pages read better aloud for the littlest listeners.</li>
            </ul>
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {busy && (
          <motion.div className="weave-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="weave-card">
              <div className="weave-spinner" />
              <h2>{progress.message || 'Creating your story…'}</h2>
              <div className="weave-bar">
                <motion.div className="weave-fill" animate={{ width: `${Math.round(progress.ratio * 100)}%` }} transition={{ ease: 'easeOut' }} />
              </div>
              <p className="weave-stage">{stageLabel(progress.stage)}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function stageLabel(stage: string): string {
  switch (stage) {
    case 'writing':
      return 'Writing the words';
    case 'illustrating':
      return 'Painting the pictures';
    case 'animating':
      return 'Bringing pages to life';
    case 'narrating':
      return 'Recording the narration';
    case 'filming':
      return 'Filming the video';
    case 'done':
      return 'Ready!';
    default:
      return '';
  }
}
