import { expect, test, type Browser, type Page } from '@playwright/test';

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? '';
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';
export const DEFAULT_PASSWORD = 'e2e correct horse battery';

export function requireAdmin() {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD');
}

export function uniqueEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/**
 * Calls the API from inside the page, so the browser handles the __Host-sid cookie natively and we
 * reuse the app's own same-origin setup. CSRF comes from /me, exactly like the app.
 */
export async function apiInPage<T = unknown>(
  page: Page,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<{ status: number; data: T | null }> {
  return page.evaluate(
    async ({ method, path, body }) => {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (method !== 'GET') {
        const me = await fetch('/api/auth/me', { credentials: 'same-origin' });
        if (me.ok) headers['X-CSRF-Token'] = ((await me.json()) as { csrfToken: string }).csrfToken;
      }
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const res = await fetch(path, {
        method,
        headers,
        credentials: 'same-origin',
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      return { status: res.status, data: text ? JSON.parse(text) : null };
    },
    { method, path, body },
  );
}

/** Register through the public API (anonymous; no cookie needed). */
export async function registerViaApi(page: Page, email: string, password = DEFAULT_PASSWORD) {
  if (page.url() === 'about:blank') await page.goto('/login');
  const res = await apiInPage(page, 'POST', '/api/auth/register', { email, password });
  expect(res.status, `register ${email}`).toBe(201);
}

export async function loginViaUi(page: Page, email: string, password = DEFAULT_PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
}

/** A fresh, signed-in browser context. */
export async function signedInPage(browser: Browser, email: string, password = DEFAULT_PASSWORD) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginViaUi(page, email, password);
  return { context, page };
}

export async function adminPage(browser: Browser) {
  return signedInPage(browser, ADMIN_EMAIL, ADMIN_PASSWORD);
}

export async function findUserId(admin: Page, email: string): Promise<string> {
  const res = await apiInPage<{ items: { id: string; email: string }[] }>(
    admin,
    'GET',
    `/api/admin/users?search=${encodeURIComponent(email)}&page=1&pageSize=5`,
  );
  const user = res.data?.items.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error(`user ${email} not found`);
  return user.id;
}

/** Simulate the tab regaining focus (TanStack Query listens for visibilitychange). */
export async function refocus(page: Page) {
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
}

export async function expectSessionEnded(page: Page) {
  await expect(page).toHaveURL(/\/login\?.*reason=expired/);
  await expect(page.getByText('Your session has ended. Please sign in again.')).toBeVisible();
}
