// Amounts are euros with at most 2 decimals, like the backend (BigDecimal, scale 2).

const EUROS = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const PERCENT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

/** French format, as on a French invoice: `1 234,50 €`. */
export function formatEuros(amount: number): string {
  return EUROS.format(amount);
}

/** `5,5 %`, `20 %`. */
export function formatPercent(rate: number): string {
  return `${PERCENT.format(rate)} %`;
}

/** Up to 10 digits before the separator and 2 after; a comma or a dot, spaces between thousands are allowed. */
export const AMOUNT_PATTERN = /^\d{1,10}(?:[.,]\d{1,2})?$/;

/** Parses what a user typed (`1 200,5`, `1200.50`) into a number, or null when it is not an amount. */
export function parseAmount(text: string): number | null {
  const compact = text.replace(/[\s  ]/g, '');
  return AMOUNT_PATTERN.test(compact) ? Number(compact.replace(',', '.')) : null;
}

/** Writes an amount for an input field, French style: `650,00`. */
export function amountInputValue(amount: number): string {
  return amount.toFixed(2).replace('.', ',');
}

/**
 * Unit price including VAT, rounded half up to the cent. Computed in cents to avoid binary rounding errors.
 * Shown as an indication: invoice totals are computed by the backend.
 */
export function priceIncludingVat(unitPrice: number, vatRate: number): number {
  const cents = Math.round(unitPrice * 100);
  const basisPoints = Math.round(vatRate * 100);
  return Math.round((cents * (10000 + basisPoints)) / 10000) / 100;
}
