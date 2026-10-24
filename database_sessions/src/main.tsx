import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { _dropNextCsrfHeaderForTest } from './api/apiFetch';
import { installAuth } from './auth/session';
import { setNavigator } from './lib/navigation';
import { createQueryClient } from './queryClient';
import { createAppRouter } from './routes';
import './styles.css';

const queryClient = createQueryClient();
const router = createAppRouter();

setNavigator((to, opts) => void router.navigate(to, opts));
installAuth(queryClient);

// Playwright hook for AC 7 (CSRF retry). Only in dev or explicit E2E builds, never in production.
if (import.meta.env.DEV || import.meta.env.VITE_E2E_HOOKS === 'true') {
  (window as unknown as { __authTest: object }).__authTest = {
    dropNextCsrfHeader: _dropNextCsrfHeaderForTest,
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
