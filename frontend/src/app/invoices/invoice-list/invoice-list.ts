import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, catchError, debounceTime, map, of, switchMap, tap } from 'rxjs';

import { Page } from '../../core/http/page';
import { errorMessage } from '../../core/http/problem-detail';
import { CustomerService } from '../../customers/customer.service';
import { AppHeader } from '../../shared/app-header';
import { formatEuros } from '../../shared/format/money';
import { Icon, IconName } from '../../shared/icon/icon';
import { EmptyState } from '../../shared/ui/empty-state';
import { HelpTip } from '../../shared/ui/help-tip';
import { PageHeader } from '../../shared/ui/page-header';
import { dueLabel, formatDate, todayIso } from '../invoice-calc';
import {
  InvoiceListItem,
  InvoiceQuery,
  InvoiceSort,
  InvoiceStatusFilter,
  InvoiceSummary,
  SortDirection,
  statusBadge,
} from '../invoice.models';
import { InvoiceService } from '../invoice.service';

export const PAGE_SIZE = 20;
export const SEARCH_DEBOUNCE_MS = 300;

export const INVOICE_TIPS = [
  'Start a draft, save it as often as you like: nothing is sent and no number is used.',
  'Issuing gives the next number of the year and freezes the invoice, as French law requires.',
  'Overdue invoices are highlighted here: sort by due date to see what to chase first.',
];

export type Period = 'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_QUARTER' | 'THIS_YEAR';

export const PERIODS: { value: Period; label: string }[] = [
  { value: 'ALL', label: 'Any date' },
  { value: 'THIS_MONTH', label: 'This month' },
  { value: 'LAST_MONTH', label: 'Last month' },
  { value: 'THIS_QUARTER', label: 'This quarter' },
  { value: 'THIS_YEAR', label: 'This year' },
];

const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** First and last issue dates of a period (both included), from today's ISO date. */
export function periodRange(period: Period, today: string): { issuedFrom?: string; issuedTo?: string } {
  const [year, month] = today.split('-').map(Number);
  const range = (fromYear: number, fromMonth: number, toYear: number, toMonth: number) => ({
    issuedFrom: `${fromYear}-${pad(fromMonth)}-01`,
    issuedTo: `${toYear}-${pad(toMonth)}-${pad(lastDay(toYear, toMonth))}`,
  });
  switch (period) {
    case 'ALL':
      return {};
    case 'THIS_MONTH':
      return range(year, month, year, month);
    case 'LAST_MONTH':
      return month === 1 ? range(year - 1, 12, year - 1, 12) : range(year, month - 1, year, month - 1);
    case 'THIS_QUARTER': {
      const first = Math.floor((month - 1) / 3) * 3 + 1;
      return range(year, first, year, first + 2);
    }
    case 'THIS_YEAR':
      return range(year, 1, year, 12);
  }
}

const TABS: { status: InvoiceStatusFilter | null; label: string }[] = [
  { status: null, label: 'All' },
  { status: 'DRAFT', label: 'Drafts' },
  { status: 'ISSUED', label: 'Issued' },
  { status: 'OVERDUE', label: 'Overdue' },
  { status: 'CANCELLED', label: 'Cancelled' },
];

const COLUMNS: { label: string; sort: InvoiceSort | null }[] = [
  { label: 'Number', sort: 'NUMBER' },
  { label: 'Customer', sort: 'CUSTOMER' },
  { label: 'Issued', sort: 'ISSUE_DATE' },
  { label: 'Due', sort: 'DUE_DATE' },
  { label: 'Status', sort: null },
  { label: 'Total', sort: 'TOTAL' },
];

type Kpi = { key: keyof InvoiceSummary; label: string; hint: string; icon: IconName; status: InvoiceStatusFilter; tone: string };

const KPIS: Kpi[] = [
  { key: 'drafts', label: 'Drafts', hint: 'not issued yet', icon: 'pencil', status: 'DRAFT', tone: 'neutral' },
  { key: 'outstanding', label: 'Outstanding', hint: 'issued, awaiting payment', icon: 'clock', status: 'ISSUED', tone: 'brand' },
  { key: 'overdue', label: 'Overdue', hint: 'past their due date', icon: 'alert', status: 'OVERDUE', tone: 'danger' },
  { key: 'issuedThisMonth', label: 'Issued this month', hint: 'since the 1st', icon: 'send', status: 'ISSUED', tone: 'accent' },
];

interface ListState {
  search: string;
  status: InvoiceStatusFilter | null;
  customerId: number | null;
  period: Period;
  sort: InvoiceSort;
  direction: SortDirection;
  page: number;
}

const INITIAL: ListState = {
  search: '',
  status: null,
  customerId: null,
  period: 'ALL',
  sort: 'CREATED_AT',
  direction: 'DESC',
  page: 0,
};

type ListResult = { page: Page<InvoiceListItem> } | { error: unknown };

/**
 * The invoices cockpit: key figures, status tabs, filters by customer and period, sortable columns, and how far each
 * due date is. A click on a row opens the invoice.
 */
