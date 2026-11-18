import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { pageOf, testAdminUser } from '../admin.fixtures';
import { ADMIN_API } from '../admin.service';
import { AdminUsers, PAGE_SIZE } from './admin-users';

describe('AdminUsers', () => {
  let fixture: ComponentFixture<AdminUsers>;
  let page: HTMLElement;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminUsers);
    page = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  const listRequest = (): TestRequest => http.expectOne((r) => r.url === `${ADMIN_API}/users`);

  async function respond(request: TestRequest, body: object): Promise<void> {
    request.flush(body);
    await fixture.whenStable();
  }

  const button = (label: string) =>
    [...page.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === label);

  it('shows the accounts with their role and status', async () => {
    await fixture.whenStable();
    expect(page.querySelector('h1')?.textContent).toContain('Accounts');
    expect(page.querySelector('[aria-label="Loading accounts"]')).toBeTruthy();

    const request = listRequest();
    expect(request.request.params.get('size')).toBe(String(PAGE_SIZE));
    await respond(
      request,
      pageOf([
        testAdminUser(),
        testAdminUser({ id: 3, email: 'admin@acme.fr', role: 'ADMIN' }),
        testAdminUser({ id: 4, email: 'bob@globex.fr', suspendedAt: '2026-11-18T10:00:00Z' }),
      ]),
    );

    const rows = page.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
    expect(rows[0].querySelector('.email')?.textContent).toBe('jane@acme.fr');
    expect(rows[0].querySelector('[data-label="Role"]')?.textContent).toContain('User');
    expect(rows[0].querySelector('[data-label="Status"]')?.textContent).toContain('Active');
    expect(rows[1].querySelector('[data-label="Role"]')?.textContent).toContain('Admin');
    expect(rows[2].querySelector('[data-label="Status"]')?.textContent).toContain('Suspended');
    expect(page.querySelector('.result-count')?.textContent).toContain('3 accounts');
  });

  it('searches by email and offers to clear a search without match', async () => {
    await fixture.whenStable();
    await respond(listRequest(), pageOf([testAdminUser()]));

    const input = page.querySelector<HTMLInputElement>('#account-search')!;
    input.value = 'nobody';
    input.dispatchEvent(new Event('input'));
    page.querySelector('form[role="search"]')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const searched = listRequest();
    expect(searched.request.params.get('search')).toBe('nobody');
    expect(searched.request.params.get('page')).toBe('0');
    await respond(searched, pageOf([]));

    expect(page.querySelector('app-empty-state h2')?.textContent).toContain('No account matches “nobody”');
    button('Clear the search')!.click();
    await fixture.whenStable();
    expect(listRequest().request.params.has('search')).toBe(false);
  });

  it('pages through the accounts', async () => {
    await fixture.whenStable();
    await respond(listRequest(), pageOf([testAdminUser()], 0, 45));

    expect(page.querySelector('.pagination span')?.textContent).toContain('Page 1 of 3');
    [...page.querySelectorAll<HTMLButtonElement>('.pagination button')]
      .find((b) => b.textContent?.includes('Next'))!
      .click();
    await fixture.whenStable();

    const next = listRequest();
    expect(next.request.params.get('page')).toBe('1');
    await respond(next, pageOf([testAdminUser()], 1, 45));
  });

  it('explains an error and retries', async () => {
    await fixture.whenStable();
    listRequest().flush(
      { status: 403, detail: 'You are not allowed to access this resource' },
      { status: 403, statusText: 'Forbidden' },
    );
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('not allowed');
    button('Retry')!.click();
    await fixture.whenStable();
    await respond(listRequest(), pageOf([testAdminUser()]));
    expect(page.querySelector('[role="alert"]')).toBeNull();
  });
});
