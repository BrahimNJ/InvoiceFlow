package com.naji.backend.common.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * Access token settings ({@code app.security.jwt.*}).
 *
 * @param secret         HMAC-SHA256 signing key (env var {@code JWT_SECRET}), at least 32 bytes
 * @param issuer         {@code iss} claim written and required on every token
 * @param accessTokenTtl lifetime of an access token; short because it cannot be revoked
 */
@ConfigurationProperties("app.security.jwt")
public record JwtProperties(String secret, String issuer, Duration accessTokenTtl) {

    /** HS256 requires a key at least as long as the hash output (RFC 7518, section 3.2). */
    static final int MIN_SECRET_BYTES = 32;

    public JwtProperties {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
            throw new IllegalArgumentException(
                    "app.security.jwt.secret (JWT_SECRET) must be at least " + MIN_SECRET_BYTES + " bytes");
        }
        if (issuer == null || issuer.isBlank()) {
            throw new IllegalArgumentException("app.security.jwt.issuer must not be blank");
        }
        if (accessTokenTtl == null || accessTokenTtl.isNegative() || accessTokenTtl.isZero()) {
            throw new IllegalArgumentException("app.security.jwt.access-token-ttl must be positive");
        }
    }

    public SecretKey secretKey() {
        return new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }

    /** Never print the secret (startup logs, debugging). */
    @Override
    public String toString() {
        return "JwtProperties[issuer=" + issuer + ", accessTokenTtl=" + accessTokenTtl + ", secret=***]";
    }
}
