// SR-1: the CSRF token lives in this module variable only. It is never written to web storage or a
// JS-readable cookie; after a reload it is re-fetched from /api/auth/me.
let csrfToken: string | null = null;

export function getCsrfToken(): string | null {
  return csrfToken;
}

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export function clearCsrfToken(): void {
  csrfToken = null;
}
