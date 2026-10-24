import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { PRODUCT_UNITS, ProductUnit } from '../../products/product.models';
import { formatEuros, formatPercent } from '../../shared/format/money';
import { Totals, formatDate } from '../invoice-calc';
import {
  BilledCustomer,
  Invoice,
  OPERATION_NATURES,
  OperationNature,
  PAYMENT_TERMS,
  PaymentTerms,
} from '../invoice.models';

export interface DocumentLine {
  label: string;
  details: string | null;
  quantity: number;
  unit: ProductUnit;
  unitPrice: number;
  vatRate: number;
  lineTotal: number;
}

/** What the A4 rendering needs: built from the editor form (live preview) or from a saved invoice. */
export interface InvoiceDocument {
  /** `null` for a draft: the number is given when the invoice is issued. */
  number: string | null;
  cancelled: boolean;
  /** For a draft, the dates it would get if issued today. */
  issueDate: string;
  dueDate: string;
  paymentTerms: PaymentTerms;
  seller: string;
  customer: BilledCustomer | null;
  lines: DocumentLine[];
  totals: Totals;
  operationNature: OperationNature | null;
  notes: string | null;
}

export const LATE_PAYMENT_MENTION =
  'Late payment: penalties at three times the French legal interest rate, plus a fixed recovery fee of 40 € ' +
  '(French Commercial Code, art. L441-10 and D441-5). No discount for early payment.';

export function documentFromInvoice(invoice: Invoice, seller: string, today: string, dueIfIssuedToday: string): InvoiceDocument {
  return {
    number: invoice.number,
    cancelled: invoice.status === 'CANCELLED',
    issueDate: invoice.issueDate ?? today,
    dueDate: invoice.dueDate ?? dueIfIssuedToday,
    paymentTerms: invoice.paymentTerms,
    seller,
    customer: invoice.customer.name ? invoice.customer : null,
    lines: invoice.lines,
    totals: invoice,
    operationNature: invoice.operationNature,
    notes: invoice.notes,
  };
}

/**
 * An invoice laid out as the A4 page the customer receives, with every mandatory mention. The same component renders
 * the live preview of the editor and the detail page, so what the user checks is what gets sent.
 * It scales with its container (container query units).
 */
@Component({
  selector: 'app-invoice-document',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invoice-document.html',
  styleUrl: './invoice-document.css',
})
export class InvoiceDocumentView {
  readonly doc = input.required<InvoiceDocument>();

  protected readonly formatEuros = formatEuros;
  protected readonly formatPercent = formatPercent;
  protected readonly formatDate = formatDate;
  protected readonly units = PRODUCT_UNITS;
  protected readonly lateMention = LATE_PAYMENT_MENTION;

  protected readonly terms = computed(() => PAYMENT_TERMS[this.doc().paymentTerms].mention);
  protected readonly nature = computed(() => {
    const nature = this.doc().operationNature;
    return nature ? OPERATION_NATURES[nature] : null;
  });
  protected readonly address = computed(() => {
    const customer = this.doc().customer;
    if (!customer) {
      return [];
    }
    const city = [customer.postalCode, customer.city].filter(Boolean).join(' ');
    return [customer.street, city, customer.country].filter((part): part is string => !!part);
  });

  protected quantity(value: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(value);
  }
}
