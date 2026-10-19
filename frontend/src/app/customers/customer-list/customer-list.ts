import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, catchError, finalize, map, of, switchMap, tap } from 'rxjs';

import { Page } from '../../core/http/page';
import { errorMessage } from '../../core/http/problem-detail';
import { AppHeader } from '../../shared/app-header';
import { Icon } from '../../shared/icon/icon';
import { Customer } from '../customer.models';
import { CustomerService } from '../customer.service';

export const PAGE_SIZE = 20;

type ListResult = { page: Page<Customer> } | { error: unknown };

/** The signed-in user's customers: search by name or email, one page at a time. */
@Component({
  selector: 'app-customer-list',
  imports: [AppHeader, Icon, ReactiveFormsModule, RouterLink],
  templateUrl: './customer-list.html',
  styleUrl: './customer-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerList {
  private readonly customers = inject(CustomerService);
  private readonly destroyRef = inject(DestroyRef);

  /** Each request replaces the previous one (switchMap): a slow old page never overwrites a newer one. */
  private readonly requests = new Subject<{ search: string; page: number }>();

  protected readonly searchForm = inject(NonNullableFormBuilder).group({ search: '' });
  /** The search the current results are for (the field can be edited without submitting). */
  protected readonly activeSearch = signal('');
  protected readonly result = signal<Page<Customer> | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  /** Id of the customer being deleted; one deletion at a time. */
  protected readonly deletingId = signal<number | null>(null);
  /** Outcome of the last deletion, announced to screen readers. */
  protected readonly notice = signal<string | null>(null);

  protected readonly customersOnPage = computed(() => this.result()?.content ?? []);
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
          this.customers.list({ ...query, size: PAGE_SIZE }).pipe(
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
    this.load(0);
  }

  protected search(): void {
    this.notice.set(null);
    this.activeSearch.set(this.searchForm.controls.search.value.trim());
    this.load(0);
  }

  protected clearSearch(): void {
    this.searchForm.reset();
    this.search();
  }

  protected goTo(page: number): void {
    this.notice.set(null);
    this.load(page);
  }

  protected delete(customer: Customer): void {
    if (this.deletingId() !== null || !confirm(`Delete ${customer.name}? This cannot be undone.`)) {
      return;
    }
    this.deletingId.set(customer.id);
    this.notice.set(null);
    this.customers
      .delete(customer.id)
      .pipe(
        finalize(() => this.deletingId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.notice.set(`${customer.name} was deleted.`);
          // Deleting the last customer of a page goes back to the previous page
          const current = this.result();
          const emptied = current !== null && current.content.length === 1 && current.page > 0;
          this.load(emptied ? current.page - 1 : (current?.page ?? 0));
        },
        error: (error: unknown) => this.error.set(errorMessage(error)),
      });
  }

  protected retry(): void {
    this.load(this.result()?.page ?? 0);
  }

  private load(page: number): void {
    this.requests.next({ search: this.activeSearch(), page });
  }
}
