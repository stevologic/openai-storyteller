import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../lib/store';
import {
  IMAGE_PROVIDERS,
  OPENAI_VOICES,
  TEXT_PROVIDERS,
  TTS_PROVIDERS,
  VIDEO_PROVIDERS,
  XAI_VOICES,
} from '../lib/catalog';
import type { ModelOption, ProviderCatalogEntry, ProviderKeys, Settings } from '../lib/types';
import { generateNarration, browserNarration } from '../lib/providers/tts';
import { checkProviderKey, getProviderModels, resolveModels, type ModelCategory, type ProviderKey, type RawModel } from '../lib/providers/models';
import { apiKeyEnding, normalizeApiKey } from '../lib/providers/util';
import { Dropdown } from './Dropdown';
import { IconClose, IconKey, IconVolume } from './icons';
import './settings.css';

type DynModels = Partial<Record<ProviderKey, RawModel[]>>;

const CUSTOM = '__custom__';

const PREVIEW_LINE = 'Once upon a time, a tiny star wished to shine as bright as the moon.';

/** Play a short sample so the user can hear a narration voice before choosing it.
 *  Cloud voices are synthesized via the API (needs a key); the browser voice
 *  speaks live for free. */
function NarrationPreview({ settings }: { settings: Settings }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const browserRef = useRef(browserNarration());
  const provider = settings.tts.provider;
  const voice = settings.tts.voice;
  const model = settings.tts.model;
  const cloudKey = provider === 'xai' ? settings.keys.xai : provider === 'openai' ? settings.keys.openai : '';
  const keyId = apiKeyEnding(cloudKey);

  function stop() {
    browserRef.current.cancel();
    const el = audioRef.current;
    if (el) {
      el.pause();
      if (el.src) URL.revokeObjectURL(el.src);
      el.removeAttribute('src');
    }
    setStatus('idle');
  }

  // Stop previews and clear stale auth results when the voice, provider, or
  // actual saved credential changes.
  useEffect(() => {
    setMessage('');
    return stop;
  }, [provider, voice, model, keyId]);

  async function play() {
    if (status === 'loading' || status === 'playing') {
      stop();
      return;
    }
    setMessage('');
    if (provider === 'browser') {
      if (!browserRef.current.supported) {
        setStatus('error');
        setMessage('This browser has no speech voices.');
        return;
      }
      setStatus('playing');
      browserRef.current.speak(PREVIEW_LINE, { onEnd: () => setStatus('idle') });
      return;
    }
    // Cloud voice — synthesize a sample through the selected provider's API.
    if (!cloudKey) {
      setStatus('error');
      setMessage(`Add your ${provider === 'xai' ? 'xAI' : 'OpenAI'} key above to preview.`);
      return;
    }
    setStatus('loading');
    try {
      const url = await generateNarration(settings, PREVIEW_LINE);
      if (!url) {
        setStatus('idle');
        return;
      }
      const el = audioRef.current ?? new Audio();
      audioRef.current = el;
      el.src = url;
      el.onended = () => setStatus('idle');
      await el.play();
      setStatus('playing');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Could not play a preview.');
    }
  }

  const label =
    status === 'loading' ? 'Loading…' : status === 'playing' ? 'Stop' : 'Preview voice';
  return (
    <div className="voice-preview">
      <button
        type="button"
        className="btn btn-ghost btn-sm voice-preview-btn"
        onClick={play}
        disabled={status === 'loading'}
      >
        <IconVolume /> {label}
      </button>
      {(provider === 'openai' || provider === 'xai') && keyId && (
        <span className="voice-key-id" title="Last four characters of the key this browser will send">
          Using {keyId}
        </span>
      )}
      {message && <span className="voice-preview-msg">{message}</span>}
    </div>
  );
}

