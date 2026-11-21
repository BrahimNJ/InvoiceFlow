package com.naji.backend.common.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class SiretValidator implements ConstraintValidator<Siret, String> {

    @Override
    public boolean isValid(String siret, ConstraintValidatorContext context) {
        return siret == null || isValid(siret);
    }

    /** SIREN of La Poste: its establishments do not follow Luhn, the sum of their SIRET digits is a multiple of 5. */
    static final String LA_POSTE_SIREN = "356000000";

    /** Whether {@code siret} is 14 digits with a valid checksum (Luhn, or the La Poste rule). */
    public static boolean isValid(String siret) {
        if (!siret.matches("\\d{14}")) {
            return false;
        }
        return luhn(siret)
                || siret.startsWith(LA_POSTE_SIREN) && siret.chars().map(c -> c - '0').sum() % 5 == 0;
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
