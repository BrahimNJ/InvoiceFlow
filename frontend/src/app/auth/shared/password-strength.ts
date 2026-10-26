import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Icon } from '../../shared/icon/icon';
import { PASSWORD_MIN_LENGTH, checkPassword, passwordStrength } from './password.validators';

const LABELS = { empty: '', weak: 'Weak', fair: 'Fair', good: 'Good', strong: 'Strong' } as const;
const LEVELS = { empty: 0, weak: 1, fair: 2, good: 3, strong: 4 } as const;

/** Live feedback while typing a new password: strength meter and the policy checklist. */
@Component({
  selector: 'app-password-strength',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="meter" [attr.data-strength]="strength()" aria-hidden="true">
      @for (bar of bars; track bar) {
        <span [class.on]="bar <= level()"></span>
      }
    </div>
    @if (label(); as label) {
      <p class="label">Strength: <strong>{{ label }}</strong></p>
    }
    <ul class="rules" aria-label="Password requirements">
      @for (rule of rules(); track rule.text) {
        <li [class.met]="rule.met">
          <app-icon [name]="rule.met ? 'check' : 'circle'" [size]="14" />
          {{ rule.text }}<span class="visually-hidden">{{ rule.met ? ': done' : ': missing' }}</span>
        </li>
      }
    </ul>
  `,
  styles: `
    :host { display: grid; gap: .5rem; }
    .meter { display: grid; grid-template-columns: repeat(4, 1fr); gap: .3rem; }
    .meter span { height: 4px; border-radius: 999px; background: var(--line); transition: background-color .2s ease; }
    [data-strength='weak'] .on { background: var(--danger); }
    [data-strength='fair'] .on { background: var(--warning); }
    [data-strength='good'] .on { background: var(--brand); }
    [data-strength='strong'] .on { background: var(--accent); }
    .label { font-size: .8rem; color: var(--ink-500); }
    .rules { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: .25rem .75rem; }
    .rules li { display: flex; align-items: center; gap: .35rem; font-size: .8rem; color: var(--ink-500); }
    .rules li.met { color: var(--accent-700); }
  `,
})
export class PasswordStrength {
  readonly password = input('');

  protected readonly bars = [1, 2, 3, 4];
  protected readonly strength = computed(() => passwordStrength(this.password()));
  protected readonly level = computed(() => LEVELS[this.strength()]);
  protected readonly label = computed(() => LABELS[this.strength()]);
  protected readonly rules = computed(() => {
    const checks = checkPassword(this.password());
    const rules = [
      { text: `${PASSWORD_MIN_LENGTH}+ characters`, met: checks.length },
      { text: 'One lowercase letter', met: checks.lowercase },
      { text: 'One uppercase letter', met: checks.uppercase },
      { text: 'One digit', met: checks.digit },
    ];
    // Only worth mentioning when it fails (very long or multi-byte passwords)
    return checks.maxBytes ? rules : [...rules, { text: 'At most 72 bytes', met: false }];
  });
}
