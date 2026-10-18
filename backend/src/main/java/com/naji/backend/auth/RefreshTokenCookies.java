package com.naji.backend.auth;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;

/**
 * Builds the refresh token cookie: {@code HttpOnly} (unreadable by JavaScript, so an XSS cannot steal it)
 * and scoped to {@code /api/auth}, the only endpoints that need it.
 */
@Component
@RequiredArgsConstructor
public class RefreshTokenCookies {

    public static final String NAME = "refresh_token";
    static final String PATH = "/api/auth";

    private final RefreshCookieProperties properties;
    private final Clock clock;

    public ResponseCookie create(IssuedToken refreshToken) {
        return base(refreshToken.value())
                .maxAge(Duration.between(clock.instant(), refreshToken.expiresAt()))
                .build();
    }

    /** Tells the browser to delete the cookie. */
    public ResponseCookie clear() {
        return base("").maxAge(Duration.ZERO).build();
    }

    private ResponseCookie.ResponseCookieBuilder base(String value) {
        return ResponseCookie.from(NAME, value)
                .httpOnly(true)
                .secure(properties.secure())
                .sameSite(properties.sameSite())
                .path(PATH);
    }
}
