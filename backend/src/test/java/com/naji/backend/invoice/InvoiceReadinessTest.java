package com.naji.backend.invoice;

import com.naji.backend.invoice.InvoiceReadiness.Check;
import com.naji.backend.invoice.InvoiceReadiness.Result;
import com.naji.backend.product.ProductType;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class InvoiceReadinessTest {

    @Test
    void anEmptyDraftFailsEveryCheck() {
        Invoice invoice = new Invoice();

        assertThat(InvoiceReadiness.check(invoice)).containsExactly(
                new Result(Check.CUSTOMER, false),
                new Result(Check.CUSTOMER_ADDRESS, false),
                new Result(Check.LINES, false),
                new Result(Check.CUSTOMER_SIREN, false));
        assertThat(InvoiceReadiness.blocking(invoice)).containsExactly(Check.CUSTOMER, Check.CUSTOMER_ADDRESS, Check.LINES);
    }

    @Test
    void aCompleteInvoicePassesEveryCheck() {
        Invoice invoice = complete();

        assertThat(InvoiceReadiness.check(invoice)).allMatch(Result::passed);
        assertThat(InvoiceReadiness.blocking(invoice)).isEmpty();
    }

    @Test
    void aMissingSirenIsOnlyAWarning() {
        Invoice invoice = complete();
        invoice.getCustomer().setSiret(null);

        assertThat(InvoiceReadiness.check(invoice)).contains(new Result(Check.CUSTOMER_SIREN, false));
        assertThat(InvoiceReadiness.blocking(invoice)).isEmpty();
    }

    @Test
    void anIncompleteAddressBlocks() {
        Invoice invoice = complete();
        invoice.getCustomer().setPostalCode(" ");

        assertThat(InvoiceReadiness.blocking(invoice)).containsExactly(Check.CUSTOMER_ADDRESS);
    }

    @Test
    void theCopiedDetailsOfADeletedCustomerStillCount() {
        Invoice invoice = complete();
        invoice.setCustomerId(null);

        assertThat(InvoiceReadiness.blocking(invoice)).isEmpty();
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

    private static InvoiceLine line(ProductType type) {
        InvoiceLine line = new InvoiceLine();
        line.setType(type);
        return line;
    }
}
