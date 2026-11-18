package com.naji.backend.admin;

import com.jayway.jsonpath.JsonPath;
import com.naji.backend.user.Role;
import com.naji.backend.user.User;
import com.naji.backend.user.UserRepository;
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

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The back-office through the real stack: signed tokens, security filter chain, Flyway schema, committed transactions.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminFlowIntegrationTest {

    private static final String PASSWORD = "Correct-horse-42";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Test
    void anAdminSuspendsAnAccountWhichCanNoLongerSignInOrRefresh() throws Exception {
        String adminEmail = uniqueEmail("admin");
        String userEmail = uniqueEmail("user");
        Account admin = register(adminEmail);
        Account user = register(userEmail);

        // A user never reaches the back-office
        mockMvc.perform(get("/api/admin/users").header(HttpHeaders.AUTHORIZATION, user.bearer()))
                .andExpect(status().isForbidden());

        // Promoted in the database (what ADMIN_EMAILS does at startup), the role reaches the next token
        promote(adminEmail);
        String adminToken = signIn(adminEmail).bearer();

        mockMvc.perform(get("/api/admin/users").param("search", userEmail)
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(user.id()))
                .andExpect(jsonPath("$.content[0].passwordHash").doesNotExist());

        // Suspension: the user can neither sign in nor refresh any more
        mockMvc.perform(put("/api/admin/users/{id}/suspension", user.id()).header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.suspendedAt").isNotEmpty());
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(loginBody(userEmail)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("This account is suspended. Contact the administrator."));
        mockMvc.perform(post("/api/auth/refresh").cookie(user.refreshCookie())
                        .header("X-Requested-With", "XMLHttpRequest"))
                .andExpect(status().isUnauthorized());

        // Reactivated, the user signs in again
        mockMvc.perform(delete("/api/admin/users/{id}/suspension", user.id())
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk());
        signIn(userEmail);

        // The audit log keeps both actions, newest first, with who did what to whom
        mockMvc.perform(get("/api/admin/audit").header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].action").value("ACCOUNT_REACTIVATED"))
                .andExpect(jsonPath("$.content[0].adminEmail").value(adminEmail))
                .andExpect(jsonPath("$.content[0].targetEmail").value(userEmail))
                .andExpect(jsonPath("$.content[1].action").value("ACCOUNT_SUSPENDED"));
    }

    @Test
    void anAdminCannotChangeTheirOwnRoleAndLosesAccessAtOnceWhenDemoted() throws Exception {
        String adminEmail = uniqueEmail("admin");
        Account registered = register(adminEmail);
        promote(adminEmail);
        String adminToken = signIn(adminEmail).bearer();

        mockMvc.perform(put("/api/admin/users/{id}/role", registered.id()).header(HttpHeaders.AUTHORIZATION, adminToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"role\": \"USER\"}"))
                .andExpect(status().isConflict());
        mockMvc.perform(get("/api/admin/stats").header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.admins").isNumber());

        // Demoted by someone else: the token still says ADMIN, the database check refuses it
        User demoted = userRepository.findByEmail(adminEmail).orElseThrow();
        demoted.setRole(Role.USER);
        userRepository.saveAndFlush(demoted);

        mockMvc.perform(get("/api/admin/stats").header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isForbidden());
    }

    private record Account(long id, String bearer, Cookie refreshCookie) {
    }

    private void promote(String email) {
        User user = userRepository.findByEmail(email).orElseThrow();
        user.setRole(Role.ADMIN);
        userRepository.saveAndFlush(user);
    }

    private Account register(String email) throws Exception {
        return account(mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content("""
                        {"firstName": "Jane", "lastName": "Doe", "email": "%s", "password": "%s"}
                        """.formatted(email, PASSWORD)))
                .andExpect(status().isCreated())
                .andReturn());
    }

    private Account signIn(String email) throws Exception {
        return account(mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody(email)))
                .andExpect(status().isOk())
                .andReturn());
    }

    private static Account account(MvcResult result) throws Exception {
        String body = result.getResponse().getContentAsString();
        Number id = JsonPath.read(body, "$.user.id");
        Cookie cookie = result.getResponse().getCookie("refresh_token");
        return new Account(id.longValue(), "Bearer " + JsonPath.read(body, "$.accessToken"),
                new Cookie(cookie.getName(), cookie.getValue()));
    }

    private static String loginBody(String email) {
        return """
                {"email": "%s", "password": "%s"}
                """.formatted(email, PASSWORD);
    }

    private static String uniqueEmail(String prefix) {
        return prefix + "-" + UUID.randomUUID() + "@acme.fr";
    }
}
