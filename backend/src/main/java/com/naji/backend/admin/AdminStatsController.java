package com.naji.backend.admin;

import com.naji.backend.admin.dto.PlatformStatsResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Platform aggregates, for admins only. */
@RestController
@RequestMapping("/api/admin/stats")
@RequiredArgsConstructor
public class AdminStatsController {

    private final AdminStatsService adminStatsService;

    @GetMapping
    public PlatformStatsResponse stats(@AuthenticationPrincipal Jwt jwt) {
        return adminStatsService.stats(Long.valueOf(jwt.getSubject()));
    }
}
