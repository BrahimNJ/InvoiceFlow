import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { testCompany } from './company.fixtures';
import { COMPANY_API, CompanyService } from './company.service';

describe('CompanyService', () => {
  let service: CompanyService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CompanyService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('gets the company', () => {
    let result: unknown;
    service.get().subscribe((company) => (result = company));

    const request = http.expectOne(COMPANY_API);
    expect(request.request.method).toBe('GET');
    request.flush(testCompany());

    expect(result).toEqual(testCompany());
  });

  it('turns a 404 into "no company yet"', () => {
    let result: unknown = 'unset';
    service.get().subscribe((company) => (result = company));

    http.expectOne(COMPANY_API).flush({ detail: 'No company details recorded yet' }, { status: 404, statusText: 'Not Found' });

    expect(result).toBeNull();
  });

  it('keeps any other error', () => {
    let status = 0;
    service.get().subscribe({ error: (error: HttpErrorResponse) => (status = error.status) });

    http.expectOne(COMPANY_API).flush({}, { status: 500, statusText: 'Server Error' });

    expect(status).toBe(500);
  });

  it('saves with a PUT', () => {
    const { id: _id, siren: _siren, createdAt: _c, updatedAt: _u, ...payload } = testCompany();
    service.save(payload).subscribe();

    const request = http.expectOne(COMPANY_API);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(payload);
    request.flush(testCompany());
  });
});
