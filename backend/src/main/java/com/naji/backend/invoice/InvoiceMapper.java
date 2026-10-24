package com.naji.backend.invoice;

import com.naji.backend.customer.Customer;
import com.naji.backend.invoice.InvoiceCalculator.TaxedAmount;
import com.naji.backend.invoice.InvoiceCalculator.Totals;
import com.naji.backend.invoice.dto.InvoiceLineRequest;
import com.naji.backend.invoice.dto.InvoiceLineResponse;
import com.naji.backend.invoice.dto.InvoiceListItem;
import com.naji.backend.invoice.dto.InvoiceRequest;
import com.naji.backend.invoice.dto.InvoiceResponse;
import com.naji.backend.invoice.dto.InvoiceResponse.BilledCustomer;
import com.naji.backend.invoice.dto.InvoiceResponse.ReadinessCheck;
import com.naji.backend.invoice.dto.InvoiceResponse.VatBreakdown;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

@Component
public class InvoiceMapper {

    /**
     * Writes the terms, notes and lines of a draft and recomputes its totals. The customer is set by the service,
     * which checks that it belongs to the owner. Amounts are already validated to have at most 2 (prices) or 3
     * (quantities) decimals.
     */
    public void updateDraft(Invoice invoice, InvoiceRequest request) {
        invoice.setPaymentTerms(request.paymentTerms());
        invoice.setNotes(blankToNull(request.notes()));
        invoice.replaceLines(request.lines().stream().map(InvoiceMapper::toLine).toList());
        applyTotals(invoice);
    }

    /** Copies the customer's billing details onto the invoice; clears them when {@code customer} is {@code null}. */
    public void copyCustomer(Invoice invoice, Customer customer) {
        InvoiceCustomer billed = new InvoiceCustomer();
        if (customer != null) {
            billed.setName(customer.getName());
            billed.setEmail(customer.getEmail());
            billed.setStreet(customer.getStreet());
            billed.setPostalCode(customer.getPostalCode());
            billed.setCity(customer.getCity());
            billed.setCountry(customer.getCountry());
            billed.setSiret(customer.getSiret());
            billed.setVatNumber(customer.getVatNumber());
        }
        invoice.setCustomerId(customer == null ? null : customer.getId());
        invoice.setCustomer(billed);
    }

    /** A copy of the draft fields (customer, terms, notes, lines) in a new draft. */
    public Invoice duplicate(Invoice source) {
        Invoice copy = new Invoice();
        copy.setOwnerId(source.getOwnerId());
        copy.setPaymentTerms(source.getPaymentTerms());
        copy.setNotes(source.getNotes());
        copy.replaceLines(source.getLines().stream().map(InvoiceMapper::copyLine).toList());
        applyTotals(copy);
        return copy;
    }

    /** {@code today} decides whether an issued invoice is overdue. */
    public InvoiceResponse toResponse(Invoice invoice, LocalDate today) {
        Totals totals = totals(invoice);
        InvoiceCustomer customer = invoice.getCustomer();
        return new InvoiceResponse(
                invoice.getId(),
                invoice.getNumber(),
                invoice.getStatus(),
                isOverdue(invoice, today),
                invoice.getCustomerId(),
                new BilledCustomer(customer.getName(), customer.getEmail(), customer.getStreet(), customer.getPostalCode(),
                        customer.getCity(), customer.getCountry(), customer.getSiret(), customer.getVatNumber()),
                invoice.getPaymentTerms(),
                invoice.getIssueDate(),
                invoice.getDueDate(),
                invoice.getNotes(),
                OperationNature.of(invoice.getLines()),
                invoice.getLines().stream().map(InvoiceMapper::toLineResponse).toList(),
                invoice.getSubtotal(),
                invoice.getVatTotal(),
                invoice.getTotal(),
                totals.vatBreakdown().stream()
                        .map(vat -> new VatBreakdown(vat.rate(), vat.base(), vat.amount()))
                        .toList(),
                InvoiceReadiness.check(invoice).stream()
                        .map(result -> new ReadinessCheck(result.check().name(), result.check().required(), result.passed()))
                        .toList(),
                invoice.getIssuedAt(),
                invoice.getCancelledAt(),
                invoice.getCreatedAt(),
                invoice.getUpdatedAt()
        );
    }

    public InvoiceListItem toListItem(Invoice invoice, LocalDate today) {
        return new InvoiceListItem(
                invoice.getId(),
                invoice.getNumber(),
                invoice.getStatus(),
                isOverdue(invoice, today),
                invoice.getCustomerId(),
                invoice.getCustomer().getName(),
                invoice.getIssueDate(),
                invoice.getDueDate(),
                invoice.getSubtotal(),
                invoice.getTotal(),
                invoice.getCreatedAt(),
                invoice.getUpdatedAt()
        );
    }

    public static boolean isOverdue(Invoice invoice, LocalDate today) {
        return invoice.getStatus() == InvoiceStatus.ISSUED && invoice.getDueDate().isBefore(today);
    }

    private static void applyTotals(Invoice invoice) {
        Totals totals = totals(invoice);
        invoice.setSubtotal(totals.subtotal());
        invoice.setVatTotal(totals.vatTotal());
        invoice.setTotal(totals.total());
    }

    private static Totals totals(Invoice invoice) {
        return InvoiceCalculator.totals(invoice.getLines().stream()
                .map(line -> new TaxedAmount(line.getLineTotal(), line.getVatRate()))
                .toList());
    }

    private static InvoiceLine toLine(InvoiceLineRequest request) {
        InvoiceLine line = new InvoiceLine();
        line.setProductId(request.productId());
        line.setType(request.type());
        line.setLabel(request.label().strip());
        line.setDetails(blankToNull(request.details()));
        line.setQuantity(request.quantity().setScale(3, RoundingMode.UNNECESSARY));
        line.setUnit(request.unit());
        line.setUnitPrice(twoDecimals(request.unitPrice()));
        line.setVatRate(twoDecimals(request.vatRate()));
        line.setLineTotal(InvoiceCalculator.lineTotal(line.getQuantity(), line.getUnitPrice()));
        return line;
    }

    private static InvoiceLine copyLine(InvoiceLine source) {
        InvoiceLine line = new InvoiceLine();
        line.setProductId(source.getProductId());
        line.setType(source.getType());
        line.setLabel(source.getLabel());
        line.setDetails(source.getDetails());
        line.setQuantity(source.getQuantity());
        line.setUnit(source.getUnit());
        line.setUnitPrice(source.getUnitPrice());
        line.setVatRate(source.getVatRate());
        line.setLineTotal(source.getLineTotal());
        return line;
    }

    private static InvoiceLineResponse toLineResponse(InvoiceLine line) {
        return new InvoiceLineResponse(
                line.getId(),
                line.getProductId(),
                line.getType(),
                line.getLabel(),
                line.getDetails(),
                line.getQuantity(),
                line.getUnit(),
                line.getUnitPrice(),
                line.getVatRate(),
                line.getLineTotal()
        );
    }

    private static BigDecimal twoDecimals(BigDecimal value) {
        return value.setScale(2, RoundingMode.UNNECESSARY);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
