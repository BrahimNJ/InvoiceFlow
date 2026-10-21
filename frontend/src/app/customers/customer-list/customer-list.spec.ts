import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ConfirmService } from '../../shared/ui/confirm.service';
import { ToastService } from '../../shared/ui/toast.service';
import { pageOf, testCustomer } from '../customer.fixtures';
import { CUSTOMERS_API } from '../customer.service';
import { CustomerList, PAGE_SIZE, SEARCH_DEBOUNCE_MS } from './customer-list';

describe('CustomerList', () => {
  let fixture: ComponentFixture<CustomerList>;
  let page: HTMLElement;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CustomerList);
    page = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  const listRequest = (): TestRequest => http.expectOne((r) => r.url === CUSTOMERS_API);

  async function respond(request: TestRequest, body: object): Promise<void> {
    request.flush(body);
    await fixture.whenStable();
  }

  const searchInput = () => page.querySelector<HTMLInputElement>('#customer-search')!;

  async function searchFor(text: string): Promise<void> {
    searchInput().value = text;
    searchInput().dispatchEvent(new Event('input'));
    page.querySelector('form[role="search"]')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  const button = (label: string) =>
    [...page.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === label || b.getAttribute('aria-label') === label,
    );

  it('explains the screen, shows skeletons, then the first page of customers', async () => {
    await fixture.whenStable();
    expect(page.querySelector('h1')?.textContent).toContain('Customers');
    expect(page.querySelectorAll('app-help-tip li').length).toBe(3);
    expect(page.querySelector('[aria-label="Loading customers"]')).toBeTruthy();

    const request = listRequest();
    expect(request.request.params.get('page')).toBe('0');
    expect(request.request.params.get('size')).toBe(String(PAGE_SIZE));
    await respond(request, pageOf([testCustomer(), testCustomer({ id: 2, name: 'Globex Corporation', city: null })]));

    const rows = page.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].querySelector('.avatar')?.textContent?.trim()).toBe('AC');
    expect(rows[0].querySelector('a.name')?.getAttribute('href')).toBe('/customers/1/edit');
    expect(rows[0].querySelector('.email')?.textContent).toBe('contact@acme.fr');
    expect(rows[0].querySelector('[data-label="City"]')?.textContent).toContain('Paris');
    expect(rows[0].querySelector('[data-label="SIRET"]')?.textContent).toContain('12345678901234');
    expect(rows[1].querySelector('.avatar')?.textContent?.trim()).toBe('GC');
    expect(rows[1].querySelector('[data-label="City"]')?.textContent).toContain('—');
    expect(page.querySelector('.result-count')?.textContent).toContain('2 customers');
    expect(page.querySelector('.pagination')).toBeNull();
  });

  it('invites to create the first customer when there is none', async () => {
    await fixture.whenStable();
    await respond(listRequest(), pageOf([]));

    expect(page.querySelector('app-empty-state h2')?.textContent).toContain('No customers yet');
    expect(page.querySelector('app-empty-state a')?.getAttribute('href')).toBe('/customers/new');
  });

  it('searches on Enter, from the first page, and can clear the search', async () => {
    await fixture.whenStable();
    await respond(listRequest(), pageOf([testCustomer()], 1, 25));

    await searchFor('  zzz ');
    const search = listRequest();
    expect(search.request.params.get('search')).toBe('zzz');
    expect(search.request.params.get('page')).toBe('0');
    await respond(search, pageOf([]));

    expect(page.querySelector('app-empty-state h2')?.textContent).toContain('No customer matches “zzz”');
    expect(page.querySelector('.result-count')?.textContent).toContain('0 matches for “zzz”');

    button('Clear the search')!.click();
    await fixture.whenStable();
    const cleared = listRequest();
    expect(cleared.request.params.has('search')).toBe(false);
    await respond(cleared, pageOf([testCustomer()]));

    expect(searchInput().value).toBe('');
    expect(page.querySelector('.search-field .clear')).toBeNull();
  });

  it('searches by itself once the user stops typing', async () => {
    vi.useFakeTimers();
    try {
      fixture.detectChanges();
      listRequest().flush(pageOf([testCustomer()]));

      searchInput().value = 'acme';
      searchInput().dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
      http.expectNone((r) => r.url === CUSTOMERS_API);

      vi.advanceTimersByTime(1);
      const request = listRequest();
      expect(request.request.params.get('search')).toBe('acme');
      request.flush(pageOf([testCustomer()]));
    } finally {
      vi.useRealTimers();
    }
  });

  it('pages through the results, keeping the search', async () => {
    await fixture.whenStable();
    await respond(listRequest(), pageOf([testCustomer()], 0, 45));
    await searchFor('acme');
    await respond(listRequest(), pageOf([testCustomer()], 0, 45));

    expect(page.querySelector('.pagination')?.textContent).toContain('Page 1 of 3');
    expect(button('Previous')!.disabled).toBe(true);

    button('Next')!.click();
    await fixture.whenStable();
    const next = listRequest();
    expect(next.request.params.get('page')).toBe('1');
    expect(next.request.params.get('search')).toBe('acme');
    await respond(next, pageOf([testCustomer({ id: 21 })], 1, 45));

    expect(page.querySelector('.pagination')?.textContent).toContain('Page 2 of 3');
    expect(button('Previous')!.disabled).toBe(false);
  });

  it('shows the error and retries', async () => {
    await fixture.whenStable();
    listRequest().flush({ status: 500, detail: 'Database unavailable' }, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('Database unavailable');

    button('Retry')!.click();
    await fixture.whenStable();
    await respond(listRequest(), pageOf([testCustomer()]));

    expect(page.querySelector('[role="alert"]')).toBeNull();
    expect(page.querySelectorAll('tbody tr').length).toBe(1);
  });

  describe('deleting', () => {
    let confirm: ConfirmService;
    let toasts: ToastService;

    beforeEach(async () => {
      confirm = TestBed.inject(ConfirmService);
      toasts = TestBed.inject(ToastService);
      await fixture.whenStable();
    });

    const deleteButton = (name: string) => button(`Delete ${name}`)!;

    /** Answers the dialog, then lets `delete()` resume after its `await` and the view update. */
    async function answer(confirmed: boolean): Promise<void> {
      confirm.answer(confirmed);
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    }

    it('asks for confirmation and does nothing when cancelled', async () => {
      await respond(listRequest(), pageOf([testCustomer()]));

      deleteButton('ACME').click();
      await fixture.whenStable();
      expect(confirm.current()?.title).toBe('Delete ACME?');
      expect(confirm.current()?.tone).toBe('danger');

      await answer(false);
      http.expectNone(`${CUSTOMERS_API}/1`);
    });

    it('deletes the customer, confirms it in a toast and reloads the page', async () => {
      await respond(listRequest(), pageOf([testCustomer(), testCustomer({ id: 2, name: 'Globex' })]));

      deleteButton('ACME').click();
      await fixture.whenStable();
      await answer(true);

      expect(deleteButton('Globex').disabled).toBe(true);
      const request = http.expectOne(`${CUSTOMERS_API}/1`);
      expect(request.request.method).toBe('DELETE');
      request.flush(null, { status: 204, statusText: 'No Content' });
      await fixture.whenStable();

      expect(toasts.toasts().map((toast) => toast.message)).toEqual(['ACME was deleted.']);
      const reload = listRequest();
      expect(reload.request.params.get('page')).toBe('0');
      await respond(reload, pageOf([testCustomer({ id: 2, name: 'Globex' })]));
      expect(page.querySelectorAll('tbody tr').length).toBe(1);
      expect(deleteButton('Globex').disabled).toBe(false);
    });

    it('goes back one page after deleting the last customer of a page', async () => {
      await respond(listRequest(), pageOf([testCustomer()], 0, 21));
      button('Next')!.click();
      await fixture.whenStable();
      await respond(listRequest(), pageOf([testCustomer({ id: 21, name: 'Zeta' })], 1, 21));

      deleteButton('Zeta').click();
      await fixture.whenStable();
      await answer(true);
      http.expectOne(`${CUSTOMERS_API}/21`).flush(null, { status: 204, statusText: 'No Content' });
      await fixture.whenStable();

      expect(listRequest().request.params.get('page')).toBe('0');
    });

    it('reports a failed deletion in an error toast', async () => {
      await respond(listRequest(), pageOf([testCustomer()]));

      deleteButton('ACME').click();
      await fixture.whenStable();
      await answer(true);
      http
        .expectOne(`${CUSTOMERS_API}/1`)
        .flush({ status: 404, detail: 'Customer with id 1 not found' }, { status: 404, statusText: 'Not Found' });
      await fixture.whenStable();

      expect(toasts.toasts()).toEqual([{ id: expect.any(Number), tone: 'error', message: 'Customer with id 1 not found' }]);
    });
  });

  it('ignores the answer of a request replaced by a newer one', async () => {
    await fixture.whenStable();
    const first = listRequest();
    await searchFor('acme');

    expect(first.cancelled).toBe(true);
    await respond(listRequest(), pageOf([testCustomer()]));
    expect(page.querySelectorAll('tbody tr').length).toBe(1);
  });
});
