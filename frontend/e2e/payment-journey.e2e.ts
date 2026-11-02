import { expect, Page, test } from '@playwright/test';

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
 * Payments on the real API: an issued invoice of 540,00 € is paid in two instalments, becomes Paid, then a payment
 * recorded by mistake is deleted and the invoice waits for payment again. The payments panel is checked with axe-core.
 */
test('an issued invoice is paid in two instalments', async ({ page }) => {
  test.slow();
  await signUp(page);
  await createCustomer(page, ATELIER_DURAND);
  await createProduct(page, 'Website audit', '450');

  await page.goto('/invoices/new');
  await chooseCustomer(page, 'Atelier', ATELIER_DURAND.name);
  await addProductLine(page, 'audit', 'Website audit');
  await issueInvoice(page);

  const payments = page.getByRole('region', { name: 'Payments' });
  await expect(payments.getByText('No payment received yet.')).toBeVisible();

  // First instalment: the form proposes the balance, 450,00 € + 20 % VAT
  await payments.getByRole('button', { name: 'Record a payment' }).click();
  const amount = payments.getByLabel('Amount received');
  await expect(amount).toHaveValue('540,00');
  await scanFromTop(page);
  await amount.fill('200');
  await payments.getByLabel('Method').selectOption('CHEQUE');
  await payments.getByLabel('Reference').fill('Cheque 0012345');
  await payments.getByRole('button', { name: 'Record payment' }).click();

  await expect(payments.getByText(/200,00\s?€/)).toBeVisible();
  await expect(payments.getByText(/Cheque 0012345/)).toBeVisible();
  const amounts = page.getByRole('region', { name: 'Amounts' });
  await expect(amounts.getByText(/340,00\s?€/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel invoice' })).toBeDisabled();

  // The rest: paid in full
  await payments.getByRole('button', { name: 'Record a payment' }).click();
  await expect(payments.getByLabel('Amount received')).toHaveValue('340,00');
  await payments.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.locator('.head .status-badge')).toHaveText('Paid');
  await expect(payments.getByRole('button', { name: 'Record a payment' })).toHaveCount(0);
  await scanFromTop(page);

  // The list shows it under the Paid tab, and nothing is outstanding any more
  await page.getByRole('link', { name: 'Invoices' }).first().click();
  const figures = page.getByRole('region', { name: 'Key figures' });
  await expect(
    figures.getByRole('button', { name: /^Outstanding 0,00\s?€ 0 invoices\b/ }),
  ).toBeVisible();
  await page.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Paid' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.locator('tbody tr a').first().click();

  // A payment deleted by mistake: the invoice waits for payment again
  await page.getByRole('button', { name: /^Delete the payment of 340,00/ }).click();
  await page
    .getByRole('alertdialog', { name: /^Delete the payment of 340,00/ })
    .getByRole('button', { name: 'Delete payment' })
    .click();
  await expect(page.locator('.head .status-badge')).toHaveText('Issued');
  await expect(payments.getByRole('button', { name: 'Record a payment' })).toBeVisible();
  await expect(payments.getByText(/340,00\s?€/)).toHaveCount(0);
});

/**
 * The header is sticky and translucent (blurred): scrolled over the page, axe-core measures its links against the
 * content underneath, which the blur hides from users. Scanning from the top measures them on the header itself.
 */
async function scanFromTop(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectAccessible(page);
}
