package com.naji.backend.admin;

import com.naji.backend.admin.dto.AdminUserResponse;
import com.naji.backend.common.web.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Accounts of the platform, for admins only ({@code /api/admin/**} requires {@code ROLE_ADMIN}). */
@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final AdminUserService adminUserService;

    /** {@code GET /api/admin/users?search=acme&page=0&size=20}: newest first, {@code size} capped at 100. */
    @GetMapping
    public PageResponse<AdminUserResponse> search(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return adminUserService.search(adminId(jwt), search, page, size);
    }

    private static Long adminId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
