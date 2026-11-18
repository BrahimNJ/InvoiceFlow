package com.naji.backend.admin;

import com.naji.backend.admin.dto.AdminActionResponse;
import com.naji.backend.common.security.SecurityConfig;
import com.naji.backend.common.web.PageResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static com.naji.backend.admin.AdminUserControllerTest.ADMIN_ID;
import static com.naji.backend.admin.AdminUserControllerTest.admin;
import static com.naji.backend.admin.AdminUserControllerTest.user;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AdminAuditController.class)
@Import(SecurityConfig.class)
class AdminAuditControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AdminAuditService adminAuditService;

    @Test
    void list_returnsAPageOfActions() throws Exception {
        when(adminAuditService.list(ADMIN_ID, 0, 20)).thenReturn(new PageResponse<>(List.of(new AdminActionResponse(
                5L, AdminActionType.ACCOUNT_SUSPENDED, ADMIN_ID, "admin@acme.fr", 2L, "jane@acme.fr", null,
                Instant.parse("2026-11-18T10:00:00Z"))), 0, 20, 1, 1));

        mockMvc.perform(get("/api/admin/audit").with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].action").value("ACCOUNT_SUSPENDED"))
                .andExpect(jsonPath("$.content[0].adminEmail").value("admin@acme.fr"))
                .andExpect(jsonPath("$.content[0].targetEmail").value("jane@acme.fr"));
    }

    @Test
    void list_isForbiddenToAUser() throws Exception {
        mockMvc.perform(get("/api/admin/audit").with(user()))
                .andExpect(status().isForbidden());
        verifyNoInteractions(adminAuditService);
    }
}
