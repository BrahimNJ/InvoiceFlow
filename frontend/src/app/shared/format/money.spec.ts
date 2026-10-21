import { amountInputValue, formatEuros, formatPercent, parseAmount, priceIncludingVat } from './money';

/** Intl uses narrow no-break spaces in French: normalized so the expectations stay readable. */
const plain = (text: string) => text.replace(/[  ]/g, ' ');

describe('money', () => {
  it('formats euros and rates the French way', () => {
    expect(plain(formatEuros(1234.5))).toBe('1 234,50 €');
    expect(plain(formatEuros(0))).toBe('0,00 €');
    expect(formatPercent(5.5)).toBe('5,5 %');
    expect(formatPercent(20)).toBe('20 %');
  });

  it('parses amounts typed with a comma, a dot or thousands separators', () => {
    expect(parseAmount('650')).toBe(650);
    expect(parseAmount('650,5')).toBe(650.5);
    expect(parseAmount('1 200.75')).toBe(1200.75);
    expect(parseAmount('1 200,75')).toBe(1200.75);
  });

  it('rejects what is not an amount with at most 2 decimals', () => {
    for (const text of ['', 'abc', '-5', '1,234', '12.', '1.2.3', '12345678901']) {
      expect(parseAmount(text)).toBeNull();
    }
  });

  it('writes amounts for input fields', () => {
    expect(amountInputValue(650)).toBe('650,00');
    expect(amountInputValue(49.9)).toBe('49,90');
  });

  it('adds the VAT, rounded half up to the cent', () => {
    expect(priceIncludingVat(650, 20)).toBe(780);
    expect(priceIncludingVat(10.05, 5.5)).toBe(10.6);
    expect(priceIncludingVat(0.15, 10)).toBe(0.17);
    expect(priceIncludingVat(99.99, 2.1)).toBe(102.09);
    expect(priceIncludingVat(42, 0)).toBe(42);
  });
});
