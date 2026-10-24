import { lazy } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { PERMISSIONS } from './api/types';
import { RequireAnonymous } from './auth/RequireAnonymous';
import { RequireAuth } from './auth/RequireAuth';
import { RequirePermission } from './auth/RequirePermission';
import { AppShell } from './components/AppShell';
import { RootLayout } from './components/RootLayout';
import { AccountPage } from './features/account/AccountPage';
import { SessionsPage } from './features/account/SessionsPage';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { NotFoundPage } from './features/errors/ErrorPages';
import { HomePage } from './features/home/HomePage';

// Admin screens are code-split so regular users never download them.
const UsersListPage = lazy(() => import('./features/admin/users/UsersListPage'));
const UserDetailPage = lazy(() => import('./features/admin/users/UserDetailPage'));
const RolesPage = lazy(() => import('./features/admin/roles/RolesPage'));
const AuditPage = lazy(() => import('./features/admin/audit/AuditPage'));

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      {
        path: '/login',
        element: (
          <RequireAnonymous>
            <LoginPage />
          </RequireAnonymous>
        ),
      },
      {
        path: '/register',
        element: (
          <RequireAnonymous>
            <RegisterPage />
          </RequireAnonymous>
        ),
      },
      {
        element: (
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <HomePage /> },
          { path: 'account', element: <AccountPage /> },
          { path: 'account/sessions', element: <SessionsPage /> },
          {
            path: 'admin/users',
            element: (
              <RequirePermission perm={PERMISSIONS.usersRead}>
                <UsersListPage />
              </RequirePermission>
            ),
          },
          {
            path: 'admin/users/:id',
            element: (
              <RequirePermission perm={PERMISSIONS.usersRead}>
                <UserDetailPage />
              </RequirePermission>
            ),
          },
          {
            path: 'admin/roles',
            element: (
              <RequirePermission perm={PERMISSIONS.rolesRead}>
                <RolesPage />
              </RequirePermission>
            ),
          },
          {
            path: 'admin/audit',
            element: (
              <RequirePermission perm={PERMISSIONS.auditRead}>
                <AuditPage />
              </RequirePermission>
            ),
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
