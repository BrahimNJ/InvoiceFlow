import { expect, Page, test } from '@playwright/test';

import { expectAccessible, uniqueEmail } from './fixtures';

/**
 * The main journey on the real API: a new user signs up, adds a customer and a product, then drafts and issues an
 * invoice, which gets the first number of the year. Every screen on the way is checked with axe-core.
 */
test('a new user issues a first invoice', async ({ page }) => {
  // Eight axe-core scans on the way: longer than the default 30 s timeout allows
  test.slow();
  await signUp(page);
  await expectAccessible(page);

  await createCustomer(page, 'Atelier Durand');
  await createProduct(page, 'Website audit', '450');

  await page.getByRole('link', { name: 'Invoices' }).first().click();
  await expect(page).toHaveURL(/\/invoices$/);
  await expectAccessible(page);
  await page
    .getByRole('link', { name: /new invoice/i })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'New invoice' })).toBeVisible();

  const customerPicker = page.getByRole('combobox', { name: 'Customer' });
  await customerPicker.fill('Atelier');
  await page.getByRole('option', { name: /Atelier Durand/ }).click();
  await expect(page.getByText('12 rue des Lilas')).toBeVisible();

  const productPicker = page.getByRole('combobox', { name: 'Add from the catalogue' });
  await productPicker.fill('audit');
  await page.getByRole('option', { name: /Website audit/ }).click();
  await expect(page.getByRole('textbox', { name: 'Line 1 description' })).toHaveValue(
    'Website audit',
  );
  await page.getByRole('textbox', { name: 'Line 1 quantity' }).fill('2');
  await expectAccessible(page);

  await page.getByRole('button', { name: 'Issue invoice' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Issue this invoice?' });
  await dialog.getByRole('button', { name: 'Issue invoice' }).click();

  // The API numbers invoices by UTC year
  const year = new Date().getUTCFullYear();
  await expect(page).toHaveURL(/\/invoices\/\d+$/);
  await expect(page.getByRole('heading', { level: 1, name: `F-${year}-0001` })).toBeVisible();
  await expect(page.getByText('Issued', { exact: true }).first()).toBeVisible();
  // 2 × 450,00 € excl. VAT, 20 % VAT
  await expect(page.getByText(/1\s?080,00\s?€/).first()).toBeVisible();
  await expectAccessible(page);
});

async function signUp(page: Page): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('First name').fill('Camille');
  await page.getByLabel('Last name').fill('Martin');
  await page.getByLabel('Work email').fill(uniqueEmail());
  await page.getByLabel('Password', { exact: true }).fill('Correct-horse-42!');
  await page.getByLabel('Confirm password').fill('Correct-horse-42!');
  await page.getByRole('button', { name: 'Create account' }).click();
  // Often the first request to a freshly started API (cold JIT and pool, BCrypt): allow more than 5 s
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

async function createCustomer(page: Page, name: string): Promise<void> {
  await page.goto('/customers/new');
  await expect(page.getByRole('heading', { level: 1, name: 'New customer' })).toBeVisible();
  await page.getByLabel('Company or full name').fill(name);
  await page.getByLabel('Billing email').fill('compta@atelier-durand.example');
  await page.getByLabel('Street (optional)').fill('12 rue des Lilas');
  await page.getByLabel('Postal code (optional)').fill('69003');
  await page.getByLabel('City (optional)').fill('Lyon');
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Create customer' }).click();
  await expect(page).toHaveURL(/\/customers$/);
  await expect(page.getByText(name).first()).toBeVisible();
  await expectAccessible(page);
}

async function createProduct(page: Page, name: string, unitPrice: string): Promise<void> {
  await page.goto('/products/new');
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Unit price, excl. VAT').fill(unitPrice);
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Add to catalogue' }).click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByText(name).first()).toBeVisible();
  await expectAccessible(page);
}
