package com.naji.backend.admin;

import com.naji.backend.admin.dto.AdminUserResponse;
import com.naji.backend.user.User;
import org.springframework.stereotype.Component;

/** Never exposes the password hash nor the sign-in lockout counters. */
@Component
public class AdminUserMapper {

    public AdminUserResponse toResponse(User user) {
        return new AdminUserResponse(
                user.getId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getRole(),
                user.getSuspendedAt(),
                user.getCreatedAt()
        );
    }
}
