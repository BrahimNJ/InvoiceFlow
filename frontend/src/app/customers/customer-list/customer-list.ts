import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, catchError, debounceTime, finalize, map, of, switchMap, tap } from 'rxjs';

import { Page } from '../../core/http/page';
import { errorMessage } from '../../core/http/problem-detail';
import { AppHeader } from '../../shared/app-header';
import { Icon } from '../../shared/icon/icon';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { EmptyState } from '../../shared/ui/empty-state';
import { HelpTip } from '../../shared/ui/help-tip';
import { PageHeader } from '../../shared/ui/page-header';
import { ToastService } from '../../shared/ui/toast.service';
import { Customer } from '../customer.models';
import { CustomerService } from '../customer.service';

export const PAGE_SIZE = 20;
/** Searching starts once the user stops typing for this long (Enter searches at once). */
export const SEARCH_DEBOUNCE_MS = 300;

export const CUSTOMER_TIPS = [
  'Add the companies and people you invoice once: their details fill in your invoices for you.',
  'The billing email is where invoices and payment reminders will be sent.',
  'For a business, add its SIRET and VAT number: the e-invoicing reform requires them on B2B invoices.',
];

/** Avatar colors, picked from the customer id so that a customer keeps the same one. */
const AVATAR_TONES = ['brand', 'accent', 'warm', 'violet'] as const;

type ListResult = { page: Page<Customer> } | { error: unknown };

/** The signed-in user's customers: search by name or email, one page at a time. */
@Component({
  selector: 'app-customer-list',
  imports: [AppHeader, EmptyState, HelpTip, Icon, PageHeader, ReactiveFormsModule, RouterLink],
  templateUrl: './customer-list.html',
  styleUrl: './customer-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerList {
  private readonly customers = inject(CustomerService);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  /** Each request replaces the previous one (switchMap): a slow old page never overwrites a newer one. */
  private readonly requests = new Subject<{ search: string; page: number }>();

  protected readonly tips = CUSTOMER_TIPS;
  protected readonly skeletonRows = [1, 2, 3, 4];

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  /** The search the current results are for. */
  protected readonly activeSearch = signal('');
  protected readonly result = signal<Page<Customer> | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  /** Id of the customer being deleted; one deletion at a time. */
  protected readonly deletingId = signal<number | null>(null);

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
    this.searchControl.valueChanges
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed())
      .subscribe((value) => this.applySearch(value));
    this.load(0);
  }

  /** Up to two letters for the avatar: "ACME" → "AC", "Jane Doe" → "JD". */
  protected initials(name: string): string {
    const words = name.trim().split(/\s+/);
    const letters = words.length > 1 ? words[0][0] + words[1][0] : name.trim().slice(0, 2);
    return letters.toUpperCase();
  }

  protected avatarTone(customer: Customer): string {
    return AVATAR_TONES[customer.id % AVATAR_TONES.length];
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

  protected goTo(page: number): void {
    this.load(page);
  }

  protected retry(): void {
    this.load(this.result()?.page ?? 0);
  }

  protected async delete(customer: Customer): Promise<void> {
    if (this.deletingId() !== null) {
      return;
    }
    const confirmed = await this.confirm.ask({
      title: `Delete ${customer.name}?`,
      message: 'Their contact details will be removed from your customers. This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }
    this.deletingId.set(customer.id);
    this.customers
      .delete(customer.id)
      .pipe(
        finalize(() => this.deletingId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.toasts.success(`${customer.name} was deleted.`);
          // Deleting the last customer of a page goes back to the previous page
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
    this.requests.next({ search: this.activeSearch(), page });
  }
}
