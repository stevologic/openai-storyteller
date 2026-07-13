import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../lib/store';
import { ART_STYLE_PRESETS, TONE_PRESETS, providerLabel, TEXT_PROVIDERS, IMAGE_PROVIDERS } from '../lib/catalog';
import { weaveStory } from '../lib/generate';
import { openStoryFile } from '../lib/exportStory';
import { describeCharacter } from '../lib/providers/vision';
import type { StoryBrief } from '../lib/types';
import { Dropdown } from './Dropdown';
import { IconSpark, IconSettings, IconImage } from './icons';
import './studio.css';

/** Read an image file, downscaled, as a JPEG data URL. */
function readImageResized(file: File, maxDim: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not process the image.'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('That image could not be read.'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('That image could not be read.'));
    reader.readAsDataURL(file);
  });
}

const AGE_BANDS = ['0–3', '3–6', '4–7', '6–9', '8–12'];
const CUSTOM = '__custom__';

// Shown one at a time while the writer model works (a single opaque call).
const WRITING_STEPS = [
  'Dreaming up the story',
  'Imagining your hero',
  'Shaping the plot, beat by beat',
  'Writing the pages',
  'Deciding the art direction',
  'Landing the gentle lesson',
  'Naming the book',
];

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
  const [writeStep, setWriteStep] = useState(0);
  const [describing, setDescribing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  async function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      set('characterImage', await readImageResized(file, 768));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that image.');
    }
  }

  async function onDescribe() {
    if (!brief.characterImage) return;
    setDescribing(true);
    setError(null);
    try {
      const desc = await describeCharacter(settings, brief.characterImage);
      set('characterDescription', desc.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not describe the photo. Try adding an API key, or type the look below.');
    } finally {
      setDescribing(false);
    }
  }

  // While the writer runs (an opaque single call), cycle descriptive sub-steps.
  // On-device runs emit real download/inference messages, which take priority.
  const deviceMsg = /download|device|model|ready|warming/i.test(progress.message);
  useEffect(() => {
    if (!busy || progress.stage !== 'writing' || deviceMsg) return;
    const id = window.setInterval(() => setWriteStep((s) => (s + 1) % WRITING_STEPS.length), 2300);
    return () => window.clearInterval(id);
  }, [busy, progress.stage, deviceMsg]);

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
              <Dropdown
                value={brief.ageRange}
                onChange={(v) => set('ageRange', v)}
                options={AGE_BANDS.map((a) => ({ value: a, label: `Ages ${a}` }))}
              />
            </label>
          </div>

          <div className="field">
            <span className="field-label">Character look (optional)</span>
            <div className="char-row">
              {brief.characterImage ? (
                <div className="char-thumb">
                  <img src={brief.characterImage} alt="Character reference" />
                  <button
                    type="button"
                    className="char-remove"
                    onClick={() => set('characterImage', undefined)}
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button type="button" className="char-add" onClick={() => photoRef.current?.click()}>
                  <IconImage />
                  <span>Add a photo</span>
                </button>
              )}
              <input ref={photoRef} type="file" accept="image/*" hidden onChange={onPhoto} />
              <div className="char-desc">
                <textarea
                  placeholder="Describe the hero’s look — e.g. a cheerful 5-year-old with curly brown hair and a green star t-shirt. Or add a photo and let AI describe it."
                  value={brief.characterDescription ?? ''}
                  onChange={(e) => set('characterDescription', e.target.value)}
                  rows={3}
                />
                {brief.characterImage && (
                  <button type="button" className="btn btn-ghost btn-sm char-describe" onClick={onDescribe} disabled={describing}>
                    <IconSpark />
                    {describing ? 'Looking at the photo…' : 'Describe from photo'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <label className="field">
            <span className="field-label">Art style</span>
            <Dropdown
              value={customStyle ? CUSTOM : brief.artStyle}
              onChange={(v) => {
                if (v === CUSTOM) {
                  setCustomStyle(true);
                  set('artStyle', '');
                } else {
                  setCustomStyle(false);
                  set('artStyle', v);
                }
              }}
              options={[
                ...ART_STYLE_PRESETS.map((a) => ({ value: a, label: a })),
                { value: CUSTOM, label: 'Custom style…' },
              ]}
            />
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
              <Dropdown
                value={brief.tone}
                onChange={(v) => set('tone', v)}
                options={TONE_PRESETS.map((t) => ({ value: t, label: t }))}
              />
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
                <b>
                  {settings.tts.provider === 'kokoro'
                    ? `On-device · ${settings.tts.voice}`
                    : settings.tts.provider === 'openai'
                      ? `OpenAI · ${settings.tts.voice}`
                      : settings.tts.provider === 'browser'
                        ? 'Browser voice'
                        : 'Off'}
                </b>
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
              <h2>
                {progress.stage === 'writing' && !deviceMsg
                  ? `${WRITING_STEPS[writeStep]}…`
                  : progress.message || 'Creating your story…'}
              </h2>
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
