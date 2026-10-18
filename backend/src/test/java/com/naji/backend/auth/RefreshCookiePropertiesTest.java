package com.naji.backend.auth;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RefreshCookiePropertiesTest {

    @Test
    void acceptsValidCombinations() {
        assertThatCode(() -> new RefreshCookieProperties(false, "Strict")).doesNotThrowAnyException();
        assertThatCode(() -> new RefreshCookieProperties(true, "None")).doesNotThrowAnyException();
    }

    @Test
    void rejectsSameSiteNoneWithoutSecure() {
        assertThatThrownBy(() -> new RefreshCookieProperties(false, "None"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("secure");
    }

    @Test
    void rejectsUnknownSameSiteValue() {
        assertThatThrownBy(() -> new RefreshCookieProperties(true, "strict"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
