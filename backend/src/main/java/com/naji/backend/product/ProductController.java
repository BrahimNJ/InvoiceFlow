package com.naji.backend.product;

import com.naji.backend.common.web.PageResponse;
import com.naji.backend.product.dto.ProductRequest;
import com.naji.backend.product.dto.ProductResponse;
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

/** Products and services of the signed-in user, identified by the subject of the access token. */
@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    /** {@code GET /api/products?search=design&type=SERVICE&page=0&size=20}: sorted by name, {@code size} capped at 100. */
    @GetMapping
    public PageResponse<ProductResponse> search(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) ProductType type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return productService.search(ownerId(jwt), search, type, page, size);
    }

    @GetMapping("/{id}")
    public ProductResponse findById(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return productService.findById(ownerId(jwt), id);
    }

    @PostMapping
    public ResponseEntity<ProductResponse> create(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ProductRequest request) {
        ProductResponse created = productService.create(ownerId(jwt), request);
        return ResponseEntity.created(URI.create("/api/products/" + created.id())).body(created);
    }

    @PutMapping("/{id}")
    public ProductResponse update(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @Valid @RequestBody ProductRequest request) {
        return productService.update(ownerId(jwt), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        productService.delete(ownerId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    private static Long ownerId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
