package com.naji.backend.invoice;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Invoice amounts, in euros, rounded half up to the cent:
 * <ul>
 *   <li>line total = quantity × unit price, rounded;</li>
 *   <li>VAT is computed once per rate, on the sum of the line totals at that rate, then rounded
 *       (rounding each line separately would let cents drift on long invoices);</li>
 *   <li>total = subtotal + VAT.</li>
 * </ul>
 */
public final class InvoiceCalculator {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private InvoiceCalculator() {
    }

    public static BigDecimal lineTotal(BigDecimal quantity, BigDecimal unitPrice) {
        return cents(quantity.multiply(unitPrice));
    }

    /** Totals of lines given as (line total, VAT rate) pairs; the breakdown lists the highest rate first. */
    public static Totals totals(List<TaxedAmount> lines) {
        Map<BigDecimal, BigDecimal> baseByRate = new TreeMap<>(Comparator.reverseOrder());
        for (TaxedAmount line : lines) {
            baseByRate.merge(line.vatRate().setScale(2, RoundingMode.UNNECESSARY), line.amount(), BigDecimal::add);
        }

        List<VatAmount> breakdown = new ArrayList<>();
        BigDecimal subtotal = cents(BigDecimal.ZERO);
        BigDecimal vatTotal = cents(BigDecimal.ZERO);
        for (Map.Entry<BigDecimal, BigDecimal> entry : baseByRate.entrySet()) {
            BigDecimal base = cents(entry.getValue());
            BigDecimal vat = cents(base.multiply(entry.getKey()).divide(HUNDRED));
            breakdown.add(new VatAmount(entry.getKey(), base, vat));
            subtotal = subtotal.add(base);
            vatTotal = vatTotal.add(vat);
        }
        return new Totals(subtotal, vatTotal, subtotal.add(vatTotal), List.copyOf(breakdown));
    }

    private static BigDecimal cents(BigDecimal amount) {
        return amount.setScale(2, RoundingMode.HALF_UP);
    }

    /** An amount excluding VAT and the VAT rate (percent) that applies to it. */
    public record TaxedAmount(BigDecimal amount, BigDecimal vatRate) {
    }

    /** VAT due at one rate: {@code base} excluding VAT and the resulting {@code amount}. */
    public record VatAmount(BigDecimal rate, BigDecimal base, BigDecimal amount) {
    }

    public record Totals(BigDecimal subtotal, BigDecimal vatTotal, BigDecimal total, List<VatAmount> vatBreakdown) {
    }
}
