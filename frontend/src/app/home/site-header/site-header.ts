import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { Logo } from '../../shared/logo';
import { ThemeToggle } from '../../shared/theme-toggle';

/** Public header (landing page and docs): section links go through the router so they work from any page. */
@Component({
  selector: 'app-site-header',
  imports: [Logo, RouterLink, RouterLinkActive, ThemeToggle],
  templateUrl: './site-header.html',
  styleUrl: './site-header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteHeader {
  protected readonly isAuthenticated = inject(AuthService).isAuthenticated;
  protected readonly links = [
    { fragment: 'product', label: 'Product' },
    { fragment: 'reform', label: 'The reform' },
    { fragment: 'engineering', label: 'Engineering' },
    { fragment: 'ai', label: 'AI assistant' },
  ];
}
