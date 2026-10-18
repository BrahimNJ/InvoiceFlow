package com.naji.backend.auth;

import com.naji.backend.auth.dto.LoginRequest;
import com.naji.backend.auth.dto.RegisterRequest;
import com.naji.backend.common.exception.ConflictException;
import com.naji.backend.common.exception.ResourceNotFoundException;
import com.naji.backend.user.Role;
import com.naji.backend.user.User;
import com.naji.backend.user.UserMapper;
import com.naji.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-18T10:00:00Z");
    private static final String PASSWORD = "Correct-horse-42";
    private static final IssuedToken ACCESS = new IssuedToken("access", NOW.plusSeconds(900));
    private static final IssuedToken REFRESH = new IssuedToken("refresh", NOW.plusSeconds(604800));

    @Mock
    private UserRepository userRepository;

    @Mock
    private AccessTokenService accessTokenService;

    @Mock
    private RefreshTokenService refreshTokenService;

    private final PasswordEncoder passwordEncoder = spy(PasswordEncoderFactories.createDelegatingPasswordEncoder());

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, new UserMapper(), passwordEncoder,
                accessTokenService, refreshTokenService, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void register_createsUserWithHashedPasswordAndStartsSession() {
        when(userRepository.saveAndFlush(any(User.class))).thenAnswer(invocation -> {
            User saved = invocation.getArgument(0);
            saved.setId(1L);
            return saved;
        });
        givenTokensAreIssued();

        AuthService.Session session = authService.register(
                new RegisterRequest(" Jane ", " Doe ", "  Jane@ACME.fr ", PASSWORD));

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).saveAndFlush(saved.capture());
        User user = saved.getValue();
        assertThat(user.getEmail()).isEqualTo("jane@acme.fr");
        assertThat(user.getFirstName()).isEqualTo("Jane");
        assertThat(user.getLastName()).isEqualTo("Doe");
        assertThat(user.getRole()).isEqualTo(Role.USER);
        assertThat(user.getPasswordHash()).startsWith("{bcrypt}").doesNotContain(PASSWORD);
        assertThat(passwordEncoder.matches(PASSWORD, user.getPasswordHash())).isTrue();
        assertThat(session.user().email()).isEqualTo("jane@acme.fr");
        assertThat(session.accessToken()).isEqualTo(ACCESS);
        assertThat(session.refreshToken()).isEqualTo(REFRESH);
    }

    @Test
    void register_rejectsTakenEmail() {
        when(userRepository.existsByEmail("jane@acme.fr")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(new RegisterRequest("Jane", "Doe", "JANE@acme.fr", PASSWORD)))
                .isInstanceOf(ConflictException.class)
                .hasMessage(AuthService.EMAIL_TAKEN);
        verify(userRepository, never()).saveAndFlush(any());
    }

    @Test
    void register_turnsAConcurrentDuplicateIntoAConflict() {
        when(userRepository.saveAndFlush(any(User.class))).thenThrow(new DataIntegrityViolationException("uk_users_email"));

        assertThatThrownBy(() -> authService.register(new RegisterRequest("Jane", "Doe", "jane@acme.fr", PASSWORD)))
                .isInstanceOf(ConflictException.class);
        verify(refreshTokenService, never()).create(any());
    }

    @Test
    void login_withValidCredentials_resetsFailedAttemptsAndStartsSession() {
        User user = storedUser();
        user.setFailedLoginAttempts(3);
        givenTokensAreIssued();

        AuthService.Session session = authService.login(new LoginRequest(" JANE@acme.fr", PASSWORD));

        assertThat(session.user().id()).isEqualTo(1L);
        assertThat(user.getFailedLoginAttempts()).isZero();
        assertThat(user.getLockedUntil()).isNull();
    }

    @Test
    void login_withUnknownEmail_failsGenericallyAfterCheckingADummyHash() {
        when(userRepository.findByEmail("nobody@acme.fr")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(new LoginRequest("nobody@acme.fr", PASSWORD)))
                .isInstanceOf(BadCredentialsException.class)
                .hasMessage(AuthService.INVALID_CREDENTIALS);
        // Same hashing work as for a real account: response time does not reveal unknown emails
        verify(passwordEncoder).matches(any(), any());
    }

    @Test
    void login_withWrongPassword_countsTheFailedAttempt() {
        User user = storedUser();

        assertThatThrownBy(() -> authService.login(new LoginRequest("jane@acme.fr", "Wrong-password-1")))
                .isInstanceOf(BadCredentialsException.class)
                .hasMessage(AuthService.INVALID_CREDENTIALS);
        assertThat(user.getFailedLoginAttempts()).isEqualTo(1);
        assertThat(user.getLockedUntil()).isNull();
        verify(refreshTokenService, never()).create(any());
    }

    @Test
    void login_locksTheAccountAfterTooManyFailures() {
        User user = storedUser();
        user.setFailedLoginAttempts(AuthService.MAX_FAILED_ATTEMPTS - 1);

        assertThatThrownBy(() -> authService.login(new LoginRequest("jane@acme.fr", "Wrong-password-1")))
                .isInstanceOf(BadCredentialsException.class);
        assertThat(user.getLockedUntil()).isEqualTo(NOW.plus(AuthService.LOCK_DURATION));
        assertThat(user.getFailedLoginAttempts()).isZero();
    }

    @Test
    void login_refusesALockedAccountEvenWithTheRightPassword() {
        User user = storedUser();
        user.setLockedUntil(NOW.plusSeconds(60));

        assertThatThrownBy(() -> authService.login(new LoginRequest("jane@acme.fr", PASSWORD)))
                .isInstanceOf(LockedException.class)
                .hasMessage(AuthService.ACCOUNT_LOCKED);
        verify(refreshTokenService, never()).create(any());
    }

    @Test
    void login_acceptsTheAccountOnceTheLockHasExpired() {
        User user = storedUser();
        user.setLockedUntil(NOW.minusSeconds(1));
        givenTokensAreIssued();

        authService.login(new LoginRequest("jane@acme.fr", PASSWORD));

        assertThat(user.getLockedUntil()).isNull();
    }

    @Test
    void login_rejectsPasswordsLongerThanBcryptAccepts() {
        storedUser();

        assertThatThrownBy(() -> authService.login(new LoginRequest("jane@acme.fr", "A1" + "a".repeat(80))))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void refresh_rotatesTheRefreshTokenAndIssuesAnAccessToken() {
        User user = storedUserWithoutLookup();
        when(refreshTokenService.rotate("old")).thenReturn(new RefreshTokenService.Rotation(user, REFRESH));
        when(accessTokenService.issue(user)).thenReturn(ACCESS);

        AuthService.Session session = authService.refresh("old");

        assertThat(session.user().id()).isEqualTo(1L);
        assertThat(session.accessToken()).isEqualTo(ACCESS);
        assertThat(session.refreshToken()).isEqualTo(REFRESH);
    }

    @Test
    void logout_revokesTheRefreshToken() {
        authService.logout("current");

        verify(refreshTokenService).revoke("current");
    }

    @Test
    void currentUser_throwsWhenTheAccountNoLongerExists() {
        when(userRepository.findById(42L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.currentUser(42L)).isInstanceOf(ResourceNotFoundException.class);
    }

    private void givenTokensAreIssued() {
        when(accessTokenService.issue(any(User.class))).thenReturn(ACCESS);
        when(refreshTokenService.create(any(User.class))).thenReturn(REFRESH);
    }

    private User storedUser() {
        User user = storedUserWithoutLookup();
        when(userRepository.findByEmail("jane@acme.fr")).thenReturn(Optional.of(user));
        return user;
    }

    private User storedUserWithoutLookup() {
        User user = new User();
        user.setId(1L);
        user.setEmail("jane@acme.fr");
        user.setFirstName("Jane");
        user.setLastName("Doe");
        user.setPasswordHash(passwordEncoder.encode(PASSWORD));
        return user;
    }
}
