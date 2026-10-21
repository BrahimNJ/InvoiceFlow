package com.naji.backend.product;

import com.naji.backend.common.exception.ResourceNotFoundException;
import com.naji.backend.common.web.PageResponse;
import com.naji.backend.product.dto.ProductRequest;
import com.naji.backend.product.dto.ProductResponse;
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
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProductServiceTest {

    private static final Long OWNER_ID = 7L;

    @Mock
    private ProductRepository productRepository;

    private ProductService productService;

    @BeforeEach
    void setUp() {
        productService = new ProductService(productRepository, new ProductMapper());
    }

    @Test
    void search_returnsAPageSortedByName() {
        Pageable expected = PageRequest.of(1, 20, Sort.by("name").ascending().and(Sort.by("id").ascending()));
        Page<Product> page = new PageImpl<>(List.of(product(1L, "Consulting")), expected, 21);
        when(productRepository.search(OWNER_ID, null, "%", expected)).thenReturn(page);

        PageResponse<ProductResponse> response = productService.search(OWNER_ID, null, null, 1, 20);

        assertThat(response.content()).extracting(ProductResponse::name).containsExactly("Consulting");
        assertThat(response.page()).isEqualTo(1);
        assertThat(response.totalElements()).isEqualTo(21);
        assertThat(response.totalPages()).isEqualTo(2);
    }

    @Test
    void search_passesTheTypeAndALiteralPattern() {
        when(productRepository.search(eq(OWNER_ID), eq(ProductType.GOODS), eq("%100!%%"), any(Pageable.class)))
                .thenReturn(Page.empty());

        productService.search(OWNER_ID, " 100% ", ProductType.GOODS, 0, 20);

        verify(productRepository).search(eq(OWNER_ID), eq(ProductType.GOODS), eq("%100!%%"), any(Pageable.class));
    }

    @Test
    void search_clampsPageAndSize() {
        when(productRepository.search(eq(OWNER_ID), isNull(), eq("%"), any(Pageable.class))).thenReturn(Page.empty());
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);

        productService.search(OWNER_ID, null, null, -3, 5000);
        productService.search(OWNER_ID, null, null, 0, 0);

        verify(productRepository, times(2)).search(eq(OWNER_ID), isNull(), eq("%"), pageable.capture());
        assertThat(pageable.getAllValues().get(0).getPageNumber()).isZero();
        assertThat(pageable.getAllValues().get(0).getPageSize()).isEqualTo(ProductService.MAX_PAGE_SIZE);
        assertThat(pageable.getAllValues().get(1).getPageSize()).isEqualTo(1);
    }

    @Test
    void create_savesTheProductForTheOwnerWithTwoDecimalAmounts() {
        when(productRepository.save(any(Product.class))).thenAnswer(invocation -> {
            Product saved = invocation.getArgument(0);
            saved.setId(1L);
            return saved;
        });

        ProductResponse response = productService.create(OWNER_ID, request("Consulting", "650", "5.5"));

        ArgumentCaptor<Product> saved = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).save(saved.capture());
        assertThat(saved.getValue().getOwnerId()).isEqualTo(OWNER_ID);
        assertThat(response.id()).isEqualTo(1L);
        assertThat(response.type()).isEqualTo(ProductType.SERVICE);
        assertThat(response.unitPrice()).hasToString("650.00");
        assertThat(response.vatRate()).hasToString("5.50");
        assertThat(response.unit()).isEqualTo(ProductUnit.DAY);
    }

    @Test
    void findById_throwsWhenMissingOrOwnedBySomeoneElse() {
        when(productRepository.findByIdAndOwnerId(42L, OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> productService.findById(OWNER_ID, 42L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Product with id 42 not found");
    }

    @Test
    void update_changesTheExistingProduct() {
        Product existing = product(1L, "Old name");
        when(productRepository.findByIdAndOwnerId(1L, OWNER_ID)).thenReturn(Optional.of(existing));
        when(productRepository.saveAndFlush(existing)).thenReturn(existing);

        ProductResponse response = productService.update(OWNER_ID, 1L, request("New name", "700.5", "20"));

        assertThat(response.name()).isEqualTo("New name");
        assertThat(response.unitPrice()).hasToString("700.50");
        assertThat(existing.getOwnerId()).isEqualTo(OWNER_ID);
    }

    @Test
    void update_throwsWhenOwnedBySomeoneElse() {
        when(productRepository.findByIdAndOwnerId(1L, OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> productService.update(OWNER_ID, 1L, request("New name", "1", "20")))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(productRepository, never()).saveAndFlush(any());
    }

    @Test
    void delete_removesTheOwnersProduct() {
        Product existing = product(1L, "Consulting");
        when(productRepository.findByIdAndOwnerId(1L, OWNER_ID)).thenReturn(Optional.of(existing));

        productService.delete(OWNER_ID, 1L);

        verify(productRepository).delete(existing);
    }

    @Test
    void delete_throwsWhenMissingOrOwnedBySomeoneElse() {
        when(productRepository.findByIdAndOwnerId(42L, OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> productService.delete(OWNER_ID, 42L))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(productRepository, never()).delete(any());
    }

    private static ProductRequest request(String name, String unitPrice, String vatRate) {
        return new ProductRequest(ProductType.SERVICE, name, "Senior developer day", new BigDecimal(unitPrice),
                new BigDecimal(vatRate), ProductUnit.DAY);
    }

    private static Product product(Long id, String name) {
        Product product = new Product();
        product.setId(id);
        product.setOwnerId(OWNER_ID);
        product.setType(ProductType.SERVICE);
        product.setName(name);
        product.setUnitPrice(new BigDecimal("650.00"));
        product.setVatRate(new BigDecimal("20.00"));
        product.setUnit(ProductUnit.DAY);
        return product;
    }
}
