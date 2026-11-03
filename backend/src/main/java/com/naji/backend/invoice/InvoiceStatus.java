package com.naji.backend.invoice;

/**
 * Lifecycle of an invoice: {@code DRAFT} → {@code ISSUED} → {@code PAID}, or {@code ISSUED} → {@code CANCELLED}.
 * Only a draft can be edited or deleted; an issued invoice keeps its number forever. An issued invoice becomes
 * {@code PAID} when its payments cover its total, and goes back to {@code ISSUED} when a payment is deleted.
 * "Overdue" is not a status: it is an issued invoice whose due date has passed.
 */
public enum InvoiceStatus {
    DRAFT,
    ISSUED,
    PAID,
    CANCELLED
}
