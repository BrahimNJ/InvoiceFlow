package com.naji.backend.auth;

import com.naji.backend.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.BadCredentialsException;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-18T10:00:00Z");
    private static final Duration TTL = Duration.ofDays(7);

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    private RefreshTokenService service;

    @BeforeEach
    void setUp() {
        service = new RefreshTokenService(
                refreshTokenRepository, new RefreshTokenProperties(TTL), Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void create_storesOnlyTheHashOfARandomToken() {
        IssuedToken issued = service.create(user());

        ArgumentCaptor<RefreshToken> saved = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository).save(saved.capture());
        assertThat(issued.value()).hasSize(43); // 32 bytes, base64url without padding
        assertThat(saved.getValue().getTokenHash())
                .isNotEqualTo(issued.value())
                .isEqualTo(RefreshTokenService.hash(issued.value()))
                .hasSize(64);
        assertThat(issued.expiresAt()).isEqualTo(NOW.plus(TTL));
        assertThat(service.create(user()).value()).isNotEqualTo(issued.value());
    }

    @Test
    void rotate_revokesThePresentedTokenAndIssuesANewOne() {
        RefreshToken current = stored("current", NOW.plusSeconds(60), null);

        RefreshTokenService.Rotation rotation = service.rotate("current");

        assertThat(current.getRevokedAt()).isEqualTo(NOW);
        assertThat(rotation.user()).isSameAs(current.getUser());
        assertThat(rotation.refreshToken().value()).isNotEqualTo("current");
        verify(refreshTokenRepository).save(any(RefreshToken.class));
    }

    @Test
    void rotate_rejectsUnknownToken() {
        when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.rotate("unknown"))
                .isInstanceOf(BadCredentialsException.class)
                .hasMessage("Invalid or expired refresh token");
    }

    @Test
    void rotate_rejectsMissingToken() {
        assertThatThrownBy(() -> service.rotate(null)).isInstanceOf(BadCredentialsException.class);
        assertThatThrownBy(() -> service.rotate(" ")).isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void rotate_rejectsExpiredToken() {
        RefreshToken expired = stored("expired", NOW, null);

        assertThatThrownBy(() -> service.rotate("expired")).isInstanceOf(BadCredentialsException.class);
        assertThat(expired.getRevokedAt()).isNull();
        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    void rotate_revokesEverySessionWhenARevokedTokenIsReused() {
        stored("stolen", NOW.plusSeconds(60), NOW.minusSeconds(10));

        assertThatThrownBy(() -> service.rotate("stolen")).isInstanceOf(BadCredentialsException.class);
        verify(refreshTokenRepository).revokeAllActiveByUserId(1L, NOW);
        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    void revoke_marksTheTokenRevoked() {
        RefreshToken token = stored("current", NOW.plusSeconds(60), null);

        service.revoke("current");

        assertThat(token.getRevokedAt()).isEqualTo(NOW);
    }

    @Test
    void revoke_ignoresMissingOrUnknownTokens() {
        when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.empty());

        service.revoke(null);
        service.revoke("unknown");

        verify(refreshTokenRepository).findByTokenHash(RefreshTokenService.hash("unknown"));
    }

    @Test
    void hash_isSha256Hex() {
        assertThat(RefreshTokenService.hash("abc"))
                .isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }

    private RefreshToken stored(String value, Instant expiresAt, Instant revokedAt) {
        RefreshToken token = new RefreshToken();
        token.setUser(user());
        token.setTokenHash(RefreshTokenService.hash(value));
        token.setExpiresAt(expiresAt);
        token.setRevokedAt(revokedAt);
        when(refreshTokenRepository.findByTokenHash(RefreshTokenService.hash(value))).thenReturn(Optional.of(token));
        return token;
    }

    private static User user() {
        User user = new User();
        user.setId(1L);
        user.setEmail("jane@acme.fr");
        return user;
    }
}
