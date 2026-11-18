package com.naji.backend.user;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
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
    void search_matchesEmailOrNamesCaseInsensitively() {
        // The in-memory database is shared with integration tests: unique values keep this test isolated
        String tag = java.util.UUID.randomUUID().toString().substring(0, 8);
        userRepository.saveAndFlush(user("jane-" + tag + "@acme.fr"));
        User bob = user("bob-" + tag + "@globex.fr");
        bob.setFirstName("Bob");
        bob.setLastName("Martin" + tag);
        userRepository.saveAndFlush(bob);
        PageRequest firstPage = PageRequest.of(0, 10, Sort.by("email"));

        assertThat(emails(userRepository.search("%jane-" + tag + "@acme%", firstPage)))
                .containsExactly("jane-" + tag + "@acme.fr");
        assertThat(emails(userRepository.search("%martin" + tag + "%", firstPage)))
                .containsExactly("bob-" + tag + "@globex.fr");
        assertThat(emails(userRepository.search("%" + tag + "%", firstPage)))
                .containsExactly("bob-" + tag + "@globex.fr", "jane-" + tag + "@acme.fr");
        assertThat(userRepository.search("%nobody-" + tag + "%", firstPage)).isEmpty();
    }

    @Test
    void lockActiveAdminIds_returnsOnlyActiveAdmins() {
        User admin = user("admin-" + java.util.UUID.randomUUID() + "@acme.fr");
        admin.setRole(Role.ADMIN);
        User suspendedAdmin = user("suspended-" + java.util.UUID.randomUUID() + "@acme.fr");
        suspendedAdmin.setRole(Role.ADMIN);
        suspendedAdmin.setSuspendedAt(Instant.parse("2026-11-18T10:00:00Z"));
        User plainUser = user("user-" + java.util.UUID.randomUUID() + "@acme.fr");
        userRepository.saveAllAndFlush(java.util.List.of(admin, suspendedAdmin, plainUser));

        assertThat(userRepository.lockActiveAdminIds())
                .contains(admin.getId())
                .doesNotContain(suspendedAdmin.getId(), plainUser.getId());
    }

    @Test
    void counts_followRolesSuspensionsAndSignUpDates() {
        // Counted as differences: the in-memory database is shared with other tests
        long admins = userRepository.countByRole(Role.ADMIN);
        long suspended = userRepository.countBySuspendedAtIsNotNull();
        long recent = userRepository.countByCreatedAtGreaterThanEqual(Instant.now().minusSeconds(60));

        User admin = user("count-admin-" + java.util.UUID.randomUUID() + "@acme.fr");
        admin.setRole(Role.ADMIN);
        User suspendedUser = user("count-suspended-" + java.util.UUID.randomUUID() + "@acme.fr");
        suspendedUser.setSuspendedAt(Instant.parse("2026-11-18T10:00:00Z"));
        userRepository.saveAllAndFlush(java.util.List.of(admin, suspendedUser));

        assertThat(userRepository.countByRole(Role.ADMIN)).isEqualTo(admins + 1);
        assertThat(userRepository.countBySuspendedAtIsNotNull()).isEqualTo(suspended + 1);
        assertThat(userRepository.countByCreatedAtGreaterThanEqual(Instant.now().minusSeconds(60)))
                .isEqualTo(recent + 2);
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

    private static java.util.List<String> emails(Page<User> page) {
        return page.map(User::getEmail).getContent();
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
