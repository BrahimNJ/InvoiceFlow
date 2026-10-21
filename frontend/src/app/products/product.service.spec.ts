import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { pageOf, testProduct } from './product.fixtures';
import { ProductPayload } from './product.models';
import { PRODUCTS_API, ProductService } from './product.service';

describe('ProductService', () => {
  let service: ProductService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ProductService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists the first page of 20 by default, without filters', () => {
    let total = -1;
    service.list().subscribe((page) => (total = page.totalElements));

    const request = http.expectOne((r) => r.url === PRODUCTS_API);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.toString()).toBe('page=0&size=20');
    request.flush(pageOf([testProduct()]));

    expect(total).toBe(1);
  });

  it('sends a trimmed search, the type and the requested page', () => {
    service.list({ search: '  design ', type: 'SERVICE', page: 2, size: 10 }).subscribe();

    const request = http.expectOne((r) => r.url === PRODUCTS_API);
    expect(request.request.params.get('search')).toBe('design');
    expect(request.request.params.get('type')).toBe('SERVICE');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('size')).toBe('10');
    request.flush(pageOf([]));
  });

  it('ignores a blank search', () => {
    service.list({ search: '   ' }).subscribe();

    const request = http.expectOne((r) => r.url === PRODUCTS_API);
    expect(request.request.params.has('search')).toBe(false);
    request.flush(pageOf([]));
  });

  it('gets, creates, updates and deletes a product', () => {
    const payload: ProductPayload = {
      type: 'GOODS',
      name: 'Keyboard',
      description: null,
      unitPrice: 49.9,
      vatRate: 20,
      unit: 'UNIT',
    };

    service.get(1).subscribe();
    expect(http.expectOne(`${PRODUCTS_API}/1`).request.method).toBe('GET');

    service.create(payload).subscribe();
    const created = http.expectOne(PRODUCTS_API);
    expect(created.request.method).toBe('POST');
    expect(created.request.body).toEqual(payload);

    service.update(1, payload).subscribe();
    const updated = http.expectOne(`${PRODUCTS_API}/1`);
    expect(updated.request.method).toBe('PUT');
    expect(updated.request.body).toEqual(payload);

    service.delete(1).subscribe();
    expect(http.expectOne(`${PRODUCTS_API}/1`).request.method).toBe('DELETE');
  });
});
