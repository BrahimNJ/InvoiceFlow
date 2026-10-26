import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../core/auth/auth.service';
import { AppHeader } from '../shared/app-header';
import { Icon, IconName } from '../shared/icon/icon';

/** First signed-in page: account summary and entry points to the business screens (more to come). */
@Component({
  selector: 'app-dashboard',
  imports: [AppHeader, DatePipe, Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-header />

    <main class="container page">
      <h1>Welcome, {{ user()?.firstName }}</h1>
      <p class="lead">Your workspace is ready. Add your customers and what you sell, then write your invoices.</p>

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
          <h2 id="next-title">Your workspace</h2>
          <ul class="next">
            @for (item of nextSteps; track item.label) {
              <li>
                <app-icon [name]="item.icon" [size]="18" />
                @if (item.link) {
                  <a [routerLink]="item.link">{{ item.label }}</a><span class="badge open">Open</span>
                } @else {
                  {{ item.label }}<span class="badge">Soon</span>
                }
              </li>
            }
          </ul>
        </section>
      </div>
    </main>
  `,
  styles: `
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
    .next a { font-weight: 600; color: var(--brand); }
    .next a:hover { text-decoration: underline; }
    .badge { margin-left: auto; padding: .15rem .55rem; border-radius: 999px; background: var(--brand-50);
            color: var(--brand); font-size: .75rem; font-weight: 700; }
    .badge.open { background: var(--accent-50); color: var(--accent-700); }
  `,
})
export class Dashboard {
  protected readonly user = inject(AuthService).user;
  protected readonly nextSteps: { icon: IconName; label: string; link?: string }[] = [
    { icon: 'users', label: 'Customers', link: '/customers' },
    { icon: 'package', label: 'Products & services', link: '/products' },
    { icon: 'invoice', label: 'Invoices', link: '/invoices' },
    { icon: 'chart', label: 'Revenue dashboard' },
  ];
}
