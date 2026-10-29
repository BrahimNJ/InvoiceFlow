import { expect, Page } from '@playwright/test';

import { expectAccessible, uniqueEmail } from './fixtures';

/** Steps of the main journey, shared by the end-to-end tests and the README screenshots. */

export interface NewCustomer {
  name: string;
  email: string;
  street: string;
  postalCode: string;
  city: string;
}

export const ATELIER_DURAND: NewCustomer = {
  name: 'Atelier Durand',
  email: 'compta@atelier-durand.example',
  street: '12 rue des Lilas',
  postalCode: '69003',
  city: 'Lyon',
};

export async function signUp(page: Page): Promise<void> {
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

/** Creates a customer through the form; the form and the list are checked with axe-core. */
export async function createCustomer(page: Page, customer: NewCustomer): Promise<void> {
  await page.goto('/customers/new');
  await expect(page.getByRole('heading', { level: 1, name: 'New customer' })).toBeVisible();
  await page.getByLabel('Company or full name').fill(customer.name);
  await page.getByLabel('Billing email').fill(customer.email);
  await page.getByLabel('Street (optional)').fill(customer.street);
  await page.getByLabel('Postal code (optional)').fill(customer.postalCode);
  await page.getByLabel('City (optional)').fill(customer.city);
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Create customer' }).click();
  await expect(page).toHaveURL(/\/customers$/);
  await expect(page.getByText(customer.name).first()).toBeVisible();
  await expectAccessible(page);
}

/** Adds a product to the catalogue; the form and the list are checked with axe-core. */
export async function createProduct(page: Page, name: string, unitPrice: string): Promise<void> {
  await page.goto('/products/new');
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Unit price, excl. VAT').fill(unitPrice);
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Add to catalogue' }).click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByText(name).first()).toBeVisible();
  await expectAccessible(page);
}

/** In the invoice editor: searches the customer picker and chooses the match. */
export async function chooseCustomer(page: Page, search: string, name: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Customer' }).fill(search);
  await page.getByRole('option', { name: new RegExp(name) }).click();
}

/** In the invoice editor: adds a catalogue product as a new line. */
export async function addProductLine(page: Page, search: string, name: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Add from the catalogue' }).fill(search);
  await page.getByRole('option', { name: new RegExp(name) }).click();
}

/** Issues the open draft, confirming the dialog, and waits for the detail page. */
export async function issueInvoice(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Issue invoice' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Issue this invoice?' });
  await dialog.getByRole('button', { name: 'Issue invoice' }).click();
  await expect(page).toHaveURL(/\/invoices\/\d+$/);
}
