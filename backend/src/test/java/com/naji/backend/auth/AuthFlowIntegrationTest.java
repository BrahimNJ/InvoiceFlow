package com.naji.backend.auth;

import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Whole authentication flow through the real stack: security filter chain, controllers, services,
 * Flyway schema on H2 and committed transactions (no test transaction, so commits behave as in production).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthFlowIntegrationTest {

    private static final String PASSWORD = "Correct-horse-42";

    @Autowired
    private MockMvc mockMvc;

    @Test
    void register_accessProtectedApi_refresh_detectReuse_logout() throws Exception {
        String email = uniqueEmail();

        // Register: signed in right away
        MvcResult registered = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody(email)))
                .andExpect(status().isCreated())
                .andReturn();
        String accessToken = accessToken(registered);
        Cookie firstRefresh = refreshCookie(registered);

        // The access token opens the protected API
        mockMvc.perform(get("/api/customers"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/customers").header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.firstName").value("Jane"));

        // Refresh rotates the refresh token
        MvcResult refreshed = refresh(firstRefresh).andExpect(status().isOk()).andReturn();
        Cookie secondRefresh = refreshCookie(refreshed);
        assertThat(secondRefresh.getValue()).isNotEqualTo(firstRefresh.getValue());
        assertThat(accessToken(refreshed)).isNotBlank();

        // Replaying the first token is detected as theft: every session is revoked, the current one too
        refresh(firstRefresh).andExpect(status().isUnauthorized());
        refresh(secondRefresh).andExpect(status().isUnauthorized());

        // Sign in again, then sign out: the refresh token is dead
        MvcResult loggedIn = login(email, PASSWORD).andExpect(status().isOk()).andReturn();
        Cookie thirdRefresh = refreshCookie(loggedIn);
        mockMvc.perform(post("/api/auth/logout").cookie(thirdRefresh).header("X-Requested-With", "XMLHttpRequest"))
                .andExpect(status().isNoContent());
        refresh(thirdRefresh).andExpect(status().isUnauthorized());
    }

    @Test
    void register_rejectsTheSameEmailWithDifferentCase() throws Exception {
        String email = uniqueEmail();
        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(registerBody(email)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody(email.toUpperCase())))
                .andExpect(status().isConflict());
    }

    @Test
    void login_locksTheAccountAfterFiveFailures_evenForTheRightPassword() throws Exception {
        String email = uniqueEmail();
        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(registerBody(email)))
                .andExpect(status().isCreated());

        for (int attempt = 1; attempt <= AuthService.MAX_FAILED_ATTEMPTS; attempt++) {
            login(email, "Wrong-password-1")
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.detail").value("Invalid email or password"));
        }

        login(email, PASSWORD).andExpect(status().isTooManyRequests());
    }

    @Test
    void login_answersTheSameForUnknownEmailAndWrongPassword() throws Exception {
        String email = uniqueEmail();
        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(registerBody(email)))
                .andExpect(status().isCreated());

        String unknown = login(uniqueEmail(), PASSWORD).andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();
        String wrongPassword = login(email, "Wrong-password-1").andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();

        assertThat(unknown).isEqualTo(wrongPassword);
    }

    private ResultActions login(String email, String password) throws Exception {
        return mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "%s"}
                        """.formatted(email, password)));
    }

    private ResultActions refresh(Cookie refreshToken) throws Exception {
        return mockMvc.perform(post("/api/auth/refresh")
                .cookie(refreshToken)
                .header("X-Requested-With", "XMLHttpRequest"));
    }

    private static String registerBody(String email) {
        return """
                {"firstName": "Jane", "lastName": "Doe", "email": "%s", "password": "%s"}
                """.formatted(email, PASSWORD);
    }

    private static String accessToken(MvcResult result) throws Exception {
        return JsonPath.read(result.getResponse().getContentAsString(), "$.accessToken");
    }

    private static Cookie refreshCookie(MvcResult result) {
        Cookie cookie = result.getResponse().getCookie(RefreshTokenCookies.NAME);
        assertThat(cookie).isNotNull();
        assertThat(cookie.isHttpOnly()).isTrue();
        return new Cookie(cookie.getName(), cookie.getValue());
    }

    private static String uniqueEmail() {
        return "user-" + UUID.randomUUID() + "@acme.fr";
    }
}
