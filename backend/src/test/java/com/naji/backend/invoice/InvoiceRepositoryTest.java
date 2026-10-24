package com.naji.backend.invoice;

import com.naji.backend.customer.Customer;
import com.naji.backend.customer.CustomerRepository;
import com.naji.backend.invoice.dto.InvoiceTotals;
import com.naji.backend.product.ProductType;
import com.naji.backend.product.ProductUnit;
import com.naji.backend.user.User;
import com.naji.backend.user.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Runs the invoice queries on the Flyway schema (V6): lines, owner scoping, filters and constraints. */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class InvoiceRepositoryTest {

    private static final PageRequest FIRST_PAGE = PageRequest.of(0, 20, Sort.by("id"));
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 24);

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private EntityManager entityManager;

    private Long ownerId;
    private Long otherOwnerId;

    @BeforeEach
    void setUp() {
        ownerId = user().getId();
        otherOwnerId = user().getId();
    }

    @Test
    void storesTheLinesInTheirOrderWithExactAmounts() {
        Invoice invoice = draft(ownerId, "Acme");
        invoice.replaceLines(List.of(line("Design", "1.5"), line("Development", "2")));
        Long id = invoiceRepository.saveAndFlush(invoice).getId();
        entityManager.clear();

        Invoice loaded = invoiceRepository.findByIdAndOwnerId(id, ownerId).orElseThrow();

        assertThat(loaded.getLines()).extracting(InvoiceLine::getLabel).containsExactly("Design", "Development");
        assertThat(loaded.getLines()).extracting(InvoiceLine::getSortOrder).containsExactly(0, 1);
        assertThat(loaded.getLines().get(0).getQuantity()).isEqualByComparingTo("1.5");
        assertThat(loaded.getCustomer().getName()).isEqualTo("Acme");
    }

    @Test
    void aDraftWithoutCustomerLoadsAnEmptyCustomer() {
        Invoice invoice = draft(ownerId, null);
        Long id = invoiceRepository.saveAndFlush(invoice).getId();
        entityManager.clear();

        assertThat(invoiceRepository.findById(id).orElseThrow().getCustomer().getName()).isNull();
    }

    @Test
    void search_andFindById_onlyReachTheOwnersInvoices() {
        save(draft(ownerId, "Acme"));
        Long othersInvoice = save(draft(otherOwnerId, "Globex"));

        assertThat(customers(search(ownerId, "%", null, null, null, null, null))).containsExactly("Acme");
        assertThat(invoiceRepository.findByIdAndOwnerId(othersInvoice, ownerId)).isEmpty();
    }

    @Test
    void lockByIdAndOwnerId_onlyReachesTheOwnersInvoice() {
        Long id = save(draft(ownerId, "Acme"));

        assertThat(invoiceRepository.lockByIdAndOwnerId(id, ownerId)).isPresent();
        assertThat(invoiceRepository.lockByIdAndOwnerId(id, otherOwnerId)).isEmpty();
    }

    @Test
    void search_matchesTheNumberOrTheCustomerNameIgnoringCase() {
        save(issued(ownerId, "Acme", "F-2026-0001", TODAY, TODAY.plusDays(30)));
        save(issued(ownerId, "Globex", "F-2026-0002", TODAY, TODAY.plusDays(30)));
        save(draft(ownerId, "ACME Europe"));

        assertThat(customers(search(ownerId, "%acme%", null, null, null, null, null)))
                .containsExactly("Acme", "ACME Europe");
        assertThat(customers(search(ownerId, "%0002%", null, null, null, null, null))).containsExactly("Globex");
    }

    @Test
    void search_filtersByStatusAndOverdue() {
        save(draft(ownerId, "Draft"));
        save(issued(ownerId, "Due later", "F-2026-0001", TODAY.minusDays(10), TODAY.plusDays(5)));
        save(issued(ownerId, "Due today", "F-2026-0002", TODAY.minusDays(30), TODAY));
        save(issued(ownerId, "Late", "F-2026-0003", TODAY.minusDays(40), TODAY.minusDays(1)));

        assertThat(customers(search(ownerId, "%", InvoiceStatus.DRAFT, null, null, null, null))).containsExactly("Draft");
        assertThat(customers(search(ownerId, "%", InvoiceStatus.ISSUED, null, null, null, null)))
                .containsExactly("Due later", "Due today", "Late");
        assertThat(customers(search(ownerId, "%", InvoiceStatus.ISSUED, TODAY, null, null, null))).containsExactly("Late");
    }

    @Test
    void search_filtersByCustomerAndIssuePeriod() {
        Invoice september = issued(ownerId, "Acme", "F-2026-0001", LocalDate.of(2026, 9, 30), TODAY);
        september.setCustomerId(null);
        save(september);
        Invoice october = issued(ownerId, "Acme", "F-2026-0002", LocalDate.of(2026, 10, 1), TODAY);
        Long customerId = customerId("Acme");
        october.setCustomerId(customerId);
        save(october);

        assertThat(numbers(search(ownerId, "%", null, null, customerId, null, null))).containsExactly("F-2026-0002");
        assertThat(numbers(search(ownerId, "%", null, null, null, LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31))))
                .containsExactly("F-2026-0002");
        assertThat(numbers(search(ownerId, "%", null, null, null, null, LocalDate.of(2026, 9, 30))))
                .containsExactly("F-2026-0001");
    }

    @Test
    void totals_countAndSumTheOwnersInvoicesPerStatusDueDateAndIssueDate() {
        save(withTotal(draft(ownerId, "Draft"), "100.00"));
        save(withTotal(issued(ownerId, "Late", "F-2026-0001", LocalDate.of(2026, 9, 1), TODAY.minusDays(1)), "1200.50"));
        save(withTotal(issued(ownerId, "Recent", "F-2026-0002", LocalDate.of(2026, 10, 2), TODAY.plusDays(20)), "300.25"));
        save(withTotal(issued(otherOwnerId, "Other", "F-2026-0001", TODAY, TODAY), "999.00"));

        assertThat(invoiceRepository.totals(ownerId, InvoiceStatus.DRAFT, null, null))
                .isEqualTo(new InvoiceTotals(1L, new BigDecimal("100.00")));
        assertThat(invoiceRepository.totals(ownerId, InvoiceStatus.ISSUED, null, null))
                .isEqualTo(new InvoiceTotals(2L, new BigDecimal("1500.75")));
        assertThat(invoiceRepository.totals(ownerId, InvoiceStatus.ISSUED, TODAY, null))
                .isEqualTo(new InvoiceTotals(1L, new BigDecimal("1200.50")));
        assertThat(invoiceRepository.totals(ownerId, InvoiceStatus.ISSUED, null, LocalDate.of(2026, 10, 1)))
                .isEqualTo(new InvoiceTotals(1L, new BigDecimal("300.25")));
        assertThat(invoiceRepository.totals(ownerId, InvoiceStatus.CANCELLED, null, null))
                .isEqualTo(new InvoiceTotals(0L, new BigDecimal("0.00")));
    }

    @Test
    void anOwnerCannotUseTheSameNumberTwice() {
        save(issued(ownerId, "Acme", "F-2026-0001", TODAY, TODAY));
        save(issued(otherOwnerId, "Acme", "F-2026-0001", TODAY, TODAY));

        assertThatThrownBy(() -> save(issued(ownerId, "Globex", "F-2026-0001", TODAY, TODAY)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void anIssuedInvoiceNeedsANumberAndDates() {
        Invoice invoice = draft(ownerId, "Acme");
        invoice.setStatus(InvoiceStatus.ISSUED);

        assertThatThrownBy(() -> save(invoice)).isInstanceOf(DataIntegrityViolationException.class);
    }

    private Page<Invoice> search(Long owner, String pattern, InvoiceStatus status, LocalDate dueBefore,
                                 Long customerId, LocalDate from, LocalDate to) {
        return invoiceRepository.search(owner, pattern, status, dueBefore, customerId, from, to, FIRST_PAGE);
    }

    private Long save(Invoice invoice) {
        return invoiceRepository.saveAndFlush(invoice).getId();
    }

    private static Invoice draft(Long owner, String customerName) {
        Invoice invoice = new Invoice();
        invoice.setOwnerId(owner);
        invoice.setPaymentTerms(PaymentTerms.NET_30);
        invoice.getCustomer().setName(customerName);
        return invoice;
    }

    private static Invoice issued(Long owner, String customerName, String number, LocalDate issueDate, LocalDate dueDate) {
        Invoice invoice = draft(owner, customerName);
        invoice.setStatus(InvoiceStatus.ISSUED);
        invoice.setNumber(number);
        invoice.setIssueDate(issueDate);
        invoice.setDueDate(dueDate);
        return invoice;
    }

    private static Invoice withTotal(Invoice invoice, String total) {
        invoice.setTotal(new BigDecimal(total));
        return invoice;
    }

    private static InvoiceLine line(String label, String quantity) {
        InvoiceLine line = new InvoiceLine();
        line.setType(ProductType.SERVICE);
        line.setLabel(label);
        line.setQuantity(new BigDecimal(quantity));
        line.setUnit(ProductUnit.DAY);
        line.setUnitPrice(new BigDecimal("500.00"));
        line.setVatRate(new BigDecimal("20.00"));
        line.setLineTotal(new BigDecimal(quantity).multiply(new BigDecimal("500.00")));
        return line;
    }

    /** A real customer row, for the foreign key. */
    private Long customerId(String name) {
        Customer customer = new Customer();
        customer.setOwnerId(ownerId);
        customer.setName(name);
        customer.setEmail("billing@acme.fr");
        return customerRepository.saveAndFlush(customer).getId();
    }

    private User user() {
        User user = new User();
        user.setEmail("user-" + UUID.randomUUID() + "@acme.fr");
        user.setPasswordHash("{bcrypt}$2a$10$hash");
        user.setFirstName("Jane");
        user.setLastName("Doe");
        return userRepository.saveAndFlush(user);
    }

    private static List<String> customers(Page<Invoice> page) {
        return page.getContent().stream().map(invoice -> invoice.getCustomer().getName()).toList();
    }

    private static List<String> numbers(Page<Invoice> page) {
        return page.getContent().stream().map(Invoice::getNumber).toList();
    }
}
