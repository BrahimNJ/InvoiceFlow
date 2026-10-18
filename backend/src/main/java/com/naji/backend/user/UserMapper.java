package com.naji.backend.user;

import com.naji.backend.user.dto.UserResponse;
import org.springframework.stereotype.Component;

/** Never exposes the password hash nor the lockout state. */
@Component
public class UserMapper {

    public UserResponse toResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getRole(),
                user.getCreatedAt()
        );
    }
}
