// Test data shared by the specs. Obviously fake values only.
import { Page } from '../core/http/page';
import { BilledCustomer, Invoice, InvoiceLine, InvoiceListItem, InvoiceSummary } from './invoice.models';

export function testBilledCustomer(overrides: Partial<BilledCustomer> = {}): BilledCustomer {
  return {
    name: 'Acme SAS',
    email: 'billing@acme.test',
    street: '12 rue de la Paix',
    postalCode: '75002',
    city: 'Paris',
    country: 'France',
    siret: '73282932000074',
    vatNumber: null,
    ...overrides,
  };
}

export function testLine(overrides: Partial<InvoiceLine> = {}): InvoiceLine {
  return {
    id: 10,
    productId: 1,
    type: 'SERVICE',
    label: 'Web development',
    details: 'Senior developer, day rate',
    quantity: 2,
    unit: 'DAY',
    unitPrice: 650,
    vatRate: 20,
    lineTotal: 1300,
    ...overrides,
  };
}

/** A draft for Acme SAS with one line: 1 300,00 € excl. VAT, 1 560,00 € incl. VAT. */
export function testInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 1,
    number: null,
    status: 'DRAFT',
    overdue: false,
    customerId: 3,
    customer: testBilledCustomer(),
    paymentTerms: 'NET_30',
    issueDate: null,
    dueDate: null,
    notes: null,
    operationNature: 'SERVICES',
    lines: [testLine()],
    subtotal: 1300,
    vatTotal: 260,
    total: 1560,
    vatBreakdown: [{ rate: 20, base: 1300, amount: 260 }],
    checks: [
      { code: 'CUSTOMER', required: true, passed: true },
      { code: 'CUSTOMER_ADDRESS', required: true, passed: true },
      { code: 'LINES', required: true, passed: true },
      { code: 'CUSTOMER_SIREN', required: false, passed: true },
    ],
    issuedAt: null,
    cancelledAt: null,
    createdAt: '2026-10-20T10:00:00Z',
    updatedAt: '2026-10-20T10:00:00Z',
    ...overrides,
  };
}

export function testIssuedInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return testInvoice({
    number: 'F-2026-0001',
    status: 'ISSUED',
    issueDate: '2026-10-20',
    dueDate: '2026-11-19',
    issuedAt: '2026-10-20T10:05:00Z',
    ...overrides,
  });
}

export function testListItem(overrides: Partial<InvoiceListItem> = {}): InvoiceListItem {
  return {
    id: 1,
    number: 'F-2026-0001',
    status: 'ISSUED',
    overdue: false,
    customerId: 3,
    customerName: 'Acme SAS',
    issueDate: '2026-10-20',
    dueDate: '2026-11-19',
    subtotal: 1300,
    total: 1560,
    createdAt: '2026-10-20T10:00:00Z',
    updatedAt: '2026-10-20T10:05:00Z',
    ...overrides,
  };
}

export function testSummary(): InvoiceSummary {
  return {
    drafts: { count: 3, total: 2400 },
    outstanding: { count: 12, total: 18950 },
    overdue: { count: 2, total: 3120 },
    issuedThisMonth: { count: 7, total: 9800 },
  };
}

export function pageOf<T>(content: T[], page = 0, totalElements = content.length, size = 20): Page<T> {
  return { content, page, size, totalElements, totalPages: Math.ceil(totalElements / size) };
}
