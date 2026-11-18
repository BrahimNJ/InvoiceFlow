import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Observable, Subject, catchError, debounceTime, finalize, map, of, switchMap, tap } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { Page } from '../../core/http/page';
import { errorMessage } from '../../core/http/problem-detail';
import { AppHeader } from '../../shared/app-header';
import { Icon } from '../../shared/icon/icon';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { EmptyState } from '../../shared/ui/empty-state';
import { PageHeader } from '../../shared/ui/page-header';
import { ToastService } from '../../shared/ui/toast.service';
import { AdminStats } from '../admin-stats/admin-stats';
import { AdminTabs } from '../admin-tabs';
import { AdminUser } from '../admin.models';
import { AdminService } from '../admin.service';

export const PAGE_SIZE = 20;
/** Searching starts once the admin stops typing for this long (Enter searches at once). */
export const SEARCH_DEBOUNCE_MS = 300;

type ListResult = { page: Page<AdminUser> } | { error: unknown };

/** Back-office: every account of the platform, newest first, searchable by email or name. */
@Component({
  selector: 'app-admin-users',
  imports: [AdminStats, AdminTabs, AppHeader, DatePipe, EmptyState, Icon, PageHeader, ReactiveFormsModule],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsers {
  private readonly admin = inject(AdminService);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  /** Each request replaces the previous one (switchMap): a slow old page never overwrites a newer one. */
  private readonly requests = new Subject<{ search: string; page: number }>();

  protected readonly skeletonRows = [1, 2, 3, 4];
  protected readonly searchControl = new FormControl('', { nonNullable: true });
  /** The search the current results are for. */
  protected readonly activeSearch = signal('');
  protected readonly result = signal<Page<AdminUser> | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  /** Id of the account being changed; one change at a time. */
  protected readonly busyId = signal<number | null>(null);

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

  protected isSelf(account: AdminUser): boolean {
    return account.id === this.auth.user()?.id;
  }

  protected async changeRole(account: AdminUser): Promise<void> {
    const promote = account.role === 'USER';
    const name = `${account.firstName} ${account.lastName}`;
    const confirmed = await this.confirm.ask(
      promote
        ? {
            title: `Make ${name} an admin?`,
            message:
              'They will manage every account of the platform, from their next sign-in or within 15 minutes.',
            confirmLabel: 'Make admin',
          }
        : {
            title: `Remove the admin role of ${name}?`,
            message: 'They lose the back-office at once and keep their own invoices and customers.',
            confirmLabel: 'Remove admin role',
            tone: 'danger',
          },
    );
    if (confirmed) {
      this.run(account, this.admin.changeRole(account.id, promote ? 'ADMIN' : 'USER'), (updated) =>
        updated.role === 'ADMIN' ? `${name} is now an admin.` : `${name} is no longer an admin.`,
      );
    }
  }

  protected async toggleSuspension(account: AdminUser): Promise<void> {
    const name = `${account.firstName} ${account.lastName}`;
    if (account.suspendedAt) {
      this.run(account, this.admin.reactivate(account.id), () => `${name} can sign in again.`);
      return;
    }
    const confirmed = await this.confirm.ask({
      title: `Suspend ${name}?`,
      message:
        'They are signed out of every session and cannot sign in until you reactivate the account. Their data is kept.',
      confirmLabel: 'Suspend',
      tone: 'danger',
    });
    if (confirmed) {
      this.run(account, this.admin.suspend(account.id), () => `${name} is suspended.`);
    }
  }

  /** One change at a time; the updated account replaces its row, nothing else is reloaded. */
  private run(account: AdminUser, request: Observable<AdminUser>, success: (updated: AdminUser) => string): void {
    if (this.busyId() !== null) {
      return;
    }
    this.busyId.set(account.id);
    request
      .pipe(
        finalize(() => this.busyId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.result.update(
            (page) =>
              page && { ...page, content: page.content.map((row) => (row.id === updated.id ? updated : row)) },
          );
          this.toasts.success(success(updated));
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
