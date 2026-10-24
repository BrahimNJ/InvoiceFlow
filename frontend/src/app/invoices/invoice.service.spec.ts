import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { pageOf, testInvoice, testSummary } from './invoice.fixtures';
import { InvoicePayload } from './invoice.models';
import { INVOICES_API, InvoiceService } from './invoice.service';

describe('InvoiceService', () => {
  let service: InvoiceService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(InvoiceService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists the first page of 20 by default, without filters', () => {
    service.list().subscribe();

    const request = http.expectOne((r) => r.url === INVOICES_API);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.toString()).toBe('page=0&size=20');
    request.flush(pageOf([]));
  });

  it('sends every filter that is set and skips the others', () => {
    service
      .list({
        search: ' acme ',
        status: 'OVERDUE',
        customerId: 3,
        issuedFrom: '2026-10-01',
        issuedTo: undefined,
        sort: 'DUE_DATE',
        direction: 'ASC',
        page: 1,
        size: 10,
      })
      .subscribe();

    const request = http.expectOne((r) => r.url === INVOICES_API);
    const params = request.request.params;
    expect(params.get('search')).toBe('acme');
    expect(params.get('status')).toBe('OVERDUE');
    expect(params.get('customerId')).toBe('3');
    expect(params.get('issuedFrom')).toBe('2026-10-01');
    expect(params.has('issuedTo')).toBe(false);
    expect(params.get('sort')).toBe('DUE_DATE');
    expect(params.get('direction')).toBe('ASC');
    expect(params.get('page')).toBe('1');
    request.flush(pageOf([]));
  });

  it('gets the summary', () => {
    let drafts = -1;
    service.summary().subscribe((summary) => (drafts = summary.drafts.count));

    http.expectOne(`${INVOICES_API}/summary`).flush(testSummary());

    expect(drafts).toBe(3);
  });

  it('gets, creates, updates and deletes a draft', () => {
    const payload: InvoicePayload = { customerId: 3, paymentTerms: 'NET_30', notes: null, lines: [] };

    service.get(1).subscribe();
    expect(http.expectOne(`${INVOICES_API}/1`).request.method).toBe('GET');

    service.create(payload).subscribe();
    const created = http.expectOne(INVOICES_API);
    expect(created.request.method).toBe('POST');
    expect(created.request.body).toEqual(payload);

    service.update(1, payload).subscribe();
    const updated = http.expectOne(`${INVOICES_API}/1`);
    expect(updated.request.method).toBe('PUT');
    expect(updated.request.body).toEqual(payload);

    service.delete(1).subscribe();
    expect(http.expectOne(`${INVOICES_API}/1`).request.method).toBe('DELETE');
  });

  it('issues, cancels and duplicates an invoice', () => {
    for (const action of ['issue', 'cancel', 'duplicate'] as const) {
      service[action](1).subscribe();
      const request = http.expectOne(`${INVOICES_API}/1/${action}`);
      expect(request.request.method).toBe('POST');
      request.flush(testInvoice());
    }
  });
});
