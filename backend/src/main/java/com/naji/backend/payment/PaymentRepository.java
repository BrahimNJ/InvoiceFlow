package com.naji.backend.payment;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    /** The payments of the owner's invoice, oldest first (ties by id, in the order they were recorded). */
    List<Payment> findByInvoiceIdAndOwnerIdOrderByDateAscIdAsc(Long invoiceId, Long ownerId);

    /**
     * A payment of the owner, reached through its invoice (a payment id under another invoice is not found), with the
     * row locked until the transaction ends: when the same payment is deleted twice at the same time, the second
     * request waits, then finds nothing (404) instead of giving the amount back to the invoice a second time.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Payment p where p.id = :id and p.invoiceId = :invoiceId and p.ownerId = :ownerId")
    Optional<Payment> lockByIdAndInvoiceIdAndOwnerId(
            @Param("id") Long id, @Param("invoiceId") Long invoiceId, @Param("ownerId") Long ownerId);
}
