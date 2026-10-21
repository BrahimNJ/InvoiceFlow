import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ConfirmService } from '../../shared/ui/confirm.service';
import { ToastService } from '../../shared/ui/toast.service';
import { pageOf, testProduct } from '../product.fixtures';
import { PRODUCTS_API } from '../product.service';
import { PAGE_SIZE, ProductList, SEARCH_DEBOUNCE_MS } from './product-list';

/** Intl uses narrow no-break spaces in French amounts. */
const plain = (text: string | null | undefined) => (text ?? '').replace(/[  ]/g, ' ');

describe('ProductList', () => {
  let fixture: ComponentFixture<ProductList>;
  let page: HTMLElement;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProductList);
    page = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  const listRequest = (): TestRequest => http.expectOne((r) => r.url === PRODUCTS_API);

  async function respond(request: TestRequest, body: object): Promise<void> {
    request.flush(body);
    await fixture.whenStable();
  }

  const searchInput = () => page.querySelector<HTMLInputElement>('#product-search')!;

  async function type(text: string): Promise<void> {
    searchInput().value = text;
    searchInput().dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function searchFor(text: string): Promise<void> {
    await type(text);
    page.querySelector('form[role="search"]')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  const button = (label: string) =>
    [...page.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === label || b.getAttribute('aria-label') === label,
    );

  it('explains the screen, shows skeletons, then the first page of products', async () => {
    await fixture.whenStable();
    expect(page.querySelector('h1')?.textContent).toContain('Products & services');
    expect(page.querySelectorAll('app-help-tip li').length).toBe(3);
    expect(page.querySelector('[aria-label="Loading products"]')).toBeTruthy();

    const request = listRequest();
    expect(request.request.params.get('page')).toBe('0');
    expect(request.request.params.get('size')).toBe(String(PAGE_SIZE));
    expect(request.request.params.has('type')).toBe(false);
    await respond(
      request,
      pageOf([testProduct(), testProduct({ id: 2, type: 'GOODS', name: 'Keyboard', description: null, unitPrice: 49.9, vatRate: 5.5, unit: 'UNIT' })]),
    );

    const rows = page.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].querySelector('a.name')?.getAttribute('href')).toBe('/products/1/edit');
    expect(rows[0].textContent).toContain('Service');
    expect(rows[0].textContent).toContain('Senior developer, day rate');
    expect(plain(rows[0].querySelector('[data-label="Price excl. VAT"]')?.textContent)).toContain('650,00 € / day');
    expect(plain(rows[0].querySelector('[data-label="Price incl. VAT"]')?.textContent)).toContain('780,00 €');
    expect(rows[1].textContent).toContain('Goods');
    expect(rows[1].querySelector('[data-label="VAT"]')?.textContent).toContain('5,5 %');
    expect(plain(rows[1].querySelector('[data-label="Price incl. VAT"]')?.textContent)).toContain('52,64 €');
    expect(page.querySelector('.result-count')?.textContent).toContain('2 items');
    expect(page.querySelector('.pagination')).toBeNull();
  });

  it('invites to add the first product when the catalogue is empty', async () => {
    await fixture.whenStable();
    await respond(listRequest(), pageOf([]));

    expect(page.querySelector('app-empty-state h2')?.textContent).toContain('Your catalogue is empty');
    expect(page.querySelector('app-empty-state a')?.getAttribute('href')).toBe('/products/new');
  });

  it('searches on Enter, from the first page, and clears the search', async () => {
    await fixture.whenStable();
    await respond(listRequest(), pageOf([testProduct()], 1, 25));

    await searchFor('  zzz ');
    const search = listRequest();
    expect(search.request.params.get('search')).toBe('zzz');
    expect(search.request.params.get('page')).toBe('0');
    await respond(search, pageOf([]));

    expect(page.querySelector('app-empty-state h2')?.textContent).toContain('Nothing matches your filters');
    expect(page.querySelector('.result-count')?.textContent).toContain('0 items found');

    button('Clear the search')!.click();
    await fixture.whenStable();
    const cleared = listRequest();
    expect(cleared.request.params.has('search')).toBe(false);
    await respond(cleared, pageOf([testProduct()]));
    expect(searchInput().value).toBe('');
  });

  it('searches by itself once the user stops typing', async () => {
    vi.useFakeTimers();
    try {
      fixture.detectChanges();
      listRequest().flush(pageOf([testProduct()]));

      searchInput().value = 'web';
      searchInput().dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
      http.expectNone((r) => r.url === PRODUCTS_API);

      vi.advanceTimersByTime(1);
      const request = listRequest();
      expect(request.request.params.get('search')).toBe('web');
      request.flush(pageOf([testProduct()]));
    } finally {
      vi.useRealTimers();
    }
  });

  it('filters by type and clears every filter at once', async () => {
    await fixture.whenStable();
    await respond(listRequest(), pageOf([testProduct()]));
    expect(button('All')!.getAttribute('aria-pressed')).toBe('true');

    button('Goods')!.click();
    await fixture.whenStable();
    const goods = listRequest();
    expect(goods.request.params.get('type')).toBe('GOODS');
    await respond(goods, pageOf([]));
    expect(button('Goods')!.getAttribute('aria-pressed')).toBe('true');
    expect(button('All')!.getAttribute('aria-pressed')).toBe('false');

    button('Clear filters')!.click();
    await fixture.whenStable();
    const all = listRequest();
    expect(all.request.params.has('type')).toBe(false);
    expect(all.request.params.has('search')).toBe(false);
    await respond(all, pageOf([testProduct()]));
  });

  it('pages through the results, keeping the filters', async () => {
    await fixture.whenStable();
    await respond(listRequest(), pageOf([testProduct()], 0, 45));
    button('Services')!.click();
    await fixture.whenStable();
    await respond(listRequest(), pageOf([testProduct()], 0, 45));

    expect(page.querySelector('.pagination')?.textContent).toContain('Page 1 of 3');
    expect(button('Previous')!.disabled).toBe(true);

    button('Next')!.click();
    await fixture.whenStable();
    const next = listRequest();
    expect(next.request.params.get('page')).toBe('1');
    expect(next.request.params.get('type')).toBe('SERVICE');
    await respond(next, pageOf([testProduct({ id: 21 })], 1, 45));

    expect(page.querySelector('.pagination')?.textContent).toContain('Page 2 of 3');
  });

  it('shows the error and retries', async () => {
    await fixture.whenStable();
    listRequest().flush({ status: 500, detail: 'Database unavailable' }, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('Database unavailable');

    button('Retry')!.click();
    await fixture.whenStable();
    await respond(listRequest(), pageOf([testProduct()]));

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
      await respond(listRequest(), pageOf([testProduct()]));

      deleteButton('Web development').click();
      await fixture.whenStable();
      expect(confirm.current()?.title).toBe('Delete “Web development”?');
      expect(confirm.current()?.tone).toBe('danger');

      await answer(false);
      http.expectNone(`${PRODUCTS_API}/1`);
    });

    it('deletes the product, confirms it in a toast and reloads the page', async () => {
      await respond(listRequest(), pageOf([testProduct(), testProduct({ id: 2, name: 'Keyboard' })]));

      deleteButton('Web development').click();
      await fixture.whenStable();
      await answer(true);

      expect(deleteButton('Keyboard').disabled).toBe(true);
      const request = http.expectOne(`${PRODUCTS_API}/1`);
      expect(request.request.method).toBe('DELETE');
      request.flush(null, { status: 204, statusText: 'No Content' });
      await fixture.whenStable();

      expect(toasts.toasts().map((toast) => toast.message)).toEqual(['“Web development” was deleted.']);
      const reload = listRequest();
      expect(reload.request.params.get('page')).toBe('0');
      await respond(reload, pageOf([testProduct({ id: 2, name: 'Keyboard' })]));
      expect(deleteButton('Keyboard').disabled).toBe(false);
    });

    it('goes back one page after deleting the last product of a page', async () => {
      await respond(listRequest(), pageOf([testProduct()], 0, 21));
      button('Next')!.click();
      await fixture.whenStable();
      await respond(listRequest(), pageOf([testProduct({ id: 21, name: 'Zeta' })], 1, 21));

      deleteButton('Zeta').click();
      await fixture.whenStable();
      await answer(true);
      http.expectOne(`${PRODUCTS_API}/21`).flush(null, { status: 204, statusText: 'No Content' });
      await fixture.whenStable();

      expect(listRequest().request.params.get('page')).toBe('0');
    });

    it('reports a failed deletion in an error toast', async () => {
      await respond(listRequest(), pageOf([testProduct()]));

      deleteButton('Web development').click();
      await fixture.whenStable();
      await answer(true);
      http
        .expectOne(`${PRODUCTS_API}/1`)
        .flush({ status: 404, detail: 'Product with id 1 not found' }, { status: 404, statusText: 'Not Found' });
      await fixture.whenStable();

      expect(toasts.toasts()).toEqual([{ id: expect.any(Number), tone: 'error', message: 'Product with id 1 not found' }]);
    });
  });

  it('ignores the answer of a request replaced by a newer one', async () => {
    await fixture.whenStable();
    const first = listRequest();
    await searchFor('web');

    expect(first.cancelled).toBe(true);
    await respond(listRequest(), pageOf([testProduct()]));
    expect(page.querySelectorAll('tbody tr').length).toBe(1);
  });
});
