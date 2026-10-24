package com.naji.backend.invoice;

/**
 * Lifecycle of an invoice: {@code DRAFT} → {@code ISSUED} → {@code CANCELLED}.
 * Only a draft can be edited or deleted; an issued invoice keeps its number forever.
 * "Overdue" is not a status: it is an issued invoice whose due date has passed.
 */
public enum InvoiceStatus {
    DRAFT,
    ISSUED,
    CANCELLED
}
