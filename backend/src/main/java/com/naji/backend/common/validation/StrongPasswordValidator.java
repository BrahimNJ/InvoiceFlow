package com.naji.backend.common.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.nio.charset.StandardCharsets;

public class StrongPasswordValidator implements ConstraintValidator<StrongPassword, String> {

    public static final int MIN_LENGTH = 12;
    public static final int MAX_BYTES = 72;

    @Override
    public boolean isValid(String password, ConstraintValidatorContext context) {
        if (password == null) {
            return false;
        }
        if (password.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES) {
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate("must not exceed " + MAX_BYTES + " bytes")
                    .addConstraintViolation();
            return false;
        }
        return password.length() >= MIN_LENGTH
                && password.chars().anyMatch(Character::isLowerCase)
                && password.chars().anyMatch(Character::isUpperCase)
                && password.chars().anyMatch(Character::isDigit);
    }
}
