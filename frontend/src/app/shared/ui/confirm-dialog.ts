import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  untracked,
  viewChild,
} from '@angular/core';

import { Icon } from '../icon/icon';
import { ConfirmService } from './confirm.service';

/**
 * Modal for `ConfirmService` questions. Focus starts on Cancel (the safe choice), stays in the dialog (Tab wraps),
 * Escape or a click outside cancels, and focus goes back to where it was when the dialog closes.
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (confirm.current(); as request) {
      <div class="backdrop" (click)="confirm.answer(false)"></div>
      <div
        class="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        (keydown)="onKeydown($event)"
      >
        <span class="icon" [class.danger]="request.tone === 'danger'" aria-hidden="true">
          <app-icon [name]="request.tone === 'danger' ? 'trash' : 'info'" [size]="22" />
        </span>
        <h2 id="confirm-title">{{ request.title }}</h2>
        <p id="confirm-message">{{ request.message }}</p>
        <div class="actions">
          <button #cancel class="btn btn-ghost" type="button" (click)="confirm.answer(false)">Cancel</button>
          <button
            #accept
            class="btn"
            [class.btn-danger]="request.tone === 'danger'"
            [class.btn-primary]="request.tone !== 'danger'"
            type="button"
            (click)="confirm.answer(true)"
          >
            {{ request.confirmLabel }}
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    .backdrop { position: fixed; inset: 0; z-index: 90; background: rgb(10 19 48 / .45);
                backdrop-filter: blur(2px); animation: fade-in .2s ease both; }
    .dialog { position: fixed; z-index: 91; left: 50%; top: 50%; width: min(440px, calc(100% - 32px));
              transform: translate(-50%, -50%); padding: 1.75rem; border-radius: var(--radius-lg);
              background: var(--surface); box-shadow: var(--shadow-lg); animation: pop .25s var(--ease-out) both; }
    @keyframes pop { from { opacity: 0; transform: translate(-50%, -46%) scale(.96); } }
    .icon { display: grid; place-items: center; width: 48px; height: 48px; margin-bottom: 1rem; border-radius: 14px;
            background: var(--brand-50); color: var(--brand); }
    .icon.danger { background: var(--danger-50); color: var(--danger); }
    h2 { font-size: 1.2rem; font-weight: 700; }
    p { margin-top: .5rem; color: var(--ink-500); }
    .actions { display: flex; flex-wrap: wrap-reverse; justify-content: flex-end; gap: .6rem; margin-top: 1.5rem; }
    @media (max-width: 479px) {
      /* Phones: a bottom sheet, closer to the thumb */
      .dialog { top: auto; bottom: 16px; transform: translateX(-50%); animation-name: sheet; }
      .actions .btn { flex: 1 1 100%; }
    }
    @keyframes sheet { from { opacity: 0; transform: translate(-50%, 16px); } }
  `,
})
export class ConfirmDialog {
  protected readonly confirm = inject(ConfirmService);

  private readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancel');
  private readonly acceptButton = viewChild<ElementRef<HTMLButtonElement>>('accept');
  private returnFocus: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const open = this.confirm.current() !== null;
      untracked(() => {
        if (open) {
          this.returnFocus ??= document.activeElement as HTMLElement | null;
        } else {
          this.returnFocus?.focus();
          this.returnFocus = null;
        }
      });
    });
    // Runs once the dialog is rendered (the view query then resolves)
    effect(() => this.cancelButton()?.nativeElement.focus());
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.confirm.answer(false);
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const first = this.cancelButton()?.nativeElement;
    const last = this.acceptButton()?.nativeElement;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
}
