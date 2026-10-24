package com.naji.backend.invoice.dto;

/**
 * Key figures of the invoices list.
 *
 * @param drafts          not issued yet
 * @param outstanding     issued and waiting for payment, overdue included
 * @param overdue         issued and past their due date
 * @param issuedThisMonth issued since the first day of the current month (cancelled ones excluded)
 */
public record InvoiceSummaryResponse(
        InvoiceTotals drafts,
        InvoiceTotals outstanding,
        InvoiceTotals overdue,
        InvoiceTotals issuedThisMonth
) {
}
