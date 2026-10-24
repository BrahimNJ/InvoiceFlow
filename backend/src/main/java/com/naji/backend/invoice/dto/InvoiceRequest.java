package com.naji.backend.invoice.dto;

import com.naji.backend.invoice.PaymentTerms;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Body of create and update; only drafts accept it. A draft may be saved incomplete (no customer, no line):
 * completeness is checked when it is issued.
 */
public record InvoiceRequest(
        Long customerId,
        @NotNull PaymentTerms paymentTerms,
        @Size(max = 2000) String notes,
        @NotNull @Size(max = 200) List<@NotNull @Valid InvoiceLineRequest> lines
) {
}
