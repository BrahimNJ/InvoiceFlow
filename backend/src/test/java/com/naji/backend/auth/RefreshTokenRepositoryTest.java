package com.naji.backend.auth;

import com.naji.backend.user.User;
import com.naji.backend.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/** Runs against the Flyway schema (V3) to check the mapping and the bulk revocation query. */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class RefreshTokenRepositoryTest {

    private static final Instant NOW = Instant.parse("2026-10-18T10:00:00Z");

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TestEntityManager entityManager;

    @Test
    void findByTokenHash_returnsTheStoredToken() {
        User jane = userRepository.save(user("jane@acme.fr"));
        refreshTokenRepository.saveAndFlush(token(jane, "a".repeat(64), null));

        assertThat(refreshTokenRepository.findByTokenHash("a".repeat(64)))
                .hasValueSatisfying(token -> assertThat(token.getUser().getId()).isEqualTo(jane.getId()));
        assertThat(refreshTokenRepository.findByTokenHash("b".repeat(64))).isEmpty();
    }

    @Test
    void revokeAllActiveByUserId_onlyRevokesActiveTokensOfThatUser() {
        User jane = userRepository.save(user("jane@acme.fr"));
        User john = userRepository.save(user("john@acme.fr"));
        RefreshToken janeActive = refreshTokenRepository.save(token(jane, "1".repeat(64), null));
        RefreshToken janeRevoked = refreshTokenRepository.save(token(jane, "2".repeat(64), NOW.minusSeconds(60)));
        RefreshToken johnActive = refreshTokenRepository.save(token(john, "3".repeat(64), null));
        entityManager.flush();

        int revoked = refreshTokenRepository.revokeAllActiveByUserId(jane.getId(), NOW);
        entityManager.clear();

        assertThat(revoked).isEqualTo(1);
        assertThat(refreshTokenRepository.findById(janeActive.getId()).orElseThrow().getRevokedAt()).isEqualTo(NOW);
        assertThat(refreshTokenRepository.findById(janeRevoked.getId()).orElseThrow().getRevokedAt())
                .isEqualTo(NOW.minusSeconds(60));
        assertThat(refreshTokenRepository.findById(johnActive.getId()).orElseThrow().getRevokedAt()).isNull();
    }

    private static RefreshToken token(User user, String hash, Instant revokedAt) {
        RefreshToken token = new RefreshToken();
        token.setUser(user);
        token.setTokenHash(hash);
        token.setExpiresAt(NOW.plusSeconds(3600));
        token.setRevokedAt(revokedAt);
        return token;
    }

    private static User user(String email) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash("{bcrypt}$2a$10$hash");
        user.setFirstName("Jane");
        user.setLastName("Doe");
        return user;
    }
}
