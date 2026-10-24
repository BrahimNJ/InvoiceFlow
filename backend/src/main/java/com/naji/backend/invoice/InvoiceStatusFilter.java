package com.naji.backend.invoice;

/** Status tabs of the invoices list. {@code ISSUED} includes the overdue invoices; {@code OVERDUE} only those. */
public enum InvoiceStatusFilter {
    DRAFT,
    ISSUED,
    OVERDUE,
    CANCELLED
}
