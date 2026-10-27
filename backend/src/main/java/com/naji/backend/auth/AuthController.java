package com.naji.backend.auth;

import com.naji.backend.auth.dto.AuthResponse;
import com.naji.backend.auth.dto.LoginRequest;
import com.naji.backend.auth.dto.RegisterRequest;
import com.naji.backend.user.dto.UserResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.time.Clock;
import java.time.Duration;

/**
 * Sign-up, sign-in and session endpoints. The four POST endpoints are public (an empty {@code @SecurityRequirements}
 * tells the OpenAPI description so): refresh and logout authenticate with the HttpOnly refresh cookie instead.
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    /**
     * Required on the cookie-authenticated endpoints (refresh, logout). A cross-site form cannot set it, and
     * a cross-site script setting it triggers a CORS preflight that only the allowed origins pass (CSRF defense).
     */
    static final String CSRF_HEADER = "X-Requested-With";

    private final AuthService authService;
    private final RefreshTokenCookies refreshTokenCookies;
    private final Clock clock;

    @PostMapping("/register")
    @SecurityRequirements
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return respond(HttpStatus.CREATED, authService.register(request));
    }

    @PostMapping("/login")
    @SecurityRequirements
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return respond(HttpStatus.OK, authService.login(request));
    }

    @PostMapping("/refresh")
    @SecurityRequirements
    public ResponseEntity<AuthResponse> refresh(
            @CookieValue(name = RefreshTokenCookies.NAME, required = false) String refreshToken,
            @RequestHeader(name = CSRF_HEADER, required = false) String csrfHeader) {
        requireCsrfHeader(csrfHeader);
        return respond(HttpStatus.OK, authService.refresh(refreshToken));
    }

    @PostMapping("/logout")
    @SecurityRequirements
    public ResponseEntity<Void> logout(
            @CookieValue(name = RefreshTokenCookies.NAME, required = false) String refreshToken,
            @RequestHeader(name = CSRF_HEADER, required = false) String csrfHeader) {
        requireCsrfHeader(csrfHeader);
        authService.logout(refreshToken);
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, refreshTokenCookies.clear().toString())
                .build();
    }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal Jwt jwt) {
        return authService.currentUser(Long.valueOf(jwt.getSubject()));
    }

    private ResponseEntity<AuthResponse> respond(HttpStatus status, AuthService.Session session) {
        long expiresIn = Duration.between(clock.instant(), session.accessToken().expiresAt()).toSeconds();
        AuthResponse body = new AuthResponse(session.accessToken().value(), AuthResponse.BEARER, expiresIn, session.user());

        ResponseEntity.BodyBuilder response = status == HttpStatus.CREATED
                ? ResponseEntity.created(URI.create("/api/auth/me"))
                : ResponseEntity.status(status);
        return response
                .header(HttpHeaders.SET_COOKIE, refreshTokenCookies.create(session.refreshToken()).toString())
                .body(body);
    }

    private static void requireCsrfHeader(String value) {
        if (value == null || value.isBlank()) {
            throw new AccessDeniedException("Missing " + CSRF_HEADER + " header");
        }
    }
}
