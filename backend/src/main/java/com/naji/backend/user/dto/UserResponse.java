package com.naji.backend.user.dto;

import com.naji.backend.user.Role;

import java.time.Instant;

public record UserResponse(
        Long id,
        String email,
        String firstName,
        String lastName,
        Role role,
        Instant createdAt
) {
}
