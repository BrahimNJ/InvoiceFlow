package com.naji.backend.invoice;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Entity
@Table(name = "invoices")
@Getter
@Setter
@NoArgsConstructor
public class Invoice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Id of the user who owns this invoice (JWT subject). Only the owner can see or change it. */
    @Column(nullable = false, updatable = false)
    private Long ownerId;

    /** Legal number, e.g. {@code F-2026-0001}; given when the invoice is issued, {@code null} for a draft. */
    @Column(length = 20)
    private String number;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private InvoiceStatus status = InvoiceStatus.DRAFT;

    /** The billed customer; {@code null} when not chosen yet or deleted since (the copied details remain). */
    private Long customerId;

    @Embedded
    private InvoiceCustomer customer = new InvoiceCustomer();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PaymentTerms paymentTerms;

    /** Set when the invoice is issued. */
    private LocalDate issueDate;

    /** Issue date plus the payment terms; set when the invoice is issued. */
    private LocalDate dueDate;

    @Column(length = 2000)
    private String notes;

    /** Total excluding VAT. */
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal vatTotal = BigDecimal.ZERO;

    /** Total including VAT. */
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal total = BigDecimal.ZERO;

    private Instant issuedAt;

    private Instant cancelledAt;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @Getter(AccessLevel.NONE)
    @Setter(AccessLevel.NONE)
    @OneToMany(mappedBy = "invoice", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder")
    private List<InvoiceLine> lines = new ArrayList<>();

    /** Never {@code null}: Hibernate loads an embeddable whose columns are all null as {@code null}. */
    public InvoiceCustomer getCustomer() {
        if (customer == null) {
            customer = new InvoiceCustomer();
        }
        return customer;
    }

    /** The lines in their order on the invoice. */
    public List<InvoiceLine> getLines() {
        return Collections.unmodifiableList(lines);
    }

    /** Replaces every line; their positions follow the order of {@code newLines}. */
    public void replaceLines(List<InvoiceLine> newLines) {
        lines.clear();
        for (InvoiceLine line : newLines) {
            line.setInvoice(this);
            line.setSortOrder(lines.size());
            lines.add(line);
        }
    }

    public boolean isDraft() {
        return status == InvoiceStatus.DRAFT;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
