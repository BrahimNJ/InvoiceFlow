import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { testIssuedInvoice } from '../../invoices/invoice.fixtures';
import { Invoice } from '../../invoices/invoice.models';
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
