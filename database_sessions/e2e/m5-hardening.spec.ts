import { expect, test } from '@playwright/test';
import { apiInPage, registerViaApi, signedInPage, uniqueEmail } from './helpers';

test('AC7: a POST without the CSRF header gets 403, the client refetches /me, retries and succeeds', async ({
  browser,
  page,
}) => {
  const email = uniqueEmail('ac7');
  await registerViaApi(page, email);
  const a = await signedInPage(browser, email);
  const b = await signedInPage(browser, email); // gives "sign out other sessions" something to do

  await a.page.goto('/account/sessions');
  await expect(a.page.getByText('This device')).toBeVisible();

  const seen: string[] = [];
  a.page.on('response', (r) => {
    const url = new URL(r.url());
    if (url.pathname.startsWith('/api/'))
      seen.push(`${r.request().method()} ${url.pathname} ${r.status()}`);
  });

  await a.page.evaluate(() =>
    (
      window as unknown as { __authTest: { dropNextCsrfHeader(): void } }
    ).__authTest.dropNextCsrfHeader(),
  );
  await a.page.getByRole('button', { name: 'Sign out all other sessions' }).click();
  await a.page.getByRole('dialog').getByRole('button', { name: 'Sign out' }).click();
  await expect(a.page.getByText(/1 session signed out\./)).toBeVisible();

  const flow = seen.filter((s) => s.includes('revoke-others') || s.startsWith('GET /api/auth/me'));
  expect(flow.slice(0, 3)).toEqual([
    'POST /api/account/sessions/revoke-others 403',
    'GET /api/auth/me 200',
    'POST /api/account/sessions/revoke-others 200',
  ]);

  await a.context.close();
  await b.context.close();
});

// Runs last: it deliberately exhausts the per-IP auth rate limit.
test('AC11: rapid failed logins show the rate-limit countdown', async ({ page }) => {
  await page.goto('/login');
  const email = uniqueEmail('ac11');

  // Burn through whatever the configured limit is.
  let status = 0;
  for (let i = 0; i < 200 && status !== 429; i++) {
    status = (
      await apiInPage(page, 'POST', '/api/auth/login', {
        email,
        password: 'nope nope nope',
        transport: 'cookie',
      })
    ).status;
  }
  expect(status).toBe(429);

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('nope nope nope');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText(/Too many attempts\. Try again in \d+ s\./)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled();
});
