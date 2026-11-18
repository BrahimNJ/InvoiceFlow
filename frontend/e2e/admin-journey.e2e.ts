import { expect, Page, test } from '@playwright/test';

import { expectAccessible, uniqueEmail } from './fixtures';
import { API_URL } from './global-setup';
import { signUp } from './steps';

const PASSWORD = 'Correct-horse-42!';

/**
 * One admin per Playwright project, so the desktop and phone runs never act on each other. Both accounts exist
 * before the API starts with them in ADMIN_EMAILS, which promotes only existing accounts (see e2e.yml and
 * docs/testing.md).
 */
function adminEmail(projectName: string): string {
  return `e2e-admin-${projectName}@example.com`;
}

async function createAccount(page: Page, email: string, firstName: string): Promise<void> {
  const response = await page.request.post(`${API_URL}/api/auth/register`, {
    data: { firstName, lastName: 'Test', email, password: PASSWORD },
  });
  expect(response.status()).toBe(201);
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('an admin suspends an account, which can no longer sign in, and finds it in the audit log', async ({
  page,
}, testInfo) => {
  test.slow();
  const admin = adminEmail(testInfo.project.name);
  const target = uniqueEmail();
  await createAccount(page, target, 'Jane');

  await signIn(page, admin);
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Admin' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Accounts' })).toBeVisible();

  await page.getByLabel('Search accounts').fill(target);
  const row = page.getByRole('row').filter({ hasText: target });
  await expect(row).toHaveCount(1);
  await expect(row.getByText('Active')).toBeVisible();
  await expectAccessible(page);

  await row.getByRole('button', { name: `Suspend: ${target}` }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Suspend Jane Test?' });
  await dialog.getByRole('button', { name: 'Suspend' }).click();
  await expect(row.getByText('Suspended')).toBeVisible();

  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link', { name: 'Audit log' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Audit log' })).toBeVisible();
  const entry = page.getByRole('row').filter({ hasText: target }).first();
  await expect(entry.getByText('Account suspended')).toBeVisible();
  await expect(entry.getByText(admin)).toBeVisible();
  await expectAccessible(page);

  // The suspended account is turned away with a clear message
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await signIn(page, target);
  await expect(page.getByText('This account is suspended. Contact the administrator.')).toBeVisible();
});

test('a user sees no admin entry and is sent back from /admin', async ({ page }) => {
  await signUp(page);

  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Admin' })).toHaveCount(0);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/dashboard$/);
});
