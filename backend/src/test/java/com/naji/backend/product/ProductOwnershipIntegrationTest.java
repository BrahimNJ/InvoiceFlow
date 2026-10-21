package com.naji.backend.product;

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

/** Two real accounts through the real stack (tokens, Flyway schema): each one only reaches its own products. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProductOwnershipIntegrationTest {

    private static final String PRODUCT_BODY = """
            {"type": "GOODS", "name": "Keyboard", "unitPrice": 49.9, "vatRate": 20, "unit": "UNIT"}
            """;

    @Autowired
    private MockMvc mockMvc;

    @Test
    void productsAreOnlyReachableByTheirOwner() throws Exception {
        String alice = register();
        String bob = register();

        MvcResult created = mockMvc.perform(post("/api/products").header(HttpHeaders.AUTHORIZATION, alice)
                        .contentType(MediaType.APPLICATION_JSON).content(PRODUCT_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.unitPrice").value(49.9))
                .andExpect(jsonPath("$.vatRate").value(20.0))
                .andReturn();
        Integer id = JsonPath.read(created.getResponse().getContentAsString(), "$.id");
        String url = "/api/products/" + id;

        // Bob neither sees nor changes Alice's product: 404, as if it did not exist
        mockMvc.perform(get("/api/products").header(HttpHeaders.AUTHORIZATION, bob))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(get(url).header(HttpHeaders.AUTHORIZATION, bob))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Product with id " + id + " not found"));
        mockMvc.perform(put(url).header(HttpHeaders.AUTHORIZATION, bob)
                        .contentType(MediaType.APPLICATION_JSON).content(PRODUCT_BODY))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete(url).header(HttpHeaders.AUTHORIZATION, bob))
                .andExpect(status().isNotFound());

        // Alice still has it, unchanged, and finds it with the goods filter
        mockMvc.perform(get("/api/products").param("type", "GOODS").header(HttpHeaders.AUTHORIZATION, alice))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].name").value("Keyboard"));
        mockMvc.perform(get("/api/products").param("type", "SERVICE").header(HttpHeaders.AUTHORIZATION, alice))
                .andExpect(jsonPath("$.totalElements").value(0));
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
