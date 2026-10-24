import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { testCustomer } from '../../customers/customer.fixtures';
import { CUSTOMERS_API } from '../../customers/customer.service';
import { addDays, todayIso } from '../invoice-calc';
import { pageOf, testListItem, testSummary } from '../invoice.fixtures';
import { INVOICES_API } from '../invoice.service';
import { InvoiceList, PAGE_SIZE, periodRange } from './invoice-list';

/** Intl uses narrow no-break spaces in French amounts. */
const plain = (text: string | null | undefined) => (text ?? '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();

describe('periodRange', () => {
  it('gives the first and last issue dates of each period', () => {
    expect(periodRange('ALL', '2026-10-24')).toEqual({});
    expect(periodRange('THIS_MONTH', '2026-02-10')).toEqual({ issuedFrom: '2026-02-01', issuedTo: '2026-02-28' });
    expect(periodRange('LAST_MONTH', '2026-01-10')).toEqual({ issuedFrom: '2025-12-01', issuedTo: '2025-12-31' });
    expect(periodRange('THIS_QUARTER', '2026-11-05')).toEqual({ issuedFrom: '2026-10-01', issuedTo: '2026-12-31' });
    expect(periodRange('THIS_YEAR', '2028-03-01')).toEqual({ issuedFrom: '2028-01-01', issuedTo: '2028-12-31' });
  });
});

describe('InvoiceList', () => {
  let fixture: ComponentFixture<InvoiceList>;
  let page: HTMLElement;
  let http: HttpTestingController;
  const today = todayIso();

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(InvoiceList);
    page = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  const listRequest = (): TestRequest => http.expectOne((r) => r.url === INVOICES_API);

  /** Answers the three requests of the first render. */
  async function start(items = [testListItem()]): Promise<void> {
    await fixture.whenStable();
    http.expectOne(`${INVOICES_API}/summary`).flush(testSummary());
    http.expectOne((r) => r.url === CUSTOMERS_API).flush({
      content: [testCustomer(), testCustomer({ id: 4, name: 'Globex' })],
      page: 0,
      size: 100,
      totalElements: 2,
      totalPages: 1,
    });
    listRequest().flush(pageOf(items));
    await fixture.whenStable();
  }

  async function respond(request: TestRequest, items = [testListItem()]): Promise<void> {
    request.flush(pageOf(items));
    await fixture.whenStable();
  }

  const button = (label: string) =>
    [...page.querySelectorAll<HTMLButtonElement>('button')].find((b) => plain(b.textContent) === label);
  const kpi = (label: string) =>
    [...page.querySelectorAll<HTMLButtonElement>('.kpi')].find((b) => b.textContent?.includes(label))!;

  it('shows the key figures, then the most recent invoices first', async () => {
    await fixture.whenStable();
    expect(page.querySelector('h1')?.textContent).toContain('Invoices');
    expect(page.querySelector('[aria-label="Loading invoices"]')).toBeTruthy();
    http.expectOne(`${INVOICES_API}/summary`).flush(testSummary());
    http.expectOne((r) => r.url === CUSTOMERS_API).flush(pageOf([testCustomer()]));
    const request = listRequest();
    expect(request.request.params.get('sort')).toBe('CREATED_AT');
    expect(request.request.params.get('direction')).toBe('DESC');
    expect(request.request.params.get('size')).toBe(String(PAGE_SIZE));
    await respond(request, [
      testListItem({ dueDate: addDays(today, 8) }),
      testListItem({ id: 2, number: 'F-2026-0002', customerName: 'Globex', overdue: true, dueDate: addDays(today, -9), total: 3120 }),
      testListItem({ id: 3, number: null, status: 'DRAFT', customerName: null, issueDate: null, dueDate: null }),
    ]);

    expect(plain(kpi('Overdue').textContent)).toContain('3 120,00 €');
    expect(plain(kpi('Overdue').textContent)).toContain('2 invoices');
    expect(kpi('Overdue').classList).toContain('alert');

    const rows = page.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
    expect(rows[0].querySelector('a')?.getAttribute('href')).toBe('/invoices/1');
    expect(plain(rows[0].querySelector('[data-label="Due"]')?.textContent)).toContain('Due in 8 days');
    expect(plain(rows[0].querySelector('[data-label="Total"]')?.textContent)).toContain('1 560,00 €');
    expect(plain(rows[0].querySelector('[data-label="Total"]')?.textContent)).toContain('1 300,00 € excl. VAT');
    expect(rows[1].classList).toContain('is-overdue');
    expect(plain(rows[1].querySelector('.status-badge')?.textContent)).toBe('Overdue');
    expect(rows[1].querySelector('.relative.late')?.textContent).toBe('9 days late');
    expect(plain(rows[2].querySelector('a')?.textContent)).toBe('Draft');
    expect(plain(rows[2].querySelector('[data-label="Customer"]')?.textContent)).toBe('No customer yet');
  });

  it('filters by status from a tab or a key figure', async () => {
    await start();

    button('Drafts')!.click();
    await fixture.whenStable();
    const drafts = listRequest();
    expect(drafts.request.params.get('status')).toBe('DRAFT');
    await respond(drafts);
    expect(button('Drafts')!.getAttribute('aria-pressed')).toBe('true');

    kpi('Overdue').click();
    await fixture.whenStable();
    const overdue = listRequest();
    expect(overdue.request.params.get('status')).toBe('OVERDUE');
    expect(overdue.request.params.get('page')).toBe('0');
    await respond(overdue);
  });

  it('filters by customer and by issue period', async () => {
    await start();

    const customer = page.querySelector<HTMLSelectElement>('#invoice-customer')!;
    expect([...customer.options].map((option) => option.textContent)).toEqual(['All customers', 'ACME', 'Globex']);
    customer.value = '4';
    customer.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    const byCustomer = listRequest();
    expect(byCustomer.request.params.get('customerId')).toBe('4');
    await respond(byCustomer);

    const period = page.querySelector<HTMLSelectElement>('#invoice-period')!;
    period.value = 'THIS_YEAR';
    period.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    const byPeriod = listRequest();
    expect(byPeriod.request.params.get('issuedFrom')).toBe(`${today.slice(0, 4)}-01-01`);
    expect(byPeriod.request.params.get('issuedTo')).toBe(`${today.slice(0, 4)}-12-31`);
    expect(byPeriod.request.params.get('customerId')).toBe('4');
    await respond(byPeriod);
  });

  it('sorts by a column, then reverses on a second click', async () => {
    await start();

    button('Due')!.click();
    await fixture.whenStable();
    const ascending = listRequest();
    expect(ascending.request.params.get('sort')).toBe('DUE_DATE');
    expect(ascending.request.params.get('direction')).toBe('ASC');
    await respond(ascending);
    expect(button('Due')!.closest('th')?.getAttribute('aria-sort')).toBe('ascending');

    button('Due')!.click();
    await fixture.whenStable();
    const descending = listRequest();
    expect(descending.request.params.get('direction')).toBe('DESC');
    await respond(descending);

    button('Total')!.click();
    await fixture.whenStable();
    const byTotal = listRequest();
    expect(byTotal.request.params.get('direction')).toBe('DESC');
    await respond(byTotal);
  });

  it('opens an invoice when its row is clicked', async () => {
    await start();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    page.querySelector<HTMLElement>('tbody tr td[data-label="Customer"]')!.click();

    expect(navigate).toHaveBeenCalledWith(['/invoices', 1]);
  });

  it('invites to write the first invoice, or to clear the filters', async () => {
    await start([]);
    expect(page.querySelector('app-empty-state h2')?.textContent).toBe('No invoice yet');

    button('Cancelled')!.click();
    await fixture.whenStable();
    await respond(listRequest(), []);
    expect(page.querySelector('app-empty-state h2')?.textContent).toBe('Nothing matches your filters');

    button('Clear filters')!.click();
    await fixture.whenStable();
    const cleared = listRequest();
    expect(cleared.request.params.has('status')).toBe(false);
    await respond(cleared, []);
  });

  it('shows an error with a retry', async () => {
    await fixture.whenStable();
    http.expectOne(`${INVOICES_API}/summary`).flush(testSummary());
    http.expectOne((r) => r.url === CUSTOMERS_API).flush(pageOf([]));
    listRequest().flush({ detail: 'Boom' }, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('Boom');
    button('Retry')!.click();
    await fixture.whenStable();
    await respond(listRequest());
    expect(page.querySelector('[role="alert"]')).toBeNull();
  });
});
