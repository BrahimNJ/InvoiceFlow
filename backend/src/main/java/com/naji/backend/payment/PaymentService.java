package com.naji.backend.payment;

import com.naji.backend.invoice.InvoicePayments;
import com.naji.backend.payment.dto.PaymentRequest;
import com.naji.backend.payment.dto.PaymentResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Payments received on the owner's invoices. The invoice module checks and updates the invoice (status, balance,
 * dates) in the same transaction, so a payment and the amount paid on its invoice never disagree. Another user's
 * invoice or payment is reported as not found.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final PaymentMapper paymentMapper;
    private final InvoicePayments invoicePayments;

    /** The payments of the owner's invoice, oldest first; 404 when the invoice is missing or someone else's. */
    public List<PaymentResponse> findByInvoice(Long ownerId, Long invoiceId) {
        invoicePayments.requireInvoice(ownerId, invoiceId);
        return paymentRepository.findByInvoiceIdAndOwnerIdOrderByDateAscIdAsc(invoiceId, ownerId).stream()
                .map(paymentMapper::toResponse)
                .toList();
    }

    /** 404, 409 or 422 from {@link InvoicePayments#receive} when the invoice cannot take this payment. */
    @Transactional
    public PaymentResponse record(Long ownerId, Long invoiceId, PaymentRequest request) {
        Payment payment = paymentMapper.toPayment(ownerId, invoiceId, request);
        invoicePayments.receive(ownerId, invoiceId, payment.getAmount(), payment.getDate());
        return paymentMapper.toResponse(paymentRepository.save(payment));
    }
}
