package com.naji.backend.common.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * A VAT rate in percent that exists in mainland France: 20, 10, 5.5, 2.1 or 0 (exempt), whatever the scale
 * ({@code 5.5} and {@code 5.50} are the same rate). Null values are valid: combine with {@code @NotNull}.
 * The frontend mirrors this list in {@code product.models.ts}.
 */
@Documented
@Constraint(validatedBy = FrenchVatRateValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface FrenchVatRate {

    String message() default "must be one of the French VAT rates: 20, 10, 5.5, 2.1 or 0";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
