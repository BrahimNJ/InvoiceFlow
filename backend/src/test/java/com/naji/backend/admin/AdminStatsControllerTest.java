package com.naji.backend.admin;

import com.naji.backend.admin.dto.PlatformStatsResponse;
import com.naji.backend.common.security.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static com.naji.backend.admin.AdminUserControllerTest.ADMIN_ID;
import static com.naji.backend.admin.AdminUserControllerTest.admin;
import static com.naji.backend.admin.AdminUserControllerTest.user;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AdminStatsController.class)
@Import(SecurityConfig.class)
class AdminStatsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AdminStatsService adminStatsService;

    @Test
    void stats_returnsTheAggregates() throws Exception {
        when(adminStatsService.stats(ADMIN_ID)).thenReturn(new PlatformStatsResponse(12, 2, 1, 4, 30, 57));

        mockMvc.perform(get("/api/admin/stats").with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.users").value(12))
                .andExpect(jsonPath("$.invoicesIssued").value(57));
    }

    @Test
    void stats_isForbiddenToAUser() throws Exception {
        mockMvc.perform(get("/api/admin/stats").with(user()))
                .andExpect(status().isForbidden());
        verifyNoInteractions(adminStatsService);
    }
}
