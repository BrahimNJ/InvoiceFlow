import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiStatusPill } from '../../shared/api-status-pill';
import { Icon } from '../../shared/icon/icon';
import { Logo } from '../../shared/logo';

@Component({
  selector: 'app-site-footer',
  imports: [ApiStatusPill, Icon, Logo, RouterLink],
  templateUrl: './site-footer.html',
  styleUrl: './site-footer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteFooter {
  protected readonly repositoryUrl = 'https://github.com/BrahimNJ/InvoiceFlow';
  protected readonly year = new Date().getFullYear();
}
