import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../lib/store';
import {
  IMAGE_PROVIDERS,
  KOKORO_VOICES,
  OPENAI_VOICES,
  TEXT_PROVIDERS,
  TTS_PROVIDERS,
  VIDEO_PROVIDERS,
} from '../lib/catalog';
import type { ModelOption, ProviderCatalogEntry } from '../lib/types';
import { IconClose, IconKey } from './icons';
import './settings.css';

const CUSTOM = '__custom__';

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
  return (
    <div className="model-picker">
      <select
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === CUSTOM ? '' : v);
        }}
      >
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
            {m.note ? ` — ${m.note}` : ''}
          </option>
        ))}
        {models.length > 1 && <option value={CUSTOM}>Custom model…</option>}
      </select>
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

function ProviderRow<T extends string>({
  title,
  hint,
  providers,
  providerId,
  model,
  onProvider,
  onModel,
  extra,
}: {
  title: string;
  hint: string;
  providers: ProviderCatalogEntry<T>[];
  providerId: T;
  model: string;
  onProvider: (id: T) => void;
  onModel: (id: string) => void;
  extra?: ReactNode;
}) {
  const current = providers.find((p) => p.id === providerId) ?? providers[0];
  return (
    <div className="provider-row">
      <div className="provider-row-head">
        <h4>{title}</h4>
        <p>{hint}</p>
      </div>
      <div className="provider-row-controls">
        <select value={providerId} onChange={(e) => onProvider(e.target.value as T)}>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <ModelPicker models={current.models} value={model} onChange={onModel} />
      </div>
      {extra}
      {current.docsUrl && (
        <a className="provider-docs" href={current.docsUrl} target="_blank" rel="noreferrer">
          {current.label} model list ↗
        </a>
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
    update({ keys: { ...settings.keys, [k]: v } });

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
                  Bring your own keys. They are stored only in this browser (localStorage) and sent
                  directly to each provider — never to us.
                </p>

                <label className="field">
                  <span className="field-label">OpenAI</span>
                  <input
                    type="password"
                    placeholder="sk-…"
                    value={settings.keys.openai}
                    onChange={(e) => setKey('openai', e.target.value)}
                    autoComplete="off"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Anthropic</span>
                  <input
                    type="password"
                    placeholder="sk-ant-…"
                    value={settings.keys.anthropic}
                    onChange={(e) => setKey('anthropic', e.target.value)}
                    autoComplete="off"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Google AI</span>
                  <input
                    type="password"
                    placeholder="AIza…"
                    value={settings.keys.google}
                    onChange={(e) => setKey('google', e.target.value)}
                    autoComplete="off"
                  />
                </label>
              </section>

              <section className="settings-section">
                <div className="section-title">
                  <h3>Generation models</h3>
                </div>

                <ProviderRow
                  title="Story text"
                  hint="Writes the tale and art direction."
                  providers={TEXT_PROVIDERS}
                  providerId={settings.text.provider}
                  model={settings.text.model}
                  onProvider={(provider) =>
                    update({ text: { provider, model: firstModel(TEXT_PROVIDERS, provider) } })
                  }
                  onModel={(model) => update({ text: { ...settings.text, model } })}
                />

                <ProviderRow
                  title="Illustrations"
                  hint="Paints every page and the cover."
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
                  providers={TTS_PROVIDERS}
                  providerId={settings.tts.provider}
                  model={settings.tts.model}
                  onProvider={(provider) =>
                    update({
                      tts: {
                        ...settings.tts,
                        provider,
                        model: firstModel(TTS_PROVIDERS, provider),
                        voice: provider === 'kokoro' ? 'af_heart' : provider === 'openai' ? 'nova' : settings.tts.voice,
                      },
                    })
                  }
                  onModel={(model) => update({ tts: { ...settings.tts, model } })}
                  extra={
                    (settings.tts.provider === 'openai' || settings.tts.provider === 'kokoro') && (
                      <label className="field inline-field">
                        <span className="field-label">Voice</span>
                        <select
                          value={settings.tts.voice}
                          onChange={(e) => update({ tts: { ...settings.tts, voice: e.target.value } })}
                        >
                          {(settings.tts.provider === 'kokoro' ? KOKORO_VOICES : OPENAI_VOICES).map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )
                  }
                />

                <div className="provider-row">
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
