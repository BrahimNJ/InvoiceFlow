package com.naji.backend.common.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Through the real security filter chain: the limit applies before credentials are even checked. */
@SpringBootTest(properties = {"app.rate-limit.auth.enabled=true", "app.rate-limit.auth.capacity=2"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthRateLimitIntegrationTest {

    private static final String WRONG_CREDENTIALS = """
            {"email": "nobody@acme.fr", "password": "Not-the-right-one-42"}
            """;

    @Autowired
    private MockMvc mockMvc;

    private MockHttpServletRequestBuilder login() {
        return post("/api/auth/login")
                .with(request -> {
                    request.setRemoteAddr("192.0.2.10");
                    return request;
                })
                .header(HttpHeaders.ORIGIN, "http://localhost:4200")
                .contentType(MediaType.APPLICATION_JSON)
                .content(WRONG_CREDENTIALS);
    }

    @Test
    void answers429AsAProblemDetailOnceTheClientExceedsTheLimit() throws Exception {
        mockMvc.perform(login()).andExpect(status().isUnauthorized());
        mockMvc.perform(login()).andExpect(status().isUnauthorized());

        mockMvc.perform(login())
                .andExpect(status().isTooManyRequests())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(jsonPath("$.detail", containsString("Too many attempts")))
                .andExpect(header().exists(HttpHeaders.RETRY_AFTER))
                // The browser can read the error: CORS headers are set before the limit is checked
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:4200"));
    }
}
