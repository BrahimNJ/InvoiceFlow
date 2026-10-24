package com.naji.backend.invoice;

import com.naji.backend.common.web.PageResponse;
import com.naji.backend.invoice.dto.InvoiceListItem;
import com.naji.backend.invoice.dto.InvoiceRequest;
import com.naji.backend.invoice.dto.InvoiceResponse;
import com.naji.backend.invoice.dto.InvoiceSummaryResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.time.LocalDate;

/** Invoices of the signed-in user, identified by the subject of the access token. */
@RestController
@RequestMapping("/api/invoices")
@RequiredArgsConstructor
public class InvoiceController {

    private final InvoiceService invoiceService;

    /**
     * {@code GET /api/invoices?search=acme&status=OVERDUE&customerId=3&issuedFrom=2026-10-01&issuedTo=2026-10-31
     * &sort=DUE_DATE&direction=ASC&page=0&size=20}: most recent first by default, {@code size} capped at 100.
     */
    @GetMapping
    public PageResponse<InvoiceListItem> search(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) InvoiceStatusFilter status,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate issuedFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate issuedTo,
            @RequestParam(required = false) InvoiceSort sort,
            @RequestParam(required = false) Sort.Direction direction,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        InvoiceSearch filters = new InvoiceSearch(search, status, customerId, issuedFrom, issuedTo, sort, direction);
        return invoiceService.search(ownerId(jwt), filters, page, size);
    }

    @GetMapping("/summary")
    public InvoiceSummaryResponse summary(@AuthenticationPrincipal Jwt jwt) {
        return invoiceService.summary(ownerId(jwt));
    }

    @GetMapping("/{id}")
    public InvoiceResponse findById(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return invoiceService.findById(ownerId(jwt), id);
    }

    /** Creates a draft. */
    @PostMapping
    public ResponseEntity<InvoiceResponse> create(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody InvoiceRequest request) {
        return created(invoiceService.create(ownerId(jwt), request));
    }

    /** Rewrites a draft; 409 once issued. */
    @PutMapping("/{id}")
    public InvoiceResponse update(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @Valid @RequestBody InvoiceRequest request) {
        return invoiceService.update(ownerId(jwt), id, request);
    }

    /** Deletes a draft; 409 once issued. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        invoiceService.delete(ownerId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    /** 422 with the {@code missing} checks when a required mention is missing; 409 when not a draft. */
    @PostMapping("/{id}/issue")
    public InvoiceResponse issue(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return invoiceService.issue(ownerId(jwt), id);
    }

    /** 409 when not issued. */
    @PostMapping("/{id}/cancel")
    public InvoiceResponse cancel(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return invoiceService.cancel(ownerId(jwt), id);
    }

    /** Creates a new draft from any invoice. */
    @PostMapping("/{id}/duplicate")
    public ResponseEntity<InvoiceResponse> duplicate(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return created(invoiceService.duplicate(ownerId(jwt), id));
    }

    private static ResponseEntity<InvoiceResponse> created(InvoiceResponse invoice) {
        return ResponseEntity.created(URI.create("/api/invoices/" + invoice.id())).body(invoice);
    }

    private static Long ownerId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
