/** Progress callback for long-running provider work (model loads, etc.). */
export type OnProgress = (msg: string) => void;

/** Normalize keys copied from password managers, .env files, or provider UIs.
 * API credentials never contain whitespace; zero-width copy artifacts are a
 * surprisingly common cause of credentials that look correct but fail auth.
 */
export function normalizeApiKey(value: string): string {
  let key = String(value ?? '').trim();
  key = key.replace(/^(?:export\s+)?[A-Z][A-Z0-9_]*\s*=\s*/i, '').trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/[\s\u200B-\u200D\u2060\uFEFF]/g, '');
}

/** Safe identifier for confirming which saved key a request will use. */
export function apiKeyEnding(value: string): string {
  const key = normalizeApiKey(value);
  return key ? `…${key.slice(-4)}` : '';
}

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

export class ProviderHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly provider: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ProviderHttpError';
  }
}

export function isProviderHttpError(error: unknown): error is ProviderHttpError {
  return error instanceof ProviderHttpError;
}

/** Friendly error from a fetch Response, reading provider error bodies. */
export async function describeHttpError(res: Response, provider: string): Promise<ProviderHttpError> {
  let detail = '';
  const requestId =
    res.headers.get('request-id') ??
    res.headers.get('x-request-id') ??
    res.headers.get('x-amzn-requestid') ??
    undefined;
  try {
    // Read once. Calling json() and then text() loses non-JSON provider errors
    // because a Response body can only be consumed once.
    const raw = (await res.text()).slice(0, 1000);
    if (raw) {
      try {
        const body = JSON.parse(raw);
        detail =
          body?.error?.message ||
          body?.error?.status ||
          body?.error?.type ||
          body?.message ||
          JSON.stringify(body);
      } catch {
        detail = raw;
      }
    }
  } catch {
    /* ignore unreadable response bodies */
  }
  const normalizedDetail = detail.toLowerCase();
  const isQuotaError =
    res.status === 429 &&
    (normalizedDetail.includes('current quota') ||
      normalizedDetail.includes('insufficient_quota') ||
      normalizedDetail.includes('billing'));
  const isRejectedXaiKey =
    res.status === 400 && provider.toLowerCase().startsWith('xai') && normalizedDetail.includes('incorrect api key');
  const hint =
    isQuotaError
      ? ' — API billing quota is unavailable; add API credits or enable API billing. ChatGPT subscriptions do not include API usage.'
      : isRejectedXaiKey
        ? ' — xAI rejected this credential. Use an enabled inference key from Console → API Keys, not a Management API key.'
        : res.status === 401
          ? ' — authentication failed; verify that the key is active and has access to this API.'
          : res.status === 429
            ? ' — rate limit or quota reached after automatic retries.'
            : res.status === 403
              ? ' — this key does not have access to that model or service.'
              : res.status === 402
                ? ' — billing or payment setup is required.'
                : '';
  const request = requestId ? ` [request ${requestId}]` : '';
  return new ProviderHttpError(
    `${provider} error (${res.status})${hint}${detail ? `: ${detail.slice(0, 500)}` : ''}${request}`,
    res.status,
    provider,
    requestId,
  );
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface FetchWithRetryOptions {
  /** Total attempts, including the first request. */
  attempts?: number;
  /** Timeout for each individual attempt. */
  timeoutMs?: number;
}

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529]);

async function isRetryableResponse(response: Response): Promise<boolean> {
  if (!RETRYABLE_STATUS.has(response.status)) return false;
  if (response.status !== 429) return true;
  try {
    const body = (await response.clone().text()).toLowerCase();
    // Billing/quota exhaustion is not transient. Retrying only delays the real
    // answer and can make a billing problem look like ordinary rate limiting.
    return !(
      body.includes('current quota') ||
      body.includes('insufficient_quota') ||
      body.includes('billing hard limit')
    );
  } catch {
    return true;
  }
}

function retryDelayMs(res: Response, attempt: number): number {
  const retryAfter = res.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.min(60_000, Math.max(0, seconds * 1000));
    const dateMs = Date.parse(retryAfter);
    if (Number.isFinite(dateMs)) return Math.min(60_000, Math.max(0, dateMs - Date.now()));
  }
  // Bounded exponential backoff. Small jitter prevents synchronized retries
  // when several page assets hit the same provider limit at once.
  return Math.min(20_000, 750 * 2 ** attempt + Math.floor(Math.random() * 250));
}

function attemptSignal(parent: AbortSignal | null | undefined, timeoutMs: number): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const abort = () => controller.abort(parent?.reason);
  parent?.addEventListener('abort', abort, { once: true });
  if (parent?.aborted) abort();
  const timer = globalThis.setTimeout(
    () => controller.abort(new DOMException('Request timed out', 'TimeoutError')),
    timeoutMs,
  );
  return {
    signal: controller.signal,
    cleanup: () => {
      globalThis.clearTimeout(timer);
      parent?.removeEventListener('abort', abort);
    },
  };
}

/** Fetch with bounded retries for explicit transient HTTP responses.
 *
 * GET requests also retry network failures. POST network failures are not
 * replayed because the provider may already have accepted a billable job.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: FetchWithRetryOptions = {},
): Promise<Response> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const timeoutMs = Math.max(1000, options.timeoutMs ?? 180_000);
  const method = (init.method ?? 'GET').toUpperCase();

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (init.signal?.aborted) {
      throw init.signal.reason ?? new DOMException('Request aborted', 'AbortError');
    }
    const timed = attemptSignal(init.signal, timeoutMs);
    try {
      const response = await fetch(input, { ...init, signal: timed.signal });
      if (!(await isRetryableResponse(response)) || attempt === attempts - 1) return response;
      await response.body?.cancel().catch(() => undefined);
      await sleep(retryDelayMs(response, attempt));
    } catch (error) {
      const mayRetryNetworkError = method === 'GET' && attempt < attempts - 1 && !init.signal?.aborted;
      if (!mayRetryNetworkError) throw error;
      await sleep(Math.min(5000, 500 * 2 ** attempt));
    } finally {
      timed.cleanup();
    }
  }

  throw new Error('Request failed without a response.');
}
