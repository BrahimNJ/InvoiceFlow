package com.naji.backend.invoice;

import com.naji.backend.invoice.dto.InvoiceTotals;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Optional;

public interface InvoiceRepository extends JpaRepository<Invoice, Long> {

    /**
     * Invoices of an owner whose number or customer name matches a lower-case {@code LIKE} pattern
     * ({@code !} escapes {@code %}, {@code _} and itself; {@code %} matches every invoice). Every other filter is
     * ignored when {@code null}: {@code status}, {@code dueBefore} (due date strictly before, for overdue invoices),
     * {@code customerId}, and the issue date range {@code issuedFrom} to {@code issuedTo} (inclusive).
     */
    @Query("""
            select i from Invoice i
            where i.ownerId = :ownerId
              and (:status is null or i.status = :status)
              and (:dueBefore is null or i.dueDate < :dueBefore)
              and (:customerId is null or i.customerId = :customerId)
              and (:issuedFrom is null or i.issueDate >= :issuedFrom)
              and (:issuedTo is null or i.issueDate <= :issuedTo)
              and (lower(coalesce(i.number, '')) like :pattern escape '!'
                   or lower(coalesce(i.customer.name, '')) like :pattern escape '!')
            """)
    Page<Invoice> search(
            @Param("ownerId") Long ownerId,
            @Param("pattern") String pattern,
            @Param("status") InvoiceStatus status,
            @Param("dueBefore") LocalDate dueBefore,
            @Param("customerId") Long customerId,
            @Param("issuedFrom") LocalDate issuedFrom,
            @Param("issuedTo") LocalDate issuedTo,
            Pageable pageable);

    Optional<Invoice> findByIdAndOwnerId(Long id, Long ownerId);

    /**
     * Count and total including VAT of the owner's invoices in a status, optionally due strictly before
     * {@code dueBefore} and issued on or after {@code issuedFrom} ({@code null}: no limit).
     */
    @Query("""
            select new com.naji.backend.invoice.dto.InvoiceTotals(count(i), sum(i.total)) from Invoice i
            where i.ownerId = :ownerId
              and i.status = :status
              and (:dueBefore is null or i.dueDate < :dueBefore)
              and (:issuedFrom is null or i.issueDate >= :issuedFrom)
            """)
    InvoiceTotals totals(
            @Param("ownerId") Long ownerId,
            @Param("status") InvoiceStatus status,
            @Param("dueBefore") LocalDate dueBefore,
            @Param("issuedFrom") LocalDate issuedFrom);

    /**
     * Same as {@link #findByIdAndOwnerId}, with the row locked until the transaction ends: two requests changing the
     * status of the same invoice run one after the other (an invoice is never issued twice, burning a number).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Invoice i where i.id = :id and i.ownerId = :ownerId")
    Optional<Invoice> lockByIdAndOwnerId(@Param("id") Long id, @Param("ownerId") Long ownerId);
}
