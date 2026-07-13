/* Chrome Built-in AI (Prompt API / Gemini Nano) — fully on-device text.
   The API surface has shifted across Chrome versions, so everything is
   feature-detected and wrapped defensively. */

export type OnProgress = (msg: string) => void;

/* eslint-disable @typescript-eslint/no-explicit-any */
function getLanguageModel(): any | null {
  const g = globalThis as any;
  return g.LanguageModel ?? g.ai?.languageModel ?? null;
}

/** True if Chrome's on-device model is present (available or downloadable). */
export async function chromeAvailable(): Promise<boolean> {
  const LM = getLanguageModel();
  if (!LM) return false;
  try {
    if (typeof LM.availability === 'function') {
      const a = await LM.availability();
      return a !== 'unavailable' && a !== 'no';
    }
    if (typeof LM.capabilities === 'function') {
      const c = await LM.capabilities();
      return Boolean(c?.available) && c.available !== 'no';
    }
  } catch {
    /* ignore */
  }
  return false;
}

export async function chromeText(system: string, user: string, onProgress?: OnProgress): Promise<string> {
  const LM = getLanguageModel();
  if (!LM) {
    throw new Error('Chrome Built-in AI is not available in this browser. Try Chrome 138+, or switch to Transformers.js.');
  }

  const monitor = (m: any) => {
    m.addEventListener?.('downloadprogress', (e: any) => {
      const pct = Math.round((e.loaded ?? 0) * 100);
      onProgress?.(`Downloading Chrome AI model… ${pct}%`);
    });
  };

  let session: any;
  try {
    session = await LM.create({ initialPrompts: [{ role: 'system', content: system }], monitor });
  } catch {
    // Older API shapes: systemPrompt string, or no options.
    try {
      session = await LM.create({ systemPrompt: system, monitor });
    } catch {
      session = await LM.create();
      user = `${system}\n\n${user}`;
    }
  }

  onProgress?.('Writing on your device…');
  try {
    const out = await session.prompt(user);
    return typeof out === 'string' ? out : String(out ?? '');
  } finally {
    session.destroy?.();
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
