package com.naji.backend.common.persistence;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SearchPatternsTest {

    @Test
    void contains_buildsACaseInsensitiveLiteralPattern() {
        assertThat(SearchPatterns.contains("  100%_Bio! ")).isEqualTo("%100!%!_bio!!%");
    }

    @Test
    void contains_matchesEverythingWithoutSearch() {
        assertThat(SearchPatterns.contains(null)).isEqualTo("%");
        assertThat(SearchPatterns.contains("   ")).isEqualTo("%");
    }
}
