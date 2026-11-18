package com.naji.backend.admin;

import com.naji.backend.admin.dto.AdminActionResponse;
import com.naji.backend.common.web.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The audit log of admin actions, for admins only. */
@RestController
@RequestMapping("/api/admin/audit")
@RequiredArgsConstructor
public class AdminAuditController {

    private final AdminAuditService adminAuditService;

    /** {@code GET /api/admin/audit?page=0&size=20}: newest first, {@code size} capped at 100. */
    @GetMapping
    public PageResponse<AdminActionResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return adminAuditService.list(Long.valueOf(jwt.getSubject()), page, size);
    }
}
