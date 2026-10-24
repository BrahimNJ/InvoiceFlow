// Live preview of what the backend computes (InvoiceCalculator, PaymentTerms, InvoiceReadiness), so that the editor
// reacts at each keystroke. The backend stays the reference: saved invoices show its figures.
import { ProductType } from '../products/product.models';
import { BilledCustomer, OperationNature, PaymentTerms, ReadinessCheck, VatBreakdown } from './invoice.models';

export interface PricedLine {
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

export interface Totals {
  subtotal: number;
  vatTotal: number;
  total: number;
  /** Highest rate first. */
  vatBreakdown: VatBreakdown[];
}

// Exact decimal arithmetic on integers: quantities in thousandths, prices in cents, rates in hundredths of a percent.
const toInt = (value: number, decimals: number) => BigInt(Math.round(value * 10 ** decimals));
/** `numerator / denominator` rounded half up, for non-negative values. */
const divideHalfUp = (numerator: bigint, denominator: bigint) => (numerator * 2n + denominator) / (denominator * 2n);
const euros = (cents: bigint) => Number(cents) / 100;

/** Quantity × unit price, rounded half up to the cent. */
export function lineTotal(quantity: number, unitPrice: number): number {
  return euros(lineCents({ quantity, unitPrice, vatRate: 0 }));
}

function lineCents(line: PricedLine): bigint {
  return divideHalfUp(toInt(line.quantity, 3) * toInt(line.unitPrice, 2), 1000n);
}

/** VAT once per rate, on the sum of the lines at that rate; total = subtotal + VAT. */
export function computeTotals(lines: PricedLine[]): Totals {
  const baseByRate = new Map<number, bigint>();
  for (const line of lines) {
    baseByRate.set(line.vatRate, (baseByRate.get(line.vatRate) ?? 0n) + lineCents(line));
  }
  let subtotal = 0n;
  let vatTotal = 0n;
  const vatBreakdown: VatBreakdown[] = [...baseByRate.entries()]
    .sort(([a], [b]) => b - a)
    .map(([rate, base]) => {
      const vat = divideHalfUp(base * toInt(rate, 2), 10000n);
      subtotal += base;
      vatTotal += vat;
      return { rate, base: euros(base), amount: euros(vat) };
    });
  return { subtotal: euros(subtotal), vatTotal: euros(vatTotal), total: euros(subtotal + vatTotal), vatBreakdown };
}

// Dates are ISO `yyyy-mm-dd` strings, computed in UTC so that no time zone shift changes the day.
function parse(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function format(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const date = parse(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return format(date);
}

/** Today in the user's time zone. */
export function todayIso(now = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

const TERM_DAYS: Record<PaymentTerms, number> = {
  ON_RECEIPT: 0,
  NET_15: 15,
  NET_30: 30,
  NET_45: 45,
  NET_60: 60,
  END_OF_MONTH_45: 45,
};

/** 45 days end of month: 45 days, then the end of that month. */
export function dueDate(terms: PaymentTerms, issueDate: string): string {
  const due = parse(addDays(issueDate, TERM_DAYS[terms]));
  if (terms === 'END_OF_MONTH_45') {
    return format(new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0)));
  }
  return format(due);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86400000);
}

/** "Due today", "Due in 8 days", "9 days late": how a due date reads from today. */
export function dueLabel(due: string, today: string): { text: string; late: boolean } {
  const days = daysBetween(today, due);
  if (days === 0) {
    return { text: 'Due today', late: false };
  }
  if (days > 0) {
    return { text: `Due in ${days} ${days === 1 ? 'day' : 'days'}`, late: false };
  }
  return { text: `${-days} ${days === -1 ? 'day' : 'days'} late`, late: true };
}

/** `24/10/2026`, as printed on French invoices. */
export function formatDate(iso: string | null): string {
  if (!iso) {
    return '—';
  }
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

export function operationNature(types: ProductType[]): OperationNature | null {
  const goods = types.includes('GOODS');
  const services = types.includes('SERVICE');
  if (goods && services) {
    return 'MIXED';
  }
  if (goods) {
    return 'GOODS';
  }
  return services ? 'SERVICES' : null;
}

const present = (value: string | null | undefined) => !!value?.trim();

/** Same rules as the backend; checked again on the server when the invoice is issued. */
export function readiness(customer: BilledCustomer | null, lineCount: number): ReadinessCheck[] {
  const chosen = customer !== null && present(customer.name);
  return [
    { code: 'CUSTOMER', required: true, passed: chosen },
    {
      code: 'CUSTOMER_ADDRESS',
      required: true,
      passed: chosen && present(customer.street) && present(customer.postalCode) && present(customer.city),
    },
    { code: 'LINES', required: true, passed: lineCount > 0 },
    { code: 'CUSTOMER_SIREN', required: false, passed: chosen && present(customer.siret) },
  ];
}

/** Quantities: up to 9 digits and 3 decimals, a comma or a dot, spaces between thousands allowed. */
export const QUANTITY_PATTERN = /^\d{1,9}(?:[.,]\d{1,3})?$/;

/** Parses a positive quantity (`1,5`, `0.25`), or null. */
export function parseQuantity(text: string): number | null {
  const compact = text.replace(/[\s  ]/g, '');
  if (!QUANTITY_PATTERN.test(compact)) {
    return null;
  }
  const value = Number(compact.replace(',', '.'));
  return value > 0 ? value : null;
}

/** `1,5`, `2`, `0,125`: no useless zeros. */
export function quantityInputValue(quantity: number): string {
  return String(Number(quantity.toFixed(3))).replace('.', ',');
}
