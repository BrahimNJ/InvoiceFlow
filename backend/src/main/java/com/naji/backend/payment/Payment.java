package com.naji.backend.payment;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * A payment received on an issued invoice. Never edited: a mistake is deleted and recorded again, so that the amount
 * paid on the invoice only ever changes by whole payments.
 */
@Entity
@Table(name = "payments")
@Getter
@Setter
@NoArgsConstructor
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Id of the user who owns this payment and its invoice (JWT subject). */
    @Column(nullable = false, updatable = false)
    private Long ownerId;

    /** The paid invoice; referenced by id, the invoice module owns it. */
    @Column(nullable = false, updatable = false)
    private Long invoiceId;

    /** Amount received, including VAT, in euros. */
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;

    /** The day the money was received. */
    @Column(name = "payment_date", nullable = false)
    private LocalDate date;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PaymentMethod method;

    /** Transfer label, cheque number… */
    @Column(length = 100)
    private String reference;

    @Column(length = 500)
    private String note;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
