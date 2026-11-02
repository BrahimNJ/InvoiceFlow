package com.naji.backend.invoice;

import com.naji.backend.common.exception.ConflictException;
import com.naji.backend.common.exception.ResourceNotFoundException;
import com.naji.backend.common.exception.UnprocessableException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.util.Map;

/**
 * What the payment module may change on an invoice: the amount paid, and the status that follows from it. The invoice
 * row is locked first, so two payments recorded at the same time cannot both fit in the same balance. Runs in the
 * caller's transaction, so that the payment and the invoice are saved together or not at all.
 */
@Component
@RequiredArgsConstructor
@Transactional(propagation = Propagation.MANDATORY)
public class InvoicePayments {

    private final InvoiceRepository invoiceRepository;
    private final Clock clock;

    /**
     * Adds {@code amount} to what the owner's invoice has received; the invoice becomes {@code PAID} when nothing is
     * left to pay. 404 when the invoice does not exist or belongs to someone else, 409 when it is not waiting for
     * payment, 422 when the amount is more than the balance due.
     */
    public void receive(Long ownerId, Long invoiceId, BigDecimal amount) {
        Invoice invoice = lock(ownerId, invoiceId);
        switch (invoice.getStatus()) {
            case DRAFT -> throw new ConflictException("A draft cannot be paid: issue it first");
            case PAID -> throw new ConflictException("Invoice %s is already paid".formatted(invoice.getNumber()));
            case CANCELLED -> throw new ConflictException(
                    "Invoice %s is cancelled: it cannot be paid".formatted(invoice.getNumber()));
            case ISSUED -> {
                // Waiting for payment: go on
            }
        }
        if (amount.compareTo(invoice.getBalance()) > 0) {
            throw new UnprocessableException(
                    "The payment is more than the balance due on invoice %s".formatted(invoice.getNumber()),
                    Map.of("balance", invoice.getBalance()));
        }
        invoice.setAmountPaid(invoice.getAmountPaid().add(amount));
        if (invoice.getBalance().signum() == 0) {
            invoice.setStatus(InvoiceStatus.PAID);
            invoice.setPaidAt(clock.instant());
        }
        invoiceRepository.saveAndFlush(invoice);
    }

    private Invoice lock(Long ownerId, Long invoiceId) {
        return invoiceRepository.lockByIdAndOwnerId(invoiceId, ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice", invoiceId));
    }
}
