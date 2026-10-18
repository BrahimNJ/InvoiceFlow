import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { Logo } from '../../shared/logo';

@Component({
  selector: 'app-site-header',
  imports: [Logo, RouterLink],
  templateUrl: './site-header.html',
  styleUrl: './site-header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteHeader {
  protected readonly isAuthenticated = inject(AuthService).isAuthenticated;
  protected readonly links = [
    { href: '#features', label: 'Features' },
    { href: '#reform', label: 'E-invoicing reform' },
    { href: '#ai', label: 'AI assistant' },
    { href: '#how-it-works', label: 'How it works' },
  ];
}
