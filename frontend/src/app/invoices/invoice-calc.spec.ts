import {
  computeTotals,
  daysBetween,
  dueDate,
  dueLabel,
  formatDate,
  lineTotal,
  operationNature,
  parseQuantity,
  quantityInputValue,
  readiness,
  todayIso,
} from './invoice-calc';
import { BilledCustomer } from './invoice.models';

describe('invoice calculations', () => {
  it('rounds line totals half up to the cent, without binary errors', () => {
    expect(lineTotal(1.5, 650)).toBe(975);
    expect(lineTotal(0.333, 10)).toBe(3.33);
    expect(lineTotal(0.125, 0.1)).toBe(0.01);
    expect(lineTotal(2.5, 0.01)).toBe(0.03);
    expect(lineTotal(3, 0.1)).toBe(0.3);
  });

  it('matches the backend on several rates, highest first', () => {
    const totals = computeTotals([
      { quantity: 1, unitPrice: 1250, vatRate: 20 },
      { quantity: 1, unitPrice: 250, vatRate: 10 },
      { quantity: 1, unitPrice: 100, vatRate: 20 },
      { quantity: 1, unitPrice: 39.9, vatRate: 5.5 },
      { quantity: 1, unitPrice: 80, vatRate: 0 },
    ]);

    expect(totals.vatBreakdown).toEqual([
      { rate: 20, base: 1350, amount: 270 },
      { rate: 10, base: 250, amount: 25 },
      { rate: 5.5, base: 39.9, amount: 2.19 },
      { rate: 0, base: 80, amount: 0 },
    ]);
    expect(totals.subtotal).toBe(1719.9);
    expect(totals.vatTotal).toBe(297.19);
    expect(totals.total).toBe(2017.09);
  });

  it('rounds the VAT once per rate, not per line', () => {
    const line = { quantity: 1, unitPrice: 0.05, vatRate: 10 };

    expect(computeTotals([line, line, line]).vatTotal).toBe(0.02);
  });

  it('has zero totals without lines', () => {
    expect(computeTotals([])).toEqual({ subtotal: 0, vatTotal: 0, total: 0, vatBreakdown: [] });
  });

  it('computes due dates like the backend', () => {
    expect(dueDate('ON_RECEIPT', '2026-10-24')).toBe('2026-10-24');
    expect(dueDate('NET_30', '2026-10-24')).toBe('2026-11-23');
    expect(dueDate('NET_60', '2026-12-15')).toBe('2027-02-13');
    expect(dueDate('END_OF_MONTH_45', '2026-10-24')).toBe('2026-12-31');
    expect(dueDate('END_OF_MONTH_45', '2028-01-10')).toBe('2028-02-29');
  });

  it('describes a due date relative to today', () => {
    expect(dueLabel('2026-10-24', '2026-10-24')).toEqual({ text: 'Due today', late: false });
    expect(dueLabel('2026-10-25', '2026-10-24')).toEqual({ text: 'Due in 1 day', late: false });
    expect(dueLabel('2026-11-01', '2026-10-24')).toEqual({ text: 'Due in 8 days', late: false });
    expect(dueLabel('2026-10-15', '2026-10-24')).toEqual({ text: '9 days late', late: true });
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
  });

  it('formats dates the French way and gives today in local time', () => {
    expect(formatDate('2026-10-24')).toBe('24/10/2026');
    expect(formatDate(null)).toBe('—');
    expect(todayIso(new Date(2026, 9, 24, 23, 59))).toBe('2026-10-24');
  });

  it('derives the operation nature from the line types', () => {
    expect(operationNature([])).toBeNull();
    expect(operationNature(['SERVICE', 'SERVICE'])).toBe('SERVICES');
    expect(operationNature(['GOODS'])).toBe('GOODS');
    expect(operationNature(['GOODS', 'SERVICE'])).toBe('MIXED');
  });

  it('checks readiness like the backend', () => {
    const customer: BilledCustomer = {
      name: 'Acme SAS',
      email: 'billing@acme.fr',
      street: '12 rue de la Paix',
      postalCode: '75002',
      city: 'Paris',
      country: null,
      siret: null,
      vatNumber: null,
    };

    expect(readiness(null, 0).map((check) => check.passed)).toEqual([false, false, false, false]);
    expect(readiness(customer, 2)).toEqual([
      { code: 'CUSTOMER', required: true, passed: true },
      { code: 'CUSTOMER_ADDRESS', required: true, passed: true },
      { code: 'LINES', required: true, passed: true },
      { code: 'CUSTOMER_SIREN', required: false, passed: false },
    ]);
    expect(readiness({ ...customer, city: ' ' }, 1)[1].passed).toBe(false);
  });

  it('parses and writes quantities', () => {
    expect(parseQuantity('1,5')).toBe(1.5);
    expect(parseQuantity(' 0.125 ')).toBe(0.125);
    expect(parseQuantity('1 000')).toBe(1000);
    expect(parseQuantity('0')).toBeNull();
    expect(parseQuantity('1,2345')).toBeNull();
    expect(parseQuantity('-1')).toBeNull();
    expect(quantityInputValue(1.5)).toBe('1,5');
    expect(quantityInputValue(2)).toBe('2');
  });
});
