package com.naji.backend.customer;

import com.naji.backend.common.web.PageResponse;
import com.naji.backend.customer.dto.CustomerRequest;
import com.naji.backend.customer.dto.CustomerResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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

/** Customers of the signed-in user, identified by the subject of the access token. */
@RestController
@RequestMapping("/api/customers")
@RequiredArgsConstructor
public class CustomerController {

    private final CustomerService customerService;

    /** {@code GET /api/customers?search=acme&page=0&size=20}: sorted by name, {@code size} capped at 100. */
    @GetMapping
    public PageResponse<CustomerResponse> search(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return customerService.search(ownerId(jwt), search, page, size);
    }

    @GetMapping("/{id}")
    public CustomerResponse findById(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return customerService.findById(ownerId(jwt), id);
    }

    @PostMapping
    public ResponseEntity<CustomerResponse> create(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CustomerRequest request) {
        CustomerResponse created = customerService.create(ownerId(jwt), request);
        return ResponseEntity.created(URI.create("/api/customers/" + created.id())).body(created);
    }

    @PutMapping("/{id}")
    public CustomerResponse update(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @Valid @RequestBody CustomerRequest request) {
        return customerService.update(ownerId(jwt), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        customerService.delete(ownerId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    private static Long ownerId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
