import { getCsrfToken } from './csrf';
import type { ProblemDetails } from './types';

export const CSRF_FAILED_TITLE = 'CSRF validation failed';
const DEFAULT_RETRY_AFTER_SECONDS = 60;

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails;
  /** Seconds from Retry-After, only for 429. */
  readonly retryAfter: number | null;

  constructor(status: number, problem: ProblemDetails, retryAfter: number | null = null) {
    super(problem.title || `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
    this.retryAfter = retryAfter;
  }

  get isCsrfFailure(): boolean {
    return this.status === 403 && this.problem.title === CSRF_FAILED_TITLE;
  }
}

/** Network failure (no HTTP response at all). */
export class NetworkError extends Error {
  constructor() {
    super('Network error');
    this.name = 'NetworkError';
  }
}

export type ApiHandlers = {
  /** Session is gone: clear state and send the user to login. */
  onUnauthorized: () => void;
  /** Missing permission (non-CSRF 403). */
  onForbidden: () => void;
  /** 5xx or network failure. */
  onServerError: () => void;
  /** Re-obtain a CSRF token (GET /api/auth/me). Resolves true when a fresh token is held. */
  refreshCsrf: () => Promise<boolean>;
  /** Called after every successful response; feeds the idle monitor. */
  onActivity: () => void;
};

const noop = () => {};
let handlers: ApiHandlers = {
  onUnauthorized: noop,
  onForbidden: noop,
  onServerError: noop,
  refreshCsrf: async () => false,
  onActivity: noop,
};

export function configureApi(next: Partial<ApiHandlers>): void {
  handlers = { ...handlers, ...next };
}

// Test hook for AC 7: drop the CSRF header from the next unsafe request. Never present in production builds.
let dropNextCsrfHeader = false;
export function _dropNextCsrfHeaderForTest(): void {
  dropNextCsrfHeader = true;
}

export type ApiFetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /**
   * Let the caller handle 401 itself instead of running the global "session ended" redirect.
   * Used by login (401 = bad credentials), the /me bootstrap (401 = anonymous) and logout.
   */
  skipUnauthorizedHandler?: boolean;
  /** Don't toast for 403 / 5xx; the caller shows its own error. */
  silent?: boolean;
};

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'DELETE']);

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  return send<T>(path, options, false);
}

async function send<T>(path: string, options: ApiFetchOptions, isRetry: boolean): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  if (UNSAFE_METHODS.has(method)) {
    const token = getCsrfToken();
    if (dropNextCsrfHeader) {
      dropNextCsrfHeader = false;
    } else if (token) {
      headers['X-CSRF-Token'] = token;
    }
  }

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'same-origin',
      signal: options.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    if (!options.silent) handlers.onServerError();
    throw new NetworkError();
  }

  if (response.ok) {
    handlers.onActivity();
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  const problem = await readProblem(response);
  const retryAfter =
    response.status === 429 ? parseRetryAfter(response.headers.get('Retry-After')) : null;
  const error = new ApiError(response.status, problem, retryAfter);

  if (error.status === 401) {
    if (!options.skipUnauthorizedHandler) handlers.onUnauthorized();
    throw error;
  }

  if (error.isCsrfFailure) {
    if (!isRetry && (await handlers.refreshCsrf())) {
      return send<T>(path, options, true);
    }
    // Second CSRF failure (or no token obtainable): treat as an ended session.
    handlers.onUnauthorized();
    throw new ApiError(401, { status: 401, title: 'Session ended' });
  }

  if (error.status === 403 && !options.silent) handlers.onForbidden();
  if (error.status >= 500 && !options.silent) handlers.onServerError();
  throw error;
}

async function readProblem(response: Response): Promise<ProblemDetails> {
  const fallback: ProblemDetails = { status: response.status, title: response.statusText || '' };
  try {
    const text = await response.text();
    if (!text) return fallback;
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      const p = parsed as Partial<ProblemDetails>;
      return {
        status: typeof p.status === 'number' ? p.status : response.status,
        title: typeof p.title === 'string' ? p.title : fallback.title,
        detail: typeof p.detail === 'string' ? p.detail : undefined,
        errors: p.errors && typeof p.errors === 'object' ? p.errors : undefined,
      };
    }
  } catch {
    // Non-JSON error body; fall through.
  }
  return fallback;
}

/** Retry-After is either delta-seconds or an HTTP date. */
export function parseRetryAfter(value: string | null): number {
  if (!value) return DEFAULT_RETRY_AFTER_SECONDS;
  const seconds = Number(value.trim());
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(value);
  if (!Number.isNaN(date)) return Math.max(0, Math.ceil((date - Date.now()) / 1000));
  return DEFAULT_RETRY_AFTER_SECONDS;
}
