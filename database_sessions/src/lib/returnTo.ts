const PUBLIC_PATHS = ['/login', '/register'];

/**
 * SR-3: accept a post-login redirect only when it is a same-app relative path that starts with a
 * single "/". Anything else (absolute URLs, protocol-relative "//host", backslash tricks, control
 * characters, javascript: URLs) collapses to "/".
 */
export function sanitizeReturnTo(value: string | null | undefined): string {
  if (!value) return '/';
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  // Browsers treat "\" like "/" in URLs, so "/\evil.com" would be protocol-relative.
  if (value.includes('\\')) return '/';
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return '/';

  try {
    const base = 'http://app.invalid';
    const url = new URL(value, base);
    if (url.origin !== base) return '/';
    const path = url.pathname + url.search + url.hash;
    if (PUBLIC_PATHS.some((p) => url.pathname === p)) return '/';
    return path;
  } catch {
    return '/';
  }
}

export function loginPathWithReturn(current: string, reason?: 'expired'): string {
  const params = new URLSearchParams();
  const returnTo = sanitizeReturnTo(current);
  if (returnTo !== '/') params.set('returnTo', returnTo);
  if (reason) params.set('reason', reason);
  const qs = params.toString();
  return qs ? `/login?${qs}` : '/login';
}
