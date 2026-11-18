package com.naji.backend.admin;

import com.naji.backend.admin.dto.AdminUserResponse;
import com.naji.backend.common.exception.ConflictException;
import com.naji.backend.common.exception.ResourceNotFoundException;
import com.naji.backend.common.security.SecurityConfig;
import com.naji.backend.common.web.PageResponse;
import com.naji.backend.user.Role;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.time.Instant;
import java.util.List;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
        when(adminUserService.search(ADMIN_ID, "acme", 1, 10)).thenReturn(new PageResponse<>(
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
        when(adminUserService.search(ADMIN_ID, null, 0, 20)).thenReturn(new PageResponse<>(List.of(), 0, 20, 0, 0));

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

    @Test
    void changeRole_returnsTheUpdatedAccount() throws Exception {
        when(adminUserService.changeRole(ADMIN_ID, 2L, Role.ADMIN)).thenReturn(
                new AdminUserResponse(2L, "jane@acme.fr", "Jane", "Doe", Role.ADMIN, null, CREATED));

        mockMvc.perform(put("/api/admin/users/2/role").with(admin())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"role\": \"ADMIN\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ADMIN"));
    }

    @Test
    void changeRole_returns400WithoutARole() throws Exception {
        mockMvc.perform(put("/api/admin/users/2/role").with(admin())
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.role").value("Choose a role"));
        verifyNoInteractions(adminUserService);
    }

    @Test
    void changeRole_returns400OnAnUnknownRole() throws Exception {
        mockMvc.perform(put("/api/admin/users/2/role").with(admin())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"role\": \"ROOT\"}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(adminUserService);
    }

    @Test
    void changeRole_returns409OnTheCallersOwnAccount() throws Exception {
        when(adminUserService.changeRole(ADMIN_ID, ADMIN_ID, Role.USER))
                .thenThrow(new ConflictException("You cannot change your own role"));

        mockMvc.perform(put("/api/admin/users/1/role").with(admin())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"role\": \"USER\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("You cannot change your own role"));
    }

    @Test
    void suspend_returnsTheSuspendedAccount() throws Exception {
        Instant suspendedAt = Instant.parse("2026-11-18T10:00:00Z");
        when(adminUserService.suspend(ADMIN_ID, 2L)).thenReturn(
                new AdminUserResponse(2L, "jane@acme.fr", "Jane", "Doe", Role.USER, suspendedAt, CREATED));

        mockMvc.perform(put("/api/admin/users/2/suspension").with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.suspendedAt").value("2026-11-18T10:00:00Z"));
    }

    @Test
    void suspend_returns404OnAnUnknownAccount() throws Exception {
        when(adminUserService.suspend(ADMIN_ID, 404L)).thenThrow(new ResourceNotFoundException("User", 404L));

        mockMvc.perform(put("/api/admin/users/404/suspension").with(admin()))
                .andExpect(status().isNotFound());
    }

    @Test
    void reactivate_returnsTheActiveAccount() throws Exception {
        when(adminUserService.reactivate(ADMIN_ID, 2L)).thenReturn(
                new AdminUserResponse(2L, "jane@acme.fr", "Jane", "Doe", Role.USER, null, CREATED));

        mockMvc.perform(delete("/api/admin/users/2/suspension").with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.suspendedAt").doesNotExist());
    }

    @Test
    void suspension_isForbiddenToAUser() throws Exception {
        mockMvc.perform(put("/api/admin/users/2/suspension").with(user()))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/admin/users/2/suspension").with(user()))
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
