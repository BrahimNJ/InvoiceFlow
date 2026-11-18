package com.naji.backend.admin;

import com.naji.backend.user.User;
import com.naji.backend.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Runs against the Flyway schema (V11). */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class AdminActionRepositoryTest {

    private static final Instant NOW = Instant.parse("2026-11-18T10:00:00Z");

    @Autowired
    private AdminActionRepository adminActionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void findAll_returnsTheNewestActionsFirst() {
        // Later than any other test's actions, since the in-memory database is shared
        Instant later = Instant.parse("2999-01-01T00:00:00Z");
        Long target = newUser().getId();
        AdminAction first = adminActionRepository.save(
                new AdminAction(null, AdminActionType.PROMOTED_FROM_CONFIG, target, null, later));
        AdminAction second = adminActionRepository.save(
                new AdminAction(target, AdminActionType.ROLE_CHANGED, target, "USER → ADMIN", later.plusSeconds(1)));
        AdminAction sameInstant = adminActionRepository.saveAndFlush(
                new AdminAction(target, AdminActionType.ACCOUNT_SUSPENDED, target, null, later.plusSeconds(1)));

        assertThat(adminActionRepository.findAllByOrderByCreatedAtDescIdDesc(PageRequest.of(0, 3)))
                .extracting(AdminAction::getId)
                .containsExactly(sameInstant.getId(), second.getId(), first.getId());
    }

    @Test
    void database_rejectsAnUnknownAction() {
        Long target = newUser().getId();

        assertThatThrownBy(() -> jdbcTemplate.update(
                "insert into admin_actions (action, target_user_id, created_at) values ('DELETED', ?, ?)",
                target, java.sql.Timestamp.from(NOW)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private User newUser() {
        User user = new User();
        user.setEmail("audit-" + UUID.randomUUID() + "@acme.fr");
        user.setPasswordHash("{bcrypt}$2a$10$hash");
        user.setFirstName("Jane");
        user.setLastName("Doe");
        return userRepository.saveAndFlush(user);
    }
}
