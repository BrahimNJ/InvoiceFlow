package com.naji.backend.admin;

import com.naji.backend.user.User;
import com.naji.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Checks the caller in the database, on top of the {@code ADMIN} role in its access token: an admin who was demoted or
 * suspended loses access at once instead of when the token expires (ADR 0010). Every admin service calls it first.
 */
@Component
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminAccess {

    static final String NOT_AN_ACTIVE_ADMIN = "You are not allowed to access this resource";

    private final UserRepository userRepository;

    /** Returns the caller's account, or throws {@link AccessDeniedException} (403) unless it is an active admin. */
    public User requireActiveAdmin(Long adminId) {
        return userRepository.findById(adminId)
                .filter(User::isAdmin)
                .filter(user -> !user.isSuspended())
                .orElseThrow(() -> new AccessDeniedException(NOT_AN_ACTIVE_ADMIN));
    }
}
