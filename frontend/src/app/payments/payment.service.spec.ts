import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { INVOICES_API } from '../invoices/invoice.service';
import { testPayment } from './payment.fixtures';
import { PaymentPayload } from './payment.models';
import { PaymentService } from './payment.service';

describe('PaymentService', () => {
  let service: PaymentService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PaymentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists the payments of an invoice', () => {
    let received = 0;
    service.list(3).subscribe((payments) => (received = payments.length));

    const request = http.expectOne(`${INVOICES_API}/3/payments`);
    expect(request.request.method).toBe('GET');
    request.flush([testPayment()]);
    expect(received).toBe(1);
  });

  it('records a payment', () => {
    const payload: PaymentPayload = {
      amount: 560,
      date: '2026-10-28',
      method: 'CHEQUE',
      reference: null,
      note: null,
    };
    service.record(3, payload).subscribe();

    const request = http.expectOne(`${INVOICES_API}/3/payments`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush(testPayment());
  });

  it('deletes a payment under its invoice', () => {
    service.delete(3, 11).subscribe();

    const request = http.expectOne(`${INVOICES_API}/3/payments/11`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
  });
});
