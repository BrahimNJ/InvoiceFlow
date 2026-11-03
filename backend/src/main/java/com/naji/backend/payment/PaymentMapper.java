package com.naji.backend.payment;

import com.naji.backend.payment.dto.PaymentRequest;
import com.naji.backend.payment.dto.PaymentResponse;
import org.springframework.stereotype.Component;

import java.math.RoundingMode;

@Component
public class PaymentMapper {

    /** A new payment of the owner's invoice; the amount is already validated to have at most 2 decimals. */
    public Payment toPayment(Long ownerId, Long invoiceId, PaymentRequest request) {
        Payment payment = new Payment();
        payment.setOwnerId(ownerId);
        payment.setInvoiceId(invoiceId);
        payment.setAmount(request.amount().setScale(2, RoundingMode.UNNECESSARY));
        payment.setDate(request.date());
        payment.setMethod(request.method());
        payment.setReference(blankToNull(request.reference()));
        payment.setNote(blankToNull(request.note()));
        return payment;
    }

    public PaymentResponse toResponse(Payment payment) {
        return new PaymentResponse(
                payment.getId(),
                payment.getInvoiceId(),
                payment.getAmount(),
                payment.getDate(),
                payment.getMethod(),
                payment.getReference(),
                payment.getNote(),
                payment.getCreatedAt()
        );
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
