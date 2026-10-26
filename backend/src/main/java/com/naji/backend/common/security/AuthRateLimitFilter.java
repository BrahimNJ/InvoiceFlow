package com.naji.backend.common.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.naji.backend.common.exception.TooManyRequestsException;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerExceptionResolver;

import java.io.IOException;
import java.time.Duration;
import java.util.Set;
import java.util.concurrent.TimeUnit;

/**
 * Token bucket per client IP on the endpoints that check credentials or mint tokens. It complements the per-account
 * lockout: the lockout stops guessing one account's password, this stops one client from trying many accounts or
 * flooding sign-up.
 *
 * <p>The client IP is {@link HttpServletRequest#getRemoteAddr()}. Behind a reverse proxy, the production profile sets
 * {@code server.forward-headers-strategy=native} so that Tomcat takes it from {@code X-Forwarded-For} only when the
 * request comes from a trusted (private-network) proxy, which a client cannot spoof.
 */
public class AuthRateLimitFilter extends OncePerRequestFilter {

    static final Set<String> LIMITED_PATHS = Set.of("/api/auth/login", "/api/auth/register", "/api/auth/refresh");

    private final RateLimitProperties properties;
    private final HandlerExceptionResolver exceptionResolver;
    /** Bounded and self-expiring, so a flood of distinct IPs cannot exhaust memory. */
    private final Cache<String, Bucket> buckets;

    public AuthRateLimitFilter(RateLimitProperties properties, HandlerExceptionResolver exceptionResolver) {
        this.properties = properties;
        this.exceptionResolver = exceptionResolver;
        this.buckets = Caffeine.newBuilder()
                .maximumSize(100_000)
                .expireAfterAccess(properties.period().multipliedBy(2))
                .build();
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !HttpMethod.POST.matches(request.getMethod()) || !LIMITED_PATHS.contains(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Bucket bucket = buckets.get(request.getRemoteAddr(), ip -> newBucket());
        ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);
        response.setHeader("RateLimit-Limit", String.valueOf(properties.capacity()));
        response.setHeader("RateLimit-Remaining", String.valueOf(probe.getRemainingTokens()));
        if (probe.isConsumed()) {
            chain.doFilter(request, response);
            return;
        }
        long retryAfterSeconds = Math.max(1, TimeUnit.NANOSECONDS.toSeconds(probe.getNanosToWaitForRefill()) + 1);
        response.setHeader("Retry-After", String.valueOf(retryAfterSeconds));
        exceptionResolver.resolveException(request, response, null, new TooManyRequestsException(
                "Too many attempts from your network. Please wait %d seconds and try again.".formatted(retryAfterSeconds)));
    }

    private Bucket newBucket() {
        Duration period = properties.period();
        return Bucket.builder()
                .addLimit(Bandwidth.builder().capacity(properties.capacity()).refillGreedy(properties.capacity(), period).build())
                .build();
    }
}
