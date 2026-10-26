package com.naji.backend.common.security;

import com.naji.backend.common.exception.TooManyRequestsException;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.servlet.HandlerExceptionResolver;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class AuthRateLimitFilterTest {

    private final HandlerExceptionResolver resolver = mock(HandlerExceptionResolver.class);
    private final AuthRateLimitFilter filter =
            new AuthRateLimitFilter(new RateLimitProperties(true, 2, Duration.ofMinutes(1)), resolver);

    private MockHttpServletResponse send(String method, String path, String ip) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setRemoteAddr(ip);
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, response, chain);
        response.setHeader("X-Passed", String.valueOf(chain.getRequest() != null));
        return response;
    }

    @Test
    void letsRequestsThroughUntilTheBucketIsEmptyThenAnswers429WithRetryAfter() throws Exception {
        assertThat(send("POST", "/api/auth/login", "203.0.113.7").getHeader("X-Passed")).isEqualTo("true");
        MockHttpServletResponse second = send("POST", "/api/auth/login", "203.0.113.7");
        assertThat(second.getHeader("X-Passed")).isEqualTo("true");
        assertThat(second.getHeader("RateLimit-Remaining")).isEqualTo("0");

        MockHttpServletResponse third = send("POST", "/api/auth/login", "203.0.113.7");

        assertThat(third.getHeader("X-Passed")).isEqualTo("false");
        assertThat(Integer.parseInt(third.getHeader("Retry-After"))).isBetween(1, 60);
        ArgumentCaptor<Exception> error = ArgumentCaptor.forClass(Exception.class);
        verify(resolver).resolveException(any(), any(), isNull(), error.capture());
        assertThat(error.getValue()).isInstanceOf(TooManyRequestsException.class);
    }

    @Test
    void countsEachClientIpSeparately() throws Exception {
        send("POST", "/api/auth/login", "203.0.113.7");
        send("POST", "/api/auth/login", "203.0.113.7");

        assertThat(send("POST", "/api/auth/login", "198.51.100.4").getHeader("X-Passed")).isEqualTo("true");
    }

    @Test
    void sharesOneBucketBetweenSignInSignUpAndRefresh() throws Exception {
        send("POST", "/api/auth/register", "203.0.113.7");
        send("POST", "/api/auth/refresh", "203.0.113.7");

        assertThat(send("POST", "/api/auth/login", "203.0.113.7").getHeader("X-Passed")).isEqualTo("false");
    }

    @Test
    void countsPercentEncodedPathsLikeTheRouterDoes() throws Exception {
        send("POST", "/api/auth/login", "203.0.113.7");
        send("POST", "/api/auth/%6Cogin", "203.0.113.7");

        assertThat(send("POST", "/api/%61uth/login", "203.0.113.7").getHeader("X-Passed")).isEqualTo("false");
    }

    @Test
    void groupsIpv6ClientsByTheirSlash64() throws Exception {
        send("POST", "/api/auth/login", "2001:db8:1:2::a");
        send("POST", "/api/auth/login", "2001:db8:1:2:ffff::b");

        assertThat(send("POST", "/api/auth/login", "2001:db8:1:2::c").getHeader("X-Passed")).isEqualTo("false");
        assertThat(send("POST", "/api/auth/login", "2001:db8:1:3::a").getHeader("X-Passed")).isEqualTo("true");
    }

    @Test
    void clientKeyKeepsIpv4AndReducesIpv6ToItsPrefix() {
        assertThat(AuthRateLimitFilter.clientKey("203.0.113.7")).isEqualTo("203.0.113.7");
        assertThat(AuthRateLimitFilter.clientKey("2001:db8:1:2:3:4:5:6")).isEqualTo("2001:db8:1:2:0:0:0:0/64");
        assertThat(AuthRateLimitFilter.clientKey(null)).isEqualTo("null");
    }

    @Test
    void stillAnswers429WhenNoExceptionHandlerResolvesTheError() throws Exception {
        send("POST", "/api/auth/login", "203.0.113.7");
        send("POST", "/api/auth/login", "203.0.113.7");

        assertThat(send("POST", "/api/auth/login", "203.0.113.7").getStatus()).isEqualTo(429);
    }

    @Test
    void leavesOtherEndpointsAndMethodsAlone() throws Exception {
        for (int i = 0; i < 5; i++) {
            assertThat(send("POST", "/api/auth/logout", "203.0.113.7").getHeader("X-Passed")).isEqualTo("true");
            assertThat(send("GET", "/api/customers", "203.0.113.7").getHeader("X-Passed")).isEqualTo("true");
            assertThat(send("OPTIONS", "/api/auth/login", "203.0.113.7").getHeader("X-Passed")).isEqualTo("true");
        }
        verify(resolver, never()).resolveException(any(), any(), any(), any());
    }

    @Test
    void propertiesHaveSafeDefaultsAndRejectNonsense() {
        RateLimitProperties defaults = new RateLimitProperties(null, null, null);
        assertThat(defaults.enabled()).isTrue();
        assertThat(defaults.capacity()).isEqualTo(10);
        assertThat(defaults.period()).isEqualTo(Duration.ofMinutes(1));

        assertThatThrownBy(() -> new RateLimitProperties(true, 0, Duration.ofMinutes(1)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new RateLimitProperties(true, 5, Duration.ZERO))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
