import { expect, test } from '@playwright/test';

import { expectAccessible } from './fixtures';

const PAGES = [
  { path: '/', heading: /invoic/i },
  { path: '/docs/overview', heading: /overview|invoiceflow/i },
  { path: '/login', heading: 'Welcome back' },
  { path: '/register', heading: 'Create your account' },
];

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`public pages, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    for (const { path, heading } of PAGES) {
      test(`${path} renders and has no accessibility violation`, async ({ page }) => {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
        await expect(page).toHaveTitle(/· InvoiceFlow|^InvoiceFlow/);
        await expectAccessible(page);
      });
    }
  });
}

test('the landing page shows the live API status', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/API.*(online|up|operational)/i).first()).toBeVisible();
});
