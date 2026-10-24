import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { Page } from '../core/http/page';
import { Invoice, InvoiceListItem, InvoicePayload, InvoiceQuery, InvoiceSummary } from './invoice.models';

export const INVOICES_API = `${environment.apiUrl}/api/invoices`;

/** Invoices of the signed-in user. The backend scopes every call to the owner of the access token. */
@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private readonly http = inject(HttpClient);

  list({ page = 0, size = 20, search, ...filters }: InvoiceQuery = {}): Observable<Page<InvoiceListItem>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (search?.trim()) {
      params = params.set('search', search.trim());
    }
    for (const [name, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(name, value);
      }
    }
    return this.http.get<Page<InvoiceListItem>>(INVOICES_API, { params });
  }

  summary(): Observable<InvoiceSummary> {
    return this.http.get<InvoiceSummary>(`${INVOICES_API}/summary`);
  }

  get(id: number): Observable<Invoice> {
    return this.http.get<Invoice>(`${INVOICES_API}/${id}`);
  }

  create(payload: InvoicePayload): Observable<Invoice> {
    return this.http.post<Invoice>(INVOICES_API, payload);
  }

  update(id: number, payload: InvoicePayload): Observable<Invoice> {
    return this.http.put<Invoice>(`${INVOICES_API}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${INVOICES_API}/${id}`);
  }

  /** 422 with `missing` checks when a mandatory detail is missing. */
  issue(id: number): Observable<Invoice> {
    return this.http.post<Invoice>(`${INVOICES_API}/${id}/issue`, null);
  }

  cancel(id: number): Observable<Invoice> {
    return this.http.post<Invoice>(`${INVOICES_API}/${id}/cancel`, null);
  }

  /** A new draft with the same customer, terms and lines. */
  duplicate(id: number): Observable<Invoice> {
    return this.http.post<Invoice>(`${INVOICES_API}/${id}/duplicate`, null);
  }
}
