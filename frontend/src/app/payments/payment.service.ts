import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { INVOICES_API } from '../invoices/invoice.service';
import { Payment, PaymentPayload } from './payment.models';

/** Payments of an invoice of the signed-in user. The backend scopes every call to the owner of the access token. */
@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);

  /** Oldest first. */
  list(invoiceId: number): Observable<Payment[]> {
    return this.http.get<Payment[]>(paymentsUrl(invoiceId));
  }

  /** 409 when the invoice is not waiting for payment, 422 when the amount or the date does not fit. */
  record(invoiceId: number, payload: PaymentPayload): Observable<Payment> {
    return this.http.post<Payment>(paymentsUrl(invoiceId), payload);
  }

  delete(invoiceId: number, paymentId: number): Observable<void> {
    return this.http.delete<void>(`${paymentsUrl(invoiceId)}/${paymentId}`);
  }
}

export function paymentsUrl(invoiceId: number): string {
  return `${INVOICES_API}/${invoiceId}/payments`;
}
