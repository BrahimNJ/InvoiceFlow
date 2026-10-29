import { expect, Page, test } from '@playwright/test';

import {
  addProductLine,
  ATELIER_DURAND,
  chooseCustomer,
  createCustomer,
  createProduct,
  issueInvoice,
  signUp,
} from './steps';

/** Images referenced by the README; regenerated with `npm run screenshots`, never edited by hand. */
const OUT = '../docs/screenshots';

async function shoot(page: Page, name: string): Promise<void> {
  // Webfonts and lazy chunks settled, so the image matches what a visitor sees
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

test('landing page in light and dark themes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await shoot(page, 'landing');

  await page.emulateMedia({ colorScheme: 'dark' });
  await shoot(page, 'landing-dark');
});

test('in-app documentation with a generated diagram', async ({ page }) => {
  await page.goto('/docs/architecture');
  await expect(page.locator('pre.mermaid svg').first()).toBeVisible();
  await shoot(page, 'docs');
});

test('invoice editor, invoice list and issued invoice', async ({ page }) => {
  test.slow();
  await signUp(page);
  await createCustomer(page, ATELIER_DURAND);
  await createCustomer(page, {
    name: 'Studio Kerouac',
    email: 'hello@studio-kerouac.example',
    street: '4 quai de la Fosse',
    postalCode: '44000',
    city: 'Nantes',
  });
  await createProduct(page, 'Website audit', '450');
  await createProduct(page, 'Design sprint (day)', '780');
  await createProduct(page, 'Maintenance, monthly', '120');

  // A first invoice, issued, so that the list shows a numbered invoice next to a draft
  await page.goto('/invoices/new');
  await chooseCustomer(page, 'Studio', 'Studio Kerouac');
  await addProductLine(page, 'sprint', 'Design sprint');
  await page.getByRole('textbox', { name: 'Line 1 quantity' }).fill('3');
  await issueInvoice(page);

  await page.goto('/invoices/new');
  await chooseCustomer(page, 'Atelier', ATELIER_DURAND.name);
  await addProductLine(page, 'audit', 'Website audit');
  await addProductLine(page, 'maint', 'Maintenance');
  await page.getByRole('textbox', { name: 'Line 2 quantity' }).fill('6');
  await page
    .getByLabel('Notes printed on the invoice')
    .fill('Thank you for your trust. PO 2026-118.');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  // Start of the workspace, without the "draft saved" toast
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await shoot(page, 'invoice-editor');

  await page.goto('/invoices');
  const issued = page.getByText(/^F-\d{4}-0001$/);
  await expect(issued).toBeVisible();
  // Summary cards load separately: wait until their placeholders are gone
  await expect(page.locator('.skeleton')).toHaveCount(0);
  await shoot(page, 'invoices');

  await issued.click();
  await expect(page.getByRole('heading', { level: 1, name: /^F-\d{4}-0001$/ })).toBeVisible();
  await shoot(page, 'invoice-issued');
});
