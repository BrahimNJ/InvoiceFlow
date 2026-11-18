package com.naji.backend.admin.dto;

import com.naji.backend.user.Role;
import jakarta.validation.constraints.NotNull;

public record RoleChangeRequest(@NotNull(message = "Choose a role") Role role) {
}
