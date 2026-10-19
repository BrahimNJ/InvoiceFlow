import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../core/auth/auth.service';
import { Icon } from './icon/icon';
import { Logo } from './logo';

/** Top bar of the signed-in pages: navigation between the business screens, current user, sign out. */
@Component({
  selector: 'app-header',
  imports: [Icon, Logo, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="topbar">
      <div class="container bar">
        <a routerLink="/dashboard" aria-label="InvoiceFlow dashboard"><app-logo /></a>
        <nav aria-label="Main">
          <a routerLink="/dashboard" routerLinkActive="active" ariaCurrentWhenActive="page">Dashboard</a>
        </nav>
        <div class="account">
          <span class="who">{{ user()?.firstName }} {{ user()?.lastName }}</span>
          <button class="btn btn-ghost btn-sm" type="button" (click)="signOut()" [disabled]="signingOut()">
            <app-icon name="log-out" [size]="16" />Sign out
          </button>
        </div>
      </div>
    </header>
  `,
  styles: `
    .topbar { border-bottom: 1px solid var(--line); background: var(--surface); }
    .bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
           gap: .5rem 1rem; min-height: var(--header-height); padding-block: .6rem; }
    /* Phones: the navigation gets its own row under the logo and the account */
    nav { order: 1; display: flex; gap: .25rem; width: 100%; }
    @media (min-width: 640px) {
      .bar { flex-wrap: nowrap; padding-block: 0; }
      nav { order: 0; width: auto; margin-right: auto; }
    }
    nav a { padding: .4rem .7rem; border-radius: 10px; font-weight: 600; font-size: .925rem; color: var(--ink-500); }
    nav a:hover { color: var(--ink-900); }
    nav a.active { background: var(--brand-50); color: var(--brand); }
    .account { display: flex; align-items: center; gap: 1rem; }
    .who { display: none; font-weight: 600; color: var(--ink-700); }
    @media (min-width: 800px) { .who { display: inline; } }
  `,
})
export class AppHeader {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly user = this.auth.user;
  protected readonly signingOut = signal(false);

  protected signOut(): void {
    this.signingOut.set(true);
    this.auth.logout().subscribe(() => void this.router.navigateByUrl('/login'));
  }
}
