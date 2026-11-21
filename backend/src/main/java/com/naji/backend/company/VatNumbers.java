package com.naji.backend.company;

import java.util.Locale;

/** Intra-community VAT numbers: format and, for French numbers, the key computed from the SIREN. */
public final class VatNumbers {

    private VatNumbers() {
    }

    /** Spaces, dots and dashes removed, upper case. */
    public static String normalize(String vatNumber) {
        return vatNumber.replaceAll("[\\s.-]+", "").toUpperCase(Locale.ROOT);
    }

    /**
     * Whether a normalized number looks like an EU VAT number: two-letter country code then 2 to 12 letters or digits.
     * A French number is {@code FR}, a two-character key and the nine-digit SIREN.
     */
    public static boolean isWellFormed(String compact) {
        if (compact.startsWith("FR")) {
            return compact.matches("FR[0-9A-Z]{2}\\d{9}");
        }
        return compact.matches("[A-Z]{2}[0-9A-Z]{2,12}");
    }

    /**
     * Whether a well-formed French number belongs to {@code siren}: same SIREN and, for a numeric key, the key
     * {@code (12 + 3 * (SIREN mod 97)) mod 97}. Foreign numbers are not checked against the SIREN.
     */
    public static boolean matchesSiren(String compact, String siren) {
        if (!compact.startsWith("FR")) {
            return true;
        }
        if (!compact.substring(4).equals(siren)) {
            return false;
        }
        String key = compact.substring(2, 4);
        if (!key.matches("\\d{2}")) {
            return true;
        }
        long expected = (12 + 3 * (Long.parseLong(siren) % 97)) % 97;
        return Integer.parseInt(key) == expected;
    }
}
