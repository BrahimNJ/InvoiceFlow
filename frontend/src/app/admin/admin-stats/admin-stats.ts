import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';

import { PlatformStats } from '../admin.models';
import { AdminService } from '../admin.service';

type StatsState = { stats: PlatformStats } | { error: true } | { loading: true };

/** Platform counts for admins: how many accounts, customers and invoices, never whose. */
@Component({
  selector: 'app-admin-stats',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (tiles(); as list) {
      <dl class="tiles">
        @for (tile of list; track tile.label) {
          <div class="tile panel">
            <dt>{{ tile.label }}</dt>
            <dd>{{ tile.value }}</dd>
          </div>
        }
      </dl>
    } @else if (failed()) {
      <p class="unavailable">Platform figures are unavailable right now.</p>
    } @else {
      <div class="tiles" role="status" aria-label="Loading platform figures">
        @for (tile of placeholders; track tile) {
          <span class="tile panel skeleton"></span>
        }
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: .75rem; margin: 0; }
    .tile { display: grid; gap: .2rem; min-height: 4.5rem; padding: .85rem 1rem; }
    dt { color: var(--ink-500); font-size: .8rem; font-weight: 600; }
    dd { margin: 0; font-size: 1.5rem; font-weight: 750; color: var(--ink-900); font-variant-numeric: tabular-nums; }
    .unavailable { color: var(--ink-500); font-size: .9rem; }
  `,
})
export class AdminStats {
  private readonly state = toSignal(
    inject(AdminService)
      .stats()
      .pipe(
        map((stats): StatsState => ({ stats })),
        catchError(() => of<StatsState>({ error: true })),
      ),
    { initialValue: { loading: true } as StatsState },
  );

  protected readonly placeholders = [1, 2, 3, 4, 5, 6];
  protected readonly failed = computed(() => 'error' in this.state());
  protected readonly tiles = computed(() => {
    const state = this.state();
    if (!('stats' in state)) {
      return null;
    }
    const { stats } = state;
    return [
      { label: 'Accounts', value: stats.users },
      { label: 'New in 30 days', value: stats.newUsersLast30Days },
      { label: 'Admins', value: stats.admins },
      { label: 'Suspended', value: stats.suspendedUsers },
      { label: 'Customers', value: stats.customers },
      { label: 'Invoices issued', value: stats.invoicesIssued },
    ];
  });
}
