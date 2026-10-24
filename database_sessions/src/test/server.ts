import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { MeResponse } from '../api/types';

export const server = setupServer();

export const ALL_PERMISSIONS = [
  'users.read',
  'users.manage',
  'roles.assign',
  'roles.read',
  'roles.manage',
  'sessions.read',
  'sessions.revoke',
  'audit.read',
];

export function makeMe(overrides: Partial<MeResponse> = {}): MeResponse {
  return {
    userId: '11111111-1111-1111-1111-111111111111',
    email: 'user@example.com',
    roles: ['User'],
    permissions: [],
    sessionId: '22222222-2222-2222-2222-222222222222',
    transport: 'cookie',
    csrfToken: 'csrf-1',
    absoluteExpiresUtc: new Date(Date.now() + 6 * 3600_000).toISOString(),
    ...overrides,
  };
}

export const adminMe = () =>
  makeMe({ email: 'admin@example.com', roles: ['Admin'], permissions: ALL_PERMISSIONS });

export function meHandler(me: MeResponse | null) {
  return http.get('/api/auth/me', () =>
    me
      ? HttpResponse.json(me)
      : HttpResponse.json({ status: 401, title: 'Unauthorized' }, { status: 401 }),
  );
}

export const problem = (status: number, title: string, extra: Record<string, unknown> = {}) =>
  HttpResponse.json({ status, title, ...extra }, { status });
