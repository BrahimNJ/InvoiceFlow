package com.naji.backend.product;

import com.naji.backend.common.exception.ResourceNotFoundException;
import com.naji.backend.common.persistence.SearchPatterns;
import com.naji.backend.common.web.PageResponse;
import com.naji.backend.product.dto.ProductRequest;
import com.naji.backend.product.dto.ProductResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Every operation is scoped to the owner: a product of another user is reported as not found,
 * exactly like a missing id, so its existence is not disclosed.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProductService {

    public static final int MAX_PAGE_SIZE = 100;

    /** Alphabetical, then by id so that pages stay stable when names are equal. */
    private static final Sort SORT = Sort.by("name").ascending().and(Sort.by("id").ascending());

    private final ProductRepository productRepository;
    private final ProductMapper productMapper;

    /**
     * One page of the owner's products of the given type ({@code null}: every type) whose name or description
     * contains {@code search} (case-insensitive, taken literally). Out-of-range page and size are clamped.
     */
    public PageResponse<ProductResponse> search(Long ownerId, String search, ProductType type, int page, int size) {
        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        PageRequest pageRequest = PageRequest.of(Math.max(page, 0), pageSize, SORT);
        return PageResponse.of(
                productRepository.search(ownerId, type, SearchPatterns.contains(search), pageRequest),
                productMapper::toResponse);
    }

    public ProductResponse findById(Long ownerId, Long id) {
        return productMapper.toResponse(getProduct(ownerId, id));
    }

    @Transactional
    public ProductResponse create(Long ownerId, ProductRequest request) {
        Product product = productMapper.toEntity(request);
        product.setOwnerId(ownerId);
        return productMapper.toResponse(productRepository.save(product));
    }

    @Transactional
    public ProductResponse update(Long ownerId, Long id, ProductRequest request) {
        Product product = getProduct(ownerId, id);
        productMapper.updateEntity(product, request);
        return productMapper.toResponse(productRepository.saveAndFlush(product));
    }

    @Transactional
    public void delete(Long ownerId, Long id) {
        productRepository.delete(getProduct(ownerId, id));
    }

    private Product getProduct(Long ownerId, Long id) {
        return productRepository.findByIdAndOwnerId(id, ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", id));
    }
}
