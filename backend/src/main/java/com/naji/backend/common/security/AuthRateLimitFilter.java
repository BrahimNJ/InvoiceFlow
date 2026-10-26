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
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.OrRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerExceptionResolver;

import java.io.IOException;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Arrays;
import java.util.concurrent.TimeUnit;

/**
 * Token bucket per client on the endpoints that check credentials or mint tokens. It complements the per-account
 * lockout: the lockout stops guessing one account's password, this stops one client from trying many accounts or
 * flooding sign-up.
 *
 * <p>Requests are matched exactly as Spring Security and Spring MVC route them (decoded path), so an encoded path
 * such as {@code /api/auth/%6Cogin} cannot reach the handler without being counted.
 *
 * <p>The client is {@link HttpServletRequest#getRemoteAddr()}: an IPv4 address, or the /64 prefix of an IPv6 address
 * (one subscriber usually controls a whole /64). Behind a reverse proxy, the production profile sets
 * {@code server.forward-headers-strategy=native}, so Tomcat takes it from {@code X-Forwarded-For} only when the
 * request comes from a trusted private-network proxy.
 */
@Slf4j
public class AuthRateLimitFilter extends OncePerRequestFilter {

    static final RequestMatcher LIMITED_ENDPOINTS = new OrRequestMatcher(
            PathPatternRequestMatcher.withDefaults().matcher(HttpMethod.POST, "/api/auth/login"),
            PathPatternRequestMatcher.withDefaults().matcher(HttpMethod.POST, "/api/auth/register"),
            PathPatternRequestMatcher.withDefaults().matcher(HttpMethod.POST, "/api/auth/refresh"));

    private final RateLimitProperties properties;
    private final HandlerExceptionResolver exceptionResolver;
    /** Bounded and self-expiring, so a flood of distinct clients cannot exhaust memory. */
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
        return !LIMITED_ENDPOINTS.matches(request);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String client = clientKey(request.getRemoteAddr());
        ConsumptionProbe probe = buckets.get(client, key -> newBucket()).tryConsumeAndReturnRemaining(1);
        response.setHeader("RateLimit-Limit", String.valueOf(properties.capacity()));
        response.setHeader("RateLimit-Remaining", String.valueOf(probe.getRemainingTokens()));
        if (probe.isConsumed()) {
            chain.doFilter(request, response);
            return;
        }
        long retryAfterSeconds = Math.max(1, TimeUnit.NANOSECONDS.toSeconds(probe.getNanosToWaitForRefill()) + 1);
        // Also shows, in production logs, which address the server attributes requests to
        log.warn("Rate limit reached on {} for client {}", request.getRequestURI(), client);
        response.setHeader("Retry-After", String.valueOf(retryAfterSeconds));
        TooManyRequestsException error = new TooManyRequestsException(
                "Too many attempts from your network. Please wait %d seconds and try again.".formatted(retryAfterSeconds));
        if (exceptionResolver.resolveException(request, response, null, error) == null) {
            response.sendError(HttpStatus.TOO_MANY_REQUESTS.value(), error.getMessage());
        }
    }

    /** IPv4 as is; IPv6 reduced to its /64 prefix. Unparsable values are used verbatim. */
    static String clientKey(String remoteAddress) {
        if (remoteAddress == null || !remoteAddress.contains(":")) {
            return String.valueOf(remoteAddress);
        }
        try {
            InetAddress address = InetAddress.getByName(remoteAddress);
            if (address instanceof Inet6Address) {
                byte[] prefix = Arrays.copyOf(address.getAddress(), 16);
                Arrays.fill(prefix, 8, 16, (byte) 0);
                return InetAddress.getByAddress(prefix).getHostAddress() + "/64";
            }
            return address.getHostAddress();
        } catch (UnknownHostException e) {
            return remoteAddress;
        }
    }

    private Bucket newBucket() {
        return Bucket.builder()
                .addLimit(Bandwidth.builder()
                        .capacity(properties.capacity())
                        .refillGreedy(properties.capacity(), properties.period())
                        .build())
                .build();
    }
}
