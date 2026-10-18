package com.naji.backend.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Set;

/**
 * Refresh token cookie settings ({@code app.security.refresh-cookie.*}).
 *
 * @param secure   send the cookie over HTTPS only; false only for local HTTP development
 * @param sameSite {@code Strict} when the frontend and the API share a site (dev), {@code None} when
 *                 they are on different sites (prod: Vercel and Render), which requires {@code secure}
 */
@ConfigurationProperties("app.security.refresh-cookie")
public record RefreshCookieProperties(boolean secure, String sameSite) {

    private static final Set<String> SAME_SITE_VALUES = Set.of("Strict", "Lax", "None");

    public RefreshCookieProperties {
        if (!SAME_SITE_VALUES.contains(sameSite)) {
            throw new IllegalArgumentException("app.security.refresh-cookie.same-site must be one of " + SAME_SITE_VALUES);
        }
        if ("None".equals(sameSite) && !secure) {
            throw new IllegalArgumentException("SameSite=None cookies must be secure (browsers reject them otherwise)");
        }
    }
}
