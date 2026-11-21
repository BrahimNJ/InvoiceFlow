package com.naji.backend.common.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class SiretValidator implements ConstraintValidator<Siret, String> {

    @Override
    public boolean isValid(String siret, ConstraintValidatorContext context) {
        return siret == null || isValid(siret);
    }

    /** Whether {@code siret} is 14 digits with a valid Luhn checksum. */
    public static boolean isValid(String siret) {
        return siret.matches("\\d{14}") && luhn(siret);
    }

    /** Luhn checksum: from the right, every second digit is doubled (minus 9 above 9); the sum ends in 0. */
    static boolean luhn(String digits) {
        int sum = 0;
        for (int i = 0; i < digits.length(); i++) {
            int digit = digits.charAt(digits.length() - 1 - i) - '0';
            if (i % 2 == 1) {
                digit *= 2;
                if (digit > 9) {
                    digit -= 9;
                }
            }
            sum += digit;
        }
        return sum % 10 == 0;
    }
}
