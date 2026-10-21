import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../core/auth/auth.service';
import { Icon, IconName } from './icon/icon';
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
          @for (link of links; track link.path) {
            <a [routerLink]="link.path" routerLinkActive="active" ariaCurrentWhenActive="page">
              <app-icon [name]="link.icon" [size]="17" />{{ link.label }}
            </a>
          }
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
    .bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
           gap: .5rem 1rem; min-height: var(--header-height); padding-block: .6rem; }
    /* Stays visible while scrolling long lists */
    :host { position: sticky; top: 0; z-index: 50; display: block; }
    .topbar { border-bottom: 1px solid var(--line); background: rgb(255 255 255 / .9); backdrop-filter: blur(10px); }
    /* Phones: the navigation gets its own row under the logo and the account, and scrolls sideways if needed */
    nav { order: 1; display: flex; gap: .25rem; width: 100%; overflow-x: auto; scrollbar-width: none; }
    @media (min-width: 640px) {
      .bar { flex-wrap: nowrap; padding-block: 0; }
      nav { order: 0; width: auto; margin-right: auto; }
    }
    nav a { display: inline-flex; align-items: center; gap: .45rem; flex-shrink: 0; padding: .45rem .75rem;
            border-radius: 10px; font-weight: 600; font-size: .925rem; color: var(--ink-500);
            transition: color .15s ease, background-color .2s ease; }
    nav a:hover { color: var(--ink-900); background: var(--bg); }
    nav a.active { background: var(--brand-50); color: var(--brand); }
    .account { display: flex; align-items: center; gap: 1rem; }
    .who { display: none; font-weight: 600; color: var(--ink-700); }
    @media (min-width: 800px) { .who { display: inline; } }
  `,
})
export class AppHeader {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly links: { path: string; label: string; icon: IconName }[] = [
    { path: '/dashboard', label: 'Dashboard', icon: 'grid' },
    { path: '/customers', label: 'Customers', icon: 'users' },
    { path: '/products', label: 'Products', icon: 'package' },
  ];
  protected readonly user = this.auth.user;
  protected readonly signingOut = signal(false);

  protected signOut(): void {
    this.signingOut.set(true);
    this.auth.logout().subscribe(() => void this.router.navigateByUrl('/login'));
  }
}
