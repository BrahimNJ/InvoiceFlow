package com.naji.backend.customer;

import com.naji.backend.common.exception.ResourceNotFoundException;
import com.naji.backend.common.security.SecurityConfig;
import com.naji.backend.common.web.PageResponse;
import com.naji.backend.customer.dto.CustomerRequest;
import com.naji.backend.customer.dto.CustomerResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(CustomerController.class)
@Import(SecurityConfig.class)
class CustomerControllerTest {

    private static final String VALID_BODY = """
            {"name": "ACME", "email": "contact@acme.fr", "siret": "12345678901234"}
            """;

    /** Id of the signed-in user, carried by the access token subject. */
    private static final Long OWNER_ID = 7L;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CustomerService customerService;

    @Test
    void search_returnsAPageOfCustomers() throws Exception {
        when(customerService.search(OWNER_ID, "acme", 2, 10))
                .thenReturn(new PageResponse<>(List.of(response(1L)), 2, 10, 21, 3));

        mockMvc.perform(get("/api/customers").param("search", "acme").param("page", "2").param("size", "10")
                        .with(owner()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].name").value("ACME"))
                .andExpect(jsonPath("$.page").value(2))
                .andExpect(jsonPath("$.size").value(10))
                .andExpect(jsonPath("$.totalElements").value(21))
                .andExpect(jsonPath("$.totalPages").value(3));
    }

    @Test
    void search_defaultsToTheFirstPageOf20WithoutFilter() throws Exception {
        when(customerService.search(OWNER_ID, null, 0, 20)).thenReturn(new PageResponse<>(List.of(), 0, 20, 0, 0));

        mockMvc.perform(get("/api/customers").with(owner()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isEmpty());
    }

    @Test
    void search_returns400OnANonNumericPage() throws Exception {
        mockMvc.perform(get("/api/customers").param("page", "abc").with(owner()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void findAll_returns401WithoutToken() throws Exception {
        mockMvc.perform(get("/api/customers"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE, "Bearer"))
                .andExpect(jsonPath("$.detail").value("Authentication is required"));
    }

    @Test
    void findById_returns404WhenMissing() throws Exception {
        when(customerService.findById(OWNER_ID, 42L)).thenThrow(new ResourceNotFoundException("Customer", 42L));

        mockMvc.perform(get("/api/customers/42").with(owner()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Customer with id 42 not found"));
    }

    @Test
    void create_returns201WithLocation() throws Exception {
        when(customerService.create(eq(OWNER_ID), any(CustomerRequest.class))).thenReturn(response(1L));

        mockMvc.perform(post("/api/customers").contentType(MediaType.APPLICATION_JSON).content(VALID_BODY).with(owner()))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/api/customers/1"))
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    void create_returns400OnInvalidPayload() throws Exception {
        String invalidBody = """
                {"name": "", "email": "not-an-email", "siret": "123"}
                """;

        mockMvc.perform(post("/api/customers").contentType(MediaType.APPLICATION_JSON).content(invalidBody).with(owner()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.name").exists())
                .andExpect(jsonPath("$.errors.email").exists())
                .andExpect(jsonPath("$.errors.siret").exists());
    }

    @Test
    void delete_returns204() throws Exception {
        mockMvc.perform(delete("/api/customers/1").with(owner()))
                .andExpect(status().isNoContent());

        verify(customerService).delete(OWNER_ID, 1L);
    }

    @Test
    void delete_returns404WhenMissing() throws Exception {
        doThrow(new ResourceNotFoundException("Customer", 42L)).when(customerService).delete(OWNER_ID, 42L);

        mockMvc.perform(delete("/api/customers/42").with(owner()))
                .andExpect(status().isNotFound());
    }

    private static RequestPostProcessor owner() {
        return jwt().jwt(token -> token.subject(OWNER_ID.toString()));
    }

    private static CustomerResponse response(Long id) {
        return new CustomerResponse(id, "ACME", "contact@acme.fr", null, null, null, null, null,
                "12345678901234", null, null, null);
    }
}
