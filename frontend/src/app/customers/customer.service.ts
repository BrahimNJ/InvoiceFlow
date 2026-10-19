import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { Page } from '../core/http/page';
import { Customer, CustomerPayload, CustomerQuery } from './customer.models';

export const CUSTOMERS_API = `${environment.apiUrl}/api/customers`;

/** Customers of the signed-in user. The backend scopes every call to the owner of the access token. */
@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly http = inject(HttpClient);

  list({ search, page = 0, size = 20 }: CustomerQuery = {}): Observable<Page<Customer>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (search?.trim()) {
      params = params.set('search', search.trim());
    }
    return this.http.get<Page<Customer>>(CUSTOMERS_API, { params });
  }

  get(id: number): Observable<Customer> {
    return this.http.get<Customer>(`${CUSTOMERS_API}/${id}`);
  }

  create(payload: CustomerPayload): Observable<Customer> {
    return this.http.post<Customer>(CUSTOMERS_API, payload);
  }

  update(id: number, payload: CustomerPayload): Observable<Customer> {
    return this.http.put<Customer>(`${CUSTOMERS_API}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${CUSTOMERS_API}/${id}`);
  }
}
