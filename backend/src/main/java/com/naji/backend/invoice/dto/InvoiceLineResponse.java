package com.naji.backend.invoice.dto;

import com.naji.backend.product.ProductType;
import com.naji.backend.product.ProductUnit;

import java.math.BigDecimal;

public record InvoiceLineResponse(
        Long id,
        Long productId,
        ProductType type,
        String label,
        String details,
        BigDecimal quantity,
        ProductUnit unit,
        BigDecimal unitPrice,
        BigDecimal vatRate,
        BigDecimal lineTotal
) {
}
