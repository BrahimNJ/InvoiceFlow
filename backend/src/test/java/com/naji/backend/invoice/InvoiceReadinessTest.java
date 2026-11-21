package com.naji.backend.invoice;

import com.naji.backend.invoice.InvoiceReadiness.Check;
import com.naji.backend.invoice.InvoiceReadiness.Result;
import com.naji.backend.company.VatRegime;
import com.naji.backend.product.ProductType;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class InvoiceReadinessTest {

    @Test
    void anEmptyDraftFailsEveryCheck() {
        Invoice invoice = new Invoice();

        assertThat(InvoiceReadiness.check(invoice, null)).containsExactly(
                new Result(Check.SELLER_DETAILS, false),
                new Result(Check.CUSTOMER, false),
                new Result(Check.CUSTOMER_ADDRESS, false),
                new Result(Check.LINES, false),
                new Result(Check.VAT_EXEMPTION, true),
                new Result(Check.CUSTOMER_SIREN, false));
        assertThat(InvoiceReadiness.blocking(invoice, null))
                .containsExactly(Check.SELLER_DETAILS, Check.CUSTOMER, Check.CUSTOMER_ADDRESS, Check.LINES);
    }

    @Test
    void aMissingCompanyBlocks() {
        assertThat(InvoiceReadiness.blocking(complete(), null)).containsExactly(Check.SELLER_DETAILS);
    }

    @Test
    void aFranchiseSellerMustChargeNoVat() {
        InvoiceSeller franchise = seller();
        franchise.setVatRegime(VatRegime.FRANCHISE);
        Invoice invoice = complete();
        invoice.getLines().get(0).setVatRate(new BigDecimal("20.00"));

        assertThat(InvoiceReadiness.blocking(invoice, franchise)).containsExactly(Check.VAT_EXEMPTION);

        invoice.getLines().get(0).setVatRate(new BigDecimal("0.00"));
        assertThat(InvoiceReadiness.blocking(invoice, franchise)).isEmpty();
    }

    @Test
    void aStandardSellerMayChargeAnyRate() {
        Invoice invoice = complete();
        invoice.getLines().get(0).setVatRate(new BigDecimal("20.00"));

        assertThat(InvoiceReadiness.blocking(invoice, seller())).isEmpty();
    }

    @Test
    void aCompleteInvoicePassesEveryCheck() {
        Invoice invoice = complete();

        assertThat(InvoiceReadiness.check(invoice, seller())).allMatch(Result::passed);
        assertThat(InvoiceReadiness.blocking(invoice, seller())).isEmpty();
    }

    @Test
    void aMissingSirenIsOnlyAWarning() {
        Invoice invoice = complete();
        invoice.getCustomer().setSiret(null);

        assertThat(InvoiceReadiness.check(invoice, seller())).contains(new Result(Check.CUSTOMER_SIREN, false));
        assertThat(InvoiceReadiness.blocking(invoice, seller())).isEmpty();
    }

    @Test
    void anIncompleteAddressBlocks() {
        Invoice invoice = complete();
        invoice.getCustomer().setPostalCode(" ");

        assertThat(InvoiceReadiness.blocking(invoice, seller())).containsExactly(Check.CUSTOMER_ADDRESS);
    }

    @Test
    void theCopiedDetailsOfADeletedCustomerStillCount() {
        Invoice invoice = complete();
        invoice.setCustomerId(null);

        assertThat(InvoiceReadiness.blocking(invoice, seller())).isEmpty();
    }

    @Test
    void operationNatureIsDerivedFromTheLines() {
        assertThat(OperationNature.of(List.of())).isNull();
        assertThat(OperationNature.of(List.of(line(ProductType.GOODS)))).isEqualTo(OperationNature.GOODS);
        assertThat(OperationNature.of(List.of(line(ProductType.SERVICE), line(ProductType.SERVICE))))
                .isEqualTo(OperationNature.SERVICES);
        assertThat(OperationNature.of(List.of(line(ProductType.SERVICE), line(ProductType.GOODS))))
                .isEqualTo(OperationNature.MIXED);
    }

    private static Invoice complete() {
        Invoice invoice = new Invoice();
        invoice.setCustomerId(3L);
        InvoiceCustomer customer = invoice.getCustomer();
        customer.setName("Acme SAS");
        customer.setStreet("12 rue de la Paix");
        customer.setPostalCode("75002");
        customer.setCity("Paris");
        customer.setSiret("73282932000074");
        invoice.replaceLines(List.of(line(ProductType.SERVICE)));
        return invoice;
    }

    private static InvoiceSeller seller() {
        InvoiceSeller seller = new InvoiceSeller();
        seller.setLegalName("Acme SAS");
        seller.setVatRegime(VatRegime.STANDARD);
        return seller;
    }

    private static InvoiceLine line(ProductType type) {
        InvoiceLine line = new InvoiceLine();
        line.setType(type);
        line.setVatRate(new BigDecimal("20.00"));
        return line;
    }
}
