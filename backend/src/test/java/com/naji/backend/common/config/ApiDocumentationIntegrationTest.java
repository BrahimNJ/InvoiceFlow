package com.naji.backend.common.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The OpenAPI description and its Scalar reference are public and describe the real, secured API. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ApiDocumentationIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void openApiDescriptionIsPublicAndDescribesTheSecuredApi() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.info.title").value("InvoiceFlow API"))
                .andExpect(jsonPath("$.components.securitySchemes['bearer-jwt'].scheme").value("bearer"))
                .andExpect(jsonPath("$.security[*]['bearer-jwt']").exists())
                .andExpect(jsonPath("$.paths['/api/invoices/{id}/issue'].post").exists())
                .andExpect(jsonPath("$.paths['/api/customers'].get").exists());
    }

    @Test
    void publicAuthenticationEndpointsDeclareNoBearerToken() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.paths['/api/auth/login'].post.security", empty()))
                .andExpect(jsonPath("$.paths['/api/auth/me'].get.security").doesNotExist());
    }

    @Test
    void controllersDoNotLeakTheAuthenticatedPrincipalAsAParameter() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.paths['/api/customers'].get.parameters[*].name", hasItem("search")))
                .andExpect(content().string(not(containsString("\"name\":\"jwt\""))));
    }

    @Test
    void scalarReferenceIsServedFromTheApiItselfWithoutThirdPartyScripts() throws Exception {
        mockMvc.perform(get("/scalar"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("/v3/api-docs")))
                .andExpect(content().string(containsString("src=\"/scalar/scalar.js\"")));
        mockMvc.perform(get("/scalar/scalar.js")).andExpect(status().isOk());
    }
}
