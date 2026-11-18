package com.naji.backend.user;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A sign-in and an admin action on the same account at the same time, on real transactions: each one writes only the
 * columns it changed, so a failed sign-in that loaded the account before a suspension cannot write it back as active.
 */
@SpringBootTest
@ActiveProfiles("test")
class UserConcurrentUpdateTest {

    private static final Instant SUSPENDED_AT = Instant.parse("2026-11-18T10:00:00Z");

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Test
    void aFailedSignInLoadedBeforeASuspensionDoesNotUndoIt() {
        Long id = newUser().getId();
        TransactionTemplate signIn = new TransactionTemplate(transactionManager);
        TransactionTemplate admin = new TransactionTemplate(transactionManager);
        admin.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);

        signIn.executeWithoutResult(status -> {
            User loadedBySignIn = userRepository.findById(id).orElseThrow();

            // Meanwhile an admin suspends and demotes the account, and commits
            admin.executeWithoutResult(inner -> {
                User loadedByAdmin = userRepository.findById(id).orElseThrow();
                loadedByAdmin.setSuspendedAt(SUSPENDED_AT);
                loadedByAdmin.setRole(Role.USER);
            });

            // The sign-in then counts its failed attempt on the copy it loaded first
            loadedBySignIn.setFailedLoginAttempts(loadedBySignIn.getFailedLoginAttempts() + 1);
        });

        User stored = userRepository.findById(id).orElseThrow();
        assertThat(stored.getSuspendedAt()).isEqualTo(SUSPENDED_AT);
        assertThat(stored.getRole()).isEqualTo(Role.USER);
        assertThat(stored.getFailedLoginAttempts()).isEqualTo(1);
    }

    private User newUser() {
        User user = new User();
        user.setEmail("concurrent-" + UUID.randomUUID() + "@acme.fr");
        user.setPasswordHash("{bcrypt}$2a$10$hash");
        user.setFirstName("Jane");
        user.setLastName("Doe");
        user.setRole(Role.ADMIN);
        return userRepository.saveAndFlush(user);
    }
}
