package com.naji.backend.company;

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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Two real accounts through the real stack (tokens, Flyway schema): each one only reaches its own company. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CompanyOwnershipIntegrationTest {

    private static final String BODY = """
            {"legalName": "%s", "legalForm": "SAS", "shareCapital": 10000, "street": "1 rue de la Paix",
             "postalCode": "75002", "city": "Paris", "country": "France", "siret": "73282932000074",
             "vatNumber": "FR 44 732 829 320", "vatRegime": "STANDARD"}
            """;

    @Autowired
    private MockMvc mockMvc;

    @Test
    void eachUserOnlyReadsAndSavesTheirOwnCompany() throws Exception {
        String alice = register();
        String bob = register();

        mockMvc.perform(put("/api/company").header(HttpHeaders.AUTHORIZATION, alice)
                        .contentType(MediaType.APPLICATION_JSON).content(BODY.formatted("Acme SAS")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.vatNumber").value("FR44732829320"));

        // Bob has no company yet: Alice's is not disclosed to him
        mockMvc.perform(get("/api/company").header(HttpHeaders.AUTHORIZATION, bob))
                .andExpect(status().isNotFound());

        // Bob saving his own company creates a second one and leaves Alice's untouched
        mockMvc.perform(put("/api/company").header(HttpHeaders.AUTHORIZATION, bob)
                        .contentType(MediaType.APPLICATION_JSON).content(BODY.formatted("Globex SAS")))
                .andExpect(status().isOk());
        MvcResult aliceCompany = mockMvc.perform(get("/api/company").header(HttpHeaders.AUTHORIZATION, alice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.legalName").value("Acme SAS"))
                .andReturn();

        // A second save by Alice updates the same company
        Integer id = JsonPath.read(aliceCompany.getResponse().getContentAsString(), "$.id");
        mockMvc.perform(put("/api/company").header(HttpHeaders.AUTHORIZATION, alice)
                        .contentType(MediaType.APPLICATION_JSON).content(BODY.formatted("Acme France SAS")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.legalName").value("Acme France SAS"));
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
