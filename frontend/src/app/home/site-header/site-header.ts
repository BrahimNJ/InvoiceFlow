import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { Logo } from '../../shared/logo';
import { ThemeToggle } from '../../shared/theme-toggle';

@Component({
  selector: 'app-site-header',
  imports: [Logo, RouterLink, ThemeToggle],
  templateUrl: './site-header.html',
  styleUrl: './site-header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteHeader {
  protected readonly isAuthenticated = inject(AuthService).isAuthenticated;
  protected readonly links = [
    { href: '#product', label: 'Product' },
    { href: '#reform', label: 'The reform' },
    { href: '#engineering', label: 'Engineering' },
    { href: '#ai', label: 'AI assistant' },
  ];
}
