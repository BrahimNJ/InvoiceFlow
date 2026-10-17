import { ChangeDetectionStrategy, Component } from '@angular/core';

interface Milestone {
  date: string;
  tag: string;
  title: string;
  text: string;
}

@Component({
  selector: 'app-reform',
  templateUrl: './reform.html',
  styleUrl: './reform.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Reform {
  protected readonly milestones: Milestone[] = [
    {
      date: '1 September 2026',
      tag: 'In effect',
      title: 'Every business receives e-invoices',
      text: 'All VAT-registered companies must be able to receive electronic invoices. Large and mid-sized companies must also issue them.',
    },
    {
      date: '1 September 2027',
      tag: 'Next step',
      title: 'SMEs and micro-businesses issue them',
      text: 'Small and medium-sized businesses and micro-businesses must issue their invoices electronically, in a structured format.',
    },
    {
      date: 'Alongside',
      tag: 'E-reporting',
      title: 'Transaction data is reported',
      text: 'Sales and payment data that are not e-invoiced (for example B2C or international) are reported to the tax administration.',
    },
  ];
}
