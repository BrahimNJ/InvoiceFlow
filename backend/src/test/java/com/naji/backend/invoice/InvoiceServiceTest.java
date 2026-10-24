package com.naji.backend.invoice;

import com.naji.backend.common.exception.ConflictException;
import com.naji.backend.common.exception.ResourceNotFoundException;
import com.naji.backend.common.exception.UnprocessableException;
import com.naji.backend.common.web.PageResponse;
import com.naji.backend.customer.Customer;
import com.naji.backend.customer.CustomerRepository;
import com.naji.backend.invoice.dto.InvoiceLineRequest;
import com.naji.backend.invoice.dto.InvoiceListItem;
import com.naji.backend.invoice.dto.InvoiceRequest;
import com.naji.backend.invoice.dto.InvoiceResponse;
import com.naji.backend.invoice.dto.InvoiceSummaryResponse;
import com.naji.backend.invoice.dto.InvoiceTotals;
import com.naji.backend.product.Product;
import com.naji.backend.product.ProductRepository;
import com.naji.backend.product.ProductType;
import com.naji.backend.product.ProductUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InvoiceServiceTest {

    private static final Long OWNER_ID = 7L;
    /** 23:30 UTC on 23 October is already 24 October in Paris. */
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-23T23:30:00Z"), ZoneOffset.UTC);
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 24);

    @Mock
    private InvoiceRepository invoiceRepository;

    @Mock
    private CustomerRepository customerRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private InvoiceNumberGenerator numberGenerator;

    private InvoiceService invoiceService;

    @BeforeEach
    void setUp() {
        invoiceService = new InvoiceService(invoiceRepository, customerRepository, productRepository,
                new InvoiceMapper(), numberGenerator, CLOCK);
    }

    @Test
    void today_isTheDateInParis() {
        assertThat(invoiceService.today()).isEqualTo(TODAY);
    }

    @Test
    void search_returnsTheMostRecentFirstByDefault() {
        Pageable expected = PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id")));
        Invoice invoice = draft(1L);
        invoice.getCustomer().setName("Acme SAS");
        when(invoiceRepository.search(OWNER_ID, "%", null, null, null, null, null, expected))
                .thenReturn(new PageImpl<>(List.of(invoice), expected, 1));

        PageResponse<InvoiceListItem> page = invoiceService.search(OWNER_ID, InvoiceSearch.all(), 0, 20);

        assertThat(page.content()).extracting(InvoiceListItem::customerName).containsExactly("Acme SAS");
        assertThat(page.totalElements()).isEqualTo(1);
    }

    @Test
    void search_overdueMeansIssuedAndDueBeforeToday() {
        when(invoiceRepository.search(eq(OWNER_ID), eq("%acme%"), eq(InvoiceStatus.ISSUED), eq(TODAY), eq(3L),
                eq(LocalDate.of(2026, 10, 1)), eq(LocalDate.of(2026, 10, 31)), any(Pageable.class))).thenReturn(Page.empty());

        invoiceService.search(OWNER_ID, new InvoiceSearch(" Acme ", InvoiceStatusFilter.OVERDUE, 3L,
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31), null, null), 0, 20);

        verify(invoiceRepository).search(eq(OWNER_ID), eq("%acme%"), eq(InvoiceStatus.ISSUED), eq(TODAY), eq(3L),
                eq(LocalDate.of(2026, 10, 1)), eq(LocalDate.of(2026, 10, 31)), any(Pageable.class));
    }

    @Test
    void search_issuedIncludesOverdueInvoices() {
        when(invoiceRepository.search(eq(OWNER_ID), eq("%"), eq(InvoiceStatus.ISSUED), isNull(), isNull(), isNull(),
                isNull(), any(Pageable.class))).thenReturn(Page.empty());

        invoiceService.search(OWNER_ID, new InvoiceSearch(null, InvoiceStatusFilter.ISSUED, null, null, null, null, null), 0, 20);

        verify(invoiceRepository).search(eq(OWNER_ID), eq("%"), eq(InvoiceStatus.ISSUED), isNull(), isNull(), isNull(),
                isNull(), any(Pageable.class));
    }

    @Test
    void search_sortsAscendingOnAColumnAndClampsPageAndSize() {
        Pageable expected = PageRequest.of(0, InvoiceService.MAX_PAGE_SIZE,
                Sort.by(Sort.Direction.ASC, "dueDate").and(Sort.by(Sort.Direction.ASC, "id")));
        when(invoiceRepository.search(OWNER_ID, "%", null, null, null, null, null, expected)).thenReturn(Page.empty());

        invoiceService.search(OWNER_ID, new InvoiceSearch(null, null, null, null, null, InvoiceSort.DUE_DATE, null), -2, 5000);

        verify(invoiceRepository).search(OWNER_ID, "%", null, null, null, null, null, expected);
    }

    @Test
    void summary_countsDraftsOutstandingOverdueAndIssuedThisMonth() {
        when(invoiceRepository.totals(OWNER_ID, InvoiceStatus.DRAFT, null, null)).thenReturn(totals(3, "2400"));
        when(invoiceRepository.totals(OWNER_ID, InvoiceStatus.ISSUED, null, null)).thenReturn(totals(12, "18950"));
        when(invoiceRepository.totals(OWNER_ID, InvoiceStatus.ISSUED, TODAY, null)).thenReturn(totals(2, "3120"));
        when(invoiceRepository.totals(OWNER_ID, InvoiceStatus.ISSUED, null, LocalDate.of(2026, 10, 1)))
                .thenReturn(totals(7, "9800"));

        InvoiceSummaryResponse summary = invoiceService.summary(OWNER_ID);

        assertThat(summary.drafts()).isEqualTo(totals(3, "2400.00"));
        assertThat(summary.outstanding().count()).isEqualTo(12);
        assertThat(summary.overdue().total()).hasToString("3120.00");
        assertThat(summary.issuedThisMonth().count()).isEqualTo(7);
    }

    @Test
    void create_savesADraftWithTheCustomerDetailsAndTotals() {
        when(customerRepository.findByIdAndOwnerId(3L, OWNER_ID)).thenReturn(Optional.of(customer()));
        when(productRepository.findByIdAndOwnerId(5L, OWNER_ID)).thenReturn(Optional.of(new Product()));
        when(invoiceRepository.save(any(Invoice.class))).thenAnswer(invocation -> {
            Invoice saved = invocation.getArgument(0);
            saved.setId(1L);
            return saved;
        });

        InvoiceResponse response = invoiceService.create(OWNER_ID, request(3L, line(5L), line(5L), line(null)));

        ArgumentCaptor<Invoice> saved = ArgumentCaptor.forClass(Invoice.class);
        verify(invoiceRepository).save(saved.capture());
        assertThat(saved.getValue().getOwnerId()).isEqualTo(OWNER_ID);
        assertThat(response.id()).isEqualTo(1L);
        assertThat(response.status()).isEqualTo(InvoiceStatus.DRAFT);
        assertThat(response.number()).isNull();
        assertThat(response.customerId()).isEqualTo(3L);
        assertThat(response.customer().name()).isEqualTo("Acme SAS");
        assertThat(response.lines()).hasSize(3);
        assertThat(response.total()).hasToString("2340.00");
    }

    @Test
    void create_acceptsADraftWithoutCustomerNorLines() {
        when(invoiceRepository.save(any(Invoice.class))).thenAnswer(invocation -> invocation.getArgument(0));

        InvoiceResponse response = invoiceService.create(OWNER_ID, request(null));

        assertThat(response.customerId()).isNull();
        assertThat(response.lines()).isEmpty();
        assertThat(response.checks()).filteredOn(InvoiceResponse.ReadinessCheck::required).noneMatch(InvoiceResponse.ReadinessCheck::passed);
    }

    @Test
    void create_rejectsTheCustomerOfSomeoneElse() {
        when(customerRepository.findByIdAndOwnerId(3L, OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> invoiceService.create(OWNER_ID, request(3L)))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Customer with id 3 not found");
        verify(invoiceRepository, never()).save(any());
    }

    @Test
    void create_rejectsTheProductOfSomeoneElse() {
        when(productRepository.findByIdAndOwnerId(5L, OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> invoiceService.create(OWNER_ID, request(null, line(5L))))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Product with id 5 not found");
        verify(invoiceRepository, never()).save(any());
    }

    @Test
    void update_rewritesTheDraftAndRefreshesTheCustomerDetails() {
        Invoice existing = draft(1L);
        existing.getCustomer().setName("Old name");
        Customer customer = customer();
        when(invoiceRepository.findByIdAndOwnerId(1L, OWNER_ID)).thenReturn(Optional.of(existing));
        when(customerRepository.findByIdAndOwnerId(3L, OWNER_ID)).thenReturn(Optional.of(customer));
        when(invoiceRepository.saveAndFlush(existing)).thenReturn(existing);

        InvoiceResponse response = invoiceService.update(OWNER_ID, 1L, request(3L, line(null)));

        assertThat(response.customer().name()).isEqualTo("Acme SAS");
        assertThat(response.total()).hasToString("780.00");
    }

    @Test
    void update_refusesAnIssuedInvoice() {
        when(invoiceRepository.findByIdAndOwnerId(1L, OWNER_ID)).thenReturn(Optional.of(issued(1L)));

        assertThatThrownBy(() -> invoiceService.update(OWNER_ID, 1L, request(null)))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Only a draft can be edited: invoice F-2026-0001 is issued");
        verify(invoiceRepository, never()).saveAndFlush(any());
    }

    @Test
    void findById_throwsWhenMissingOrOwnedBySomeoneElse() {
        when(invoiceRepository.findByIdAndOwnerId(42L, OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> invoiceService.findById(OWNER_ID, 42L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Invoice with id 42 not found");
    }

    @Test
    void delete_removesADraft() {
        Invoice existing = draft(1L);
        when(invoiceRepository.findByIdAndOwnerId(1L, OWNER_ID)).thenReturn(Optional.of(existing));

        invoiceService.delete(OWNER_ID, 1L);

        verify(invoiceRepository).delete(existing);
    }

    @Test
    void delete_refusesAnIssuedInvoice() {
        when(invoiceRepository.findByIdAndOwnerId(1L, OWNER_ID)).thenReturn(Optional.of(issued(1L)));

        assertThatThrownBy(() -> invoiceService.delete(OWNER_ID, 1L))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Only a draft can be deleted: invoice F-2026-0001 is issued");
        verify(invoiceRepository, never()).delete(any());
    }

    @Test
    void duplicate_createsADraftWithTheCurrentCustomerDetails() {
        Invoice source = issued(1L);
        source.setCustomerId(3L);
        source.getCustomer().setName("Name when issued");
        when(invoiceRepository.findByIdAndOwnerId(1L, OWNER_ID)).thenReturn(Optional.of(source));
        when(customerRepository.findByIdAndOwnerId(3L, OWNER_ID)).thenReturn(Optional.of(customer()));
        when(invoiceRepository.save(any(Invoice.class))).thenAnswer(invocation -> invocation.getArgument(0));

        InvoiceResponse copy = invoiceService.duplicate(OWNER_ID, 1L);

        assertThat(copy.status()).isEqualTo(InvoiceStatus.DRAFT);
        assertThat(copy.number()).isNull();
        assertThat(copy.customer().name()).isEqualTo("Acme SAS");
        assertThat(copy.lines()).hasSize(1);
    }

    @Test
    void duplicate_leavesTheCustomerEmptyWhenItWasDeleted() {
        Invoice source = issued(1L);
        source.setCustomerId(null);
        when(invoiceRepository.findByIdAndOwnerId(1L, OWNER_ID)).thenReturn(Optional.of(source));
        when(invoiceRepository.save(any(Invoice.class))).thenAnswer(invocation -> invocation.getArgument(0));

        InvoiceResponse copy = invoiceService.duplicate(OWNER_ID, 1L);

        assertThat(copy.customerId()).isNull();
        assertThat(copy.customer().name()).isNull();
    }

    @Test
    void issue_numbersAndDatesTheDraftWithTheLatestCustomerDetails() {
        Invoice draft = readyDraft();
        when(invoiceRepository.lockByIdAndOwnerId(1L, OWNER_ID)).thenReturn(Optional.of(draft));
        Customer customer = addressed(customer());
        customer.setName("Acme SAS (renamed)");
        when(customerRepository.findByIdAndOwnerId(3L, OWNER_ID)).thenReturn(Optional.of(customer));
        when(numberGenerator.next(OWNER_ID, 2026)).thenReturn("F-2026-0007");
        when(invoiceRepository.saveAndFlush(draft)).thenReturn(draft);

        InvoiceResponse response = invoiceService.issue(OWNER_ID, 1L);

        assertThat(response.status()).isEqualTo(InvoiceStatus.ISSUED);
        assertThat(response.number()).isEqualTo("F-2026-0007");
        assertThat(response.issueDate()).isEqualTo(TODAY);
        assertThat(response.dueDate()).isEqualTo(LocalDate.of(2026, 11, 23));
        assertThat(response.issuedAt()).isEqualTo(CLOCK.instant());
        assertThat(response.customer().name()).isEqualTo("Acme SAS (renamed)");
        assertThat(response.overdue()).isFalse();
    }

    @Test
    void issue_keepsTheCopiedDetailsWhenTheCustomerWasDeleted() {
        Invoice draft = readyDraft();
        draft.setCustomerId(null);
        when(invoiceRepository.lockByIdAndOwnerId(1L, OWNER_ID)).thenReturn(Optional.of(draft));
        when(numberGenerator.next(OWNER_ID, 2026)).thenReturn("F-2026-0001");
        when(invoiceRepository.saveAndFlush(draft)).thenReturn(draft);

        InvoiceResponse response = invoiceService.issue(OWNER_ID, 1L);

        assertThat(response.customer().name()).isEqualTo("Acme SAS");
        verify(customerRepository, never()).findByIdAndOwnerId(any(), any());
    }

    @Test
    void issue_refusesAnIncompleteInvoiceWithTheMissingChecks() {
        Invoice draft = draft(1L);
        when(invoiceRepository.lockByIdAndOwnerId(1L, OWNER_ID)).thenReturn(Optional.of(draft));

        assertThatThrownBy(() -> invoiceService.issue(OWNER_ID, 1L))
                .isInstanceOfSatisfying(UnprocessableException.class, ex ->
                        assertThat(ex.getProperties()).containsEntry("missing", List.of("CUSTOMER", "CUSTOMER_ADDRESS", "LINES")));
        verify(numberGenerator, never()).next(any(), any(Integer.class));
        verify(invoiceRepository, never()).saveAndFlush(any());
    }

    @Test
    void issue_refusesAnInvoiceThatIsNotADraft() {
        when(invoiceRepository.lockByIdAndOwnerId(1L, OWNER_ID)).thenReturn(Optional.of(issued(1L)));

        assertThatThrownBy(() -> invoiceService.issue(OWNER_ID, 1L))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Only a draft can be issued: invoice F-2026-0001 is issued");
        verify(numberGenerator, never()).next(any(), any(Integer.class));
    }

    @Test
    void issue_throwsWhenMissingOrOwnedBySomeoneElse() {
        when(invoiceRepository.lockByIdAndOwnerId(42L, OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> invoiceService.issue(OWNER_ID, 42L)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void cancel_keepsTheNumberAndRecordsWhen() {
        Invoice invoice = issued(1L);
        when(invoiceRepository.lockByIdAndOwnerId(1L, OWNER_ID)).thenReturn(Optional.of(invoice));
        when(invoiceRepository.saveAndFlush(invoice)).thenReturn(invoice);

        InvoiceResponse response = invoiceService.cancel(OWNER_ID, 1L);

        assertThat(response.status()).isEqualTo(InvoiceStatus.CANCELLED);
        assertThat(response.number()).isEqualTo("F-2026-0001");
        assertThat(response.cancelledAt()).isEqualTo(CLOCK.instant());
    }

    @Test
    void cancel_refusesADraftOrACancelledInvoice() {
        Invoice cancelled = issued(2L);
        cancelled.setStatus(InvoiceStatus.CANCELLED);
        when(invoiceRepository.lockByIdAndOwnerId(1L, OWNER_ID)).thenReturn(Optional.of(draft(1L)));
        when(invoiceRepository.lockByIdAndOwnerId(2L, OWNER_ID)).thenReturn(Optional.of(cancelled));

        assertThatThrownBy(() -> invoiceService.cancel(OWNER_ID, 1L))
                .isInstanceOf(ConflictException.class)
                .hasMessage("A draft cannot be cancelled: delete it instead");
        assertThatThrownBy(() -> invoiceService.cancel(OWNER_ID, 2L))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Invoice F-2026-0001 is already cancelled");
        verify(invoiceRepository, never()).saveAndFlush(any());
    }

    private static InvoiceTotals totals(long count, String total) {
        return new InvoiceTotals(count, new BigDecimal(total).setScale(2));
    }

    /** A draft that passes every required check. */
    private static Invoice readyDraft() {
        Invoice invoice = draft(1L);
        InvoiceMapper mapper = new InvoiceMapper();
        mapper.copyCustomer(invoice, addressed(customer()));
        mapper.updateDraft(invoice, request(3L, line(null)));
        return invoice;
    }

    private static InvoiceRequest request(Long customerId, InvoiceLineRequest... lines) {
        return new InvoiceRequest(customerId, PaymentTerms.NET_30, null, List.of(lines));
    }

    /** 1 day at 650.00 excl. VAT, 20 % VAT: 780.00 incl. VAT. */
    private static InvoiceLineRequest line(Long productId) {
        return new InvoiceLineRequest(productId, ProductType.SERVICE, "Web development", null, BigDecimal.ONE,
                ProductUnit.DAY, new BigDecimal("650"), new BigDecimal("20"));
    }

    private static Invoice draft(Long id) {
        Invoice invoice = new Invoice();
        invoice.setId(id);
        invoice.setOwnerId(OWNER_ID);
        invoice.setPaymentTerms(PaymentTerms.NET_30);
        return invoice;
    }

    private static Invoice issued(Long id) {
        Invoice invoice = draft(id);
        new InvoiceMapper().updateDraft(invoice, request(null, line(null)));
        invoice.setStatus(InvoiceStatus.ISSUED);
        invoice.setNumber("F-2026-0001");
        invoice.setIssueDate(TODAY);
        invoice.setDueDate(TODAY.plusDays(30));
        return invoice;
    }

    private static Customer addressed(Customer customer) {
        customer.setStreet("12 rue de la Paix");
        customer.setPostalCode("75002");
        customer.setCity("Paris");
        return customer;
    }

    private static Customer customer() {
        Customer customer = new Customer();
        customer.setId(3L);
        customer.setOwnerId(OWNER_ID);
        customer.setName("Acme SAS");
        customer.setEmail("billing@acme.fr");
        return customer;
    }
}
