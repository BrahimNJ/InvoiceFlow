package com.naji.backend.invoice.dto;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** How many invoices, and their total including VAT. Built by the summary queries (JPQL constructor expression). */
public record InvoiceTotals(Long count, BigDecimal total) {

    /** {@code sum()} of no row is {@code null}. */
    public InvoiceTotals {
        count = count == null ? 0L : count;
        total = (total == null ? BigDecimal.ZERO : total).setScale(2, RoundingMode.UNNECESSARY);
    }
}
