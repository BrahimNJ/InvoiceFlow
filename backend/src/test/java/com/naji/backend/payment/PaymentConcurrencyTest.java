package com.naji.backend.payment;

import com.naji.backend.common.exception.ResourceNotFoundException;
import com.naji.backend.common.exception.UnprocessableException;
import com.naji.backend.invoice.Invoice;
import com.naji.backend.invoice.InvoiceRepository;
import com.naji.backend.invoice.InvoiceService;
import com.naji.backend.invoice.InvoiceStatus;
import com.naji.backend.invoice.PaymentTerms;
import com.naji.backend.payment.dto.PaymentRequest;
import com.naji.backend.user.User;
import com.naji.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDate;
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
 * Two requests on the same invoice at the same time, on real transactions: the invoice and payment row locks make
 * them run one after the other, so the amount paid always equals the sum of the payments.
 */
@SpringBootTest
@ActiveProfiles("test")
class PaymentConcurrencyTest {

    private static final LocalDate TODAY = LocalDate.now(InvoiceService.ZONE);

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private UserRepository userRepository;

    private Long ownerId;
    private Long invoiceId;

    @BeforeEach
    void setUp() {
        ownerId = user().getId();
        invoiceId = issuedInvoice("100.00");
    }

    @Test
    void twoPaymentsThatExceedTheBalanceTogetherCannotBothBeRecorded() throws Exception {
        List<Throwable> failures = concurrently(
                () -> paymentService.record(ownerId, invoiceId, payment("60.00")),
                () -> paymentService.record(ownerId, invoiceId, payment("60.00")));

        assertThat(failures).singleElement().isInstanceOf(UnprocessableException.class);
        assertThat(amountPaid()).isEqualByComparingTo("60.00");
        assertThat(paymentService.findByInvoice(ownerId, invoiceId)).hasSize(1);
    }

    @Test
    void thePaymentDeletedTwiceAtOnceIsGivenBackOnce() throws Exception {
        Long first = paymentService.record(ownerId, invoiceId, payment("50.00")).id();
        paymentService.record(ownerId, invoiceId, payment("50.00"));

        List<Throwable> failures = concurrently(
                () -> paymentService.delete(ownerId, invoiceId, first),
                () -> paymentService.delete(ownerId, invoiceId, first));

        assertThat(failures).singleElement().isInstanceOf(ResourceNotFoundException.class);
        assertThat(amountPaid()).isEqualByComparingTo("50.00");
        Invoice invoice = invoiceRepository.findById(invoiceId).orElseThrow();
        assertThat(invoice.getStatus()).isEqualTo(InvoiceStatus.ISSUED);
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

    private BigDecimal amountPaid() {
        return invoiceRepository.findById(invoiceId).orElseThrow().getAmountPaid();
    }

    private static PaymentRequest payment(String amount) {
        return new PaymentRequest(new BigDecimal(amount), TODAY, PaymentMethod.BANK_TRANSFER, null, null);
    }

    private Long issuedInvoice(String total) {
        Invoice invoice = new Invoice();
        invoice.setOwnerId(ownerId);
        invoice.setPaymentTerms(PaymentTerms.NET_30);
        invoice.setStatus(InvoiceStatus.ISSUED);
        invoice.setNumber("F-2026-0001");
        invoice.setIssueDate(TODAY);
        invoice.setDueDate(TODAY.plusDays(30));
        invoice.setTotal(new BigDecimal(total));
        return invoiceRepository.saveAndFlush(invoice).getId();
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
