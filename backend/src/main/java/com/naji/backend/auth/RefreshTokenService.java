package com.naji.backend.auth;

import com.naji.backend.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Opaque refresh tokens with rotation and reuse detection
 * (OAuth 2.0 Security Best Current Practice, RFC 9700, section 4.14.2).
 */
@Slf4j
@Service
@RequiredArgsConstructor
// Commit even when the token is rejected: the reuse detection revokes sessions before throwing
@Transactional(noRollbackFor = BadCredentialsException.class)
public class RefreshTokenService {

    static final String INVALID_TOKEN_MESSAGE = "Invalid or expired refresh token";

    /** 256 bits of entropy: cannot be guessed, so a fast hash (SHA-256) is enough to store it. */
    private static final int TOKEN_BYTES = 32;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final RefreshTokenRepository refreshTokenRepository;
    private final RefreshTokenProperties properties;
    private final Clock clock;

    public record Rotation(User user, IssuedToken refreshToken) {
    }

    public IssuedToken create(User user) {
        byte[] bytes = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(bytes);
        String value = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        RefreshToken token = new RefreshToken();
        token.setUser(user);
        token.setTokenHash(hash(value));
        token.setExpiresAt(clock.instant().plus(properties.ttl()));
        refreshTokenRepository.save(token);

        return new IssuedToken(value, token.getExpiresAt());
    }

    /**
     * Exchanges a valid refresh token for a new one; the presented token can never be used again.
     * Presenting an already revoked token means it was copied: every session of the user is revoked.
     */
    public Rotation rotate(String value) {
        RefreshToken current = find(value);
        Instant now = clock.instant();

        if (current.isRevoked()) {
            User user = current.getUser();
            int revoked = refreshTokenRepository.revokeAllActiveByUserId(user.getId(), now);
            log.warn("Refresh token reuse detected for user {}: {} active session(s) revoked", user.getId(), revoked);
            throw new BadCredentialsException(INVALID_TOKEN_MESSAGE);
        }
        if (current.isExpired(now)) {
            throw new BadCredentialsException(INVALID_TOKEN_MESSAGE);
        }

        current.setRevokedAt(now);
        return new Rotation(current.getUser(), create(current.getUser()));
    }

    /** Ends one session (sign-out). Unknown or already revoked tokens are ignored. */
    public void revoke(String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        refreshTokenRepository.findByTokenHash(hash(value))
                .filter(token -> !token.isRevoked())
                .ifPresent(token -> token.setRevokedAt(clock.instant()));
    }

    private RefreshToken find(String value) {
        if (value == null || value.isBlank()) {
            throw new BadCredentialsException(INVALID_TOKEN_MESSAGE);
        }
        return refreshTokenRepository.findByTokenHash(hash(value))
                .orElseThrow(() -> new BadCredentialsException(INVALID_TOKEN_MESSAGE));
    }

    static String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is required by every Java platform", e);
        }
    }
}
