import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Icon, IconName } from '../icon/icon';

/** Shown instead of a list when it has nothing to display: says why and what to do next (projected actions). */
@Component({
  selector: 'app-empty-state',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="icon" aria-hidden="true"><app-icon [name]="icon()" [size]="28" /></span>
    <h2>{{ heading() }}</h2>
    <p>{{ text() }}</p>
    <div class="actions"><ng-content /></div>
  `,
  styles: `
    :host { display: grid; justify-items: center; gap: .5rem; padding: clamp(2rem, 6vw, 3.5rem) 1.5rem;
            border: 1px dashed var(--line-strong); border-radius: var(--radius-lg); background: var(--surface);
            text-align: center; animation: scale-in .4s var(--ease-out) both; }
    .icon { display: grid; place-items: center; width: 64px; height: 64px; margin-bottom: .5rem; border-radius: 20px;
            background: var(--brand-50); color: var(--brand); }
    h2 { font-size: 1.15rem; font-weight: 700; }
    p { max-width: 420px; color: var(--ink-500); }
    .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: .6rem; margin-top: .75rem; }
    .actions:empty { display: none; }
  `,
})
export class EmptyState {
  readonly icon = input.required<IconName>();
  readonly heading = input.required<string>();
  readonly text = input.required<string>();
}
