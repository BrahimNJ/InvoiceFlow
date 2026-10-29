import { expect, test } from '@playwright/test';

import { expectAccessible } from './fixtures';
import {
  addProductLine,
  ATELIER_DURAND,
  chooseCustomer,
  createCustomer,
  createProduct,
  issueInvoice,
  signUp,
} from './steps';

/**
 * The main journey on the real API: a new user signs up, adds a customer and a product, then drafts and issues an
 * invoice, which gets the first number of the year. Every screen on the way is checked with axe-core.
 */
test('a new user issues a first invoice', async ({ page }) => {
  // Eight axe-core scans on the way: longer than the default 30 s timeout allows
  test.slow();
  await signUp(page);
  await expectAccessible(page);

  await createCustomer(page, ATELIER_DURAND);
  await createProduct(page, 'Website audit', '450');

  await page.getByRole('link', { name: 'Invoices' }).first().click();
  await expect(page).toHaveURL(/\/invoices$/);
  await expectAccessible(page);
  await page
    .getByRole('link', { name: /new invoice/i })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'New invoice' })).toBeVisible();

  await chooseCustomer(page, 'Atelier', ATELIER_DURAND.name);
  await expect(page.getByText(ATELIER_DURAND.street)).toBeVisible();

  await addProductLine(page, 'audit', 'Website audit');
  await expect(page.getByRole('textbox', { name: 'Line 1 description' })).toHaveValue(
    'Website audit',
  );
  await page.getByRole('textbox', { name: 'Line 1 quantity' }).fill('2');
  await expectAccessible(page);

  await issueInvoice(page);

  // The API numbers invoices by UTC year
  const year = new Date().getUTCFullYear();
  await expect(page.getByRole('heading', { level: 1, name: `F-${year}-0001` })).toBeVisible();
  await expect(page.getByText('Issued', { exact: true }).first()).toBeVisible();
  // 2 × 450,00 € excl. VAT, 20 % VAT
  await expect(page.getByText(/1\s?080,00\s?€/).first()).toBeVisible();
  await expectAccessible(page);
});
