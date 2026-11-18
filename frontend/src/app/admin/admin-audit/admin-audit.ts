import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, map, of, switchMap, tap } from 'rxjs';

import { Page } from '../../core/http/page';
import { errorMessage } from '../../core/http/problem-detail';
import { AppHeader } from '../../shared/app-header';
import { Icon } from '../../shared/icon/icon';
import { EmptyState } from '../../shared/ui/empty-state';
import { PageHeader } from '../../shared/ui/page-header';
import { AdminTabs } from '../admin-tabs';
import { AdminAction, AdminActionType } from '../admin.models';
import { AdminService } from '../admin.service';

export const PAGE_SIZE = 20;

const ACTION_LABELS: Record<AdminActionType, string> = {
  ROLE_CHANGED: 'Role changed',
  ACCOUNT_SUSPENDED: 'Account suspended',
  ACCOUNT_REACTIVATED: 'Account reactivated',
  PROMOTED_AT_STARTUP: 'Made admin at startup',
};

type AuditResult = { page: Page<AdminAction> } | { error: unknown };

/** Back-office: what admins did to accounts, newest first. Read-only. */
@Component({
  selector: 'app-admin-audit',
  imports: [AdminTabs, AppHeader, DatePipe, EmptyState, Icon, PageHeader],
  templateUrl: './admin-audit.html',
  styleUrl: './admin-audit.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAudit {
  private readonly admin = inject(AdminService);
  private readonly requests = new Subject<number>();

  protected readonly result = signal<Page<AdminAction> | null>(null);
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
        switchMap((page) =>
          this.admin.audit(page, PAGE_SIZE).pipe(
            map((result): AuditResult => ({ page: result })),
            catchError((error: unknown) => of<AuditResult>({ error })),
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
    this.requests.next(0);
  }

  protected label(action: AdminAction): string {
    return ACTION_LABELS[action.action];
  }

  protected goTo(page: number): void {
    this.requests.next(page);
  }

  protected retry(): void {
    this.requests.next(this.result()?.page ?? 0);
  }
}
