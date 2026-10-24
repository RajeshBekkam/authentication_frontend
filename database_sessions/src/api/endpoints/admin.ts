import { apiFetch } from '../apiFetch';
import type {
  AuditRecord,
  Paged,
  PermissionResponse,
  RevokedCount,
  RoleResponse,
  SessionResponse,
  UserDetail,
  UserSummary,
} from '../types';

const id = (value: string) => encodeURIComponent(value);

export function listUsers(
  params: { search: string; page: number; pageSize: number },
  signal?: AbortSignal,
) {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  if (params.search) qs.set('search', params.search);
  return apiFetch<Paged<UserSummary>>(`/api/admin/users?${qs}`, { signal });
}

export function getUser(userId: string, signal?: AbortSignal) {
  return apiFetch<UserDetail>(`/api/admin/users/${id(userId)}`, { signal });
}

export type UserAction = 'disable' | 'enable' | 'unlock';

export function userAction(userId: string, action: UserAction) {
  return apiFetch<void>(`/api/admin/users/${id(userId)}/${action}`, { method: 'POST' });
}

export function setUserRoles(userId: string, roles: string[]) {
  return apiFetch<void>(`/api/admin/users/${id(userId)}/roles`, {
    method: 'PUT',
    body: { roles },
  });
}

export function listUserSessions(userId: string, signal?: AbortSignal) {
  return apiFetch<SessionResponse[]>(`/api/admin/users/${id(userId)}/sessions`, { signal });
}

export function revokeAllUserSessions(userId: string) {
  return apiFetch<RevokedCount>(`/api/admin/users/${id(userId)}/sessions/revoke-all`, {
    method: 'POST',
  });
}

export function revokeSession(sessionId: string) {
  return apiFetch<void>(`/api/admin/sessions/${id(sessionId)}`, { method: 'DELETE' });
}

export function listRoles(signal?: AbortSignal) {
  return apiFetch<RoleResponse[]>('/api/admin/roles', { signal });
}

export function listPermissions(signal?: AbortSignal) {
  return apiFetch<PermissionResponse[]>('/api/admin/permissions', { signal });
}

export function createRole(name: string, description: string | null) {
  return apiFetch<RoleResponse>('/api/admin/roles', {
    method: 'POST',
    body: { name, description },
  });
}

export function setRolePermissions(name: string, permissions: string[]) {
  return apiFetch<void>(`/api/admin/roles/${id(name)}/permissions`, {
    method: 'PUT',
    body: { permissions },
  });
}

export const AUDIT_PAGE_SIZE = 50;

export function listAudit(
  params: { userId?: string; eventType?: string; page: number },
  signal?: AbortSignal,
) {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(AUDIT_PAGE_SIZE) });
  if (params.userId) qs.set('userId', params.userId);
  if (params.eventType) qs.set('eventType', params.eventType);
  return apiFetch<AuditRecord[]>(`/api/admin/audit?${qs}`, { signal });
}
