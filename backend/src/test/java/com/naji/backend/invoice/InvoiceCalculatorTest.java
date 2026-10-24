package com.naji.backend.invoice;

import com.naji.backend.invoice.InvoiceCalculator.TaxedAmount;
import com.naji.backend.invoice.InvoiceCalculator.Totals;
import com.naji.backend.invoice.InvoiceCalculator.VatAmount;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class InvoiceCalculatorTest {

    @ParameterizedTest
    @CsvSource({
            "1, 650.00, 650.00",
            "1.5, 650.00, 975.00",
            "0.333, 10.00, 3.33",
            // 0.0125 and 0.025: half up at the cent
            "0.125, 0.10, 0.01",
            "2.5, 0.01, 0.03",
    })
    void lineTotal_isQuantityTimesUnitPriceRoundedHalfUpToTheCent(String quantity, String unitPrice, String expected) {
        assertThat(InvoiceCalculator.lineTotal(new BigDecimal(quantity), new BigDecimal(unitPrice))).hasToString(expected);
    }

    @Test
    void totals_ofNoLineAreZero() {
        Totals totals = InvoiceCalculator.totals(List.of());

        assertThat(totals.subtotal()).hasToString("0.00");
        assertThat(totals.vatTotal()).hasToString("0.00");
        assertThat(totals.total()).hasToString("0.00");
        assertThat(totals.vatBreakdown()).isEmpty();
    }

    @Test
    void totals_groupTheVatByRateHighestFirst() {
        Totals totals = InvoiceCalculator.totals(List.of(
                taxed("1250.00", "20"),
                taxed("250.00", "10"),
                taxed("100.00", "20.00"),
                taxed("39.90", "5.5"),
                taxed("80.00", "0")));

        assertThat(totals.vatBreakdown()).containsExactly(
                new VatAmount(new BigDecimal("20.00"), new BigDecimal("1350.00"), new BigDecimal("270.00")),
                new VatAmount(new BigDecimal("10.00"), new BigDecimal("250.00"), new BigDecimal("25.00")),
                new VatAmount(new BigDecimal("5.50"), new BigDecimal("39.90"), new BigDecimal("2.19")),
                new VatAmount(new BigDecimal("0.00"), new BigDecimal("80.00"), new BigDecimal("0.00")));
        assertThat(totals.subtotal()).hasToString("1719.90");
        assertThat(totals.vatTotal()).hasToString("297.19");
        assertThat(totals.total()).hasToString("2017.09");
    }

    @Test
    void totals_roundTheVatOncePerRateNotPerLine() {
        // Per line: 3 × round(0.005) = 3 × 0.01 = 0.03. Per rate: round(0.015) = 0.02.
        Totals totals = InvoiceCalculator.totals(List.of(
                taxed("0.05", "10"),
                taxed("0.05", "10"),
                taxed("0.05", "10")));

        assertThat(totals.vatBreakdown()).singleElement().satisfies(vat -> {
            assertThat(vat.base()).hasToString("0.15");
            assertThat(vat.amount()).hasToString("0.02");
        });
        assertThat(totals.total()).hasToString("0.17");
    }

    @Test
    void totals_roundHalfUp() {
        // 5.5 % of 0.10 = 0.0055 → 0.01; 20 % of 0.02 = 0.004 → 0.00
        assertThat(InvoiceCalculator.totals(List.of(taxed("0.10", "5.5"))).vatTotal()).hasToString("0.01");
        assertThat(InvoiceCalculator.totals(List.of(taxed("0.02", "20"))).vatTotal()).hasToString("0.00");
    }

    private static TaxedAmount taxed(String amount, String vatRate) {
        return new TaxedAmount(new BigDecimal(amount), new BigDecimal(vatRate));
    }
}
