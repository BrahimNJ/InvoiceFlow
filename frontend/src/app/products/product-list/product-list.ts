import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, catchError, debounceTime, finalize, map, of, switchMap, tap } from 'rxjs';

import { Page } from '../../core/http/page';
import { errorMessage } from '../../core/http/problem-detail';
import { AppHeader } from '../../shared/app-header';
import { formatEuros, formatPercent, priceIncludingVat } from '../../shared/format/money';
import { Icon, IconName } from '../../shared/icon/icon';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { EmptyState } from '../../shared/ui/empty-state';
import { HelpTip } from '../../shared/ui/help-tip';
import { PageHeader } from '../../shared/ui/page-header';
import { ToastService } from '../../shared/ui/toast.service';
import { PRODUCT_TYPES, PRODUCT_UNITS, Product, ProductType } from '../product.models';
import { ProductService } from '../product.service';

export const PAGE_SIZE = 20;
/** Searching starts once the user stops typing for this long (Enter searches at once). */
export const SEARCH_DEBOUNCE_MS = 300;

export const PRODUCT_TIPS = [
  'Add each product or service once, then reuse it on your invoices: no retyping, no pricing mistakes.',
  'Prices are excluding VAT. The VAT rate you choose is added on the invoice.',
  'Goods or service: the e-invoicing reform requires this category on every invoice.',
];

type ListResult = { page: Page<Product> } | { error: unknown };

const FILTERS: { type: ProductType | null; label: string; icon: IconName }[] = [
  { type: null, label: 'All', icon: 'grid' },
  { type: 'SERVICE', label: PRODUCT_TYPES.SERVICE.plural, icon: PRODUCT_TYPES.SERVICE.icon },
  { type: 'GOODS', label: PRODUCT_TYPES.GOODS.plural, icon: PRODUCT_TYPES.GOODS.icon },
];

/** The signed-in user's catalogue: search, goods / services filter, one page at a time. */
@Component({
  selector: 'app-product-list',
  imports: [AppHeader, EmptyState, HelpTip, Icon, PageHeader, ReactiveFormsModule, RouterLink],
  templateUrl: './product-list.html',
  styleUrl: './product-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductList {
  private readonly products = inject(ProductService);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  /** Each request replaces the previous one (switchMap): a slow old page never overwrites a newer one. */
  private readonly requests = new Subject<{ search: string; type: ProductType | null; page: number }>();

  protected readonly tips = PRODUCT_TIPS;
  protected readonly filters = FILTERS;
  protected readonly types = PRODUCT_TYPES;
  protected readonly units = PRODUCT_UNITS;
  protected readonly formatEuros = formatEuros;
  protected readonly formatPercent = formatPercent;
  protected readonly priceIncludingVat = priceIncludingVat;
  protected readonly skeletonRows = [1, 2, 3, 4];

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  /** The search the current results are for. */
  protected readonly activeSearch = signal('');
  protected readonly activeType = signal<ProductType | null>(null);
  protected readonly result = signal<Page<Product> | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  /** Id of the product being deleted; one deletion at a time. */
  protected readonly deletingId = signal<number | null>(null);

  protected readonly filtered = computed(() => this.activeSearch() !== '' || this.activeType() !== null);
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
        switchMap((query) =>
          this.products.list({ ...query, type: query.type ?? undefined, size: PAGE_SIZE }).pipe(
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
    this.load(0);
  }

  /** A plain form (no form group): the browser submit is cancelled here. */
  protected submitSearch(event: Event): void {
    event.preventDefault();
    this.applySearch(this.searchControl.value);
  }

  protected clearSearch(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.applySearch('');
  }

  protected filterBy(type: ProductType | null): void {
    if (type !== this.activeType()) {
      this.activeType.set(type);
      this.load(0);
    }
  }

  protected clearFilters(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.activeSearch.set('');
    this.activeType.set(null);
    this.load(0);
  }

  protected goTo(page: number): void {
    this.load(page);
  }

  protected retry(): void {
    this.load(this.result()?.page ?? 0);
  }

  protected async delete(product: Product): Promise<void> {
    if (this.deletingId() !== null) {
      return;
    }
    const confirmed = await this.confirm.ask({
      title: `Delete “${product.name}”?`,
      message: 'It will be removed from your catalogue. This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }
    this.deletingId.set(product.id);
    this.products
      .delete(product.id)
      .pipe(
        finalize(() => this.deletingId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.toasts.success(`“${product.name}” was deleted.`);
          // Deleting the last product of a page goes back to the previous page
          const current = this.result();
          const emptied = current !== null && current.content.length === 1 && current.page > 0;
          this.load(emptied ? current.page - 1 : (current?.page ?? 0));
        },
        error: (error: unknown) => this.toasts.error(errorMessage(error)),
      });
  }

  private applySearch(value: string): void {
    const search = value.trim();
    if (search !== this.activeSearch()) {
      this.activeSearch.set(search);
      this.load(0);
    }
  }

  private load(page: number): void {
    this.requests.next({ search: this.activeSearch(), type: this.activeType(), page });
  }
}
