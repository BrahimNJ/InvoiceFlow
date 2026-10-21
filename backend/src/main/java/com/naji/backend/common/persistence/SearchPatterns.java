package com.naji.backend.common.persistence;

import java.util.Locale;

/** Builds {@code LIKE} patterns for the free-text search of list endpoints. */
public final class SearchPatterns {

    private SearchPatterns() {
    }

    /**
     * A lower-case pattern matching values that contain {@code search} literally: {@code %}, {@code _} and
     * {@code !} are escaped with {@code !} (queries use {@code escape '!'}). A blank search returns {@code %},
     * which matches everything.
     */
    public static String contains(String search) {
        if (search == null || search.isBlank()) {
            return "%";
        }
        String escaped = search.strip().toLowerCase(Locale.ROOT)
                .replace("!", "!!")
                .replace("%", "!%")
                .replace("_", "!_");
        return "%" + escaped + "%";
    }
}
