import { expect, test } from '@playwright/test';
import {
  DEFAULT_PASSWORD,
  expectSessionEnded,
  registerViaApi,
  signedInPage,
  uniqueEmail,
} from './helpers';

test('AC3: a 6th sign-in evicts the oldest session', async ({ browser, page }) => {
  const email = uniqueEmail('ac3');
  await registerViaApi(page, email);

  const contexts = [];
  for (let i = 0; i < 6; i++) contexts.push(await signedInPage(browser, email));

  const newest = contexts[5]!.page;
  await newest.goto('/account/sessions');
  await expect(newest.getByRole('row')).toHaveCount(1 + 5); // header + 5 sessions

  const oldest = contexts[0]!.page;
  await oldest.goto('/account/sessions'); // next action hits the API
  await expectSessionEnded(oldest);

  for (const c of contexts) await c.context.close();
});

test('AC4: revoking another session ends it on its next request', async ({ browser, page }) => {
  const email = uniqueEmail('ac4');
  await registerViaApi(page, email);
  const a = await signedInPage(browser, email);
  const b = await signedInPage(browser, email);

  await a.page.goto('/account/sessions');
  const otherRow = a.page
    .getByRole('row')
    .filter({ has: a.page.getByRole('button', { name: /Revoke/ }) })
    .filter({ hasNotText: 'This device' })
    .first();
  await otherRow.getByRole('button', { name: /Revoke/ }).click();
  await a.page.getByRole('dialog').getByRole('button', { name: 'Revoke' }).click();
  await expect(a.page.getByText('Session signed out.')).toBeVisible();

  await b.page.goto('/account/sessions');
  await expectSessionEnded(b.page);

  await a.context.close();
  await b.context.close();
});

test('AC8: changing the password signs out other sessions but not this one', async ({
  browser,
  page,
}) => {
  const email = uniqueEmail('ac8');
  await registerViaApi(page, email);
  const a = await signedInPage(browser, email);
  const b = await signedInPage(browser, email);

  await a.page.goto('/account');
  await a.page.getByLabel('Current password').fill(DEFAULT_PASSWORD);
  await a.page.getByLabel('New password', { exact: true }).fill('a brand new passphrase');
  await a.page.getByLabel('Confirm new password').fill('a brand new passphrase');
  await a.page.getByRole('button', { name: 'Change password' }).click();
  await expect(
    a.page.getByText('Password changed. All other sessions were signed out.'),
  ).toBeVisible();

  await b.page.goto('/account/sessions');
  await expectSessionEnded(b.page);

  await a.page.goto('/account/sessions');
  await expect(a.page.getByText('This device')).toBeVisible();

  await a.context.close();
  await b.context.close();
});
