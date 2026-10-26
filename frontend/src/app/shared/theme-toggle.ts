import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { ThemeService } from '../core/theme/theme.service';
import { Icon } from './icon/icon';

/** Switches between the paper (light) and ink (dark) themes; the icon shows the theme you would switch to. */
@Component({
  selector: 'app-theme-toggle',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button class="icon-btn" type="button" [attr.aria-label]="label()" [title]="label()" (click)="themes.toggle()">
      <app-icon [name]="dark() ? 'sun' : 'moon'" [size]="17" />
    </button>
  `,
})
export class ThemeToggle {
  protected readonly themes = inject(ThemeService);
  protected readonly dark = computed(() => this.themes.theme() === 'dark');
  protected readonly label = computed(() => (this.dark() ? 'Switch to light theme' : 'Switch to dark theme'));
}
