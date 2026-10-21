import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { Page } from '../core/http/page';
import { Product, ProductPayload, ProductQuery } from './product.models';

export const PRODUCTS_API = `${environment.apiUrl}/api/products`;

/** Products and services of the signed-in user. The backend scopes every call to the owner of the access token. */
@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);

  list({ search, type, page = 0, size = 20 }: ProductQuery = {}): Observable<Page<Product>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (search?.trim()) {
      params = params.set('search', search.trim());
    }
    if (type) {
      params = params.set('type', type);
    }
    return this.http.get<Page<Product>>(PRODUCTS_API, { params });
  }

  get(id: number): Observable<Product> {
    return this.http.get<Product>(`${PRODUCTS_API}/${id}`);
  }

  create(payload: ProductPayload): Observable<Product> {
    return this.http.post<Product>(PRODUCTS_API, payload);
  }

  update(id: number, payload: ProductPayload): Observable<Product> {
    return this.http.put<Product>(`${PRODUCTS_API}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${PRODUCTS_API}/${id}`);
  }
}
