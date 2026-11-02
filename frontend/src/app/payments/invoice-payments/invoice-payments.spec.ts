import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { testIssuedInvoice, testPaidInvoice } from '../../invoices/invoice.fixtures';
import { Invoice } from '../../invoices/invoice.models';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { ToastService } from '../../shared/ui/toast.service';
import { testPayment } from '../payment.fixtures';
import { Payment } from '../payment.models';
import { paymentsUrl } from '../payment.service';
import { InvoicePayments } from './invoice-payments';

const plain = (text: string | null | undefined) =>
  (text ?? '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();

describe('InvoicePayments', () => {
  let fixture: ComponentFixture<InvoicePayments>;
  let panel: HTMLElement;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(InvoicePayments);
    panel = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  async function open(invoice: Invoice, payments: Payment[]): Promise<void> {
    fixture.componentRef.setInput('invoice', invoice);
    await fixture.whenStable();
    http.expectOne(paymentsUrl(invoice.id)).flush(payments);
    await fixture.whenStable();
  }

  const button = (label: string) =>
    [...panel.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => plain(b.textContent) === label,
    );
  const deleteButton = () =>
    panel.querySelector<HTMLButtonElement>('button[aria-label^="Delete the payment of"]');
  const rows = () => [...panel.querySelectorAll('.payments li')].map((li) => plain(li.textContent));

  it('lists the payments received, oldest first as the API sends them', async () => {
    await open(testIssuedInvoice({ amountPaid: 760, balance: 800 }), [
      testPayment(),
      testPayment({ id: 12, amount: 200, date: '2026-10-30', method: 'CHEQUE', reference: null }),
    ]);

    expect(rows()).toEqual([
      '560,00 € 28/10/2026 · Bank transfer · VIR ACME 0042',
      '200,00 € 30/10/2026 · Cheque',
    ]);
  });

  it('records a payment, then reloads the list and tells the page', async () => {
    const success = vi.spyOn(TestBed.inject(ToastService), 'success');
    let changed = 0;
    fixture.componentInstance.changed.subscribe(() => changed++);
    await open(testIssuedInvoice(), []);

    button('Record a payment')!.click();
    await fixture.whenStable();
    const amount = panel.querySelector<HTMLInputElement>('app-payment-form [name="amount"]')!;
    expect(amount.value).toBe('1560,00');
    const form = panel.querySelector<HTMLFormElement>('app-payment-form form')!;
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    http
      .expectOne((r) => r.method === 'POST' && r.url === paymentsUrl(1))
      .flush(testPayment({ amount: 1560 }));
    await fixture.whenStable();
    http.expectOne(paymentsUrl(1)).flush([testPayment({ amount: 1560 })]);
    await fixture.whenStable();

    expect(plain(success.mock.calls[0][0] as string)).toBe('Payment of 1 560,00 € recorded.');
    expect(changed).toBe(1);
    expect(panel.querySelector('app-payment-form')).toBeNull();
    expect(rows().length).toBe(1);
  });

  it('closes the form without recording', async () => {
    await open(testIssuedInvoice(), []);
    button('Record a payment')!.click();
    await fixture.whenStable();

    button('Cancel')!.click();
    await fixture.whenStable();

    expect(panel.querySelector('app-payment-form')).toBeNull();
    expect(button('Record a payment')).toBeTruthy();
  });

  it('offers no new payment on a paid invoice', async () => {
    await open(testPaidInvoice(), [testPayment({ amount: 1560 })]);

    expect(button('Record a payment')).toBeUndefined();
  });

  it('deletes a payment after a warning, then reloads the list and tells the page', async () => {
    const confirm = vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(true);
    let changed = 0;
    fixture.componentInstance.changed.subscribe(() => changed++);
    await open(testPaidInvoice(), [testPayment({ amount: 1560 })]);

    deleteButton()!.click();
    await fixture.whenStable();
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ tone: 'danger' }));
    const request = http.expectOne(`${paymentsUrl(1)}/11`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
    await fixture.whenStable();
    http.expectOne(paymentsUrl(1)).flush([]);
    await fixture.whenStable();

    expect(changed).toBe(1);
    expect(rows()).toEqual([]);
  });

  it('keeps the payment when the warning is dismissed', async () => {
    vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(false);
    await open(testIssuedInvoice(), [testPayment()]);

    deleteButton()!.click();
    await fixture.whenStable();

    http.expectNone(`${paymentsUrl(1)}/11`);
    expect(rows().length).toBe(1);
  });

  it('says when nothing was received yet', async () => {
    await open(testIssuedInvoice(), []);

    expect(plain(panel.querySelector('.empty')?.textContent)).toBe('No payment received yet.');
  });

  it('offers to try again when the payments cannot be loaded', async () => {
    fixture.componentRef.setInput('invoice', testIssuedInvoice());
    await fixture.whenStable();
    http.expectOne(paymentsUrl(1)).flush({ detail: 'Boom' }, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(panel.querySelector('[role="alert"]')).toBeTruthy();

    panel.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await fixture.whenStable();
    http.expectOne(paymentsUrl(1)).flush([testPayment()]);
    await fixture.whenStable();

    expect(rows().length).toBe(1);
  });
});
