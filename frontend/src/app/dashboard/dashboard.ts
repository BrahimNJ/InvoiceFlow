import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../core/auth/auth.service';
import { Icon, IconName } from '../shared/icon/icon';
import { Logo } from '../shared/logo';

/** First signed-in page. Placeholder until the business screens (customers, products, invoices) exist. */
@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, Icon, Logo, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="topbar">
      <div class="container bar">
        <a routerLink="/" aria-label="InvoiceFlow home"><app-logo /></a>
        <div class="account">
          <span class="who">{{ user()?.firstName }} {{ user()?.lastName }}</span>
          <button class="btn btn-ghost btn-sm" type="button" (click)="signOut()" [disabled]="signingOut()">
            <app-icon name="log-out" [size]="16" />Sign out
          </button>
        </div>
      </div>
    </header>

    <main class="container page">
      <h1>Welcome, {{ user()?.firstName }}</h1>
      <p class="lead">Your workspace is ready. Here is what comes next.</p>

      <div class="grid">
        <section class="card" aria-labelledby="account-title">
          <h2 id="account-title">Your account</h2>
          <dl>
            <div><dt>Name</dt><dd>{{ user()?.firstName }} {{ user()?.lastName }}</dd></div>
            <div><dt>Email</dt><dd>{{ user()?.email }}</dd></div>
            <div><dt>Role</dt><dd>{{ user()?.role }}</dd></div>
            <div><dt>Member since</dt><dd>{{ user()?.createdAt | date: 'longDate' }}</dd></div>
          </dl>
        </section>

        <section class="card" aria-labelledby="next-title">
          <h2 id="next-title">Coming next</h2>
          <ul class="next">
            @for (item of nextSteps; track item.label) {
              <li><app-icon [name]="item.icon" [size]="18" />{{ item.label }}<span class="soon">Soon</span></li>
            }
          </ul>
        </section>
      </div>
    </main>
  `,
  styles: `
    .topbar { border-bottom: 1px solid var(--line); background: var(--surface); }
    .bar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; height: var(--header-height); }
    .account { display: flex; align-items: center; gap: 1rem; }
    .who { display: none; font-weight: 600; color: var(--ink-700); }
    @media (min-width: 640px) { .who { display: inline; } }

    .page { padding-block: clamp(2rem, 6vw, 3.5rem); }
    h1 { font-size: clamp(1.8rem, 4vw, 2.4rem); font-weight: 750; }
    .lead { margin-top: .5rem; color: var(--ink-500); }
    .grid { display: grid; gap: 1.25rem; margin-top: 2rem; }
    @media (min-width: 800px) { .grid { grid-template-columns: 1fr 1fr; } }
    .card { padding: 1.5rem; border: 1px solid var(--line); border-radius: var(--radius-lg);
            background: var(--surface); box-shadow: var(--shadow-sm); }
    h2 { font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; }
    dl { display: grid; gap: .75rem; margin: 0; }
    dl div { display: flex; justify-content: space-between; gap: 1rem; }
    dt { color: var(--ink-500); }
    dd { margin: 0; font-weight: 600; text-align: right; overflow-wrap: anywhere; }
    .next { display: grid; gap: .75rem; }
    .next li { display: flex; align-items: center; gap: .6rem; color: var(--ink-700); }
    .next app-icon { color: var(--brand); }
    .soon { margin-left: auto; padding: .15rem .55rem; border-radius: 999px; background: var(--brand-50);
            color: var(--brand); font-size: .75rem; font-weight: 700; }
  `,
})
export class Dashboard {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly user = this.auth.user;
  protected readonly signingOut = signal(false);
  protected readonly nextSteps: { icon: IconName; label: string }[] = [
    { icon: 'users', label: 'Customers' },
    { icon: 'package', label: 'Products & services' },
    { icon: 'invoice', label: 'Invoices' },
    { icon: 'chart', label: 'Revenue dashboard' },
  ];

  protected signOut(): void {
    this.signingOut.set(true);
    this.auth.logout().subscribe(() => void this.router.navigateByUrl('/login'));
  }
}
