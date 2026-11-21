import { expect, test } from '@playwright/test';

import { expectAccessible } from './fixtures';
import {
  addProductLine,
  ATELIER_DURAND,
  chooseCustomer,
  createCustomer,
  createProduct,
  DURAND_CONSEIL,
  fillCompany,
  issueInvoice,
  recordCompany,
  signUp,
} from './steps';

/**
 * The company on the real API: the form refuses a SIRET with a wrong checksum, saves a valid company, and the seller
 * mentions are then printed on the issued invoice. A company under the VAT franchise bills at 0 % and the invoice
 * carries the art. 293 B mention.
 */
test('a company is recorded and printed on the issued invoice', async ({ page }) => {
  test.slow();
  await signUp(page);

  await page.getByRole('link', { name: 'Company' }).click();
  await expect(page).toHaveURL(/\/company$/);
  await expect(page.getByText('cannot be issued without it')).toBeVisible();
  await expectAccessible(page);

  // A SIRET with a wrong checksum is refused before anything is sent
  await fillCompany(page, { ...DURAND_CONSEIL, siret: '73282932000075' });
  await page.getByRole('button', { name: 'Save company' }).click();
  await expect(page.getByText('A SIRET is 14 digits with a valid checksum')).toBeVisible();
  await expectAccessible(page);

  await page.getByLabel('SIRET', { exact: true }).fill(DURAND_CONSEIL.siret);
  await page.getByLabel('Registration (optional)').fill('RCS Lyon 732 829 320');
  await page.getByRole('button', { name: 'Save company' }).click();
  await expect(page.getByText('Company details saved.')).toBeVisible();

  // Saved for good: a reload shows it again, and the intro is gone
  await page.reload();
  await expect(page.getByLabel('Legal name', { exact: true })).toHaveValue('Durand Conseil');
  await expect(page.getByText('cannot be issued without it')).toHaveCount(0);

  await createCustomer(page, ATELIER_DURAND);
  await createProduct(page, 'Website audit', '450');
  await page.goto('/invoices/new');
  await chooseCustomer(page, 'Atelier', ATELIER_DURAND.name);
  await addProductLine(page, 'audit', 'Website audit');
  await issueInvoice(page);

  const invoice = page.getByRole('article', { name: /^Invoice F-/ });
  await expect(invoice.getByText('Durand Conseil')).toBeVisible();
  await expect(invoice.getByText(/SAS au capital de 10\s000\s€/)).toBeVisible();
  await expect(invoice.getByText('8 rue des Tilleuls')).toBeVisible();
  await expect(invoice.getByText('SIREN 732829320 · SIRET 73282932000074')).toBeVisible();
  await expect(invoice.getByText('VAT FR44732829320')).toBeVisible();
  await expect(invoice.getByText('RCS Lyon 732 829 320')).toBeVisible();
  await expect(invoice.getByText('TVA non applicable')).toHaveCount(0);
  await expectAccessible(page);
});

test('an invoice cannot be issued before the company is recorded', async ({ page }) => {
  await signUp(page);
  await createCustomer(page, ATELIER_DURAND);
  await createProduct(page, 'Website audit', '450');

  await page.goto('/invoices/new');
  await chooseCustomer(page, 'Atelier', ATELIER_DURAND.name);
  await addProductLine(page, 'audit', 'Website audit');

  await expect(page.getByRole('button', { name: 'Issue invoice' })).toBeDisabled();
  await page.getByRole('link', { name: 'Add your company details' }).click();
  // The draft is not saved yet: the editor asks before leaving it
  await page.getByRole('alertdialog', { name: 'Leave without saving?' }).getByRole('button', { name: 'Leave' }).click();
  await expect(page).toHaveURL(/\/company$/);
});

test('under the VAT franchise, lines are at 0 % and the invoice says why', async ({ page }) => {
  test.slow();
  await signUp(page);
  await recordCompany(page, { ...DURAND_CONSEIL, legalForm: 'EI_MICRO', shareCapital: '', vatRegime: 'FRANCHISE', vatNumber: '' });
  await createCustomer(page, ATELIER_DURAND);
  await createProduct(page, 'Website audit', '450');

  await page.goto('/invoices/new');
  await chooseCustomer(page, 'Atelier', ATELIER_DURAND.name);
  await addProductLine(page, 'audit', 'Website audit');
  await expect(page.getByText('Your company is under the VAT franchise')).toBeVisible();
  await expect(page.getByLabel('Line 1 VAT rate').locator('option:checked')).toHaveText('0 %');

  await issueInvoice(page);

  const invoice = page.getByRole('article', { name: /^Invoice F-/ });
  await expect(invoice.getByText('TVA non applicable, art. 293 B du CGI')).toBeVisible();
  // 450,00 € with no VAT
  await expect(invoice.getByText(/450,00\s€/).first()).toBeVisible();
  await expectAccessible(page);
});
