package com.naji.backend.payment;

import com.naji.backend.common.exception.ResourceNotFoundException;
import com.naji.backend.common.exception.UnprocessableException;
import com.naji.backend.invoice.InvoicePayments;
import com.naji.backend.payment.dto.PaymentRequest;
import com.naji.backend.payment.dto.PaymentResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    private static final Long OWNER_ID = 7L;
    private static final LocalDate DATE = LocalDate.of(2026, 10, 28);

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private InvoicePayments invoicePayments;

    private PaymentService paymentService;

    @BeforeEach
    void setUp() {
        paymentService = new PaymentService(paymentRepository, new PaymentMapper(), invoicePayments);
    }

    @Test
    void record_updatesTheInvoiceThenSavesThePayment() {
        when(paymentRepository.save(any(Payment.class))).thenAnswer(invocation -> {
            Payment saved = invocation.getArgument(0);
            saved.setId(11L);
            return saved;
        });

        PaymentResponse response = paymentService.record(OWNER_ID, 3L, request("450.5"));

        verify(invoicePayments).receive(OWNER_ID, 3L, new BigDecimal("450.50"), DATE);
        assertThat(response.id()).isEqualTo(11L);
        assertThat(response.invoiceId()).isEqualTo(3L);
        assertThat(response.amount()).hasToString("450.50");
    }

    @Test
    void record_savesNothingWhenTheInvoiceRefusesThePayment() {
        doThrow(new UnprocessableException("too much", Map.of()))
                .when(invoicePayments).receive(OWNER_ID, 3L, new BigDecimal("9999.00"), DATE);

        assertThatThrownBy(() -> paymentService.record(OWNER_ID, 3L, request("9999")))
                .isInstanceOf(UnprocessableException.class);
        verify(paymentRepository, never()).save(any());
    }

    @Test
    void findByInvoice_listsThePaymentsOfTheOwnersInvoice() {
        Payment payment = new PaymentMapper().toPayment(OWNER_ID, 3L, request("100"));
        when(paymentRepository.findByInvoiceIdAndOwnerIdOrderByDateAscIdAsc(3L, OWNER_ID)).thenReturn(List.of(payment));

        assertThat(paymentService.findByInvoice(OWNER_ID, 3L))
                .extracting(PaymentResponse::amount)
                .containsExactly(new BigDecimal("100.00"));
        verify(invoicePayments).requireInvoice(OWNER_ID, 3L);
    }

    @Test
    void findByInvoice_throwsWhenTheInvoiceIsMissingOrSomeoneElses() {
        doThrow(new ResourceNotFoundException("Invoice", 42L)).when(invoicePayments).requireInvoice(OWNER_ID, 42L);

        assertThatThrownBy(() -> paymentService.findByInvoice(OWNER_ID, 42L))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(paymentRepository, never()).findByInvoiceIdAndOwnerIdOrderByDateAscIdAsc(any(), any());
    }

    private static PaymentRequest request(String amount) {
        return new PaymentRequest(new BigDecimal(amount), DATE, PaymentMethod.BANK_TRANSFER, null, null);
    }
}
