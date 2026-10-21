package com.naji.backend.common.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.math.BigDecimal;
import java.util.List;

public class FrenchVatRateValidator implements ConstraintValidator<FrenchVatRate, BigDecimal> {

    /** Standard, intermediate, reduced, super-reduced and zero rates (also enforced by a database check). */
    public static final List<BigDecimal> RATES = List.of(
            new BigDecimal("20"), new BigDecimal("10"), new BigDecimal("5.5"), new BigDecimal("2.1"), BigDecimal.ZERO);

    @Override
    public boolean isValid(BigDecimal rate, ConstraintValidatorContext context) {
        return rate == null || RATES.stream().anyMatch(allowed -> allowed.compareTo(rate) == 0);
    }
}
