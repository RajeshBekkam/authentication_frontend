import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // Errors are surfaced (and retried manually) by the UI; never auto-retry auth-sensitive calls.
      queries: { retry: false, refetchOnWindowFocus: false, staleTime: 15_000 },
      mutations: { retry: false },
    },
  });
}
