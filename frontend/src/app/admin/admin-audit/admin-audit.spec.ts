import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { pageOf, testAdminAction } from '../admin.fixtures';
import { ADMIN_API } from '../admin.service';
import { AdminAudit } from './admin-audit';

describe('AdminAudit', () => {
  let fixture: ComponentFixture<AdminAudit>;
  let page: HTMLElement;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminAudit);
    page = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  const auditRequest = (): TestRequest => http.expectOne((r) => r.url === `${ADMIN_API}/audit`);

  async function respond(request: TestRequest, body: object): Promise<void> {
    request.flush(body);
    await fixture.whenStable();
  }

  it('lists the actions with who did what to whom', async () => {
    await fixture.whenStable();
    expect(page.querySelector('h1')?.textContent).toContain('Audit log');
    expect([...page.querySelectorAll('app-admin-tabs a')].map((a) => a.getAttribute('href'))).toEqual([
      '/admin',
      '/admin/audit',
    ]);

    await respond(
      auditRequest(),
      pageOf([
        testAdminAction({ action: 'ROLE_CHANGED', details: 'USER -> ADMIN' }),
        testAdminAction({ id: 4, action: 'PROMOTED_FROM_CONFIG', adminId: null, adminEmail: null }),
      ]),
    );

    const rows = page.querySelectorAll('tbody tr');
    expect(rows[0].querySelector('.action')?.textContent).toBe('Role changed');
    expect(rows[0].querySelector('.details')?.textContent).toBe('USER -> ADMIN');
    expect(rows[0].querySelector('[data-label="Account"]')?.textContent).toBe('jane@acme.fr');
    expect(rows[0].querySelector('[data-label="By"]')?.textContent).toBe('admin@acme.fr');
    expect(rows[1].querySelector('.action')?.textContent).toBe('Made admin by ADMIN_EMAILS');
    expect(rows[1].querySelector('[data-label="By"]')?.textContent).toBe('ADMIN_EMAILS');
  });

  it('says when nothing was recorded yet', async () => {
    await fixture.whenStable();
    await respond(auditRequest(), pageOf([]));

    expect(page.querySelector('app-empty-state h2')?.textContent).toContain('Nothing recorded yet');
  });

  it('pages through the log and retries after an error', async () => {
    await fixture.whenStable();
    await respond(auditRequest(), pageOf([testAdminAction()], 0, 30));

    [...page.querySelectorAll<HTMLButtonElement>('.pagination button')]
      .find((b) => b.textContent?.includes('Next'))!
      .click();
    await fixture.whenStable();
    const next = auditRequest();
    expect(next.request.params.get('page')).toBe('1');
    next.flush({ status: 500, detail: 'Boom' }, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')).toBeTruthy();
    [...page.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === 'Retry')!.click();
    await fixture.whenStable();
    expect(auditRequest().request.params.get('page')).toBe('0');
  });
});
