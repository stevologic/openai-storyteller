import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../lib/store';
import { ART_STYLE_PRESETS, TONE_PRESETS, LANGUAGES, providerLabel, TEXT_PROVIDERS, IMAGE_PROVIDERS } from '../lib/catalog';
import { weaveStory } from '../lib/generate';
import { estimateStoryCost, formatUsd, getGenerationConfigurationErrors, type StoryCostEstimate } from '../lib/cost';
import { openStoryFile } from '../lib/exportStory';
import { loadLatestBook } from '../lib/bookshelf';
import { describeCharacter } from '../lib/providers/vision';
import type { RenderedStory, Settings, StoryBrief } from '../lib/types';
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

const DEFAULT_BRIEF: StoryBrief = {
  idea: '',
  heroName: '',
  ageRange: '4–7',
  artStyle: ART_STYLE_PRESETS[0],
  pageCount: 6,
  lesson: '',
  tone: TONE_PRESETS[0],
  language: 'English (US)',
};

interface GenerationPlan {
  settings: Settings;
  brief: StoryBrief;
  estimate: StoryCostEstimate;
}

function snapshotSettings(settings: Settings): Settings {
  return {
    ...settings,
    keys: { ...settings.keys },
    text: { ...settings.text },
    youtube: { ...settings.youtube },
    image: { ...settings.image },
    video: { ...settings.video },
    tts: { ...settings.tts },
    storyVideo: { ...settings.storyVideo },
  };
}

