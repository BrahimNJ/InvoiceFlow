package com.naji.backend.invoice;

import com.naji.backend.common.exception.ConflictException;
import com.naji.backend.common.exception.ResourceNotFoundException;
import com.naji.backend.common.persistence.SearchPatterns;
import com.naji.backend.common.web.PageResponse;
import com.naji.backend.customer.Customer;
import com.naji.backend.customer.CustomerRepository;
import com.naji.backend.invoice.dto.InvoiceLineRequest;
import com.naji.backend.invoice.dto.InvoiceListItem;
import com.naji.backend.invoice.dto.InvoiceRequest;
import com.naji.backend.invoice.dto.InvoiceResponse;
import com.naji.backend.product.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Objects;

/**
 * Every operation is scoped to the owner: an invoice of another user is reported as not found, exactly like a
 * missing id, so its existence is not disclosed. The same goes for the customer and products a draft refers to.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InvoiceService {

    public static final int MAX_PAGE_SIZE = 100;

    /** Invoices are dated in French time: an invoice issued at 00:30 in Paris is dated that day, not the day before. */
    public static final ZoneId ZONE = ZoneId.of("Europe/Paris");

    private final InvoiceRepository invoiceRepository;
    private final CustomerRepository customerRepository;
    private final ProductRepository productRepository;
    private final InvoiceMapper invoiceMapper;
    private final Clock clock;

    /**
     * One page of the owner's invoices matching the filters; most recent first unless another sort is asked for
     * (ties broken by id so that pages stay stable). Out-of-range page and size are clamped.
     */
    public PageResponse<InvoiceListItem> search(Long ownerId, InvoiceSearch filters, int page, int size) {
        LocalDate today = today();
        InvoiceStatusFilter status = filters.status();
        InvoiceSort sort = Objects.requireNonNullElse(filters.sort(), InvoiceSort.CREATED_AT);
        Sort.Direction direction = Objects.requireNonNullElse(
                filters.direction(), sort == InvoiceSort.CREATED_AT ? Sort.Direction.DESC : Sort.Direction.ASC);
        PageRequest pageRequest = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE),
                Sort.by(direction, sort.property()).and(Sort.by(direction, "id")));
        return PageResponse.of(
                invoiceRepository.search(
                        ownerId,
                        SearchPatterns.contains(filters.search()),
                        status == null ? null : switch (status) {
                            case DRAFT -> InvoiceStatus.DRAFT;
                            case ISSUED, OVERDUE -> InvoiceStatus.ISSUED;
                            case CANCELLED -> InvoiceStatus.CANCELLED;
                        },
                        status == InvoiceStatusFilter.OVERDUE ? today : null,
                        filters.customerId(),
                        filters.issuedFrom(),
                        filters.issuedTo(),
                        pageRequest),
                invoice -> invoiceMapper.toListItem(invoice, today));
    }

    public InvoiceResponse findById(Long ownerId, Long id) {
        return toResponse(getInvoice(ownerId, id));
    }

    @Transactional
    public InvoiceResponse create(Long ownerId, InvoiceRequest request) {
        Invoice invoice = new Invoice();
        invoice.setOwnerId(ownerId);
        writeDraft(ownerId, invoice, request);
        return toResponse(invoiceRepository.save(invoice));
    }

    @Transactional
    public InvoiceResponse update(Long ownerId, Long id, InvoiceRequest request) {
        Invoice invoice = getDraft(ownerId, id, "edited");
        writeDraft(ownerId, invoice, request);
        return toResponse(invoiceRepository.saveAndFlush(invoice));
    }

    /** Only a draft can be deleted: an issued invoice must stay in the records (cancel it instead). */
    @Transactional
    public void delete(Long ownerId, Long id) {
        invoiceRepository.delete(getDraft(ownerId, id, "deleted"));
    }

    /** A new draft with the same customer, terms, notes and lines, whatever the status of the original. */
    @Transactional
    public InvoiceResponse duplicate(Long ownerId, Long id) {
        Invoice source = getInvoice(ownerId, id);
        Invoice copy = invoiceMapper.duplicate(source);
        Customer customer = source.getCustomerId() == null
                ? null
                : customerRepository.findByIdAndOwnerId(source.getCustomerId(), ownerId).orElse(null);
        invoiceMapper.copyCustomer(copy, customer);
        return toResponse(invoiceRepository.save(copy));
    }

    private void writeDraft(Long ownerId, Invoice invoice, InvoiceRequest request) {
        invoiceMapper.copyCustomer(invoice, request.customerId() == null ? null : getCustomer(ownerId, request.customerId()));
        request.lines().stream()
                .map(InvoiceLineRequest::productId)
                .filter(Objects::nonNull)
                .distinct()
                .forEach(productId -> productRepository.findByIdAndOwnerId(productId, ownerId)
                        .orElseThrow(() -> new ResourceNotFoundException("Product", productId)));
        invoiceMapper.updateDraft(invoice, request);
    }

    LocalDate today() {
        return LocalDate.now(clock.withZone(ZONE));
    }

    private InvoiceResponse toResponse(Invoice invoice) {
        return invoiceMapper.toResponse(invoice, today());
    }

    private Invoice getInvoice(Long ownerId, Long id) {
        return invoiceRepository.findByIdAndOwnerId(id, ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice", id));
    }

    /** @param action what the caller wants to do, for the error message: "edited", "deleted"… */
    private Invoice getDraft(Long ownerId, Long id, String action) {
        Invoice invoice = getInvoice(ownerId, id);
        if (!invoice.isDraft()) {
            throw new ConflictException("Only a draft can be %s: invoice %s is %s"
                    .formatted(action, invoice.getNumber(), invoice.getStatus().name().toLowerCase()));
        }
        return invoice;
    }

    private Customer getCustomer(Long ownerId, Long id) {
        return customerRepository.findByIdAndOwnerId(id, ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", id));
    }
}