function ModelPicker({
  models,
  value,
  onChange,
}: {
  models: ModelOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  const isKnown = models.some((m) => m.id === value);
  const selectValue = isKnown ? value : CUSTOM;
  const opts = models.map((m) => ({ value: m.id, label: m.note ? `${m.label} — ${m.note}` : m.label }));
  if (models.length > 1) opts.push({ value: CUSTOM, label: 'Custom model…' });
  return (
    <div className="model-picker">
      <Dropdown value={selectValue} onChange={(v) => onChange(v === CUSTOM ? '' : v)} options={opts} />
      {!isKnown && (
        <input
          type="text"
          placeholder="Type an exact model id"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function ApiKeyField({
  provider,
  label,
  placeholder,
  value,
  onChange,
}: {
  provider: ProviderKey;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [result, setResult] = useState<{ kind: 'idle' | 'checking' | 'success' | 'error'; message: string }>({
    kind: 'idle',
    message: '',
  });

  useEffect(() => setResult({ kind: 'idle', message: '' }), [value]);

  async function check() {
    setResult({ kind: 'checking', message: 'Checking…' });
    try {
      const count = await checkProviderKey(provider, value);
      setResult({ kind: 'success', message: `Key works · ${count} models available` });
    } catch (error) {
      setResult({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Key check failed.',
      });
    }
  }

  return (
    <div className="field key-field">
      <label className="field-label" htmlFor={`api-key-${provider}`}>{label}</label>
      <div className="key-input-row">
        <input
          id={`api-key-${provider}`}
          type="password"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm key-check-btn"
          onClick={check}
          disabled={!value || result.kind === 'checking'}
        >
          {result.kind === 'checking' ? 'Checking…' : 'Check key'}
        </button>
      </div>
      {result.message && (
        <span className={`key-check-result ${result.kind}`} role={result.kind === 'error' ? 'alert' : undefined}>
          {result.kind === 'success' ? '✓ ' : ''}{result.message}
        </span>
      )}
    </div>
  );
}

function ProviderRow<T extends string>({
  title,
  hint,
  providers,
  providerId,
  model,
  category,
  dyn,
  onProvider,
  onModel,
  extra,
}: {
  title: string;
  hint: string;
  providers: ProviderCatalogEntry<T>[];
  providerId: T;
  model: string;
  category: ModelCategory;
  dyn: DynModels;
  onProvider: (id: T) => void;
  onModel: (id: string) => void;
  extra?: ReactNode;
}) {
  const current = providers.find((p) => p.id === providerId) ?? providers[0];
  const { models, live } = resolveModels(current.models, current.keyField as ProviderKey | null, category, dyn);
  return (
    <div className="provider-row">
      <div className="provider-row-head">
        <h4>{title}</h4>
        <p>{hint}</p>
      </div>
      <div className="provider-row-controls">
        <Dropdown
          value={providerId}
          onChange={(v) => onProvider(v as T)}
          options={providers.map((p) => ({ value: p.id, label: p.label }))}
          ariaLabel={`${title} provider`}
        />
        <ModelPicker models={models} value={model} onChange={onModel} />
      </div>
      {extra}
      {(current.docsUrl || live) && (
        <div className="provider-row-foot">
          {current.docsUrl ? (
            <a className="provider-docs" href={current.docsUrl} target="_blank" rel="noreferrer">
              {current.label} model list ↗
            </a>
          ) : (
            <span />
          )}
          {live && (
            <span className="provider-live" title="Loaded live from the provider">
              ✓ latest models
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function SettingsPanel() {
  const open = useStore((s) => s.settingsOpen);
  const close = useStore((s) => s.closeSettings);
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);

  const setKey = (k: keyof typeof settings.keys, v: string) =>
    update({ keys: { ...settings.keys, [k]: normalizeApiKey(v) } });

  // Load each keyed provider's live model list when the panel opens so the
  // newest models surface in the dropdowns automatically (cached for 12h).
  const [dyn, setDyn] = useState<DynModels>({});
  useEffect(() => {
    if (!open) return;
    // Key fields update on every keystroke. Debounce validation and abort stale
    // requests so typing a key cannot fan out into dozens of /models calls.
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      (['openai', 'anthropic', 'google', 'xai'] as const).forEach((p) => {
        const key = settings.keys[p as keyof ProviderKeys];
        if (!key) return;
        getProviderModels(p, key, controller.signal).then(
          (models) => setDyn((s) => (s[p] === models ? s : { ...s, [p]: models })),
          (error) => {
            if (!controller.signal.aborted) console.warn(`${p} model list could not be loaded:`, error);
          },
        );
      });
    }, 600);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, settings.keys.openai, settings.keys.anthropic, settings.keys.google, settings.keys.xai]);

  // When switching a provider, snap the model to that provider's default.
  const firstModel = <T extends string>(list: ProviderCatalogEntry<T>[], id: T) =>
    list.find((p) => p.id === id)?.models[0]?.id ?? '';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="settings-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.aside
            className="settings-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 260 }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="settings-header">
              <div>
                <span className="eyebrow">Model Studio</span>
                <h2>Settings</h2>
              </div>
              <button className="btn btn-ghost btn-sm icon-btn" onClick={close} aria-label="Close settings">
                <IconClose />
              </button>
            </header>

            <div className="settings-body">
              <section className="settings-section">
                <div className="section-title">
                  <IconKey />
                  <h3>API keys</h3>
                </div>
                <p className="section-note">
                  Stored only in this browser and sent straight to each provider — never to us.
                </p>

                <div className="keys-grid">
                  <ApiKeyField provider="openai" label="OpenAI" placeholder="sk-…" value={settings.keys.openai} onChange={(v) => setKey('openai', v)} />
                  <ApiKeyField provider="anthropic" label="Anthropic" placeholder="sk-ant-…" value={settings.keys.anthropic} onChange={(v) => setKey('anthropic', v)} />
                  <ApiKeyField provider="google" label="Google AI" placeholder="AIza…" value={settings.keys.google} onChange={(v) => setKey('google', v)} />
                  <ApiKeyField provider="xai" label="xAI (Grok)" placeholder="xai-…" value={settings.keys.xai} onChange={(v) => setKey('xai', v)} />
                </div>
                <p className="section-note">
                  OpenAI API billing is separate from ChatGPT subscriptions. For xAI, use an inference key from
                  Console → API Keys—not a Management API key—and give it access to the needed endpoints/models.
                </p>
              </section>

              <section className="settings-section">
                <div className="section-title">
                  <h3>Generation models</h3>
                </div>

                <div className="provider-grid">
                <ProviderRow
                  title="Story text"
                  hint="Writes the tale and art direction."
                  category="text"
                  dyn={dyn}
                  providers={TEXT_PROVIDERS}
                  providerId={settings.text.provider}
                  model={settings.text.model}
                  onProvider={(provider) =>
                    update({ text: { provider, model: firstModel(TEXT_PROVIDERS, provider) } })
                  }
                  onModel={(model) => update({ text: { ...settings.text, model } })}
                />

                <ProviderRow
                  title="YouTube title & description"
                  hint="Writes publishing copy for the finished video."
                  category="text"
                  dyn={dyn}
                  providers={TEXT_PROVIDERS}
                  providerId={settings.youtube.provider}
                  model={settings.youtube.model}
                  onProvider={(provider) =>
                    update({ youtube: { provider, model: firstModel(TEXT_PROVIDERS, provider) } })
                  }
                  onModel={(model) => update({ youtube: { ...settings.youtube, model } })}
                />

                <ProviderRow
                  title="Illustrations"
                  hint="Paints every page and the cover."
                  category="image"
                  dyn={dyn}
                  providers={IMAGE_PROVIDERS}
                  providerId={settings.image.provider}
                  model={settings.image.model}
                  onProvider={(provider) =>
                    update({ image: { provider, model: firstModel(IMAGE_PROVIDERS, provider) } })
                  }
                  onModel={(model) => update({ image: { ...settings.image, model } })}
                />

                <ProviderRow
                  title="Video"
                  hint="Optional. Animates pages into short clips (slow & costly)."
                  category="video"
                  dyn={dyn}
                  providers={VIDEO_PROVIDERS}
                  providerId={settings.video.provider}
                  model={settings.video.model}
                  onProvider={(provider) =>
                    update({
                      video: {
                        provider,
                        model: firstModel(VIDEO_PROVIDERS, provider),
                        enabled: provider !== 'none',
                      },
                    })
                  }
                  onModel={(model) => update({ video: { ...settings.video, model } })}
                  extra={
                    settings.video.provider !== 'none' && (
                      <label className="toggle-line">
                        <input
                          type="checkbox"
                          checked={settings.video.enabled}
                          onChange={(e) => update({ video: { ...settings.video, enabled: e.target.checked } })}
                        />
                        <span>Generate a video clip per page</span>
                      </label>
                    )
                  }
                />

                <ProviderRow
                  title="Narration"
                  hint="Reads the story aloud."
                  category="tts"
                  dyn={dyn}
                  providers={TTS_PROVIDERS}
                  providerId={settings.tts.provider}
                  model={settings.tts.model}
                  onProvider={(provider) =>
                    update({
                      tts: {
                        ...settings.tts,
                        provider,
                        model: firstModel(TTS_PROVIDERS, provider),
                        voice: provider === 'openai' ? 'nova' : provider === 'xai' ? 'eve' : settings.tts.voice,
                      },
                    })
                  }
                  onModel={(model) => update({ tts: { ...settings.tts, model } })}
                  extra={
                    settings.tts.provider === 'openai' || settings.tts.provider === 'xai' ? (
                      <label className="field inline-field">
                        <div className="voice-head">
                          <span className="field-label">Voice</span>
                          <NarrationPreview settings={settings} />
                        </div>
                        <Dropdown
                          value={settings.tts.voice}
                          onChange={(v) => update({ tts: { ...settings.tts, voice: v } })}
                          options={(settings.tts.provider === 'xai' ? XAI_VOICES : OPENAI_VOICES).map((v) => ({
                            value: v.id,
                            label: v.label,
                          }))}
                        />
                      </label>
                    ) : settings.tts.provider === 'browser' ? (
                      <div className="inline-field">
                        <NarrationPreview settings={settings} />
                      </div>
                    ) : null
                  }
                />

                <div className="provider-row provider-row--wide">
                  <div className="provider-row-head">
                    <h4>Story video</h4>
                    <p>Render the whole book to a downloadable video while generating (MP4 where supported).</p>
                  </div>
                  <label className="toggle-line">
                    <input
                      type="checkbox"
                      checked={settings.storyVideo?.enabled !== false}
                      onChange={(e) => update({ storyVideo: { enabled: e.target.checked } })}
                    />
                    <span>Also make a video of the finished book</span>
                  </label>
                </div>
                </div>
              </section>
            </div>

            <footer className="settings-footer">
              <button className="btn btn-primary" onClick={close}>
                Done
              </button>
            </footer>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
