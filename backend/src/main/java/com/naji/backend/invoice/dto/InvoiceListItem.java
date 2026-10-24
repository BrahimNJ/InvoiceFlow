package com.naji.backend.invoice.dto;

import com.naji.backend.invoice.InvoiceStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/** One row of the invoices list: no lines, so that a page costs a single query. */
public record InvoiceListItem(
        Long id,
        String number,
        InvoiceStatus status,
        boolean overdue,
        Long customerId,
        String customerName,
        LocalDate issueDate,
        LocalDate dueDate,
        BigDecimal subtotal,
        BigDecimal total,
        Instant createdAt,
        Instant updatedAt
) {
}
