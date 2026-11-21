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

export interface NewCompany {
  legalName: string;
  legalForm: string;
  shareCapital: string;
  street: string;
  postalCode: string;
  city: string;
  siret: string;
  vatRegime: 'STANDARD' | 'FRANCHISE';
  vatNumber: string;
}

/** A valid fictitious company: the SIRET passes the Luhn check and the VAT number matches its SIREN. */
export const DURAND_CONSEIL: NewCompany = {
  legalName: 'Durand Conseil',
  legalForm: 'SAS',
  shareCapital: '10000',
  street: '8 rue des Tilleuls',
  postalCode: '69003',
  city: 'Lyon',
  siret: '73282932000074',
  vatRegime: 'STANDARD',
  vatNumber: 'FR44732829320',
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

/** Fills the company form (not saved yet); a field the legal form or VAT regime hides is left out. */
export async function fillCompany(page: Page, company: NewCompany): Promise<void> {
  await page.getByLabel('Legal name', { exact: true }).fill(company.legalName);
  await page.getByLabel('Legal form', { exact: true }).selectOption(company.legalForm);
  if (company.shareCapital) {
    await page.getByLabel('Share capital (€)', { exact: true }).fill(company.shareCapital);
  }
  await page.getByLabel('Street', { exact: true }).fill(company.street);
  await page.getByLabel('Postal code', { exact: true }).fill(company.postalCode);
  await page.getByLabel('City', { exact: true }).fill(company.city);
  await page.getByLabel('SIRET', { exact: true }).fill(company.siret);
  await page.getByLabel('VAT regime', { exact: true }).selectOption(company.vatRegime);
  await page.getByLabel('VAT number', { exact: true }).fill(company.vatNumber);
}

/**
 * Records the company of the new user, which every invoice needs as its seller: an invoice cannot be issued without
 * it. The form is checked with axe-core before it is saved.
 */
export async function recordCompany(page: Page, company: NewCompany = DURAND_CONSEIL): Promise<void> {
  await page.goto('/company');
  await expect(page.getByRole('heading', { level: 1, name: 'Company' })).toBeVisible();
  await fillCompany(page, company);
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Save company' }).click();
  await expect(page.getByText('Company details saved.')).toBeVisible();
}
