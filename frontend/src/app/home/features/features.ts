import { ChangeDetectionStrategy, Component } from '@angular/core';

type Availability = 'Live' | 'Next' | 'Planned';

interface Feature {
  title: string;
  text: string;
  availability: Availability;
}

/** What the product does today and what comes next, stated plainly. */
@Component({
  selector: 'app-features',
  templateUrl: './features.html',
  styleUrl: './features.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Features {
  protected readonly features: Feature[] = [
    {
      title: 'Customers',
      text: 'A private customer book per account: search, SIREN / SIRET and VAT number checked on entry.',
      availability: 'Live',
    },
    {
      title: 'Products & services',
      text: 'A catalogue with the goods / services category the reform asks for, prices excluding VAT and the French VAT rates.',
      availability: 'Live',
    },
    {
      title: 'Invoices',
      text: 'Drafts with a readiness checklist and a live A4 preview; issue, cancel, duplicate, overdue tracking.',
      availability: 'Live',
    },
    {
      title: 'Payments',
      text: 'Full and partial payments recorded against an invoice, which then moves to paid on its own.',
      availability: 'Next',
    },
    {
      title: 'PDF & Factur-X',
      text: 'PDF/A-3 with the structured CII data embedded: the hybrid format accepted by the reform.',
      availability: 'Planned',
    },
    {
      title: 'Dashboard',
      text: 'Revenue, outstanding and overdue amounts, and who to follow up first.',
      availability: 'Planned',
    },
  ];
}
