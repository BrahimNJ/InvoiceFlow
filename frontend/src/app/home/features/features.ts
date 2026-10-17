import { ChangeDetectionStrategy, Component } from '@angular/core';

import { Icon, IconName } from '../../shared/icon/icon';

interface Feature {
  icon: IconName;
  title: string;
  text: string;
}

@Component({
  selector: 'app-features',
  imports: [Icon],
  templateUrl: './features.html',
  styleUrl: './features.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Features {
  protected readonly features: Feature[] = [
    {
      icon: 'users',
      title: 'Customers',
      text: 'Keep every customer in one place, with SIRET, contact and billing details validated on entry.',
    },
    {
      icon: 'package',
      title: 'Products & services',
      text: 'Build your catalogue once: prices, VAT rates and descriptions reused on every invoice.',
    },
    {
      icon: 'invoice',
      title: 'Invoices',
      text: 'Sequential numbering, subtotal, VAT and total computed for you, and a clear status from draft to paid.',
    },
    {
      icon: 'file-check',
      title: 'PDF & Factur-X',
      text: 'Download clean PDF invoices and prepare the structured Factur-X format required by the reform.',
    },
    {
      icon: 'chart',
      title: 'Dashboard',
      text: 'Revenue, paid, pending and overdue invoices at a glance, so you know who to follow up.',
    },
    {
      icon: 'shield',
      title: 'Secure by design',
      text: 'Authenticated access, roles and a validated REST API: business rules always run on the server.',
    },
  ];
}
