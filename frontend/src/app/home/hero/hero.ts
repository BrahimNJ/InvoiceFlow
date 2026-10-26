import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { InvoiceDocument, InvoiceDocumentView } from '../../invoices/invoice-document/invoice-document';
import { computeTotals, lineTotal } from '../../invoices/invoice-calc';
import { Icon } from '../../shared/icon/icon';

const SAMPLE_LINES = [
  { label: 'Web development', details: 'Invoicing module, sprint 3', quantity: 3, unit: 'DAY', unitPrice: 450, vatRate: 20 },
  { label: 'Hosting setup', details: null, quantity: 1, unit: 'UNIT', unitPrice: 150, vatRate: 20 },
  { label: 'Printed training handbook', details: null, quantity: 2, unit: 'UNIT', unitPrice: 16, vatRate: 5.5 },
] as const;

/**
 * The illustration is the app's own A4 invoice component, fed with sample data and totalled by the same exact-arithmetic
 * code as the editor: what visitors see is what the product renders.
 */
export const SAMPLE_INVOICE: InvoiceDocument = {
  number: 'F-2026-0042',
  cancelled: false,
  issueDate: '2026-10-12',
  dueDate: '2026-11-11',
  paymentTerms: 'NET_30',
  seller: 'Atelier Lumen',
  sellerDetails: 'SAS · SIREN 000 000 000\n8 rue des Tanneurs, 69001 Lyon\nVAT FR00 000000000',
  customer: {
    name: 'ACME SAS',
    email: 'billing@acme.example',
    street: '12 avenue de la République',
    postalCode: '75011',
    city: 'Paris',
    country: 'France',
    siret: '00000000000000',
    vatNumber: null,
  },
  lines: SAMPLE_LINES.map((line) => ({ ...line, lineTotal: lineTotal(line.quantity, line.unitPrice) })),
  totals: computeTotals([...SAMPLE_LINES]),
  operationNature: 'MIXED',
  notes: null,
};

@Component({
  selector: 'app-hero',
  imports: [Icon, InvoiceDocumentView, RouterLink],
  templateUrl: './hero.html',
  styleUrl: './hero.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Hero {
  protected readonly sample = SAMPLE_INVOICE;
  protected readonly repositoryUrl = 'https://github.com/BrahimNJ/InvoiceFlow';
  protected readonly specs = [
    { term: 'Numbering', value: 'F-2026-0001, gap-free' },
    { term: 'VAT', value: 'per rate, half-up' },
    { term: 'Amounts', value: 'exact decimals' },
    { term: 'Tests', value: '452 automated' },
  ];
}
