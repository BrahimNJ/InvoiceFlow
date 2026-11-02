package com.naji.backend.payment;

import com.naji.backend.invoice.Invoice;
import com.naji.backend.invoice.InvoiceRepository;
import com.naji.backend.invoice.InvoiceStatus;
import com.naji.backend.invoice.PaymentTerms;
import com.naji.backend.user.User;
import com.naji.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Runs the payment queries on the Flyway schema (V8): order, owner scoping and constraints. */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class PaymentRepositoryTest {

    private static final LocalDate ISSUE_DATE = LocalDate.of(2026, 10, 1);

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private UserRepository userRepository;

    private Long ownerId;
    private Long otherOwnerId;
    private Long invoiceId;

    @BeforeEach
    void setUp() {
        ownerId = user().getId();
        otherOwnerId = user().getId();
        invoiceId = invoice(ownerId, "F-2026-0001");
    }

    @Test
    void listsTheInvoicePaymentsOldestFirst() {
        Long late = save(payment(ownerId, invoiceId, "300.00", ISSUE_DATE.plusDays(10))).getId();
        Long first = save(payment(ownerId, invoiceId, "100.00", ISSUE_DATE.plusDays(2))).getId();
        Long sameDay = save(payment(ownerId, invoiceId, "50.00", ISSUE_DATE.plusDays(10))).getId();
        save(payment(ownerId, invoice(ownerId, "F-2026-0002"), "999.00", ISSUE_DATE));

        assertThat(paymentRepository.findByInvoiceIdAndOwnerIdOrderByDateAscIdAsc(invoiceId, ownerId))
                .extracting(Payment::getId)
                .containsExactly(first, late, sameDay);
    }

    @Test
    void onlyReachesTheOwnersPaymentsUnderTheirInvoice() {
        Long id = save(payment(ownerId, invoiceId, "100.00", ISSUE_DATE)).getId();
        Long otherInvoice = invoice(ownerId, "F-2026-0002");

        assertThat(paymentRepository.findByIdAndInvoiceIdAndOwnerId(id, invoiceId, ownerId)).isPresent();
        assertThat(paymentRepository.findByIdAndInvoiceIdAndOwnerId(id, invoiceId, otherOwnerId)).isEmpty();
        assertThat(paymentRepository.findByIdAndInvoiceIdAndOwnerId(id, otherInvoice, ownerId)).isEmpty();
        assertThat(paymentRepository.findByInvoiceIdAndOwnerIdOrderByDateAscIdAsc(invoiceId, otherOwnerId)).isEmpty();
    }

    @Test
    void storesTheExactAmountAndTheOptionalDetails() {
        Payment payment = payment(ownerId, invoiceId, "1234.56", ISSUE_DATE);
        payment.setReference("VIR ACME 0042");
        payment.setNote("First instalment");
        Long id = save(payment).getId();

        Payment loaded = paymentRepository.findById(id).orElseThrow();

        assertThat(loaded.getAmount()).isEqualByComparingTo("1234.56");
        assertThat(loaded.getMethod()).isEqualTo(PaymentMethod.BANK_TRANSFER);
        assertThat(loaded.getReference()).isEqualTo("VIR ACME 0042");
        assertThat(loaded.getCreatedAt()).isNotNull();
    }

    @Test
    void rejectsAZeroAmount() {
        assertThatThrownBy(() -> save(payment(ownerId, invoiceId, "0.00", ISSUE_DATE)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void rejectsAPaymentOfAMissingInvoice() {
        assertThatThrownBy(() -> save(payment(ownerId, 999_999L, "10.00", ISSUE_DATE)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private Payment save(Payment payment) {
        return paymentRepository.saveAndFlush(payment);
    }

    private static Payment payment(Long owner, Long invoice, String amount, LocalDate date) {
        Payment payment = new Payment();
        payment.setOwnerId(owner);
        payment.setInvoiceId(invoice);
        payment.setAmount(new BigDecimal(amount));
        payment.setDate(date);
        payment.setMethod(PaymentMethod.BANK_TRANSFER);
        return payment;
    }

    private Long invoice(Long owner, String number) {
        Invoice invoice = new Invoice();
        invoice.setOwnerId(owner);
        invoice.setPaymentTerms(PaymentTerms.NET_30);
        invoice.setStatus(InvoiceStatus.ISSUED);
        invoice.setNumber(number);
        invoice.setIssueDate(ISSUE_DATE);
        invoice.setDueDate(ISSUE_DATE.plusDays(30));
        invoice.setTotal(new BigDecimal("5000.00"));
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
