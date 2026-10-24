package com.naji.backend.invoice;

import com.naji.backend.user.User;
import com.naji.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Real transactions on the Flyway schema: each issue commits on its own, like in production. */
@SpringBootTest
@ActiveProfiles("test")
class InvoiceNumberGeneratorTest {

    @Autowired
    private InvoiceNumberGenerator generator;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Autowired
    private UserRepository userRepository;

    private Long ownerId;

    @BeforeEach
    void setUp() {
        ownerId = user().getId();
    }

    @Test
    void numbersAreConsecutivePerOwnerAndYear() {
        Long otherOwnerId = user().getId();

        assertThat(next(ownerId, 2026)).isEqualTo("F-2026-0001");
        assertThat(next(ownerId, 2026)).isEqualTo("F-2026-0002");
        assertThat(next(otherOwnerId, 2026)).isEqualTo("F-2026-0001");
        assertThat(next(ownerId, 2027)).isEqualTo("F-2027-0001");
        assertThat(next(ownerId, 2026)).isEqualTo("F-2026-0003");
    }

    @Test
    void aRolledBackIssueGivesItsNumberBack() {
        transactionTemplate.executeWithoutResult(status -> {
            assertThat(generator.next(ownerId, 2026)).isEqualTo("F-2026-0001");
            status.setRollbackOnly();
        });

        assertThat(next(ownerId, 2026)).isEqualTo("F-2026-0001");
    }

    @Test
    void concurrentIssuesGetDistinctConsecutiveNumbers() throws Exception {
        int threads = 6;
        int perThread = 5;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        Set<String> numbers = ConcurrentHashMap.newKeySet();
        List<Future<?>> futures = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            futures.add(executor.submit((Callable<Void>) () -> {
                start.await();
                for (int n = 0; n < perThread; n++) {
                    numbers.add(next(ownerId, 2026));
                }
                return null;
            }));
        }
        start.countDown();
        for (Future<?> future : futures) {
            future.get();
        }
        executor.shutdown();

        assertThat(numbers).containsExactlyInAnyOrderElementsOf(
                IntStream.rangeClosed(1, threads * perThread).mapToObj(n -> InvoiceNumberGenerator.format(2026, n)).toList());
    }

    @Test
    void refusesToRunOutsideATransaction() {
        assertThatThrownBy(() -> generator.next(ownerId, 2026)).isInstanceOf(IllegalTransactionStateException.class);
    }

    @Test
    void formatPadsToFourDigitsAndThenGrows() {
        assertThat(InvoiceNumberGenerator.format(2026, 42)).isEqualTo("F-2026-0042");
        assertThat(InvoiceNumberGenerator.format(2026, 12345)).isEqualTo("F-2026-12345");
    }

    private String next(Long owner, int year) {
        return transactionTemplate.execute(status -> generator.next(owner, year));
    }

    private User user() {
        User user = new User();
        user.setEmail("user-" + UUID.randomUUID() + "@acme.fr");
        user.setPasswordHash("{bcrypt}$2a$10$hash");
        user.setFirstName("Jane");
        user.setLastName("Doe");
        return userRepository.saveAndFlush(user);
    }
}
