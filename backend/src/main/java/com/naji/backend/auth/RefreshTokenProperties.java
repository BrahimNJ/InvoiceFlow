package com.naji.backend.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * Refresh token settings ({@code app.security.refresh-token.*}).
 *
 * @param ttl how long a sign-in lasts without activity; each refresh starts a new period
 */
@ConfigurationProperties("app.security.refresh-token")
public record RefreshTokenProperties(Duration ttl) {

    public RefreshTokenProperties {
        if (ttl == null || ttl.isNegative() || ttl.isZero()) {
            throw new IllegalArgumentException("app.security.refresh-token.ttl must be positive");
        }
    }
}
