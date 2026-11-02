package com.naji.backend.invoice;

/**
 * Status tabs of the invoices list. {@code ISSUED} (waiting for payment) includes the overdue invoices; {@code OVERDUE}
 * only those. {@code PAID} lists the settled ones.
 */
public enum InvoiceStatusFilter {
    DRAFT,
    ISSUED,
    OVERDUE,
    PAID,
    CANCELLED
}
