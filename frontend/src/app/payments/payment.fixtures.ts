import { Payment } from './payment.models';

/** 560,00 € received by bank transfer on invoice 1. */
export function testPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 11,
    invoiceId: 1,
    amount: 560,
    date: '2026-10-28',
    method: 'BANK_TRANSFER',
    reference: 'VIR ACME 0042',
    note: null,
    createdAt: '2026-10-28T09:00:00Z',
    ...overrides,
  };
}
