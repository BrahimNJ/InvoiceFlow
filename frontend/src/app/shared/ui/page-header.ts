import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icon, IconName } from '../icon/icon';

/**
 * Title block of a signed-in page: optional back link, icon, title, one-line explanation and actions.
 * Actions (buttons, links) are projected and move under the title on phones.
 */
@Component({
  selector: 'app-page-header',
  imports: [Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (backLink(); as link) {
      <a class="back" [routerLink]="link"><app-icon name="chevron-left" [size]="16" />{{ backLabel() }}</a>
    }
    <div class="row">
      <span class="badge" aria-hidden="true"><app-icon [name]="icon()" [size]="24" /></span>
      <div class="text">
        <h1>{{ heading() }}</h1>
        @if (subtitle(); as text) {
          <p class="subtitle">{{ text }}</p>
        }
      </div>
      <div class="actions"><ng-content /></div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .back { display: inline-flex; align-items: center; gap: .3rem; margin-bottom: .9rem; font-size: .9rem;
            font-weight: 600; color: var(--ink-500); transition: color .15s ease, gap .15s ease; }
    .back:hover { color: var(--brand); gap: .45rem; }
    .row { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; }
    .badge { display: grid; place-items: center; width: 52px; height: 52px; flex-shrink: 0; border-radius: var(--radius-lg);
             color: var(--on-brand); background: var(--brand); }
    .text { flex: 1 1 220px; min-width: 0; }
    h1 { font-size: clamp(1.6rem, 4vw, 2.2rem); font-weight: 750; }
    .subtitle { margin-top: .3rem; color: var(--ink-500); }
    .actions { display: flex; flex-wrap: wrap; gap: .6rem; }
    .actions:empty { display: none; }
    @media (max-width: 559px) {
      .badge { width: 44px; height: 44px; border-radius: var(--radius); }
      .actions { width: 100%; }
    }
  `,
})
export class PageHeader {
  readonly icon = input.required<IconName>();
  readonly heading = input.required<string>();
  readonly subtitle = input<string>();
  readonly backLink = input<string>();
  readonly backLabel = input('Back');
}
