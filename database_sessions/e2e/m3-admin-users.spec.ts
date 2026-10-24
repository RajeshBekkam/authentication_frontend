import { expect, test } from '@playwright/test';
import {
  ADMIN_EMAIL,
  DEFAULT_PASSWORD,
  adminPage,
  expectSessionEnded,
  findUserId,
  registerViaApi,
  requireAdmin,
  signedInPage,
  uniqueEmail,
} from './helpers';

test.beforeEach(() => requireAdmin());

const GENERIC = 'Invalid email or password, or the account is temporarily locked.';

test('AC2: lockout is indistinguishable from a wrong password; admin unlock restores login', async ({
  browser,
  page,
}) => {
  const email = uniqueEmail('ac2');
  await registerViaApi(page, email);

  await page.goto('/login');
  for (let i = 0; i < 5; i++) {
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(`wrong password ${i}`);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText(GENERIC)).toBeVisible();
  }
  // Correct password, but locked: same message.
  await page.getByLabel('Password').fill(DEFAULT_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText(GENERIC)).toBeVisible();

  const admin = await adminPage(browser);
  const id = await findUserId(admin.page, email);
  await admin.page.goto(`/admin/users/${id}`);
  await admin.page.getByRole('button', { name: 'Unlock' }).click();
  await admin.page.getByRole('dialog').getByRole('button', { name: 'Unlock' }).click();
  await expect(admin.page.getByText('User unlocked.')).toBeVisible();

  await page.getByLabel('Password').fill(DEFAULT_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await admin.context.close();
});

test('AC5: disabling a user ends their session; re-login says "Account disabled"', async ({
  browser,
  page,
}) => {
  const email = uniqueEmail('ac5');
  await registerViaApi(page, email);
  const victim = await signedInPage(browser, email);
  const admin = await adminPage(browser);

  const id = await findUserId(admin.page, email);
  await admin.page.goto(`/admin/users/${id}`);
  await admin.page.getByRole('button', { name: 'Disable' }).click();
  const dialog = admin.page.getByRole('dialog');
  await expect(dialog).toContainText(email);
  await expect(dialog).toContainText('This immediately signs the user out everywhere.');
  await dialog.getByRole('button', { name: 'Disable' }).click();
  await expect(admin.page.getByText('Disabled', { exact: true })).toBeVisible();

  await victim.page.goto('/account/sessions');
  await expectSessionEnded(victim.page);
  await victim.page.getByLabel('Email').fill(email);
  await victim.page.getByLabel('Password').fill(DEFAULT_PASSWORD);
  await victim.page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    victim.page.getByText('This account has been disabled. Contact an administrator.'),
  ).toBeVisible();

  await victim.context.close();
  await admin.context.close();
});

test('AC9: Admin role is not editable; admins cannot disable or demote themselves', async ({
  browser,
}) => {
  const admin = await adminPage(browser);

  await admin.page.goto('/admin/roles');
  const adminBoxes = admin.page.getByRole('checkbox', { name: / for Admin$/ });
  const count = await adminBoxes.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) await expect(adminBoxes.nth(i)).toBeDisabled();

  const selfId = await findUserId(admin.page, ADMIN_EMAIL);
  await admin.page.goto(`/admin/users/${selfId}`);
  await expect(admin.page.getByRole('heading', { name: 'Account actions' })).toBeVisible();
  await expect(admin.page.getByRole('button', { name: 'Disable' })).toHaveCount(0);
  await expect(admin.page.getByRole('button', { name: 'Save roles' })).toHaveCount(0);
  await expect(admin.page.getByText('You cannot change your own roles.')).toBeVisible();

  await admin.context.close();
});
