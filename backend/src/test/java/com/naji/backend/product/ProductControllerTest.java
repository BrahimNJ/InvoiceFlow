package com.naji.backend.product;

import com.naji.backend.common.exception.ResourceNotFoundException;
import com.naji.backend.common.security.SecurityConfig;
import com.naji.backend.common.web.PageResponse;
import com.naji.backend.product.dto.ProductRequest;
import com.naji.backend.product.dto.ProductResponse;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ProductController.class)
@Import(SecurityConfig.class)
class ProductControllerTest {

    private static final String VALID_BODY = """
            {"type": "SERVICE", "name": "Consulting", "unitPrice": 650.5, "vatRate": 5.5, "unit": "DAY"}
            """;

    /** Id of the signed-in user, carried by the access token subject. */
    private static final Long OWNER_ID = 7L;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ProductService productService;

    @Test
    void search_returnsAPageOfProductsWithTheFilters() throws Exception {
        when(productService.search(OWNER_ID, "design", ProductType.SERVICE, 2, 10))
                .thenReturn(new PageResponse<>(List.of(response(1L)), 2, 10, 21, 3));

        mockMvc.perform(get("/api/products").param("search", "design").param("type", "SERVICE")
                        .param("page", "2").param("size", "10").with(owner()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].name").value("Consulting"))
                .andExpect(jsonPath("$.content[0].unitPrice").value(650.5))
                .andExpect(jsonPath("$.content[0].vatRate").value(20.0))
                .andExpect(jsonPath("$.content[0].unit").value("DAY"))
                .andExpect(jsonPath("$.totalElements").value(21));
    }

    @Test
    void search_defaultsToEveryTypeOnTheFirstPageOf20() throws Exception {
        when(productService.search(OWNER_ID, null, null, 0, 20)).thenReturn(new PageResponse<>(List.of(), 0, 20, 0, 0));

        mockMvc.perform(get("/api/products").with(owner()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isEmpty());
    }

    @Test
    void search_returns400OnAnUnknownType() throws Exception {
        mockMvc.perform(get("/api/products").param("type", "FOOD").with(owner()))
                .andExpect(status().isBadRequest());

        verify(productService, never()).search(any(), any(), any(), anyInt(), anyInt());
    }

    @Test
    void search_returns401WithoutToken() throws Exception {
        mockMvc.perform(get("/api/products"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void findById_returns404WhenMissing() throws Exception {
        when(productService.findById(OWNER_ID, 42L)).thenThrow(new ResourceNotFoundException("Product", 42L));

        mockMvc.perform(get("/api/products/42").with(owner()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Product with id 42 not found"));
    }

    @Test
    void create_returns201WithLocationAndExactAmounts() throws Exception {
        when(productService.create(eq(OWNER_ID), any(ProductRequest.class))).thenReturn(response(1L));

        mockMvc.perform(post("/api/products").contentType(MediaType.APPLICATION_JSON).content(VALID_BODY).with(owner()))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/api/products/1"))
                .andExpect(jsonPath("$.id").value(1));

        ArgumentCaptor<ProductRequest> request = ArgumentCaptor.forClass(ProductRequest.class);
        verify(productService).create(eq(OWNER_ID), request.capture());
        assertThat(request.getValue().unitPrice()).isEqualByComparingTo("650.5");
        assertThat(request.getValue().vatRate()).isEqualByComparingTo("5.5");
    }

    @Test
    void create_returns400OnInvalidPayload() throws Exception {
        String invalidBody = """
                {"name": " ", "description": "%s", "unitPrice": -1.234, "vatRate": 19.6}
                """.formatted("x".repeat(1001));

        mockMvc.perform(post("/api/products").contentType(MediaType.APPLICATION_JSON).content(invalidBody).with(owner()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.type").exists())
                .andExpect(jsonPath("$.errors.name").exists())
                .andExpect(jsonPath("$.errors.description").exists())
                .andExpect(jsonPath("$.errors.unitPrice").exists())
                .andExpect(jsonPath("$.errors.vatRate").value("must be one of the French VAT rates: 20, 10, 5.5, 2.1 or 0"))
                .andExpect(jsonPath("$.errors.unit").exists());
    }

    @Test
    void create_returns400OnAPriceWithMoreThanTwoDecimals() throws Exception {
        String body = VALID_BODY.replace("650.5", "650.555");

        mockMvc.perform(post("/api/products").contentType(MediaType.APPLICATION_JSON).content(body).with(owner()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.unitPrice").exists());
    }

    @Test
    void update_returnsTheUpdatedProduct() throws Exception {
        when(productService.update(eq(OWNER_ID), eq(1L), any(ProductRequest.class))).thenReturn(response(1L));

        mockMvc.perform(put("/api/products/1").contentType(MediaType.APPLICATION_JSON).content(VALID_BODY).with(owner()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Consulting"));
    }

    @Test
    void delete_returns204() throws Exception {
        mockMvc.perform(delete("/api/products/1").with(owner()))
                .andExpect(status().isNoContent());

        verify(productService).delete(OWNER_ID, 1L);
    }

    @Test
    void delete_returns404WhenMissing() throws Exception {
        doThrow(new ResourceNotFoundException("Product", 42L)).when(productService).delete(OWNER_ID, 42L);

        mockMvc.perform(delete("/api/products/42").with(owner()))
                .andExpect(status().isNotFound());
    }

    private static RequestPostProcessor owner() {
        return jwt().jwt(token -> token.subject(OWNER_ID.toString()));
    }

    private static ProductResponse response(Long id) {
        return new ProductResponse(id, ProductType.SERVICE, "Consulting", null, new BigDecimal("650.50"),
                new BigDecimal("20.00"), ProductUnit.DAY, null, null);
    }
}
