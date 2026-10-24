// Mirrors the backend DTOs of com.naji.backend.invoice.
import { ProductType, ProductUnit } from '../products/product.models';
import { IconName } from '../shared/icon/icon';

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'CANCELLED';
/** Status tabs of the list: `ISSUED` includes the overdue invoices, `OVERDUE` only those. */
export type InvoiceStatusFilter = 'DRAFT' | 'ISSUED' | 'OVERDUE' | 'CANCELLED';
export type PaymentTerms = 'ON_RECEIPT' | 'NET_15' | 'NET_30' | 'NET_45' | 'NET_60' | 'END_OF_MONTH_45';
export type OperationNature = 'GOODS' | 'SERVICES' | 'MIXED';
export type InvoiceSort = 'CREATED_AT' | 'NUMBER' | 'CUSTOMER' | 'ISSUE_DATE' | 'DUE_DATE' | 'TOTAL';
export type SortDirection = 'ASC' | 'DESC';
export type ReadinessCode = 'CUSTOMER' | 'CUSTOMER_ADDRESS' | 'LINES' | 'CUSTOMER_SIREN';

export interface BilledCustomer {
  name: string | null;
  email: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  siret: string | null;
  vatNumber: string | null;
}

export interface InvoiceLine {
  id: number;
  productId: number | null;
  type: ProductType;
  label: string;
  details: string | null;
  quantity: number;
  unit: ProductUnit;
  /** Euros, excluding VAT. */
  unitPrice: number;
  vatRate: number;
  /** Quantity × unit price, excluding VAT, rounded to the cent. */
  lineTotal: number;
}

export interface VatBreakdown {
  rate: number;
  /** Total excluding VAT of the lines at this rate. */
  base: number;
  amount: number;
}

export interface ReadinessCheck {
  code: ReadinessCode;
  /** A failed required check blocks the issue; a failed recommended one is a warning. */
  required: boolean;
  passed: boolean;
}

export interface Invoice {
  id: number;
  /** Given when the invoice is issued. */
  number: string | null;
  status: InvoiceStatus;
  overdue: boolean;
  customerId: number | null;
  customer: BilledCustomer;
  paymentTerms: PaymentTerms;
  /** ISO dates (`2026-10-24`), set when the invoice is issued. */
  issueDate: string | null;
  dueDate: string | null;
  notes: string | null;
  operationNature: OperationNature | null;
  lines: InvoiceLine[];
  subtotal: number;
  vatTotal: number;
  total: number;
  vatBreakdown: VatBreakdown[];
  checks: ReadinessCheck[];
  issuedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One row of the list (no lines). */
export interface InvoiceListItem {
  id: number;
  number: string | null;
  status: InvoiceStatus;
  overdue: boolean;
  customerId: number | null;
  customerName: string | null;
  issueDate: string | null;
  dueDate: string | null;
  subtotal: number;
  total: number;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceTotals {
  count: number;
  total: number;
}

export interface InvoiceSummary {
  drafts: InvoiceTotals;
  outstanding: InvoiceTotals;
  overdue: InvoiceTotals;
  issuedThisMonth: InvoiceTotals;
}

export type InvoiceLinePayload = Omit<InvoiceLine, 'id' | 'lineTotal'>;

/** Body of create and update (drafts only). */
export interface InvoicePayload {
  customerId: number | null;
  paymentTerms: PaymentTerms;
  notes: string | null;
  lines: InvoiceLinePayload[];
}

export interface InvoiceQuery {
  search?: string;
  status?: InvoiceStatusFilter;
  customerId?: number;
  /** ISO dates, both included. */
  issuedFrom?: string;
  issuedTo?: string;
  sort?: InvoiceSort;
  direction?: SortDirection;
  /** Zero-based. */
  page?: number;
  size?: number;
}

export const PAYMENT_TERMS: Record<PaymentTerms, { label: string; mention: string }> = {
  ON_RECEIPT: { label: 'On receipt', mention: 'Payable on receipt' },
  NET_15: { label: '15 days', mention: 'Payable within 15 days' },
  NET_30: { label: '30 days', mention: 'Payable within 30 days' },
  NET_45: { label: '45 days', mention: 'Payable within 45 days' },
  NET_60: { label: '60 days', mention: 'Payable within 60 days' },
  END_OF_MONTH_45: { label: '45 days end of month', mention: 'Payable within 45 days end of month' },
};

export const OPERATION_NATURES: Record<OperationNature, string> = {
  GOODS: 'Delivery of goods',
  SERVICES: 'Provision of services',
  MIXED: 'Delivery of goods and provision of services',
};

/** How each check reads in the readiness list, and what to do when it fails. */
export const READINESS: Record<ReadinessCode, { label: string; fix: string }> = {
  CUSTOMER: { label: 'Customer chosen', fix: 'Choose who you are billing.' },
  CUSTOMER_ADDRESS: {
    label: 'Customer billing address',
    fix: 'Street, postal code and city are mandatory on an invoice.',
  },
  LINES: { label: 'At least one line', fix: 'Add what you are billing.' },
  CUSTOMER_SIREN: {
    label: 'Customer SIREN',
    fix: 'Mandatory for business customers under the e-invoicing reform: add their SIRET.',
  },
};

export type StatusTone = 'neutral' | 'brand' | 'danger' | 'muted';

/** Badge of a list row or a detail page; an issued invoice past due shows as overdue. */
export function statusBadge(status: InvoiceStatus, overdue: boolean): { label: string; tone: StatusTone; icon: IconName } {
  if (status === 'ISSUED' && overdue) {
    return { label: 'Overdue', tone: 'danger', icon: 'alert' };
  }
  switch (status) {
    case 'DRAFT':
      return { label: 'Draft', tone: 'neutral', icon: 'pencil' };
    case 'ISSUED':
      return { label: 'Issued', tone: 'brand', icon: 'send' };
    case 'CANCELLED':
      return { label: 'Cancelled', tone: 'muted', icon: 'x' };
  }
}
