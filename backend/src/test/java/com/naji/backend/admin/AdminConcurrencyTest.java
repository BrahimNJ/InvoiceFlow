package com.naji.backend.admin;

import com.naji.backend.user.Role;
import com.naji.backend.user.User;
import com.naji.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.RepeatedTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.context.ActiveProfiles;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Two admins acting on each other at the same time, on real transactions: the admin lock makes them run one after the
 * other, and the second one is refused because it is no longer an active admin. The platform keeps one admin.
 */
@SpringBootTest
@ActiveProfiles("test")
class AdminConcurrencyTest {

    @Autowired
    private AdminUserService adminUserService;

    @Autowired
    private UserRepository userRepository;

    private Long alice;
    private Long bob;

    @BeforeEach
    void setUp() {
        alice = admin().getId();
        bob = admin().getId();
    }

    @RepeatedTest(3)
    void twoAdminsDemotingEachOtherCannotBothSucceed() throws Exception {
        List<Throwable> failures = concurrently(
                () -> adminUserService.changeRole(alice, bob, Role.USER),
                () -> adminUserService.changeRole(bob, alice, Role.USER));

        assertThat(failures).singleElement().isInstanceOf(AccessDeniedException.class);
        assertThat(List.of(role(alice), role(bob))).containsExactlyInAnyOrder(Role.ADMIN, Role.USER);
    }

    @RepeatedTest(3)
    void twoAdminsSuspendingEachOtherCannotBothSucceed() throws Exception {
        List<Throwable> failures = concurrently(
                () -> adminUserService.suspend(alice, bob),
                () -> adminUserService.suspend(bob, alice));

        assertThat(failures).singleElement().isInstanceOf(AccessDeniedException.class);
        assertThat(List.of(suspended(alice), suspended(bob))).containsExactlyInAnyOrder(true, false);
    }

    /** Starts both actions together and returns what each one threw (nothing when it succeeded). */
    private static List<Throwable> concurrently(Runnable first, Runnable second) throws InterruptedException {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Void>> futures = new ArrayList<>();
        for (Runnable action : List.of(first, second)) {
            futures.add(executor.submit((Callable<Void>) () -> {
                start.await();
                action.run();
                return null;
            }));
        }
        start.countDown();
        List<Throwable> failures = new ArrayList<>();
        for (Future<Void> future : futures) {
            try {
                future.get();
            } catch (ExecutionException e) {
                failures.add(e.getCause());
            }
        }
        executor.shutdown();
        return failures;
    }

    private Role role(Long id) {
        return userRepository.findById(id).orElseThrow().getRole();
    }

    private boolean suspended(Long id) {
        return userRepository.findById(id).orElseThrow().isSuspended();
    }

    private User admin() {
        User user = new User();
        user.setEmail("concurrent-admin-" + UUID.randomUUID() + "@acme.fr");
        user.setPasswordHash("{bcrypt}$2a$10$hash");
        user.setFirstName("Ada");
        user.setLastName("Admin");
        user.setRole(Role.ADMIN);
        return userRepository.saveAndFlush(user);
    }
}
