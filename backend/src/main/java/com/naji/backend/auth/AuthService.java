package com.naji.backend.auth;

import com.naji.backend.auth.dto.LoginRequest;
import com.naji.backend.auth.dto.RegisterRequest;
import com.naji.backend.common.exception.ConflictException;
import com.naji.backend.common.exception.ResourceNotFoundException;
import com.naji.backend.common.validation.StrongPasswordValidator;
import com.naji.backend.user.User;
import com.naji.backend.user.UserMapper;
import com.naji.backend.user.UserRepository;
import com.naji.backend.user.dto.UserResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

/**
 * Registration, sign-in, token refresh and sign-out.
 * Transactions commit even when authentication fails, so failed attempts and revocations are kept.
 */
@Slf4j
@Service
@Transactional(noRollbackFor = AuthenticationException.class)
public class AuthService {

    static final int MAX_FAILED_ATTEMPTS = 5;
    static final Duration LOCK_DURATION = Duration.ofMinutes(15);
    static final String INVALID_CREDENTIALS = "Invalid email or password";
    static final String ACCOUNT_LOCKED = "Too many failed sign-in attempts. Try again in 15 minutes.";
    static final String EMAIL_TAKEN = "An account already exists with this email";

    private final UserRepository userRepository;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final AccessTokenService accessTokenService;
    private final RefreshTokenService refreshTokenService;
    private final Clock clock;

    /** Checked when the email is unknown, so the response time does not reveal which accounts exist. */
    private final String dummyPasswordHash;

    public AuthService(UserRepository userRepository, UserMapper userMapper, PasswordEncoder passwordEncoder,
                       AccessTokenService accessTokenService, RefreshTokenService refreshTokenService, Clock clock) {
        this.userRepository = userRepository;
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
        this.accessTokenService = accessTokenService;
        this.refreshTokenService = refreshTokenService;
        this.clock = clock;
        this.dummyPasswordHash = passwordEncoder.encode("dummy-password-for-timing-only");
    }

    /** What the controller sends back: the user, the access token (body) and the refresh token (cookie). */
    public record Session(UserResponse user, IssuedToken accessToken, IssuedToken refreshToken) {
    }

    public Session register(RegisterRequest request) {
        String email = User.normalizeEmail(request.email());
        if (userRepository.existsByEmail(email)) {
            throw new ConflictException(EMAIL_TAKEN);
        }

        User user = new User();
        user.setEmail(email);
        user.setFirstName(request.firstName().trim());
        user.setLastName(request.lastName().trim());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        try {
            user = userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            // Two registrations with the same email at the same time: the unique constraint decides
            throw new ConflictException(EMAIL_TAKEN);
        }
        return startSession(user);
    }

    public Session login(LoginRequest request) {
        Instant now = clock.instant();
        User user = userRepository.findByEmail(User.normalizeEmail(request.email())).orElse(null);

        if (user == null) {
            passwordEncoder.matches(request.password(), dummyPasswordHash);
            throw new BadCredentialsException(INVALID_CREDENTIALS);
        }
        if (user.isLocked(now)) {
            throw new LockedException(ACCOUNT_LOCKED);
        }
        if (!passwordMatches(request.password(), user.getPasswordHash())) {
            recordFailedAttempt(user, now);
            throw new BadCredentialsException(INVALID_CREDENTIALS);
        }

        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        if (passwordEncoder.upgradeEncoding(user.getPasswordHash())) {
            user.setPasswordHash(passwordEncoder.encode(request.password()));
        }
        return startSession(user);
    }

    public Session refresh(String refreshToken) {
        RefreshTokenService.Rotation rotation = refreshTokenService.rotate(refreshToken);
        User user = rotation.user();
        return new Session(userMapper.toResponse(user), accessTokenService.issue(user), rotation.refreshToken());
    }

    public void logout(String refreshToken) {
        refreshTokenService.revoke(refreshToken);
    }

    @Transactional(readOnly = true)
    public UserResponse currentUser(Long userId) {
        return userRepository.findById(userId)
                .map(userMapper::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
    }

    private Session startSession(User user) {
        return new Session(userMapper.toResponse(user), accessTokenService.issue(user), refreshTokenService.create(user));
    }

    /** BCrypt only reads the first 72 bytes: a longer password can never match a stored hash. */
    private boolean passwordMatches(String rawPassword, String passwordHash) {
        return rawPassword.getBytes(StandardCharsets.UTF_8).length <= StrongPasswordValidator.MAX_BYTES
                && passwordEncoder.matches(rawPassword, passwordHash);
    }

    private void recordFailedAttempt(User user, Instant now) {
        int attempts = user.getFailedLoginAttempts() + 1;
        if (attempts >= MAX_FAILED_ATTEMPTS) {
            user.setFailedLoginAttempts(0);
            user.setLockedUntil(now.plus(LOCK_DURATION));
            log.warn("User {} locked for {} after {} failed sign-in attempts", user.getId(), LOCK_DURATION, attempts);
        } else {
            user.setFailedLoginAttempts(attempts);
        }
    }
}
