package com.naji.backend.customer;

import com.naji.backend.common.exception.ResourceNotFoundException;
import com.naji.backend.common.security.SecurityConfig;
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

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
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

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CustomerService customerService;

    @Test
    void findAll_returnsCustomers() throws Exception {
        when(customerService.findAll()).thenReturn(List.of(response(1L)));

        mockMvc.perform(get("/api/customers").with(jwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("ACME"));
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
        when(customerService.findById(42L)).thenThrow(new ResourceNotFoundException("Customer", 42L));

        mockMvc.perform(get("/api/customers/42").with(jwt()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Customer with id 42 not found"));
    }

    @Test
    void create_returns201WithLocation() throws Exception {
        when(customerService.create(any(CustomerRequest.class))).thenReturn(response(1L));

        mockMvc.perform(post("/api/customers").contentType(MediaType.APPLICATION_JSON).content(VALID_BODY).with(jwt()))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/api/customers/1"))
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    void create_returns400OnInvalidPayload() throws Exception {
        String invalidBody = """
                {"name": "", "email": "not-an-email", "siret": "123"}
                """;

        mockMvc.perform(post("/api/customers").contentType(MediaType.APPLICATION_JSON).content(invalidBody).with(jwt()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.name").exists())
                .andExpect(jsonPath("$.errors.email").exists())
                .andExpect(jsonPath("$.errors.siret").exists());
    }

    @Test
    void delete_returns204() throws Exception {
        mockMvc.perform(delete("/api/customers/1").with(jwt()))
                .andExpect(status().isNoContent());
    }

    @Test
    void delete_returns404WhenMissing() throws Exception {
        doThrow(new ResourceNotFoundException("Customer", 42L)).when(customerService).delete(42L);

        mockMvc.perform(delete("/api/customers/42").with(jwt()))
                .andExpect(status().isNotFound());
    }

    private static CustomerResponse response(Long id) {
        return new CustomerResponse(id, "ACME", "contact@acme.fr", null, null, null, null, null,
                "12345678901234", null, null, null);
    }
}
