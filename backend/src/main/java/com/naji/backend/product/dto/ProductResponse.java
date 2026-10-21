package com.naji.backend.product.dto;

import com.naji.backend.product.ProductType;
import com.naji.backend.product.ProductUnit;

import java.math.BigDecimal;
import java.time.Instant;

public record ProductResponse(
        Long id,
        ProductType type,
        String name,
        String description,
        BigDecimal unitPrice,
        BigDecimal vatRate,
        ProductUnit unit,
        Instant createdAt,
        Instant updatedAt
) {
}
