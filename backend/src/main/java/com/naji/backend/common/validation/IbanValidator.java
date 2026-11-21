package com.naji.backend.common.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.math.BigInteger;
import java.util.Locale;

public class IbanValidator implements ConstraintValidator<Iban, String> {

    private static final BigInteger NINETY_SEVEN = BigInteger.valueOf(97);

    @Override
    public boolean isValid(String iban, ConstraintValidatorContext context) {
        return iban == null || iban.isBlank() || isValid(iban);
    }

    /** Whether {@code iban}, once spaces are removed and letters upper-cased, is a well-formed IBAN. */
    public static boolean isValid(String iban) {
        String compact = normalize(iban);
        if (!compact.matches("[A-Z]{2}\\d{2}[A-Z0-9]{11,30}")) {
            return false;
        }
        String rearranged = compact.substring(4) + compact.substring(0, 4);
        StringBuilder digits = new StringBuilder();
        for (char c : rearranged.toCharArray()) {
            digits.append(Character.isDigit(c) ? String.valueOf(c) : String.valueOf(c - 'A' + 10));
        }
        return new BigInteger(digits.toString()).mod(NINETY_SEVEN).intValue() == 1;
    }

    /** Spaces removed, upper case. */
    public static String normalize(String iban) {
        return iban.replaceAll("\\s+", "").toUpperCase(Locale.ROOT);
    }
}
