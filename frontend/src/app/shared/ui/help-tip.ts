import { ChangeDetectionStrategy, Component, OnInit, input, signal } from '@angular/core';

import { Icon } from '../icon/icon';

export const HELP_STORAGE_PREFIX = 'invoiceflow.help.';

let nextId = 0;

/**
 * "How it works" panel that explains a screen in a few short points. Open by default; once the user
 * hides it, it stays collapsed on that screen (remembered in this browser only).
 */
@Component({
  selector: 'app-help-tip',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="help" [class.open]="open()">
      <button class="toggle" type="button" [attr.aria-expanded]="open()" [attr.aria-controls]="bodyId" (click)="toggle()">
        <span class="bulb" aria-hidden="true"><app-icon name="lightbulb" [size]="18" /></span>
        <span class="title">{{ heading() }}</span>
        <span class="action">{{ open() ? 'Hide' : 'Show' }}</span>
        <app-icon class="chevron" name="chevron-down" [size]="18" />
      </button>
      <ul class="body" [id]="bodyId" [hidden]="!open()">
        @for (tip of tips(); track tip) {
          <li><app-icon name="check" [size]="16" />{{ tip }}</li>
        }
      </ul>
    </section>
  `,
  styles: `
    :host { display: block; }
    .help { border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface-2); }
    .toggle { display: flex; align-items: center; gap: .75rem; width: 100%; padding: .8rem 1rem; border: 0;
              background: transparent; font: inherit; text-align: left; color: var(--ink-900); cursor: pointer; }
    .bulb { display: grid; place-items: center; width: 32px; height: 32px; flex-shrink: 0; border-radius: var(--radius);
            background: var(--surface); color: var(--warning); box-shadow: var(--shadow-sm); }
    .title { flex: 1; font-weight: 700; }
    .action { font-size: .85rem; font-weight: 600; color: var(--brand); }
    .chevron { color: var(--brand); transition: transform .25s var(--ease-out); }
    .open .chevron { transform: rotate(180deg); }
    .body { display: grid; gap: .55rem; padding: 0 1rem 1rem 3.75rem; color: var(--ink-700); font-size: .925rem; }
    .body:not([hidden]) { animation: fade-up .3s var(--ease-out) both; }
    .body li { display: flex; gap: .5rem; }
    .body app-icon { margin-top: .2rem; color: var(--accent); }
    @media (max-width: 559px) { .body { padding-left: 1rem; } .action { display: none; } }
  `,
})
export class HelpTip implements OnInit {
  /** Identifies the screen, to remember whether the panel is collapsed. */
  readonly storageKey = input.required<string>();
  readonly heading = input.required<string>();
  readonly tips = input.required<string[]>();

  protected readonly bodyId = `help-tip-${nextId++}`;
  protected readonly open = signal(true);

  ngOnInit(): void {
    this.open.set(read(this.key()) !== 'collapsed');
  }

  protected toggle(): void {
    this.open.update((open) => !open);
    write(this.key(), this.open() ? null : 'collapsed');
  }

  private key(): string {
    return HELP_STORAGE_PREFIX + this.storageKey();
  }
}

// Storage can be unavailable (private mode, blocked site data): the panel then simply starts open.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // Not remembered: acceptable for a display preference
  }
}
