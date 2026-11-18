package com.naji.backend.admin.dto;

import com.naji.backend.user.Role;

import java.time.Instant;

/** An account as the admin back-office sees it: identity, role and status, nothing of its business data. */
public record AdminUserResponse(
        Long id,
        String email,
        String firstName,
        String lastName,
        Role role,
        Instant suspendedAt,
        Instant createdAt
) {
}
