import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { TEST_USER, authResponse } from '../../core/auth/auth.fixtures';
import { AUTH_ENDPOINTS, AuthService } from '../../core/auth/auth.service';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { ToastService } from '../../shared/ui/toast.service';
import { pageOf, testAdminUser, testStats } from '../admin.fixtures';
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

  afterEach(() => {
    // The figures above the list are covered by their own spec
    http.match(`${ADMIN_API}/stats`).forEach((request) => request.flush(testStats()));
    http.verify();
  });

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

  describe('changing accounts', () => {
    let confirm: ConfirmService;
    let toasts: ToastService;

    beforeEach(async () => {
      confirm = TestBed.inject(ConfirmService);
      toasts = TestBed.inject(ToastService);
      // The signed-in admin is account 1
      TestBed.inject(AuthService).login({ email: 'admin@acme.fr', password: 'Correct-horse-42' }).subscribe();
      http.expectOne(AUTH_ENDPOINTS.login).flush({ ...authResponse(), user: { ...TEST_USER, role: 'ADMIN' } });
      await fixture.whenStable();
    });

    const labelled = (label: string) =>
      page.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

    /** Answers the dialog, then lets the action resume after its `await` and the view update. */
    async function answer(confirmed: boolean): Promise<void> {
      confirm.answer(confirmed);
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    }

    it('offers no action on the signed-in admin', async () => {
      await respond(listRequest(), pageOf([testAdminUser({ id: TEST_USER.id, role: 'ADMIN' })]));

      expect(page.querySelector('tbody .self')?.textContent).toContain('You');
      expect(page.querySelectorAll('tbody button').length).toBe(0);
    });

    it('promotes a user after confirmation and updates the row', async () => {
      await respond(listRequest(), pageOf([testAdminUser()]));

      labelled('Make admin: jane@acme.fr').click();
      await fixture.whenStable();
      expect(confirm.current()?.title).toBe('Make Jane Doe an admin?');
      await answer(true);

      const request = http.expectOne(`${ADMIN_API}/users/2/role`);
      expect(request.request.body).toEqual({ role: 'ADMIN' });
      request.flush(testAdminUser({ role: 'ADMIN' }));
      await fixture.whenStable();

      expect(page.querySelector('[data-label="Role"]')?.textContent).toContain('Admin');
      expect(toasts.toasts().map((toast) => toast.message)).toEqual(['Jane Doe is now an admin.']);
    });

    it('asks a danger confirmation before removing the admin role, and does nothing when cancelled', async () => {
      await respond(listRequest(), pageOf([testAdminUser({ role: 'ADMIN' })]));

      labelled('Remove admin role: jane@acme.fr').click();
      await fixture.whenStable();
      expect(confirm.current()?.tone).toBe('danger');
      await answer(false);

      http.expectNone(`${ADMIN_API}/users/2/role`);
    });

    it('suspends an account after a danger confirmation', async () => {
      await respond(listRequest(), pageOf([testAdminUser()]));

      labelled('Suspend: jane@acme.fr').click();
      await fixture.whenStable();
      expect(confirm.current()?.title).toBe('Suspend Jane Doe?');
      expect(confirm.current()?.tone).toBe('danger');
      await answer(true);

      const request = http.expectOne(`${ADMIN_API}/users/2/suspension`);
      expect(request.request.method).toBe('PUT');
      request.flush(testAdminUser({ suspendedAt: '2026-11-18T10:00:00Z' }));
      await fixture.whenStable();

      expect(page.querySelector('[data-label="Status"]')?.textContent).toContain('Suspended');
      expect(labelled('Reactivate: jane@acme.fr')).toBeTruthy();
      expect(toasts.toasts().map((toast) => toast.message)).toEqual(['Jane Doe is suspended.']);
    });

    it('reactivates a suspended account without asking', async () => {
      await respond(listRequest(), pageOf([testAdminUser({ suspendedAt: '2026-11-18T10:00:00Z' })]));

      labelled('Reactivate: jane@acme.fr').click();
      await fixture.whenStable();
      expect(confirm.current()).toBeNull();

      const request = http.expectOne(`${ADMIN_API}/users/2/suspension`);
      expect(request.request.method).toBe('DELETE');
      request.flush(testAdminUser());
      await fixture.whenStable();

      expect(page.querySelector('[data-label="Status"]')?.textContent).toContain('Active');
      expect(toasts.toasts().map((toast) => toast.message)).toEqual(['Jane Doe can sign in again.']);
    });

    it('shows the refusal of the API in a toast', async () => {
      await respond(listRequest(), pageOf([testAdminUser()]));

      labelled('Make admin: jane@acme.fr').click();
      await fixture.whenStable();
      await answer(true);
      http
        .expectOne(`${ADMIN_API}/users/2/role`)
        .flush({ status: 409, detail: 'You cannot change your own role' }, { status: 409, statusText: 'Conflict' });
      await fixture.whenStable();

      expect(toasts.toasts().map((toast) => toast.message)).toEqual(['You cannot change your own role']);
      expect(labelled('Make admin: jane@acme.fr').disabled).toBe(false);
    });
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
