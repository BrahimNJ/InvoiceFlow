package com.naji.backend.invoice;

import com.naji.backend.company.VatRegime;

import java.util.List;

/**
 * Checks an invoice against the mentions French law requires before it can be issued. A failed required check
 * blocks the issue; a failed recommended one is only a warning (the customer's SIREN is mandatory for business
 * customers only, and customers do not say whether they are a business yet).
 */
public final class InvoiceReadiness {

    private InvoiceReadiness() {
    }

    public enum Check {
        /** The owner has recorded their company, the seller printed on the invoice. */
        SELLER_DETAILS(true),
        /** A customer is chosen. */
        CUSTOMER(true),
        /** The customer's billing address is complete: street, postal code and city. */
        CUSTOMER_ADDRESS(true),
        /** The invoice has at least one line. */
        LINES(true),
        /** A seller under the VAT exemption (franchise) charges no VAT: every line is at 0 %. */
        VAT_EXEMPTION(true),
        /** The customer's SIRET, whose first 9 digits are the SIREN required by the e-invoicing reform. */
        CUSTOMER_SIREN(false);

        private final boolean required;

        Check(boolean required) {
            this.required = required;
        }

        public boolean required() {
            return required;
        }
    }

    public record Result(Check check, boolean passed) {

        public boolean blocking() {
            return check.required() && !passed;
        }
    }

    /**
     * Every check, in display order. {@code seller} is the owner's current company for a draft, the frozen snapshot
     * for an issued invoice; {@code null} when there is none.
     */
    public static List<Result> check(Invoice invoice, InvoiceSeller seller) {
        InvoiceCustomer customer = invoice.getCustomer();
        boolean hasCustomer = invoice.getCustomerId() != null || present(customer.getName());
        return List.of(
                new Result(Check.SELLER_DETAILS, seller != null),
                new Result(Check.CUSTOMER, hasCustomer),
                new Result(Check.CUSTOMER_ADDRESS, hasCustomer
                        && present(customer.getStreet()) && present(customer.getPostalCode()) && present(customer.getCity())),
                new Result(Check.LINES, !invoice.getLines().isEmpty()),
                new Result(Check.VAT_EXEMPTION, seller == null || seller.getVatRegime() != VatRegime.FRANCHISE
                        || invoice.getLines().stream().allMatch(line -> line.getVatRate().signum() == 0)),
                new Result(Check.CUSTOMER_SIREN, hasCustomer && present(customer.getSiret())));
    }

    /** The required checks that fail; empty when the invoice can be issued. */
    public static List<Check> blocking(Invoice invoice, InvoiceSeller seller) {
        return check(invoice, seller).stream().filter(Result::blocking).map(Result::check).toList();
    }

    private static boolean present(String value) {
        return value != null && !value.isBlank();
    }
}
