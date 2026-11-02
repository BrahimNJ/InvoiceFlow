package com.naji.backend.payment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    /** The payments of the owner's invoice, oldest first (ties by id, in the order they were recorded). */
    List<Payment> findByInvoiceIdAndOwnerIdOrderByDateAscIdAsc(Long invoiceId, Long ownerId);

    /** A payment of the owner, reached through its invoice: a payment id under another invoice is not found. */
    Optional<Payment> findByIdAndInvoiceIdAndOwnerId(Long id, Long invoiceId, Long ownerId);
}
