import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icon, IconName } from '../../shared/icon/icon';
import { Logo } from '../../shared/logo';

/** Two-column frame of the sign-in and sign-up pages: product panel on the left, the form on the right. */
@Component({
  selector: 'app-auth-layout',
  imports: [Icon, Logo, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="layout">
      <aside class="panel">
        <a routerLink="/" class="home" aria-label="InvoiceFlow home"><app-logo /></a>
        <div class="pitch">
          <h2>Invoicing made simple for the e-invoicing era.</h2>
          <ul>
            @for (point of points; track point.text) {
              <li><app-icon [name]="point.icon" [size]="18" />{{ point.text }}</li>
            }
          </ul>
        </div>
        <p class="note"><app-icon name="lock" [size]="14" />Your session is protected by short-lived tokens.</p>
      </aside>

      <main class="content">
        <a routerLink="/" class="home mobile" aria-label="InvoiceFlow home"><app-logo /></a>
        <div class="card">
          <ng-content />
        </div>
      </main>
    </div>
  `,
  styles: `
    .layout { display: grid; min-height: 100vh; min-height: 100dvh; }
    @media (min-width: 960px) { .layout { grid-template-columns: minmax(380px, 5fr) 7fr; } }

    .panel { display: none; flex-direction: column; justify-content: space-between; gap: 3rem;
             padding: 2.5rem; color: var(--on-night);
             background: var(--night); }
    @media (min-width: 960px) { .panel { display: flex; } }
    .pitch h2 { font-size: clamp(1.8rem, 2.6vw, 2.4rem); font-weight: 750; max-width: 22rem; }
    .pitch ul { display: grid; gap: .9rem; margin-top: 2rem; }
    .pitch li { display: flex; align-items: center; gap: .7rem; color: color-mix(in srgb, var(--on-night) 82%, transparent); }
    .pitch app-icon { color: var(--accent); }
    .note { display: flex; align-items: center; gap: .5rem; font-size: .8rem; color: var(--on-night-muted); }

    .content { display: flex; flex-direction: column; align-items: center; justify-content: center;
               gap: 2rem; padding: 2rem 16px; }
    .home { display: inline-flex; }
    .mobile { align-self: flex-start; }
    @media (min-width: 960px) { .mobile { display: none; } }
    .card { width: 100%; max-width: 440px; }
  `,
})
export class AuthLayout {
  protected readonly points: { icon: IconName; text: string }[] = [
    { icon: 'file-check', text: 'Compliant invoices, ready for Factur-X' },
    { icon: 'chart', text: 'Every payment tracked in one place' },
    { icon: 'sparkles', text: 'An AI assistant that drafts invoices for you' },
  ];
}
