package com.naji.backend.payment;

import com.naji.backend.payment.dto.PaymentRequest;
import com.naji.backend.payment.dto.PaymentResponse;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class PaymentMapperTest {

    private static final LocalDate DATE = LocalDate.of(2026, 10, 28);

    private final PaymentMapper mapper = new PaymentMapper();

    @Test
    void toPayment_writesTheOwnerTheInvoiceAndTwoDecimalAmount() {
        Payment payment = mapper.toPayment(7L, 3L, new PaymentRequest(new BigDecimal("450.5"), DATE,
                PaymentMethod.CHEQUE, "  Cheque 0012345 ", "  Second instalment  "));

        assertThat(payment.getOwnerId()).isEqualTo(7L);
        assertThat(payment.getInvoiceId()).isEqualTo(3L);
        assertThat(payment.getAmount()).hasToString("450.50");
        assertThat(payment.getDate()).isEqualTo(DATE);
        assertThat(payment.getMethod()).isEqualTo(PaymentMethod.CHEQUE);
        assertThat(payment.getReference()).isEqualTo("Cheque 0012345");
        assertThat(payment.getNote()).isEqualTo("Second instalment");
    }

    @Test
    void toPayment_dropsBlankReferenceAndNote() {
        Payment payment = mapper.toPayment(7L, 3L, new PaymentRequest(BigDecimal.TEN, DATE, PaymentMethod.CASH, " ", null));

        assertThat(payment.getReference()).isNull();
        assertThat(payment.getNote()).isNull();
    }

    @Test
    void toResponse_copiesEveryField() {
        Payment payment = mapper.toPayment(7L, 3L, new PaymentRequest(new BigDecimal("99.90"), DATE,
                PaymentMethod.CARD, "CB 4242", null));
        payment.setId(11L);

        PaymentResponse response = mapper.toResponse(payment);

        assertThat(response).isEqualTo(new PaymentResponse(11L, 3L, new BigDecimal("99.90"), DATE, PaymentMethod.CARD,
                "CB 4242", null, null));
    }
}
