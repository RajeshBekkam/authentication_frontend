import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { onTestFinished } from 'vitest';
import type { MeResponse } from '../api/types';
import { installAuth } from '../auth/session';
import { setNavigator } from '../lib/navigation';
import { createQueryClient } from '../queryClient';
import { routes } from '../routes';
import { meHandler, server } from './server';

/** Renders the real route tree at `path` with a fresh cache and the given `/me` answer. */
export function renderApp(path: string, me: MeResponse | null) {
  server.use(meHandler(me));
  const queryClient = createQueryClient();
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  setNavigator((to, opts) => void router.navigate(to, opts));
  const uninstall = installAuth(queryClient);
  onTestFinished(() => {
    uninstall();
    queryClient.clear();
  });
  // session.ts reads window.location for returnTo; keep it in step with the memory router.
  window.history.replaceState(null, '', path);
  router.subscribe((state) => {
    window.history.replaceState(null, '', state.location.pathname + state.location.search);
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...utils, router, queryClient };
}
