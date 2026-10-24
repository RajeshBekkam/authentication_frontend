import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { MeResponse, PermissionResponse, RoleResponse, UserDetail } from '../api/types';
import { renderApp } from './renderApp';
import { ALL_PERMISSIONS, adminMe, makeMe, problem, server } from './server';

const OTHER_ID = '33333333-3333-3333-3333-333333333333';

function userDetail(overrides: Partial<UserDetail['user']> = {}, roles = ['User']): UserDetail {
  return {
    user: {
      id: OTHER_ID,
      email: 'target@example.com',
      isDisabled: false,
      disabledAtUtc: null,
      isLockedOut: false,
      lockoutEndUtc: null,
      createdUtc: '2026-01-01T00:00:00Z',
      ...overrides,
    },
    roles,
    permissions: [],
    failedLoginCount: 0,
    passwordChangedUtc: '2026-01-01T00:00:00Z',
  };
}

const ROLES: RoleResponse[] = [
  { name: 'Admin', description: 'Everything', isSystem: true, permissions: ALL_PERMISSIONS },
  { name: 'User', description: 'Default', isSystem: true, permissions: [] },
  { name: 'Ops', description: null, isSystem: false, permissions: ['users.read'] },
];
const PERMS: PermissionResponse[] = ALL_PERMISSIONS.map((name, i) => ({
  id: i + 1,
  name,
  description: `${name} desc`,
}));

function adminApis(detail: UserDetail) {
  server.use(
    http.get('/api/admin/users/:id', () => HttpResponse.json(detail)),
    http.get('/api/admin/users/:id/sessions', () => HttpResponse.json([])),
    http.get('/api/admin/roles', () => HttpResponse.json(ROLES)),
    http.get('/api/admin/permissions', () => HttpResponse.json(PERMS)),
  );
}

const withPerms = (permissions: string[]): MeResponse => makeMe({ permissions, roles: ['Ops'] });

describe('navigation', () => {
  it('shows no admin entries to a plain user', async () => {
    renderApp('/', makeMe());
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(within(nav).queryByText('Administration')).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
  });

  it('shows only the entries a delegated operator may use', async () => {
    renderApp('/', withPerms(['audit.read']));
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Audit log' })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
    expect(
      within(nav).queryByRole('link', { name: 'Roles & permissions' }),
    ).not.toBeInTheDocument();
  });

  it('shows everything to an admin', async () => {
    renderApp('/', adminMe());
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    for (const name of ['Users', 'Roles & permissions', 'Audit log']) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
    }
  });
});

