import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { testCustomer } from '../../customers/customer.fixtures';
import { CUSTOMERS_API } from '../../customers/customer.service';
import { testProduct } from '../../products/product.fixtures';
import { PRODUCTS_API } from '../../products/product.service';
import { AUTOCOMPLETE_DEBOUNCE_MS } from '../../shared/ui/autocomplete';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { ToastService } from '../../shared/ui/toast.service';
import { pageOf, testInvoice, testIssuedInvoice } from '../invoice.fixtures';
import { INVOICES_API } from '../invoice.service';
import { InvoiceEditor } from './invoice-editor';

/** Intl uses narrow no-break spaces in French amounts. */
const plain = (text: string | null | undefined) => (text ?? '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
const debounce = () => new Promise((resolve) => setTimeout(resolve, AUTOCOMPLETE_DEBOUNCE_MS + 10));

describe('InvoiceEditor', () => {
  let fixture: ComponentFixture<InvoiceEditor>;
  let page: HTMLElement;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(InvoiceEditor);
    page = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  const button = (label: string) =>
    [...page.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => plain(b.textContent) === label || b.getAttribute('aria-label') === label,
    )!;
  /** Each total as "label amount", one after the other. */
  const totalsText = () =>
    [...page.querySelectorAll('dl.totals > div')]
      .map((row) => `${plain(row.querySelector('dt')?.textContent)} ${plain(row.querySelector('dd')?.textContent)}`)
      .join(' | ');

  /** Types in an autocomplete, answers its search with `results` and picks the first option. */
  async function pick(inputId: string, api: string, text: string, results: object[]): Promise<void> {
    const input = page.querySelector<HTMLInputElement>(`#${inputId}`)!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await debounce();
    const search = http.expectOne((r) => r.url === api);
    expect(search.request.params.get('search')).toBe(text);
    search.flush(pageOf(results));
    await fixture.whenStable();
    page.querySelector<HTMLElement>('li[role="option"]')!.click();
    await fixture.whenStable();
  }

  async function type(selector: string, value: string): Promise<void> {
    const input = page.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  it('writes a new draft: customer, terms, lines from the catalogue, live totals, then saves it', async () => {
    const location = TestBed.inject(Location);
    const replaceState = vi.spyOn(location, 'replaceState');
    const success = vi.spyOn(TestBed.inject(ToastService), 'success');
    await fixture.whenStable();
    expect(page.querySelector('h1')?.textContent).toBe('New invoice');
    expect(page.textContent).toContain('No line yet');

    await pick('customer-picker', CUSTOMERS_API, 'acme', [testCustomer({ id: 3, name: 'Acme SAS' })]);
    expect(page.querySelector('.customer-card')?.textContent).toContain('Acme SAS');
    expect(page.querySelector('.customer-card')?.textContent).toContain('75002 Paris');

    page.querySelectorAll<HTMLInputElement>('.term input')[0].click();
    await fixture.whenStable();
    expect(page.querySelector('.term.selected')?.textContent?.trim()).toBe('On receipt');

    await pick('product-picker', PRODUCTS_API, 'web', [testProduct({ id: 7 })]);
    await pick('product-picker', PRODUCTS_API, 'key', [
      testProduct({ id: 8, type: 'GOODS', name: 'Keyboard', description: null, unitPrice: 49.9, vatRate: 5.5, unit: 'UNIT' }),
    ]);
    expect(page.querySelectorAll('.line').length).toBe(2);
    expect(totalsText()).toContain('Total excl. VAT 699,90 €');
    expect(totalsText()).toContain('VAT 20 % on 650,00 € 130,00 €');
    expect(totalsText()).toContain('VAT 5,5 % on 49,90 € 2,74 €');
    expect(totalsText()).toContain('Total incl. VAT 832,64 €');

    // 2,5 days instead of 1
    await type('.line .cell[data-label="Qty"] input', '2,5');
    expect(totalsText()).toContain('Total incl. VAT 2 002,64 €');
    expect(page.querySelector('.save-state')?.textContent).toContain('Unsaved changes');

    button('Save draft').click();
    await fixture.whenStable();
    const request = http.expectOne(INVOICES_API);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      customerId: 3,
      paymentTerms: 'ON_RECEIPT',
      notes: null,
      lines: [
        { productId: 7, type: 'SERVICE', label: 'Web development', details: 'Senior developer, day rate', quantity: 2.5, unit: 'DAY', unitPrice: 650, vatRate: 20 },
        { productId: 8, type: 'GOODS', label: 'Keyboard', details: null, quantity: 1, unit: 'UNIT', unitPrice: 49.9, vatRate: 5.5 },
      ],
    });
    request.flush(testInvoice({ id: 12 }));
    await fixture.whenStable();

    expect(replaceState).toHaveBeenCalledWith('/invoices/12/edit');
    expect(success).toHaveBeenCalledWith('Draft for Acme SAS saved.');
    expect(page.querySelector('h1')?.textContent).toBe('Draft invoice');
    expect(page.querySelector('.save-state')?.textContent).toContain('Saved');
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
  });

  it('edits a saved draft and updates it', async () => {
    fixture.componentRef.setInput('id', '1');
    await fixture.whenStable();
    http.expectOne(`${INVOICES_API}/1`).flush(testInvoice({ notes: 'Thanks' }));
    await fixture.whenStable();

    expect(page.querySelector('.customer-card')?.textContent).toContain('Acme SAS');
    expect(page.querySelector<HTMLTextAreaElement>('#invoice-notes')?.value).toBe('Thanks');
    expect(page.querySelectorAll('.line').length).toBe(1);
    expect(totalsText()).toContain('Total incl. VAT 1 560,00 €');
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);

    await type('#invoice-notes', 'Thank you!');
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
    button('Save draft').click();
    await fixture.whenStable();
    const request = http.expectOne(`${INVOICES_API}/1`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.notes).toBe('Thank you!');
    expect(request.request.body.customerId).toBe(3);
    request.flush(testInvoice({ notes: 'Thank you!' }));
    await fixture.whenStable();
  });

  it('lets the user change the customer', async () => {
    fixture.componentRef.setInput('id', '1');
    await fixture.whenStable();
    http.expectOne(`${INVOICES_API}/1`).flush(testInvoice());
    await fixture.whenStable();

    button('Change').click();
    await fixture.whenStable();

    expect(page.querySelector('.customer-card')).toBeNull();
    expect(page.querySelector('#customer-picker')).toBeTruthy();
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
  });

  it('does not save invalid lines and shows the server messages on the right line', async () => {
    await fixture.whenStable();
    button('Free line').click();
    await fixture.whenStable();

    button('Save draft').click();
    await fixture.whenStable();
    http.expectNone(INVOICES_API);
    expect(page.querySelector('[role="alert"]')?.textContent).toContain('Some lines need your attention.');
    expect(page.querySelector('.line .field-error')?.textContent).toBe('Describe what you bill.');

    await type('.line input[formcontrolname="label"]', 'Audit');
    await type('.line input[formcontrolname="unitPrice"]', '100');
    button('Save draft').click();
    await fixture.whenStable();
    http
      .expectOne(INVOICES_API)
      .flush(
        { detail: 'Validation failed', errors: { 'lines[0].quantity': 'must be greater than 0' } },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('Please check the highlighted fields.');
    expect(page.querySelector('.cell[data-label="Qty"] .field-error')?.textContent).toBe('must be greater than 0');
  });

  it('lists what is missing and only lets a complete invoice be issued', async () => {
    await fixture.whenStable();
    const checklist = () => [...page.querySelectorAll('.readiness li')].map((item) => item.className);

    expect(checklist()).toEqual(['missing', 'missing', 'missing', 'warn', 'pending']);
    expect(page.querySelector('.score')?.textContent).toBe('0/4');
    expect(button('Issue invoice').disabled).toBe(true);

    await pick('customer-picker', CUSTOMERS_API, 'acme', [testCustomer({ id: 3, siret: null })]);
    await pick('product-picker', PRODUCTS_API, 'web', [testProduct()]);

    expect(checklist()).toEqual(['ok', 'ok', 'ok', 'warn', 'pending']);
    expect(page.querySelector('.readiness')?.textContent).toContain('Recommended.');
    expect(button('Issue invoice').disabled).toBe(false);
  });

  it('saves, then issues the draft once confirmed, and opens it', async () => {
    const ask = vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(true);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const success = vi.spyOn(TestBed.inject(ToastService), 'success');
    fixture.componentRef.setInput('id', '1');
    await fixture.whenStable();
    http.expectOne(`${INVOICES_API}/1`).flush(testInvoice());
    await fixture.whenStable();

    button('Issue invoice').click();
    await fixture.whenStable();
    expect(ask).toHaveBeenCalledWith(expect.objectContaining({ title: 'Issue this invoice?', confirmLabel: 'Issue invoice' }));
    http.expectOne(`${INVOICES_API}/1`).flush(testInvoice());
    await fixture.whenStable();
    const issue = http.expectOne(`${INVOICES_API}/1/issue`);
    expect(issue.request.method).toBe('POST');
    issue.flush(testIssuedInvoice());
    await fixture.whenStable();

    expect(success).toHaveBeenCalledWith('Invoice F-2026-0001 issued.');
    expect(navigate).toHaveBeenCalledWith(['/invoices', 1]);
  });

  it('does nothing when the user does not confirm the issue', async () => {
    vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(false);
    fixture.componentRef.setInput('id', '1');
    await fixture.whenStable();
    http.expectOne(`${INVOICES_API}/1`).flush(testInvoice());
    await fixture.whenStable();

    button('Issue invoice').click();
    await fixture.whenStable();

    http.expectNone(`${INVOICES_API}/1`);
  });

  it('explains a refused issue with the missing mentions', async () => {
    vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(true);
    fixture.componentRef.setInput('id', '1');
    await fixture.whenStable();
    http.expectOne(`${INVOICES_API}/1`).flush(testInvoice());
    await fixture.whenStable();

    button('Issue invoice').click();
    await fixture.whenStable();
    http.expectOne(`${INVOICES_API}/1`).flush(testInvoice());
    await fixture.whenStable();
    http
      .expectOne(`${INVOICES_API}/1/issue`)
      .flush(
        { detail: 'This invoice cannot be issued yet', missing: ['CUSTOMER_ADDRESS'] },
        { status: 422, statusText: 'Unprocessable Content' },
      );
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain(
      'This invoice cannot be issued yet. Missing: customer billing address.',
    );
  });

  it('shows the invoice as it will be printed, in the side panel or full screen', async () => {
    await fixture.whenStable();

    button('Preview').click();
    await fixture.whenStable();
    expect(page.querySelector('.side app-invoice-document .watermark')?.textContent).toBe('Draft');

    page.querySelector<HTMLButtonElement>('.mobile-bar button')!.click();
    await fixture.whenStable();
    expect(page.querySelector('[role="dialog"][aria-label="Invoice preview"] app-invoice-document')).toBeTruthy();
    button('Close the preview').click();
    await fixture.whenStable();
    expect(page.querySelector('[role="dialog"]')).toBeNull();
  });

  it('refuses to edit an issued invoice', async () => {
    fixture.componentRef.setInput('id', '1');
    await fixture.whenStable();
    http.expectOne(`${INVOICES_API}/1`).flush(testIssuedInvoice());
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain(
      'Invoice F-2026-0001 is issued: it can no longer be changed.',
    );
    expect(page.querySelector('[role="alert"] a')?.getAttribute('href')).toBe('/invoices/1');
    expect(button('Save draft').disabled).toBe(true);
  });

  it('says when the draft does not exist', async () => {
    fixture.componentRef.setInput('id', '42');
    await fixture.whenStable();
    http.expectOne(`${INVOICES_API}/42`).flush({ detail: 'Invoice with id 42 not found' }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('This invoice does not exist or has been deleted.');
  });
});
