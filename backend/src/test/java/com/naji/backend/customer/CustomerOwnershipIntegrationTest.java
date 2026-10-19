package com.naji.backend.customer;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Two real accounts through the real stack (tokens, Flyway schema): each one only reaches its own customers. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CustomerOwnershipIntegrationTest {

    private static final String CUSTOMER_BODY = """
            {"name": "ACME", "email": "contact@acme.fr"}
            """;

    @Autowired
    private MockMvc mockMvc;

    @Test
    void customersAreOnlyReachableByTheirOwner() throws Exception {
        String alice = register();
        String bob = register();

        MvcResult created = mockMvc.perform(post("/api/customers").header(HttpHeaders.AUTHORIZATION, alice)
                        .contentType(MediaType.APPLICATION_JSON).content(CUSTOMER_BODY))
                .andExpect(status().isCreated())
                .andReturn();
        Integer id = JsonPath.read(created.getResponse().getContentAsString(), "$.id");
        String url = "/api/customers/" + id;

        // Bob neither sees nor changes Alice's customer: 404, as if it did not exist
        mockMvc.perform(get("/api/customers").header(HttpHeaders.AUTHORIZATION, bob))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(get(url).header(HttpHeaders.AUTHORIZATION, bob))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Customer with id " + id + " not found"));
        mockMvc.perform(put(url).header(HttpHeaders.AUTHORIZATION, bob)
                        .contentType(MediaType.APPLICATION_JSON).content(CUSTOMER_BODY))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete(url).header(HttpHeaders.AUTHORIZATION, bob))
                .andExpect(status().isNotFound());

        // Alice still has it, unchanged
        mockMvc.perform(get("/api/customers").header(HttpHeaders.AUTHORIZATION, alice))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].name").value("ACME"));
        mockMvc.perform(delete(url).header(HttpHeaders.AUTHORIZATION, alice))
                .andExpect(status().isNoContent());
    }

    /** Signs up a new user and returns its {@code Authorization} header value. */
    private String register() throws Exception {
        String body = """
                {"firstName": "Jane", "lastName": "Doe", "email": "user-%s@acme.fr", "password": "Correct-horse-42"}
                """.formatted(UUID.randomUUID());
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andReturn();
        return "Bearer " + JsonPath.read(result.getResponse().getContentAsString(), "$.accessToken");
    }
}
