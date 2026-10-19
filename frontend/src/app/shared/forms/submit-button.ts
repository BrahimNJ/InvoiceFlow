import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';

/** After this delay the free hosting plan is probably waking up: tell the user instead of a silent spinner. */
export const SLOW_REQUEST_MS = 4000;

/** Full-width submit button with a busy state, for forms that call the API. */
@Component({
  selector: 'app-submit-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button class="btn btn-primary btn-block" type="submit" [disabled]="busy()" [attr.aria-busy]="busy()">
      @if (busy()) {
        <span class="spinner" aria-hidden="true"></span>{{ busyLabel() }}
      } @else {
        {{ label() }}
      }
    </button>
    @if (slow()) {
      <p class="slow" role="status">The server is waking up, this can take up to a minute…</p>
    }
  `,
  styles: `
    :host { display: grid; gap: .6rem; }
    .slow { font-size: .825rem; color: var(--ink-500); text-align: center; }
  `,
})
export class SubmitButton {
  readonly label = input.required<string>();
  readonly busyLabel = input.required<string>();
  readonly busy = input(false);

  protected readonly slow = signal(false);

  constructor() {
    let timer: ReturnType<typeof setTimeout> | undefined;
    effect(() => {
      clearTimeout(timer);
      this.slow.set(false);
      if (this.busy()) {
        timer = setTimeout(() => this.slow.set(true), SLOW_REQUEST_MS);
      }
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }
}
