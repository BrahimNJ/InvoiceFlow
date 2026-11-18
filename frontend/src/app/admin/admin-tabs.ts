import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Switches between the screens of the back-office. */
@Component({
  selector: 'app-admin-tabs',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="chips" aria-label="Admin sections">
      <a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"
         ariaCurrentWhenActive="page">Accounts</a>
      <a routerLink="/admin/audit" routerLinkActive="active" ariaCurrentWhenActive="page">Audit log</a>
    </nav>
  `,
  styles: `
    :host { display: block; }
    a { display: inline-flex; align-items: center; padding: .35rem .8rem; border-radius: calc(var(--radius) - 2px);
        font-weight: 600; font-size: .9rem; color: var(--ink-500); }
    a:hover { color: var(--ink-900); }
    a.active { background: var(--surface); color: var(--ink-900); box-shadow: 0 1px 2px rgb(0 0 0 / 8%); }
  `,
})
export class AdminTabs {}
