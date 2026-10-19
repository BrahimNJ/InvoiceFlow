import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { pageOf, testCustomer } from '../customer.fixtures';
import { CUSTOMERS_API } from '../customer.service';
import { CustomerList, PAGE_SIZE } from './customer-list';

describe('CustomerList', () => {
  let fixture: ComponentFixture<CustomerList>;
  let page: HTMLElement;
  let http: HttpTestingController;

  beforeEach(() => {
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

  async function searchFor(text: string): Promise<void> {
    const input = page.querySelector<HTMLInputElement>('#customer-search')!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    page.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  const button = (label: string) =>
    [...page.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === label);

  it('shows a loading state, then the first page of customers', async () => {
    await fixture.whenStable();
    expect(page.querySelector('.status[role="status"]')?.textContent).toContain('Loading customers');

    const request = listRequest();
    expect(request.request.params.get('page')).toBe('0');
    expect(request.request.params.get('size')).toBe(String(PAGE_SIZE));
    await respond(request, pageOf([testCustomer(), testCustomer({ id: 2, name: 'Globex', city: null })]));

    const rows = page.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('ACME');
    expect(rows[0].textContent).toContain('contact@acme.fr');
    expect(rows[0].querySelector('a')?.getAttribute('href')).toBe('/customers/1/edit');
    expect(rows[1].textContent).toContain('—');
    expect(page.querySelector('.lead')?.textContent).toContain('2 customers');
    expect(page.querySelector('.pager')).toBeNull();
  });

  it('invites to create the first customer when there is none', async () => {
    await fixture.whenStable();
    await respond(listRequest(), pageOf([]));

    expect(page.querySelector('.empty h2')?.textContent).toContain('No customers yet');
    expect(page.querySelector('.empty a')?.getAttribute('href')).toBe('/customers/new');
  });

  it('searches from the first page and can clear the search', async () => {
    await fixture.whenStable();
    await respond(listRequest(), pageOf([testCustomer()], 1, 25));

    await searchFor('  zzz ');
    const search = listRequest();
    expect(search.request.params.get('search')).toBe('zzz');
    expect(search.request.params.get('page')).toBe('0');
    await respond(search, pageOf([]));

    expect(page.querySelector('.empty h2')?.textContent).toContain('No customer matches “zzz”');
    expect(page.querySelector('.lead')?.textContent).toContain('0 matches for “zzz”');

    button('Clear')!.click();
    await fixture.whenStable();
    const cleared = listRequest();
    expect(cleared.request.params.has('search')).toBe(false);
    await respond(cleared, pageOf([testCustomer()]));

    expect(page.querySelector<HTMLInputElement>('#customer-search')!.value).toBe('');
    expect(button('Clear')).toBeUndefined();
  });

  it('pages through the results, keeping the search', async () => {
    await fixture.whenStable();
    await respond(listRequest(), pageOf([testCustomer()], 0, 45));
    await searchFor('acme');
    await respond(listRequest(), pageOf([testCustomer()], 0, 45));

    expect(page.querySelector('.pager')?.textContent).toContain('Page 1 of 3');
    expect(button('Previous')!.disabled).toBe(true);

    button('Next')!.click();
    await fixture.whenStable();
    const next = listRequest();
    expect(next.request.params.get('page')).toBe('1');
    expect(next.request.params.get('search')).toBe('acme');
    await respond(next, pageOf([testCustomer({ id: 21 })], 1, 45));

    expect(page.querySelector('.pager')?.textContent).toContain('Page 2 of 3');
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
    const deleteButton = (name: string) => button(`Delete ${name}`)!;

    it('asks for confirmation and does nothing when cancelled', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
      await fixture.whenStable();
      await respond(listRequest(), pageOf([testCustomer()]));

      deleteButton('ACME').click();

      expect(confirm).toHaveBeenCalledWith('Delete ACME? This cannot be undone.');
      http.expectNone(`${CUSTOMERS_API}/1`);
    });

    it('deletes the customer, announces it and reloads the page', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      await fixture.whenStable();
      await respond(listRequest(), pageOf([testCustomer(), testCustomer({ id: 2, name: 'Globex' })]));

      deleteButton('ACME').click();
      await fixture.whenStable();
      expect(deleteButton('Globex').disabled).toBe(true);
      const request = http.expectOne(`${CUSTOMERS_API}/1`);
      expect(request.request.method).toBe('DELETE');
      request.flush(null, { status: 204, statusText: 'No Content' });
      await fixture.whenStable();

      expect(page.querySelector('.notice')?.textContent).toContain('ACME was deleted.');
      const reload = listRequest();
      expect(reload.request.params.get('page')).toBe('0');
      await respond(reload, pageOf([testCustomer({ id: 2, name: 'Globex' })]));
      expect(page.querySelectorAll('tbody tr').length).toBe(1);
      expect(deleteButton('Globex').disabled).toBe(false);
    });

    it('goes back one page after deleting the last customer of a page', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      await fixture.whenStable();
      await respond(listRequest(), pageOf([testCustomer()], 0, 21));
      button('Next')!.click();
      await fixture.whenStable();
      await respond(listRequest(), pageOf([testCustomer({ id: 21, name: 'Zeta' })], 1, 21));

      deleteButton('Zeta').click();
      http.expectOne(`${CUSTOMERS_API}/21`).flush(null, { status: 204, statusText: 'No Content' });
      await fixture.whenStable();

      expect(listRequest().request.params.get('page')).toBe('0');
    });

    it('shows the error when the deletion fails', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      await fixture.whenStable();
      await respond(listRequest(), pageOf([testCustomer()]));

      deleteButton('ACME').click();
      http
        .expectOne(`${CUSTOMERS_API}/1`)
        .flush({ status: 404, detail: 'Customer with id 1 not found' }, { status: 404, statusText: 'Not Found' });
      await fixture.whenStable();

      expect(page.querySelector('[role="alert"]')?.textContent).toContain('Customer with id 1 not found');
      expect(page.querySelector('.notice')?.textContent).toBe('');
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
