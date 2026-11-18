import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subject, catchError, debounceTime, map, of, switchMap, tap } from 'rxjs';

import { Page } from '../../core/http/page';
import { errorMessage } from '../../core/http/problem-detail';
import { AppHeader } from '../../shared/app-header';
import { Icon } from '../../shared/icon/icon';
import { EmptyState } from '../../shared/ui/empty-state';
import { PageHeader } from '../../shared/ui/page-header';
import { AdminUser } from '../admin.models';
import { AdminService } from '../admin.service';

export const PAGE_SIZE = 20;
/** Searching starts once the admin stops typing for this long (Enter searches at once). */
export const SEARCH_DEBOUNCE_MS = 300;

type ListResult = { page: Page<AdminUser> } | { error: unknown };

/** Back-office: every account of the platform, newest first, searchable by email or name. */
@Component({
  selector: 'app-admin-users',
  imports: [AppHeader, DatePipe, EmptyState, Icon, PageHeader, ReactiveFormsModule],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsers {
  private readonly admin = inject(AdminService);

  /** Each request replaces the previous one (switchMap): a slow old page never overwrites a newer one. */
  private readonly requests = new Subject<{ search: string; page: number }>();

  protected readonly skeletonRows = [1, 2, 3, 4];
  protected readonly searchControl = new FormControl('', { nonNullable: true });
  /** The search the current results are for. */
  protected readonly activeSearch = signal('');
  protected readonly result = signal<Page<AdminUser> | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

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
          this.admin.users({ ...query, size: PAGE_SIZE }).pipe(
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

  protected goTo(page: number): void {
    this.load(page);
  }

  protected retry(): void {
    this.load(this.result()?.page ?? 0);
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
