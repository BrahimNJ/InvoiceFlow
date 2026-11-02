package com.naji.backend.payment.dto;

import com.naji.backend.payment.PaymentMethod;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A payment received on an invoice. The rules that need the invoice (amount within the balance, date between the
 * issue date and today) are checked by the service and answer 422.
 */
public record PaymentRequest(
        @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 12, fraction = 2) BigDecimal amount,
        @NotNull LocalDate date,
        @NotNull PaymentMethod method,
        @Size(max = 100) String reference,
        @Size(max = 500) String note
) {
}
