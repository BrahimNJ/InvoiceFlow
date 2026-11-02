package com.naji.backend.payment.dto;

import com.naji.backend.payment.PaymentMethod;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record PaymentResponse(
        Long id,
        Long invoiceId,
        BigDecimal amount,
        LocalDate date,
        PaymentMethod method,
        String reference,
        String note,
        Instant createdAt
) {
}
