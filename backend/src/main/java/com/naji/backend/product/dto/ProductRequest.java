package com.naji.backend.product.dto;

import com.naji.backend.common.validation.FrenchVatRate;
import com.naji.backend.product.ProductType;
import com.naji.backend.product.ProductUnit;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/** {@code unitPrice} excludes VAT, in euros with at most 2 decimals; {@code vatRate} is in percent. */
public record ProductRequest(
        @NotNull ProductType type,
        @NotBlank @Size(max = 255) String name,
        @Size(max = 1000) String description,
        @NotNull @DecimalMin("0.00") @Digits(integer = 10, fraction = 2) BigDecimal unitPrice,
        @NotNull @FrenchVatRate BigDecimal vatRate,
        @NotNull ProductUnit unit
) {
}
