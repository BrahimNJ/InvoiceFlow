package com.naji.backend.invoice.dto;

import com.naji.backend.common.validation.FrenchVatRate;
import com.naji.backend.product.ProductType;
import com.naji.backend.product.ProductUnit;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * One line, written from a catalogue product ({@code productId}) or free ({@code null}). The values are taken from
 * the request, so the user can adjust a catalogue price on one invoice.
 */
public record InvoiceLineRequest(
        Long productId,
        @NotNull ProductType type,
        @NotBlank @Size(max = 255) String label,
        @Size(max = 1000) String details,
        @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 9, fraction = 3) BigDecimal quantity,
        @NotNull ProductUnit unit,
        @NotNull @DecimalMin("0.00") @Digits(integer = 10, fraction = 2) BigDecimal unitPrice,
        @NotNull @FrenchVatRate BigDecimal vatRate
) {
}
