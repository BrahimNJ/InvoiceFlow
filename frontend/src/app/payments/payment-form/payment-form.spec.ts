import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { addDays, todayIso } from '../../invoices/invoice-calc';
import { testPayment } from '../payment.fixtures';
import { Payment } from '../payment.models';
import { paymentsUrl } from '../payment.service';
import { PaymentForm } from './payment-form';

const plain = (text: string | null | undefined) =>
  (text ?? '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();

describe('PaymentForm', () => {
  let fixture: ComponentFixture<PaymentForm>;
  let form: HTMLElement;
  let http: HttpTestingController;
  const today = todayIso();
  const issueDate = addDays(today, -10);

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PaymentForm);
    fixture.componentRef.setInput('invoiceId', 1);
    fixture.componentRef.setInput('balance', 1000);
    fixture.componentRef.setInput('issueDate', issueDate);
    form = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  const input = (name: string) => form.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
  const select = (name: string) => form.querySelector<HTMLSelectElement>(`[name="${name}"]`)!;
  const error = (name: string) => plain(form.querySelector(`#payment-${name}-error`)?.textContent);

  async function type(name: string, value: string): Promise<void> {
    input(name).value = value;
    input(name).dispatchEvent(new Event('input'));
    input(name).dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  }

  async function submit(): Promise<void> {
    form.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('proposes the balance due, received today by bank transfer', () => {
    expect(input('amount').value).toBe('1000,00');
    expect(input('date').value).toBe(today);
    expect(input('date').min).toBe(issueDate);
    expect(input('date').max).toBe(today);
    expect(select('method').value).toBe('BANK_TRANSFER');
    expect(plain(form.querySelector('#payment-amount-hint')?.textContent)).toBe(
      'Balance due: 1 000,00 €',
    );
  });

  it('records the payment and hands it to the page', async () => {
    let recorded: Payment | undefined;
    fixture.componentInstance.recorded.subscribe((payment) => (recorded = payment));
    await type('amount', '450,5');
    select('method').value = 'CHEQUE';
    select('method').dispatchEvent(new Event('change'));
    await type('reference', '  Cheque 0012345 ');

    await submit();
    const request = http.expectOne(paymentsUrl(1));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      amount: 450.5,
      date: today,
      method: 'CHEQUE',
      reference: 'Cheque 0012345',
      note: null,
    });
    request.flush(testPayment({ amount: 450.5 }));
    await fixture.whenStable();

    expect(recorded?.amount).toBe(450.5);
  });

  it('refuses more than the balance, zero and a malformed amount without calling the API', async () => {
    await type('amount', '1000,01');
    expect(error('amount')).toBe('At most the balance due, 1 000,00 €.');
    await type('amount', '0');
    expect(error('amount')).toBe('A payment must be more than 0 €.');
    await type('amount', '12,345');
    expect(error('amount')).toContain('at most 2 decimals');
    await type('amount', '');
    expect(error('amount')).toBe('Enter the amount received.');

    await submit();
    http.expectNone(paymentsUrl(1));
    expect(document.activeElement).toBe(input('amount'));
  });

  it('refuses a date before the issue date or in the future', async () => {
    await type('date', addDays(issueDate, -1));
    expect(error('date')).toContain('a payment cannot be earlier');
    await type('date', addDays(today, 1));
    expect(error('date')).toBe('A payment cannot be dated in the future.');
    await type('date', issueDate);
    expect(form.querySelector('#payment-date-error')).toBeNull();
  });

  it('shows the refusal of the API', async () => {
    await submit();
    http
      .expectOne(paymentsUrl(1))
      .flush(
        { detail: 'Invoice F-2026-0001 is already paid' },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();

    expect(plain(form.querySelector('[role="alert"]')?.textContent)).toBe(
      'Invoice F-2026-0001 is already paid',
    );
  });

  it('can be closed without recording', async () => {
    let closed = false;
    fixture.componentInstance.cancelled.subscribe(() => (closed = true));

    [...form.querySelectorAll('button')].find((b) => plain(b.textContent) === 'Cancel')!.click();

    expect(closed).toBe(true);
  });
});
