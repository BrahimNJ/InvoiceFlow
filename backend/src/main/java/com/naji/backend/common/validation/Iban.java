package com.naji.backend.common.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * An IBAN (ISO 13616): country code, two check digits and up to 30 letters or digits, with a valid mod-97 checksum.
 * Spaces and lower case are tolerated. Null and blank values are valid.
 */
@Documented
@Constraint(validatedBy = IbanValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface Iban {

    String message() default "must be a valid IBAN";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
