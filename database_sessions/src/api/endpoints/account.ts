import { apiFetch } from '../apiFetch';
import type { RevokedCount, SessionResponse } from '../types';

export function changePassword(currentPassword: string, newPassword: string) {
  return apiFetch<void>('/api/account/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  });
}

export function listMySessions(signal?: AbortSignal) {
  return apiFetch<SessionResponse[]>('/api/account/sessions', { signal });
}

export function revokeMySession(id: string) {
  return apiFetch<void>(`/api/account/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function revokeMyOtherSessions() {
  return apiFetch<RevokedCount>('/api/account/sessions/revoke-others', { method: 'POST' });
}
