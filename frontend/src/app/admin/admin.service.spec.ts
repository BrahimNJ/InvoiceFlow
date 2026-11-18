import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { pageOf, testAdminAction, testAdminUser, testStats } from './admin.fixtures';
import { ADMIN_API, AdminService } from './admin.service';

describe('AdminService', () => {
  let service: AdminService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AdminService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists the first page of 20 accounts by default', () => {
    let total = -1;
    service.users().subscribe((page) => (total = page.totalElements));

    const request = http.expectOne((r) => r.url === `${ADMIN_API}/users`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.toString()).toBe('page=0&size=20');
    request.flush(pageOf([testAdminUser()]));

    expect(total).toBe(1);
  });

  it('sends a trimmed search and ignores a blank one', () => {
    service.users({ search: '  acme ', page: 1 }).subscribe();
    const searched = http.expectOne((r) => r.url === `${ADMIN_API}/users`);
    expect(searched.request.params.get('search')).toBe('acme');
    expect(searched.request.params.get('page')).toBe('1');
    searched.flush(pageOf([]));

    service.users({ search: '   ' }).subscribe();
    const blank = http.expectOne((r) => r.url === `${ADMIN_API}/users`);
    expect(blank.request.params.has('search')).toBe(false);
    blank.flush(pageOf([]));
  });

  it('changes a role, suspends and reactivates an account', () => {
    service.changeRole(2, 'ADMIN').subscribe();
    const role = http.expectOne(`${ADMIN_API}/users/2/role`);
    expect(role.request.method).toBe('PUT');
    expect(role.request.body).toEqual({ role: 'ADMIN' });
    role.flush(testAdminUser({ role: 'ADMIN' }));

    service.suspend(2).subscribe();
    const suspend = http.expectOne(`${ADMIN_API}/users/2/suspension`);
    expect(suspend.request.method).toBe('PUT');
    suspend.flush(testAdminUser({ suspendedAt: '2026-11-18T10:00:00Z' }));

    service.reactivate(2).subscribe();
    const reactivate = http.expectOne(`${ADMIN_API}/users/2/suspension`);
    expect(reactivate.request.method).toBe('DELETE');
    reactivate.flush(testAdminUser());
  });

  it('reads the statistics and a page of the audit log', () => {
    service.stats().subscribe();
    http.expectOne(`${ADMIN_API}/stats`).flush(testStats());

    service.audit(2).subscribe();
    const audit = http.expectOne((r) => r.url === `${ADMIN_API}/audit`);
    expect(audit.request.params.toString()).toBe('page=2&size=20');
    audit.flush(pageOf([testAdminAction()]));
  });
});
