package com.naji.backend.admin;

import com.naji.backend.admin.dto.AdminUserResponse;
import com.naji.backend.common.security.SecurityConfig;
import com.naji.backend.common.web.PageResponse;
import com.naji.backend.user.Role;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.time.Instant;
import java.util.List;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AdminUserController.class)
@Import(SecurityConfig.class)
class AdminUserControllerTest {

    static final Long ADMIN_ID = 1L;
    static final Instant CREATED = Instant.parse("2026-11-01T09:00:00Z");

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AdminUserService adminUserService;

    @Test
    void search_returnsAPageOfAccounts() throws Exception {
        when(adminUserService.search("acme", 1, 10)).thenReturn(new PageResponse<>(
                List.of(new AdminUserResponse(2L, "jane@acme.fr", "Jane", "Doe", Role.USER, null, CREATED)),
                1, 10, 11, 2));

        mockMvc.perform(get("/api/admin/users").param("search", "acme").param("page", "1").param("size", "10")
                        .with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].email").value("jane@acme.fr"))
                .andExpect(jsonPath("$.content[0].role").value("USER"))
                .andExpect(jsonPath("$.content[0].suspendedAt").doesNotExist())
                .andExpect(jsonPath("$.content[0].passwordHash").doesNotExist())
                .andExpect(jsonPath("$.totalElements").value(11));
    }

    @Test
    void search_defaultsToTheFirstPageOf20() throws Exception {
        when(adminUserService.search(null, 0, 20)).thenReturn(new PageResponse<>(List.of(), 0, 20, 0, 0));

        mockMvc.perform(get("/api/admin/users").with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isEmpty());
    }

    @Test
    void search_isForbiddenToAUser() throws Exception {
        mockMvc.perform(get("/api/admin/users").with(user()))
                .andExpect(status().isForbidden());
        verifyNoInteractions(adminUserService);
    }

    static RequestPostProcessor admin() {
        return jwt().jwt(token -> token.subject(ADMIN_ID.toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }

    static RequestPostProcessor user() {
        return jwt().jwt(token -> token.subject("2")).authorities(new SimpleGrantedAuthority("ROLE_USER"));
    }
}
