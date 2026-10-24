import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the REAL backend + SQL Server (PRD §10.1).
 *
 * Prerequisites:
 *   - The backend runs on http://localhost:5154 (Development), with a bootstrap admin.
 *   - E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD are set to that admin's credentials.
 *   - Recommended for the run: Auth__RateLimit__PermitLimit=100 so setup logins aren't throttled.
 *     The rate-limit spec (AC 11) keeps failing until it sees 429, whatever the limit is.
 *
 * The Vite dev server is started automatically and proxies /api to the backend (same origin).
 */
export default defineConfig({
  testDir: './e2e',
  // Tests share one backend and its per-IP rate limiter; run serially for determinism.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
