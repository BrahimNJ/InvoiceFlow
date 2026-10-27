package com.naji.backend.common.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * Per-IP limit on the public authentication endpoints ({@code app.rate-limit.auth.*}).
 *
 * @param enabled  on unless a test turns it off
 * @param capacity requests allowed per client IP within {@code period}, refilled gradually
 * @param period   window in which {@code capacity} requests are refilled
 */
@ConfigurationProperties("app.rate-limit.auth")
public record RateLimitProperties(Boolean enabled, Integer capacity, Duration period) {

    public RateLimitProperties {
        enabled = enabled == null || enabled;
        capacity = capacity == null ? 10 : capacity;
        period = period == null ? Duration.ofMinutes(1) : period;
        if (capacity < 1 || period.isNegative() || period.isZero()) {
            throw new IllegalArgumentException("app.rate-limit.auth needs a positive capacity and period");
        }
    }
}
