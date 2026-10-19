import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { pageOf, testCustomer } from './customer.fixtures';
import { CustomerPayload } from './customer.models';
import { CUSTOMERS_API, CustomerService } from './customer.service';

describe('CustomerService', () => {
  let service: CustomerService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CustomerService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists the first page of 20 by default, without search', () => {
    let total = -1;
    service.list().subscribe((page) => (total = page.totalElements));

    const request = http.expectOne((r) => r.url === CUSTOMERS_API);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.toString()).toBe('page=0&size=20');
    request.flush(pageOf([testCustomer()]));

    expect(total).toBe(1);
  });

  it('sends a trimmed search and the requested page', () => {
    service.list({ search: '  acme ', page: 2, size: 10 }).subscribe();

    const request = http.expectOne((r) => r.url === CUSTOMERS_API);
    expect(request.request.params.get('search')).toBe('acme');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('size')).toBe('10');
    request.flush(pageOf([]));
  });

  it('ignores a blank search', () => {
    service.list({ search: '   ' }).subscribe();

    const request = http.expectOne((r) => r.url === CUSTOMERS_API);
    expect(request.request.params.has('search')).toBe(false);
    request.flush(pageOf([]));
  });

  it('gets, creates, updates and deletes a customer', () => {
    const payload: CustomerPayload = {
      name: 'ACME',
      email: 'contact@acme.fr',
      phone: null,
      street: null,
      postalCode: null,
      city: null,
      country: null,
      siret: '12345678901234',
      vatNumber: null,
    };

    service.get(1).subscribe();
    expect(http.expectOne(`${CUSTOMERS_API}/1`).request.method).toBe('GET');

    service.create(payload).subscribe();
    const created = http.expectOne(CUSTOMERS_API);
    expect(created.request.method).toBe('POST');
    expect(created.request.body).toEqual(payload);

    service.update(1, payload).subscribe();
    const updated = http.expectOne(`${CUSTOMERS_API}/1`);
    expect(updated.request.method).toBe('PUT');
    expect(updated.request.body).toEqual(payload);

    service.delete(1).subscribe();
    expect(http.expectOne(`${CUSTOMERS_API}/1`).request.method).toBe('DELETE');
  });
});