describe('route guards', () => {
  it('redirects anonymous users to login with returnTo', async () => {
    const { router } = renderApp('/account/sessions', null);
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('?returnTo=%2Faccount%2Fsessions');
  });

  it('renders 403 (not a login redirect) for a missing permission', async () => {
    const { router } = renderApp('/admin/users', makeMe());
    expect(await screen.findByRole('heading', { name: /403/ })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin/users');
  });

  it('renders 404 for unknown routes', async () => {
    renderApp('/nope', makeMe());
    expect(await screen.findByRole('heading', { name: /404/ })).toBeInTheDocument();
  });
});

describe('user detail gating', () => {
  it('admin sees disable, roles editor and session revoke on another user', async () => {
    adminApis(userDetail());
    renderApp(`/admin/users/${OTHER_ID}`, adminMe());
    expect(await screen.findByRole('button', { name: 'Disable' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Save roles' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sessions' })).toBeInTheDocument();
  });

  it('hides Disable and the roles editor on your own record', async () => {
    const me = adminMe();
    adminApis(userDetail({ id: me.userId, email: me.email }, ['Admin']));
    renderApp(`/admin/users/${me.userId}`, me);
    expect(await screen.findByText('You cannot disable your own account.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Disable' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save roles' })).not.toBeInTheDocument();
    expect(screen.getByText('You cannot change your own roles.')).toBeInTheDocument();
  });

  it('users.read only: no actions, read-only roles, no sessions panel', async () => {
    adminApis(userDetail());
    renderApp(`/admin/users/${OTHER_ID}`, withPerms(['users.read']));
    expect(await screen.findByRole('heading', { name: 'target@example.com' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Account actions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save roles' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sessions' })).not.toBeInTheDocument();
  });

  it('roles.assign without roles.read shows current roles read-only', async () => {
    adminApis(userDetail());
    renderApp(`/admin/users/${OTHER_ID}`, withPerms(['users.read', 'roles.assign']));
    await screen.findByRole('heading', { name: 'Roles' });
    expect(screen.queryByRole('button', { name: 'Save roles' })).not.toBeInTheDocument();
  });

  it('sessions.read without sessions.revoke shows sessions without revoke buttons', async () => {
    adminApis(userDetail());
    server.use(
      http.get('/api/admin/users/:id/sessions', () =>
        HttpResponse.json([
          {
            id: 's1',
            transport: 'cookie',
            createdUtc: '2026-01-01T00:00:00Z',
            lastSeenUtc: '2026-01-01T00:00:00Z',
            idleExpiresUtc: '2026-01-01T00:30:00Z',
            absoluteExpiresUtc: '2026-01-01T12:00:00Z',
            revokedUtc: null,
            revokedReason: null,
            ipAddress: '10.0.0.1',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0',
            isCurrent: false,
          },
        ]),
      ),
    );
    renderApp(`/admin/users/${OTHER_ID}`, withPerms(['users.read', 'sessions.read']));
    expect(await screen.findByText('10.0.0.1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Revoke/ })).not.toBeInTheDocument();
  });

  it('shows Unlock only for locked users and Enable only for disabled users', async () => {
    adminApis(userDetail({ isLockedOut: true, lockoutEndUtc: '2030-01-01T10:00:00Z' }));
    renderApp(`/admin/users/${OTHER_ID}`, adminMe());
    expect(await screen.findByRole('button', { name: 'Unlock' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enable' })).not.toBeInTheDocument();
  });

  it('shows the 409 title inline when disabling the last admin', async () => {
    adminApis(userDetail({}, ['Admin']));
    server.use(
      http.post('/api/admin/users/:id/disable', () =>
        problem(409, 'Cannot disable the last active admin'),
      ),
    );
    renderApp(`/admin/users/${OTHER_ID}`, adminMe());
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Disable' }));
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(/immediately signs the user out everywhere/),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Disable' }));
    expect(
      await within(dialog).findByText('Cannot disable the last active admin'),
    ).toBeInTheDocument();
  });

  it('shows a not-found state for an unknown user', async () => {
    server.use(http.get('/api/admin/users/:id', () => problem(404, 'Not Found')));
    renderApp(`/admin/users/${OTHER_ID}`, adminMe());
    expect(await screen.findByRole('heading', { name: 'User not found' })).toBeInTheDocument();
  });
});

describe('roles matrix gating', () => {
  it('Admin row is read-only and locked; other rows editable with roles.manage', async () => {
    adminApis(userDetail());
    renderApp('/admin/roles', adminMe());
    const adminBox = await screen.findByRole('checkbox', { name: 'users.read for Admin' });
    expect(adminBox).toBeDisabled();
    expect(adminBox).toBeChecked();
    expect(
      screen.getAllByText('The Admin role always has every permission.').length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('checkbox', { name: 'users.read for Ops' })).toBeEnabled();
    expect(screen.getByRole('heading', { name: 'Create role' })).toBeInTheDocument();
  });

  it('roles.read only: everything read-only and no create form', async () => {
    adminApis(userDetail());
    renderApp('/admin/roles', withPerms(['roles.read']));
    expect(await screen.findByRole('checkbox', { name: 'users.read for Ops' })).toBeDisabled();
    expect(screen.queryByRole('heading', { name: 'Create role' })).not.toBeInTheDocument();
  });
});

describe('session expiry', () => {
  it('a 401 on any call redirects to login with the session-ended message', async () => {
    server.use(http.get('/api/account/sessions', () => problem(401, 'Unauthorized')));
    const { router } = renderApp('/account/sessions', makeMe());
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toContain('reason=expired');
    expect(router.state.location.search).toContain('returnTo=%2Faccount%2Fsessions');
    // Anonymous now: /me is no longer called with stale state.
    server.use(http.get('/api/auth/me', () => problem(401, 'Unauthorized')));
    expect(
      await screen.findByText('Your session has ended. Please sign in again.'),
    ).toBeInTheDocument();
  });
});
