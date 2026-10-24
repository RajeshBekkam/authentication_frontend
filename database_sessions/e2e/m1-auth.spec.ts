import { expect, test } from '@playwright/test';
import { DEFAULT_PASSWORD, loginViaUi, uniqueEmail } from './helpers';

test('AC1: register, log in, survive reload; no token reachable from JS', async ({ page }) => {
  const email = uniqueEmail('ac1');

  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(DEFAULT_PASSWORD);
  await page.getByLabel('Confirm password').fill(DEFAULT_PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/login\?registered=1/);
  await expect(page.getByText('Account created. You can sign in now.')).toBeVisible();

  await loginViaUi(page, email);
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  await expect(page.getByRole('main')).toContainText(email);

  await page.reload();
  await expect(page.getByRole('main')).toContainText(email);

  const storage = await page.evaluate(() => ({
    local: Object.keys(window.localStorage),
    session: Object.keys(window.sessionStorage),
    cookie: document.cookie,
  }));
  expect(storage.local).toEqual([]);
  expect(storage.session).toEqual([]);
  expect(storage.cookie).not.toContain('__Host-sid');

  // The cookie exists, but only at the HTTP layer.
  const cookies = await page.context().cookies();
  const sid = cookies.find((c) => c.name === '__Host-sid');
  expect(sid?.httpOnly).toBe(true);
  expect(sid?.sameSite).toBe('Strict');
});

test('AC10: logging out in one tab logs out all tabs', async ({ page, context }) => {
  const email = uniqueEmail('ac10');
  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(DEFAULT_PASSWORD);
  await page.getByLabel('Confirm password').fill(DEFAULT_PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await loginViaUi(page, email);

  const second = await context.newPage();
  await second.goto('/account');
  await expect(second.getByRole('heading', { name: 'Account' })).toBeVisible();

  await page.getByRole('button', { name: email }).click(); // user menu
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);

  // The other tab follows via BroadcastChannel, without any action of its own.
  await expect(second).toHaveURL(/\/login/);
});
