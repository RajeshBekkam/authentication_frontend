import { expect, test } from '@playwright/test';
import {
  adminPage,
  apiInPage,
  findUserId,
  refocus,
  registerViaApi,
  requireAdmin,
  signedInPage,
  uniqueEmail,
} from './helpers';

test.beforeEach(() => requireAdmin());

test('AC6: removing users.read from a role hides admin nav after refocus; direct URL shows 403', async ({
  browser,
  page,
}) => {
  const email = uniqueEmail('ac6');
  const role = `E2E_${Date.now()}`;
  await registerViaApi(page, email);
  const admin = await adminPage(browser);

  // Set up a custom role with users.read and give it to the user (via the UI where it matters).
  await admin.page.goto('/admin/roles');
  await admin.page.getByLabel('Name').fill(role);
  await admin.page.getByRole('button', { name: 'Create role' }).click();
  await expect(admin.page.getByRole('rowheader', { name: new RegExp(role) })).toBeVisible();
  expect(
    (
      await apiInPage(admin.page, 'PUT', `/api/admin/roles/${role}/permissions`, {
        permissions: ['users.read'],
      })
    ).status,
  ).toBe(204);
  const id = await findUserId(admin.page, email);
  expect(
    (await apiInPage(admin.page, 'PUT', `/api/admin/users/${id}/roles`, { roles: ['User', role] }))
      .status,
  ).toBe(204);

  const operator = await signedInPage(browser, email);
  const nav = operator.page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Users' })).toBeVisible();

  // Admin removes users.read through the matrix.
  await admin.page.reload();
  await admin.page.getByRole('checkbox', { name: `users.read for ${role}` }).uncheck();
  const row = admin.page
    .getByRole('row')
    .filter({ has: admin.page.getByRole('rowheader', { name: new RegExp(role) }) });
  await row.getByRole('button', { name: 'Save' }).click();
  await admin.page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(admin.page.getByText(`Permissions for ${role} saved.`)).toBeVisible();

  await refocus(operator.page);
  await expect(nav.getByRole('link', { name: 'Users' })).toHaveCount(0);

  await operator.page.goto('/admin/users');
  await expect(operator.page.getByRole('heading', { name: /403/ })).toBeVisible();

  await operator.context.close();
  await admin.context.close();
});
