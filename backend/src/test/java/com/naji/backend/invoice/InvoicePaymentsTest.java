package com.naji.backend.invoice;

import com.naji.backend.common.exception.ConflictException;
import com.naji.backend.common.exception.ResourceNotFoundException;
import com.naji.backend.common.exception.UnprocessableException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InvoicePaymentsTest {

    private static final Long OWNER_ID = 7L;
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-11-02T10:00:00Z"), ZoneOffset.UTC);
    private static final LocalDate ISSUE_DATE = LocalDate.of(2026, 10, 20);
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 2);

    @Mock
    private InvoiceRepository invoiceRepository;

    private InvoicePayments invoicePayments;

    @BeforeEach
    void setUp() {
        invoicePayments = new InvoicePayments(invoiceRepository, CLOCK);
    }

    @Test
    void receive_addsToTheAmountPaidAndKeepsAPartlyPaidInvoiceIssued() {
        Invoice invoice = issued("1200.00");
        when(invoiceRepository.lockByIdAndOwnerId(1L, OWNER_ID)).thenReturn(Optional.of(invoice));

        invoicePayments.receive(OWNER_ID, 1L, new BigDecimal("500.00"), TODAY);

        assertThat(invoice.getAmountPaid()).hasToString("500.00");
        assertThat(invoice.getBalance()).hasToString("700.00");
        assertThat(invoice.getStatus()).isEqualTo(InvoiceStatus.ISSUED);
        assertThat(invoice.getPaidAt()).isNull();
        verify(invoiceRepository).saveAndFlush(invoice);
    }

    @Test
    void receive_marksTheInvoicePaidWhenTheBalanceReachesZero() {
        Invoice invoice = issued("1200.00");
        invoice.setAmountPaid(new BigDecimal("500.00"));
        when(invoiceRepository.lockByIdAndOwnerId(1L, OWNER_ID)).thenReturn(Optional.of(invoice));

        invoicePayments.receive(OWNER_ID, 1L, new BigDecimal("700.00"), TODAY);

        assertThat(invoice.getBalance()).isZero();
        assertThat(invoice.getStatus()).isEqualTo(InvoiceStatus.PAID);
        assertThat(invoice.getPaidAt()).isEqualTo(CLOCK.instant());
    }

    @Test
    void receive_refusesMoreThanTheBalance() {
        Invoice invoice = issued("1200.00");
        invoice.setAmountPaid(new BigDecimal("1000.00"));
        when(invoiceRepository.lockByIdAndOwnerId(1L, OWNER_ID)).thenReturn(Optional.of(invoice));

        assertThatThrownBy(() -> invoicePayments.receive(OWNER_ID, 1L, new BigDecimal("200.01"), TODAY))
                .isInstanceOf(UnprocessableException.class)
                .hasMessage("The payment is more than the balance due on invoice F-2026-0001")
                .satisfies(e -> assertThat(((UnprocessableException) e).getProperties())
                        .containsEntry("balance", new BigDecimal("200.00")));
        assertThat(invoice.getAmountPaid()).hasToString("1000.00");
        verify(invoiceRepository, never()).saveAndFlush(any());
    }

    @Test
    void receive_acceptsTheIssueDateAndToday() {
        Invoice invoice = issued("1200.00");
        when(invoiceRepository.lockByIdAndOwnerId(1L, OWNER_ID)).thenReturn(Optional.of(invoice));

        invoicePayments.receive(OWNER_ID, 1L, new BigDecimal("100.00"), ISSUE_DATE);
        invoicePayments.receive(OWNER_ID, 1L, new BigDecimal("100.00"), TODAY);

        assertThat(invoice.getAmountPaid()).hasToString("200.00");
    }

    @Test
    void receive_refusesADateBeforeTheIssueDateOrInTheFuture() {
        Invoice invoice = issued("1200.00");
        when(invoiceRepository.lockByIdAndOwnerId(1L, OWNER_ID)).thenReturn(Optional.of(invoice));

        assertThatThrownBy(() -> invoicePayments.receive(OWNER_ID, 1L, BigDecimal.ONE, ISSUE_DATE.minusDays(1)))
                .isInstanceOf(UnprocessableException.class)
                .hasMessage("A payment must be dated between the issue date of invoice F-2026-0001 and today");
        assertThatThrownBy(() -> invoicePayments.receive(OWNER_ID, 1L, BigDecimal.ONE, TODAY.plusDays(1)))
                .isInstanceOf(UnprocessableException.class);
        verify(invoiceRepository, never()).saveAndFlush(any());
    }

    @Test
    void receive_refusesAnInvoiceThatIsNotWaitingForPayment() {
        Invoice draft = new Invoice();
        Invoice paid = issued("100.00");
        paid.setStatus(InvoiceStatus.PAID);
        Invoice cancelled = issued("100.00");
        cancelled.setStatus(InvoiceStatus.CANCELLED);
        when(invoiceRepository.lockByIdAndOwnerId(1L, OWNER_ID)).thenReturn(Optional.of(draft));
        when(invoiceRepository.lockByIdAndOwnerId(2L, OWNER_ID)).thenReturn(Optional.of(paid));
        when(invoiceRepository.lockByIdAndOwnerId(3L, OWNER_ID)).thenReturn(Optional.of(cancelled));

        assertThatThrownBy(() -> invoicePayments.receive(OWNER_ID, 1L, BigDecimal.ONE, TODAY))
                .isInstanceOf(ConflictException.class)
                .hasMessage("A draft cannot be paid: issue it first");
        assertThatThrownBy(() -> invoicePayments.receive(OWNER_ID, 2L, BigDecimal.ONE, TODAY))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Invoice F-2026-0001 is already paid");
        assertThatThrownBy(() -> invoicePayments.receive(OWNER_ID, 3L, BigDecimal.ONE, TODAY))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Invoice F-2026-0001 is cancelled: it cannot be paid");
        verify(invoiceRepository, never()).saveAndFlush(any());
    }

    @Test
    void receive_throwsWhenTheInvoiceIsMissingOrSomeoneElses() {
        when(invoiceRepository.lockByIdAndOwnerId(42L, OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> invoicePayments.receive(OWNER_ID, 42L, BigDecimal.ONE, TODAY))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void giveBack_takesThePaymentBackAndReopensAPaidInvoice() {
        Invoice invoice = issued("1200.00");
        invoice.setAmountPaid(new BigDecimal("1200.00"));
        invoice.setStatus(InvoiceStatus.PAID);
        invoice.setPaidAt(CLOCK.instant());
        when(invoiceRepository.lockByIdAndOwnerId(1L, OWNER_ID)).thenReturn(Optional.of(invoice));

        invoicePayments.giveBack(OWNER_ID, 1L, new BigDecimal("200.00"));

        assertThat(invoice.getAmountPaid()).hasToString("1000.00");
        assertThat(invoice.getBalance()).hasToString("200.00");
        assertThat(invoice.getStatus()).isEqualTo(InvoiceStatus.ISSUED);
        assertThat(invoice.getPaidAt()).isNull();
        verify(invoiceRepository).saveAndFlush(invoice);
    }

    @Test
    void giveBack_refusesMoreThanTheInvoiceReceived() {
        Invoice invoice = issued("1200.00");
        invoice.setAmountPaid(new BigDecimal("100.00"));
        when(invoiceRepository.lockByIdAndOwnerId(1L, OWNER_ID)).thenReturn(Optional.of(invoice));

        assertThatThrownBy(() -> invoicePayments.giveBack(OWNER_ID, 1L, new BigDecimal("100.01")))
                .isInstanceOf(IllegalStateException.class);
        verify(invoiceRepository, never()).saveAndFlush(any());
    }

    @Test
    void giveBack_throwsWhenTheInvoiceIsMissingOrSomeoneElses() {
        when(invoiceRepository.lockByIdAndOwnerId(42L, OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> invoicePayments.giveBack(OWNER_ID, 42L, BigDecimal.ONE))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    private static Invoice issued(String total) {
        Invoice invoice = new Invoice();
        invoice.setId(1L);
        invoice.setOwnerId(OWNER_ID);
        invoice.setPaymentTerms(PaymentTerms.NET_30);
        invoice.setStatus(InvoiceStatus.ISSUED);
        invoice.setNumber("F-2026-0001");
        invoice.setIssueDate(ISSUE_DATE);
        invoice.setDueDate(ISSUE_DATE.plusDays(30));
        invoice.setTotal(new BigDecimal(total));
        invoice.setAmountPaid(new BigDecimal("0.00"));
        return invoice;
    }
}