@Component({
  selector: 'app-invoice-list',
  imports: [AppHeader, EmptyState, HelpTip, Icon, PageHeader, ReactiveFormsModule, RouterLink],
  templateUrl: './invoice-list.html',
  styleUrl: './invoice-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceList {
  private readonly invoices = inject(InvoiceService);
  private readonly router = inject(Router);
  private readonly requests = new Subject<ListState>();

  protected readonly tips = INVOICE_TIPS;
  protected readonly tabs = TABS;
  protected readonly kpis = KPIS;
  protected readonly columns = COLUMNS;
  protected readonly periods = PERIODS;
  protected readonly formatEuros = formatEuros;
  protected readonly formatDate = formatDate;
  protected readonly statusBadge = statusBadge;
  protected readonly skeletonRows = [1, 2, 3, 4];
  protected readonly today = todayIso();

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly state = signal<ListState>(INITIAL);
  protected readonly result = signal<Page<InvoiceListItem> | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  /** Set when the key figures cannot be loaded: the cards say so instead of loading forever. */
  protected readonly summaryFailed = signal(false);
  protected readonly summary = toSignal(
    this.invoices.summary().pipe(
      catchError(() => {
        this.summaryFailed.set(true);
        return of(null);
      }),
    ),
    { initialValue: null },
  );
  /** Options of the customer filter (the first 100, by name). */
  protected readonly customers = toSignal(
    inject(CustomerService)
      .list({ size: 100 })
      .pipe(
        map((page) => page.content),
        catchError(() => of([])),
      ),
    { initialValue: [] },
  );

  protected readonly filtered = computed(() => {
    const { search, status, customerId, period } = this.state();
    return search !== '' || status !== null || customerId !== null || period !== 'ALL';
  });
  protected readonly hasPrevious = computed(() => (this.result()?.page ?? 0) > 0);
  protected readonly hasNext = computed(() => {
    const page = this.result();
    return page !== null && page.page + 1 < page.totalPages;
  });

  constructor() {
    this.requests
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap((state) =>
          this.invoices.list(toQuery(state, this.today)).pipe(
            map((page): ListResult => ({ page })),
            catchError((error: unknown) => of<ListResult>({ error })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        this.loading.set(false);
        if ('page' in result) {
          this.result.set(result.page);
        } else {
          this.error.set(errorMessage(result.error));
        }
      });
    this.searchControl.valueChanges
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed())
      .subscribe((value) => this.applySearch(value));
    this.load();
  }

  protected submitSearch(event: Event): void {
    event.preventDefault();
    this.applySearch(this.searchControl.value);
  }

  protected clearSearch(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.applySearch('');
  }

  protected filterByStatus(status: InvoiceStatusFilter | null): void {
    this.update({ status });
  }

  protected filterByCustomer(value: string): void {
    this.update({ customerId: value === '' ? null : Number(value) });
  }

  protected filterByPeriod(value: string): void {
    this.update({ period: value as Period });
  }

  protected clearFilters(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.update({ search: '', status: null, customerId: null, period: 'ALL' });
  }

  /** A first click sorts ascending (descending for amounts), a second click reverses. */
  protected sortBy(sort: InvoiceSort): void {
    const current = this.state();
    const direction: SortDirection =
      current.sort === sort ? (current.direction === 'ASC' ? 'DESC' : 'ASC') : sort === 'TOTAL' ? 'DESC' : 'ASC';
    this.update({ sort, direction });
  }

  protected ariaSort(sort: InvoiceSort): 'ascending' | 'descending' | null {
    const current = this.state();
    if (current.sort !== sort) {
      return null;
    }
    return current.direction === 'ASC' ? 'ascending' : 'descending';
  }

  protected sortIcon(sort: InvoiceSort): IconName {
    const order = this.ariaSort(sort);
    return order === 'ascending' ? 'arrow-up' : order === 'descending' ? 'arrow-down' : 'sort';
  }

  protected goTo(page: number): void {
    this.state.update((state) => ({ ...state, page }));
    this.load();
  }

  protected retry(): void {
    this.load();
  }

  /** The whole row opens the invoice; links and buttons inside keep their own behavior. */
  protected open(invoice: InvoiceListItem, event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('a, button')) {
      return;
    }
    void this.router.navigate(['/invoices', invoice.id]);
  }

  protected due(invoice: InvoiceListItem): { text: string; late: boolean } | null {
    return invoice.status === 'ISSUED' && invoice.dueDate ? dueLabel(invoice.dueDate, this.today) : null;
  }

  private applySearch(value: string): void {
    const search = value.trim();
    if (search !== this.state().search) {
      this.update({ search });
    }
  }

  /** Any filter or sort change goes back to the first page. */
  private update(changes: Partial<ListState>): void {
    this.state.update((state) => ({ ...state, ...changes, page: 0 }));
    this.load();
  }

  private load(): void {
    this.requests.next(this.state());
  }
}

function toQuery(state: ListState, today: string): InvoiceQuery {
  return {
    search: state.search,
    status: state.status ?? undefined,
    customerId: state.customerId ?? undefined,
    ...periodRange(state.period, today),
    sort: state.sort,
    direction: state.direction,
    page: state.page,
    size: PAGE_SIZE,
  };
}
