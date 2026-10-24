import type { QueryClient } from '@tanstack/react-query';
import { ApiError, configureApi } from '../api/apiFetch';
import { clearCsrfToken, setCsrfToken } from '../api/csrf';
import { getMe, logout } from '../api/endpoints/auth';
import { queryKeys } from '../api/queryKeys';
import type { MeResponse } from '../api/types';
import { currentPath, navigateTo } from '../lib/navigation';
import { loginPathWithReturn } from '../lib/returnTo';
import { showToast } from '../lib/toast';
import { broadcastAuth, openAuthChannel } from './authChannel';
import { recordActivity, recordRemoteActivity } from './idleMonitor';

let queryClient: QueryClient | null = null;

function qc(): QueryClient {
  if (!queryClient) throw new Error('installAuth() has not been called');
  return queryClient;
}

/** Wires apiFetch's global handlers and the cross-tab channel to this QueryClient. */
export function installAuth(client: QueryClient): () => void {
  queryClient = client;

  configureApi({
    onUnauthorized: handleUnauthorized,
    onForbidden: () => {
      showToast("You don't have permission to do that.", 'error');
      // Permissions may have changed server-side; refreshing /me updates the navigation.
      void client.invalidateQueries({ queryKey: queryKeys.me });
    },
    onServerError: () => showToast('Something went wrong. Please try again.', 'error'),
    refreshCsrf,
    onActivity: recordActivity,
  });

  const closeChannel = openAuthChannel((message) => {
    switch (message.type) {
      case 'logout':
        clearLocalAuth();
        if (!isOnPublicPage()) navigateTo('/login', { replace: true });
        break;
      case 'login':
        // Another tab signed in (possibly as someone else): drop everything and re-read /me.
        clearCsrfToken();
        client.removeQueries({ predicate: (q) => q.queryKey[0] !== queryKeys.me[0] });
        void client.invalidateQueries({ queryKey: queryKeys.me });
        break;
      case 'activity':
        recordRemoteActivity(message.at);
        break;
    }
  });

  return () => {
    closeChannel();
    queryClient = null;
  };
}

export async function fetchMe(signal?: AbortSignal): Promise<MeResponse | null> {
  try {
    const me = await getMe(signal);
    setCsrfToken(me.csrfToken);
    return me;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      // Anonymous. If we previously believed we were signed in, the session has ended.
      const hadUser = qc().getQueryData<MeResponse | null>(queryKeys.me);
      clearCsrfToken();
      if (hadUser) handleUnauthorized();
      return null;
    }
    throw err;
  }
}

export const meQueryOptions = {
  queryKey: queryKeys.me,
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchMe(signal),
  staleTime: 30_000,
  // Roles and permissions are re-read by the backend on every request; notice changes on refocus.
  refetchOnWindowFocus: 'always' as const,
  retry: false,
};

function clearLocalAuth(): void {
  clearCsrfToken();
  const client = qc();
  client.clear();
  client.setQueryData(queryKeys.me, null);
}

function isOnPublicPage(): boolean {
  const path = window.location.pathname;
  return path === '/login' || path === '/register';
}

let redirecting = false;

/** Global 401 handling (PRD 6.1). */
export function handleUnauthorized(): void {
  const returnTo = currentPath();
  clearLocalAuth();
  broadcastAuth({ type: 'logout' });
  if (isOnPublicPage() || redirecting) return;
  redirecting = true;
  navigateTo(loginPathWithReturn(returnTo, 'expired'), { replace: true });
  // Several requests can fail at once; only redirect once per burst.
  setTimeout(() => (redirecting = false), 1000);
}

async function refreshCsrf(): Promise<boolean> {
  try {
    const me = await getMe();
    setCsrfToken(me.csrfToken);
    qc().setQueryData(queryKeys.me, me);
    return me.csrfToken !== null;
  } catch {
    return false;
  }
}

/** Local half of sign-out: used after logout, logout-all, or revoking the current session. */
export function completeSignOut(): void {
  clearLocalAuth();
  broadcastAuth({ type: 'logout' });
  navigateTo('/login', { replace: true });
}

/** FR-7: tell the server, then clear local state regardless of the result. */
export async function signOut(): Promise<void> {
  try {
    await logout();
  } catch {
    // Ignored: the local session is cleared either way.
  }
  completeSignOut();
}

/** After a successful login: load /me into the cache and tell other tabs. */
export async function completeLogin(csrfToken: string): Promise<void> {
  const client = qc();
  setCsrfToken(csrfToken);
  client.removeQueries({ predicate: (q) => q.queryKey[0] !== queryKeys.me[0] });
  await client.fetchQuery({ ...meQueryOptions, staleTime: 0 });
  broadcastAuth({ type: 'login' });
}
