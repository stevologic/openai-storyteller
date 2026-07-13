/** Progress callback for long-running provider work (model loads, etc.). */
export type OnProgress = (msg: string) => void;

/** Pull the first balanced JSON object out of a model response that may be
 *  wrapped in prose or ```json fences. */
export function extractJson(raw: string): unknown {
  let text = raw.trim();
  // strip code fences
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('The model did not return JSON. Try again or pick a stronger text model.');
  }
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    // Best-effort repair: trailing commas
    const repaired = slice.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(repaired);
  }
}

export function base64ToDataUrl(b64: string, mime = 'image/png'): string {
  return `data:${mime};base64,${b64}`;
}

export async function blobToObjectUrl(blob: Blob): Promise<string> {
  return URL.createObjectURL(blob);
}

/** Friendly error from a fetch Response, reading provider error bodies. */
export async function describeHttpError(res: Response, provider: string): Promise<Error> {
  let detail = '';
  try {
    const body = await res.json();
    detail = body?.error?.message || body?.error?.status || body?.message || JSON.stringify(body).slice(0, 240);
  } catch {
    try {
      detail = (await res.text()).slice(0, 240);
    } catch {
      /* ignore */
    }
  }
  const hint =
    res.status === 401
      ? ' — check that your API key is correct and has access.'
      : res.status === 429
        ? ' — rate limit or quota reached.'
        : res.status === 403
          ? ' — this key may not have access to that model.'
          : '';
  return new Error(`${provider} error (${res.status})${hint}${detail ? `: ${detail}` : ''}`);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
