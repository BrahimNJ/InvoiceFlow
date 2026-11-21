package com.naji.backend.company.dto;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** Cross-field rules of a {@link CompanyRequest}; each violation is reported on the field it concerns. */
@Documented
@Constraint(validatedBy = ConsistentCompanyValidator.class)
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface ConsistentCompany {

    String message() default "inconsistent company details";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
