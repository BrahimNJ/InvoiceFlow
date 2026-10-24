package com.naji.backend.invoice;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Billing details of the customer as printed on the invoice. Copied from the customer while the invoice is a draft,
 * then frozen when it is issued.
 */
@Embeddable
@Getter
@Setter
@NoArgsConstructor
public class InvoiceCustomer {

    @Column(name = "customer_name")
    private String name;

    @Column(name = "customer_email")
    private String email;

    @Column(name = "customer_street")
    private String street;

    @Column(name = "customer_postal_code")
    private String postalCode;

    @Column(name = "customer_city")
    private String city;

    @Column(name = "customer_country")
    private String country;

    @Column(name = "customer_siret", length = 14)
    private String siret;

    @Column(name = "customer_vat_number")
    private String vatNumber;
}