/** Unlock narration capture while the Create storybook click is still active. */
function unlockExportAudio(): AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return undefined;
  const context = new AudioCtor();
  void context.resume().catch(() => undefined);
  return context;
}

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
  const storedBrief = useStore((s) => s.storyBrief);
  const setStoryBrief = useStore((s) => s.setStoryBrief);
  const setView = useStore((s) => s.setView);
  const progress = useStore((s) => s.progress);
  const setProgress = useStore((s) => s.setProgress);

  const brief = storedBrief ?? DEFAULT_BRIEF;
  const customStyle = !ART_STYLE_PRESETS.includes(brief.artStyle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingGeneration, setPendingGeneration] = useState<GenerationPlan | null>(null);
  const [writeStep, setWriteStep] = useState(0);
  const [describing, setDescribing] = useState(false);
  const [shelfBook, setShelfBook] = useState<RenderedStory | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  // The bookshelf keeps the most recent generated book across reloads.
  useEffect(() => {
    let alive = true;
    loadLatestBook().then((book) => {
      if (alive) setShelfBook(book);
    });
    return () => {
      alive = false;
    };
  }, []);

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
  useEffect(() => {
    if (!busy || progress.stage !== 'writing') return;
    const id = window.setInterval(() => setWriteStep((s) => (s + 1) % WRITING_STEPS.length), 2300);
    return () => window.clearInterval(id);
  }, [busy, progress.stage]);

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
  const textKeyMissing = textProvider?.keyField ? !settings.keys[textProvider.keyField] : false;

  const set = <K extends keyof StoryBrief>(k: K, v: StoryBrief[K]) =>
    setStoryBrief({ ...(useStore.getState().storyBrief ?? brief), [k]: v });

  async function onWeave() {
    setError(null);
    if (!brief.idea.trim()) {
      setError('Tell me what the story is about first.');
      return;
    }
    const configurationErrors = getGenerationConfigurationErrors(settings);
    if (configurationErrors.length) {
      setError(configurationErrors.join(' '));
      openSettings();
      return;
    }
    const quoteSettings = snapshotSettings(settings);
    const quoteBrief = { ...brief };
    setPendingGeneration({
      settings: quoteSettings,
      brief: quoteBrief,
      estimate: estimateStoryCost(quoteSettings, quoteBrief),
    });
  }

  async function confirmWeave() {
    const plan = pendingGeneration;
    if (!plan) return;
    const hasCloudNarration = plan.settings.tts.provider === 'openai' || plan.settings.tts.provider === 'xai';
    const exportAudioContext =
      plan.settings.storyVideo?.enabled !== false && hasCloudNarration ? unlockExportAudio() : undefined;
    setPendingGeneration(null);
    setBusy(true);
    setProgress({ stage: 'writing', message: 'Warming up the storyteller…', ratio: 0.02 });
    try {
      const story = await weaveStory(plan.settings, plan.brief, (p) => setProgress(p), { audioContext: exportAudioContext });
      setStory(story);
      setView('reader');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setProgress({ stage: 'error', message: '', ratio: 0 });
    } finally {
      setBusy(false);
      if (exportAudioContext && exportAudioContext.state !== 'closed') {
        void exportAudioContext.close().catch(() => undefined);
      }
    }
  }

  return (
    <div className="studio container">
      <div className="studio-head">
        <span className="eyebrow">Tiny Book Buddies AI Studio</span>
        <h1>Create a new storybook</h1>
        <p>Describe the tale. Tiny Book Buddies AI writes it, illustrates every page, and reads it aloud.</p>
        <p className="studio-open">
          or{' '}
          <button type="button" className="linklike" onClick={() => fileRef.current?.click()}>
            open a saved story
          </button>
          {shelfBook && (
            <>
              {' · '}
              <button
                type="button"
                className="linklike"
                onClick={() => {
                  setStory(shelfBook);
                  setView('reader');
                }}
              >
                continue “{shelfBook.title}”
              </button>
            </>
          )}
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
                  set('artStyle', '');
                } else {
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
              <span className="field-label">Language</span>
              <Dropdown
                value={brief.language}
                onChange={(v) => set('language', v)}
                options={LANGUAGES.map((l) => ({ value: l.label, label: l.label }))}
              />
            </label>
            <label className="field">
              <span className="field-label">Tone</span>
              <Dropdown
                value={brief.tone}
                onChange={(v) => set('tone', v)}
                options={TONE_PRESETS.map((t) => ({ value: t, label: t }))}
              />
            </label>
          </div>

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
                <span>YouTube copy</span>
                <b>{providerLabel(TEXT_PROVIDERS, settings.youtube.provider)}</b>
                <em>{settings.youtube.model}</em>
              </li>
              <li>
                <span>Video</span>
                <b>{settings.video.enabled ? settings.video.model : 'Cinematic motion'}</b>
              </li>
              <li>
                <span>Narration</span>
                <b>
                  {settings.tts.provider === 'openai'
                    ? `OpenAI · ${settings.tts.voice}`
                    : settings.tts.provider === 'xai'
                      ? `Grok Voice · ${settings.tts.voice}`
                    : settings.tts.provider === 'browser'
                      ? 'Browser voice'
                      : 'Off'}
                </b>
              </li>
            </ul>
            {textKeyMissing && (
              <p className="studio-nokey">
                Add your {providerLabel(TEXT_PROVIDERS, settings.text.provider)} API key in Settings to start
                creating.
              </p>
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
        {pendingGeneration && (
          <motion.div
            className="cost-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPendingGeneration(null)}
          >
            <motion.section
              className="cost-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cost-dialog-title"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              onClick={(event) => event.stopPropagation()}
            >
              <span className="eyebrow">Before we begin</span>
              <h2 id="cost-dialog-title">Estimated API cost</h2>
              {pendingGeneration.estimate.hasUnknownCosts ? (
                <p className="cost-total cost-total-warning">
                  Known subtotal: <strong>{formatUsd(pendingGeneration.estimate.knownTotal)}</strong> USD. One or more selected models have no current standard price.
                </p>
              ) : (
                <p className="cost-total">
                  <strong>{formatUsd(pendingGeneration.estimate.knownTotal)}</strong> USD estimated for this {pendingGeneration.estimate.pageCount}-page book.
                </p>
              )}
              <p className="cost-intro">No story, image, video, or voice API call is made until you confirm below.</p>

              <div className="cost-lines">
                {pendingGeneration.estimate.lines.map((line) => (
                  <div className="cost-line" key={line.label}>
                    <div>
                      <strong>{line.label}</strong>
                      <span>{line.basis}</span>
                    </div>
                    <b className={line.amount === undefined ? 'cost-unknown' : undefined}>
                      {line.amount === undefined ? 'Price unavailable' : formatUsd(line.amount)}
                    </b>
                  </div>
                ))}
              </div>

              {pendingGeneration.estimate.unknownReasons.length > 0 && (
                <p className="cost-note">
                  Check the provider pricing for: {pendingGeneration.estimate.unknownReasons.join(' ')}
                </p>
              )}
              <p className="cost-note">
                Text and narration are estimates because their final length is not known yet. Standard paid-tier price book: {pendingGeneration.estimate.pricedAt}.
              </p>
              <div className="cost-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setPendingGeneration(null)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={confirmWeave}>
                  <IconSpark /> Create storybook
                </button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {busy && (
          <motion.div className="weave-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="weave-card">
              <div className="weave-spinner" />
              <h2>
                {progress.stage === 'writing'
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
