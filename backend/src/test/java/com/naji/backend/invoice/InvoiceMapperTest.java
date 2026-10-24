package com.naji.backend.invoice;

import com.naji.backend.customer.Customer;
import com.naji.backend.invoice.dto.InvoiceLineRequest;
import com.naji.backend.invoice.dto.InvoiceListItem;
import com.naji.backend.invoice.dto.InvoiceRequest;
import com.naji.backend.invoice.dto.InvoiceResponse;
import com.naji.backend.invoice.dto.InvoiceResponse.ReadinessCheck;
import com.naji.backend.invoice.dto.InvoiceResponse.VatBreakdown;
import com.naji.backend.product.ProductType;
import com.naji.backend.product.ProductUnit;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class InvoiceMapperTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 24);

    private final InvoiceMapper mapper = new InvoiceMapper();

    @Test
    void updateDraft_writesTheLinesAndTheirTotals() {
        Invoice invoice = new Invoice();

        mapper.updateDraft(invoice, new InvoiceRequest(null, PaymentTerms.NET_30, "  Thank you!  ", List.of(
                line(7L, ProductType.SERVICE, " Web development ", "2.5", "650", "20"),
                line(null, ProductType.GOODS, "Keyboard", "1", "49.9", "5.5"))));

        assertThat(invoice.getPaymentTerms()).isEqualTo(PaymentTerms.NET_30);
        assertThat(invoice.getNotes()).isEqualTo("Thank you!");
        assertThat(invoice.getLines()).hasSize(2);
        InvoiceLine first = invoice.getLines().get(0);
        assertThat(first.getProductId()).isEqualTo(7L);
        assertThat(first.getLabel()).isEqualTo("Web development");
        assertThat(first.getQuantity()).hasToString("2.500");
        assertThat(first.getUnitPrice()).hasToString("650.00");
        assertThat(first.getVatRate()).hasToString("20.00");
        assertThat(first.getLineTotal()).hasToString("1625.00");
        assertThat(invoice.getSubtotal()).hasToString("1674.90");
        // 325.00 + 2.7445 → 2.74
        assertThat(invoice.getVatTotal()).hasToString("327.74");
        assertThat(invoice.getTotal()).hasToString("2002.64");
    }

    @Test
    void updateDraft_replacesThePreviousLines() {
        Invoice invoice = new Invoice();
        mapper.updateDraft(invoice, request(line(null, ProductType.SERVICE, "Old", "1", "10", "20")));

        mapper.updateDraft(invoice, request());

        assertThat(invoice.getLines()).isEmpty();
        assertThat(invoice.getTotal()).hasToString("0.00");
        assertThat(invoice.getNotes()).isNull();
    }

    @Test
    void copyCustomer_copiesTheBillingDetailsAndClearsThemForNoCustomer() {
        Invoice invoice = new Invoice();

        mapper.copyCustomer(invoice, customer());

        assertThat(invoice.getCustomerId()).isEqualTo(3L);
        assertThat(invoice.getCustomer().getName()).isEqualTo("Acme SAS");
        assertThat(invoice.getCustomer().getCity()).isEqualTo("Paris");
        assertThat(invoice.getCustomer().getSiret()).isEqualTo("73282932000074");

        mapper.copyCustomer(invoice, null);

        assertThat(invoice.getCustomerId()).isNull();
        assertThat(invoice.getCustomer().getName()).isNull();
    }

    @Test
    void duplicate_copiesTheDraftFieldsIntoANewDraft() {
        Invoice source = issued();

        Invoice copy = mapper.duplicate(source);

        assertThat(copy.getId()).isNull();
        assertThat(copy.getStatus()).isEqualTo(InvoiceStatus.DRAFT);
        assertThat(copy.getNumber()).isNull();
        assertThat(copy.getIssueDate()).isNull();
        assertThat(copy.getOwnerId()).isEqualTo(source.getOwnerId());
        assertThat(copy.getPaymentTerms()).isEqualTo(PaymentTerms.NET_15);
        assertThat(copy.getLines()).extracting(InvoiceLine::getLabel).containsExactly("Web development");
        assertThat(copy.getLines().get(0)).isNotSameAs(source.getLines().get(0));
        assertThat(copy.getTotal()).isEqualByComparingTo(source.getTotal());
    }

    @Test
    void toResponse_carriesTheBreakdownTheChecksAndTheNature() {
        Invoice invoice = issued();

        InvoiceResponse response = mapper.toResponse(invoice, TODAY);

        assertThat(response.number()).isEqualTo("F-2026-0001");
        assertThat(response.customer().name()).isEqualTo("Acme SAS");
        assertThat(response.operationNature()).isEqualTo(OperationNature.SERVICES);
        assertThat(response.lines()).singleElement().satisfies(line -> assertThat(line.lineTotal()).hasToString("1300.00"));
        assertThat(response.vatBreakdown()).containsExactly(
                new VatBreakdown(new BigDecimal("20.00"), new BigDecimal("1300.00"), new BigDecimal("260.00")));
        assertThat(response.checks()).containsExactly(
                new ReadinessCheck("CUSTOMER", true, true),
                new ReadinessCheck("CUSTOMER_ADDRESS", true, true),
                new ReadinessCheck("LINES", true, true),
                new ReadinessCheck("CUSTOMER_SIREN", false, true));
        assertThat(response.overdue()).isFalse();
    }

    @Test
    void anIssuedInvoiceIsOverdueTheDayAfterItsDueDate() {
        Invoice invoice = issued();
        invoice.setDueDate(TODAY);
        assertThat(mapper.toListItem(invoice, TODAY).overdue()).isFalse();

        invoice.setDueDate(TODAY.minusDays(1));
        InvoiceListItem item = mapper.toListItem(invoice, TODAY);
        assertThat(item.overdue()).isTrue();
        assertThat(item.customerName()).isEqualTo("Acme SAS");

        invoice.setStatus(InvoiceStatus.CANCELLED);
        assertThat(mapper.toListItem(invoice, TODAY).overdue()).isFalse();
    }

    @Test
    void aDraftIsNeverOverdue() {
        Invoice draft = new Invoice();

        assertThat(mapper.toResponse(draft, TODAY).overdue()).isFalse();
    }

    private Invoice issued() {
        Invoice invoice = new Invoice();
        invoice.setOwnerId(7L);
        mapper.copyCustomer(invoice, customer());
        mapper.updateDraft(invoice, new InvoiceRequest(3L, PaymentTerms.NET_15, null,
                List.of(line(1L, ProductType.SERVICE, "Web development", "2", "650", "20"))));
        invoice.setStatus(InvoiceStatus.ISSUED);
        invoice.setNumber("F-2026-0001");
        invoice.setIssueDate(TODAY.minusDays(10));
        invoice.setDueDate(TODAY.plusDays(5));
        return invoice;
    }

    private static InvoiceRequest request(InvoiceLineRequest... lines) {
        return new InvoiceRequest(null, PaymentTerms.ON_RECEIPT, " ", List.of(lines));
    }

    private static InvoiceLineRequest line(Long productId, ProductType type, String label, String quantity,
                                           String unitPrice, String vatRate) {
        return new InvoiceLineRequest(productId, type, label, null, new BigDecimal(quantity), ProductUnit.DAY,
                new BigDecimal(unitPrice), new BigDecimal(vatRate));
    }

    private static Customer customer() {
        Customer customer = new Customer();
        customer.setId(3L);
        customer.setName("Acme SAS");
        customer.setEmail("billing@acme.fr");
        customer.setStreet("12 rue de la Paix");
        customer.setPostalCode("75002");
        customer.setCity("Paris");
        customer.setCountry("France");
        customer.setSiret("73282932000074");
        return customer;
    }
}
