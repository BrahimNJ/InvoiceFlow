package com.naji.backend.user;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Runs against the Flyway schema to check the mapping and the database constraints. */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class UserRepositoryTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void save_persistsUserWithDefaults() {
        User saved = userRepository.saveAndFlush(user("jane@acme.fr"));

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getRole()).isEqualTo(Role.USER);
        assertThat(saved.getFailedLoginAttempts()).isZero();
        assertThat(saved.isSuspended()).isFalse();
        assertThat(saved.isAdmin()).isFalse();
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(userRepository.findByEmail("jane@acme.fr")).isPresent();
        assertThat(userRepository.existsByEmail("jane@acme.fr")).isTrue();
    }

    @Test
    void save_rejectsDuplicateEmail() {
        userRepository.saveAndFlush(user("jane@acme.fr"));

        assertThatThrownBy(() -> userRepository.saveAndFlush(user("jane@acme.fr")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void save_keepsTheSuspensionDate() {
        User user = user("jane@acme.fr");
        user.setSuspendedAt(Instant.parse("2026-11-18T10:00:00Z"));

        User saved = userRepository.saveAndFlush(user);

        assertThat(userRepository.findById(saved.getId())).get()
                .satisfies(found -> assertThat(found.isSuspended()).isTrue());
    }

    @Test
    void database_rejectsAnUnknownRole() {
        User saved = userRepository.saveAndFlush(user("jane@acme.fr"));

        assertThatThrownBy(() -> jdbcTemplate.update("update users set role = 'ROOT' where id = ?", saved.getId()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void normalizeEmail_trimsAndLowerCases() {
        assertThat(User.normalizeEmail("  Jane.Doe@ACME.fr ")).isEqualTo("jane.doe@acme.fr");
    }

    @Test
    void isLocked_onlyBeforeLockExpiry() {
        Instant now = Instant.parse("2026-10-18T10:00:00Z");
        User user = user("jane@acme.fr");

        assertThat(user.isLocked(now)).isFalse();
        user.setLockedUntil(now.plusSeconds(60));
        assertThat(user.isLocked(now)).isTrue();
        assertThat(user.isLocked(now.plusSeconds(61))).isFalse();
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
