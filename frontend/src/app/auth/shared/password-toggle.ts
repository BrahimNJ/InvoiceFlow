import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

import { Icon } from '../../shared/icon/icon';

/** Show/hide button placed next to a password input: `<input #pwd …><app-password-toggle [input]="pwd" />`. */
@Component({
  selector: 'app-password-toggle',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      [attr.aria-label]="visible() ? 'Hide password' : 'Show password'"
      [attr.aria-pressed]="visible()"
      [attr.aria-controls]="input().id || null"
      (click)="toggle()"
    >
      <app-icon [name]="visible() ? 'eye-off' : 'eye'" [size]="18" />
    </button>
  `,
  styles: `
    :host { position: absolute; inset-block: 0; right: .35rem; display: flex; align-items: center; }
    button { display: grid; place-items: center; width: 36px; height: 36px; border: 0; border-radius: 8px;
             background: transparent; color: var(--ink-500); cursor: pointer; }
    button:hover { color: var(--ink-900); background: var(--hover-tint); }
  `,
})
export class PasswordToggle {
  readonly input = input.required<HTMLInputElement>();

  protected readonly visible = signal(false);

  protected toggle(): void {
    this.visible.update((visible) => !visible);
    this.input().type = this.visible() ? 'text' : 'password';
  }
}
