import { apiFetch } from '../apiFetch';
import type { LoginResponse, MeResponse, RevokedCount } from '../types';

export function register(email: string, password: string) {
  return apiFetch<{ id: string; email: string }>('/api/auth/register', {
    method: 'POST',
    body: { email, password },
    skipUnauthorizedHandler: true,
  });
}

export function login(email: string, password: string) {
  // Cookie transport only: the browser app must never request or hold a bearer token.
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: { email, password, transport: 'cookie' },
    skipUnauthorizedHandler: true,
  });
}

export function logout() {
  return apiFetch<void>('/api/auth/logout', {
    method: 'POST',
    skipUnauthorizedHandler: true,
    silent: true,
  });
}

export function logoutAll() {
  return apiFetch<RevokedCount>('/api/auth/logout-all', { method: 'POST' });
}

export function getMe(signal?: AbortSignal) {
  return apiFetch<MeResponse>('/api/auth/me', { signal, skipUnauthorizedHandler: true });
}
