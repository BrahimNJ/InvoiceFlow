// Mirrors the backend DTOs of com.naji.backend.payment.

export type PaymentMethod = 'BANK_TRANSFER' | 'CARD' | 'CHEQUE' | 'CASH' | 'DIRECT_DEBIT' | 'OTHER';

export interface Payment {
  id: number;
  invoiceId: number;
  /** Euros, including VAT. */
  amount: number;
  /** ISO date (`2026-10-28`): the day the money was received. */
  date: string;
  method: PaymentMethod;
  reference: string | null;
  note: string | null;
  createdAt: string;
}

/**
 * Body of a new payment. The backend answers 422 when the amount is more than the balance due (`balance`) or the
 * date is before the issue date or after today (`issueDate`).
 */
export type PaymentPayload = Omit<Payment, 'id' | 'invoiceId' | 'createdAt'>;

export const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Bank transfer',
  CARD: 'Card',
  CHEQUE: 'Cheque',
  CASH: 'Cash',
  DIRECT_DEBIT: 'Direct debit',
  OTHER: 'Other',
};
