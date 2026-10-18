package com.naji.backend.common.security;

import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtPropertiesTest {

    private static final String SECRET = "a-secret-of-at-least-thirty-two-bytes!";

    @Test
    void rejectsSecretShorterThan32Bytes() {
        assertThatThrownBy(() -> new JwtProperties("too-short", "invoiceflow", Duration.ofMinutes(15)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("JWT_SECRET");
    }

    @Test
    void rejectsMissingSecret() {
        assertThatThrownBy(() -> new JwtProperties(null, "invoiceflow", Duration.ofMinutes(15)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsBlankIssuerAndNonPositiveTtl() {
        assertThatThrownBy(() -> new JwtProperties(SECRET, " ", Duration.ofMinutes(15)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new JwtProperties(SECRET, "invoiceflow", Duration.ZERO))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void toString_neverExposesTheSecret() {
        JwtProperties properties = new JwtProperties(SECRET, "invoiceflow", Duration.ofMinutes(15));

        assertThat(properties.toString()).doesNotContain(SECRET).contains("secret=***");
    }
}
