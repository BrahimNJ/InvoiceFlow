import { ChangeDetectionStrategy, Component } from '@angular/core';

import { Logo } from '../../shared/logo';

@Component({
  selector: 'app-site-header',
  imports: [Logo],
  templateUrl: './site-header.html',
  styleUrl: './site-header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteHeader {
  protected readonly links = [
    { href: '#features', label: 'Features' },
    { href: '#reform', label: 'E-invoicing reform' },
    { href: '#ai', label: 'AI assistant' },
    { href: '#how-it-works', label: 'How it works' },
  ];
}
