package com.naji.backend.invoice;

import com.naji.backend.product.ProductType;
import com.naji.backend.product.ProductUnit;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * One line of an invoice. The product values (label, price, VAT rate…) are copied when the line is written:
 * changing the catalogue later never changes an invoice.
 */
@Entity
@Table(name = "invoice_lines")
@Getter
@Setter
@NoArgsConstructor
public class InvoiceLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "invoice_id", nullable = false)
    private Invoice invoice;

    /** Zero-based position of the line on the invoice. */
    @Column(nullable = false)
    private int sortOrder;

    /** Catalogue product the line was written from, if any; {@code null} for a free line or a deleted product. */
    private Long productId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private ProductType type;

    @Column(nullable = false)
    private String label;

    @Column(length = 1000)
    private String details;

    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal quantity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private ProductUnit unit;

    /** Excluding VAT, in euros. */
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    /** In percent, e.g. {@code 20.00}. */
    @Column(nullable = false, precision = 4, scale = 2)
    private BigDecimal vatRate;

    /** Quantity × unit price, excluding VAT, rounded to the cent. */
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal lineTotal;
}
