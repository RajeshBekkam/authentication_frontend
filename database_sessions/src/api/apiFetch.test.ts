import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { problem, server } from '../test/server';
import { ApiError, apiFetch, configureApi, parseRetryAfter } from './apiFetch';
import { setCsrfToken } from './csrf';

const handlers = {
  onUnauthorized: vi.fn(),
  onForbidden: vi.fn(),
  onServerError: vi.fn(),
  refreshCsrf: vi.fn(async () => false),
  onActivity: vi.fn(),
};

beforeEach(() => {
  Object.values(handlers).forEach((h) => h.mockReset());
  handlers.refreshCsrf.mockResolvedValue(false);
  configureApi(handlers);
});

function captureHeaders(method: 'get' | 'post' | 'put' | 'delete') {
  const seen: Headers[] = [];
  server.use(
    http[method]('/api/thing', ({ request }) => {
      seen.push(request.headers);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return seen;
}

describe('apiFetch CSRF header', () => {
  it.each(['POST', 'PUT', 'DELETE'] as const)('adds X-CSRF-Token on %s', async (method) => {
    setCsrfToken('tok-123');
    const seen = captureHeaders(method.toLowerCase() as 'post');
    await apiFetch('/api/thing', { method });
    expect(seen[0]?.get('X-CSRF-Token')).toBe('tok-123');
  });

  it('never adds it on GET', async () => {
    setCsrfToken('tok-123');
    const seen = captureHeaders('get');
    await apiFetch('/api/thing');
    expect(seen[0]?.has('X-CSRF-Token')).toBe(false);
  });

  it('omits it when no token is held', async () => {
    const seen = captureHeaders('post');
    await apiFetch('/api/thing', { method: 'POST' });
    expect(seen[0]?.has('X-CSRF-Token')).toBe(false);
  });

  it('sends JSON bodies with Content-Type and same-origin credentials', async () => {
    let contentType: string | null = null;
    let body: unknown;
    server.use(
      http.post('/api/thing', async ({ request }) => {
        contentType = request.headers.get('Content-Type');
        body = await request.json();
        return HttpResponse.json({ ok: true });
      }),
    );
    const spy = vi.spyOn(globalThis, 'fetch');
    const result = await apiFetch<{ ok: boolean }>('/api/thing', {
      method: 'POST',
      body: { a: 1 },
    });
    expect(result).toEqual({ ok: true });
    expect(contentType).toBe('application/json');
    expect(body).toEqual({ a: 1 });
    expect(spy.mock.calls[0]?.[1]?.credentials).toBe('same-origin');
    spy.mockRestore();
  });
});

describe('apiFetch 401 handling', () => {
  it('runs the global unauthorized handler', async () => {
    server.use(http.get('/api/thing', () => problem(401, 'Unauthorized')));
    await expect(apiFetch('/api/thing')).rejects.toMatchObject({ status: 401 });
    expect(handlers.onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('lets login-style callers opt out', async () => {
    server.use(http.post('/api/thing', () => problem(401, 'Login failed')));
    await expect(
      apiFetch('/api/thing', { method: 'POST', skipUnauthorizedHandler: true }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(handlers.onUnauthorized).not.toHaveBeenCalled();
  });
});

describe('apiFetch CSRF 403 retry', () => {
  it('refreshes the token and retries exactly once', async () => {
    setCsrfToken('stale');
    const tokens: (string | null)[] = [];
    server.use(
      http.post('/api/thing', ({ request }) => {
        const token = request.headers.get('X-CSRF-Token');
        tokens.push(token);
        return token === 'fresh'
          ? HttpResponse.json({ ok: true })
          : problem(403, 'CSRF validation failed');
      }),
    );
    handlers.refreshCsrf.mockImplementation(async () => {
      setCsrfToken('fresh');
      return true;
    });

    await expect(apiFetch('/api/thing', { method: 'POST' })).resolves.toEqual({ ok: true });
    expect(tokens).toEqual(['stale', 'fresh']);
    expect(handlers.refreshCsrf).toHaveBeenCalledTimes(1);
    expect(handlers.onUnauthorized).not.toHaveBeenCalled();
  });

  it('treats a second CSRF failure as 401', async () => {
    setCsrfToken('stale');
    let calls = 0;
    server.use(
      http.post('/api/thing', () => {
        calls++;
        return problem(403, 'CSRF validation failed');
      }),
    );
    handlers.refreshCsrf.mockResolvedValue(true);

    await expect(apiFetch('/api/thing', { method: 'POST' })).rejects.toMatchObject({ status: 401 });
    expect(calls).toBe(2);
    expect(handlers.refreshCsrf).toHaveBeenCalledTimes(1);
    expect(handlers.onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('reports a plain 403 as a permission problem, without retrying', async () => {
    let calls = 0;
    server.use(
      http.post('/api/thing', () => {
        calls++;
        return problem(403, 'Forbidden');
      }),
    );
    await expect(apiFetch('/api/thing', { method: 'POST' })).rejects.toMatchObject({ status: 403 });
    expect(calls).toBe(1);
    expect(handlers.onForbidden).toHaveBeenCalledTimes(1);
    expect(handlers.refreshCsrf).not.toHaveBeenCalled();
  });
});

describe('apiFetch 429 and errors', () => {
  it('parses Retry-After on 429 (empty body from the rate limiter)', async () => {
    server.use(
      http.post(
        '/api/thing',
        () => new HttpResponse(null, { status: 429, headers: { 'Retry-After': '42' } }),
      ),
    );
    const err = await apiFetch('/api/thing', { method: 'POST' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(429);
    expect((err as ApiError).retryAfter).toBe(42);
  });

  it('parses Retry-After formats', () => {
    expect(parseRetryAfter('7')).toBe(7);
    expect(parseRetryAfter(null)).toBe(60);
    expect(parseRetryAfter('garbage')).toBe(60);
    const inTen = new Date(Date.now() + 10_000).toUTCString();
    expect(parseRetryAfter(inTen)).toBeGreaterThanOrEqual(9);
  });

  it('parses ProblemDetails with validation errors', async () => {
    server.use(
      http.post('/api/thing', () =>
        problem(400, 'One or more validation errors occurred.', {
          errors: { Password: ['Password is too repetitive.'] },
        }),
      ),
    );
    const err = (await apiFetch('/api/thing', { method: 'POST' }).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(err.problem.errors).toEqual({ Password: ['Password is too repetitive.'] });
  });

  it('signals server errors and network failures', async () => {
    server.use(http.get('/api/thing', () => problem(500, 'Boom')));
    await expect(apiFetch('/api/thing')).rejects.toMatchObject({ status: 500 });
    expect(handlers.onServerError).toHaveBeenCalledTimes(1);

    server.use(http.get('/api/thing', () => HttpResponse.error()));
    await expect(apiFetch('/api/thing')).rejects.toThrow('Network error');
    expect(handlers.onServerError).toHaveBeenCalledTimes(2);
  });

  it('records activity on success only', async () => {
    server.use(http.get('/api/thing', () => HttpResponse.json({})));
    await apiFetch('/api/thing');
    expect(handlers.onActivity).toHaveBeenCalledTimes(1);
  });
});
