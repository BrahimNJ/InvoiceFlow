package com.naji.backend.admin;

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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** An email listed in ADMIN_EMAILS that signs up after startup is an admin from its first token, no restart needed. */
@SpringBootTest(properties = "app.admin.emails=first-admin@acme.fr")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminSignUpPromotionIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void aListedEmailIsAnAdminAsSoonAsItSignsUp() throws Exception {
        MvcResult registered = mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"firstName": "Ada", "lastName": "Admin", "email": "First-Admin@ACME.fr",
                                 "password": "Correct-horse-42"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.user.role").value("ADMIN"))
                .andReturn();
        String token = JsonPath.read(registered.getResponse().getContentAsString(), "$.accessToken");

        mockMvc.perform(get("/api/admin/audit").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].action").value("PROMOTED_FROM_CONFIG"))
                .andExpect(jsonPath("$.content[0].targetEmail").value("first-admin@acme.fr"));
    }
}
