package com.naji.backend.invoice.dto;

import com.naji.backend.invoice.InvoiceStatus;
import com.naji.backend.invoice.OperationNature;
import com.naji.backend.invoice.PaymentTerms;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * A full invoice. {@code overdue}: issued and past its due date. {@code checks}: what the invoice needs before it
 * can be issued (still computed once issued, for the record).
 */
public record InvoiceResponse(
        Long id,
        String number,
        InvoiceStatus status,
        boolean overdue,
        Long customerId,
        BilledCustomer customer,
        PaymentTerms paymentTerms,
        LocalDate issueDate,
        LocalDate dueDate,
        String notes,
        OperationNature operationNature,
        List<InvoiceLineResponse> lines,
        BigDecimal subtotal,
        BigDecimal vatTotal,
        BigDecimal total,
        List<VatBreakdown> vatBreakdown,
        List<ReadinessCheck> checks,
        Instant issuedAt,
        Instant cancelledAt,
        Instant createdAt,
        Instant updatedAt
) {

    /** The customer's details as printed on the invoice. */
    public record BilledCustomer(
            String name,
            String email,
            String street,
            String postalCode,
            String city,
            String country,
            String siret,
            String vatNumber
    ) {
    }

    /** VAT at one rate: {@code base} excluding VAT and the VAT {@code amount}. */
    public record VatBreakdown(BigDecimal rate, BigDecimal base, BigDecimal amount) {
    }

    public record ReadinessCheck(String code, boolean required, boolean passed) {
    }
}
