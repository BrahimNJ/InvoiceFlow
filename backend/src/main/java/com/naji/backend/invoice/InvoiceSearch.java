package com.naji.backend.invoice;

import org.springframework.data.domain.Sort;

import java.time.LocalDate;

/**
 * Filters of the invoices list; {@code null} fields filter nothing.
 *
 * @param search     part of the number or of the customer name
 * @param issuedFrom first issue date included
 * @param issuedTo   last issue date included
 */
public record InvoiceSearch(
        String search,
        InvoiceStatusFilter status,
        Long customerId,
        LocalDate issuedFrom,
        LocalDate issuedTo,
        InvoiceSort sort,
        Sort.Direction direction
) {

    public static InvoiceSearch all() {
        return new InvoiceSearch(null, null, null, null, null, null, null);
    }
}
