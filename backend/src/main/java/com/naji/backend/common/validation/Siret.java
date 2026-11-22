package com.naji.backend.common.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * A SIRET: 14 digits whose Luhn checksum is valid (the first nine digits, the SIREN, carry their own Luhn key too).
 * Null values are valid: combine with {@code @NotBlank}.
 */
@Documented
@Constraint(validatedBy = SiretValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface Siret {

    String message() default "must be a valid SIRET (14 digits)";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
