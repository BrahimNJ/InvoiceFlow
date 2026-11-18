package com.naji.backend.admin;

import com.naji.backend.user.Role;
import com.naji.backend.user.User;
import com.naji.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Bootstraps the first admins: at startup, while the platform has no active admin, the existing accounts listed in
 * {@code ADMIN_EMAILS} become admins. It is the only way to get an admin, since no endpoint lets a user promote
 * themselves. Once an admin exists the list is ignored, so a listed account that an admin demoted stays demoted.
 * Never at sign-up: without email verification, whoever registered a listed address first would become admin.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AdminBootstrap implements ApplicationRunner {

    private final AdminProperties properties;
    private final UserRepository userRepository;
    private final AuditLog auditLog;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        promote(properties.emails());
    }

    /** Returns the accounts that became admin during this call. */
    List<User> promote(List<String> emails) {
        if (emails.isEmpty()) {
            return List.of();
        }
        if (userRepository.countByRoleAndSuspendedAtIsNull(Role.ADMIN) > 0) {
            log.info("ADMIN_EMAILS ignored: the platform already has an active admin");
            return List.of();
        }
        List<User> promoted = new ArrayList<>();
        int unknown = 0;
        for (String email : emails) {
            Optional<User> user = userRepository.findByEmail(email);
            if (user.isEmpty()) {
                unknown++;
            } else {
                user.get().setRole(Role.ADMIN);
                promoted.add(user.get());
                auditLog.record(null, AdminActionType.PROMOTED_FROM_CONFIG, user.get().getId(), null);
                // Ids only: emails are personal data and stay out of the logs
                log.info("User {} promoted to admin from ADMIN_EMAILS", user.get().getId());
            }
        }
        if (unknown > 0) {
            log.warn("ADMIN_EMAILS lists {} address(es) without an account: sign up, then restart", unknown);
        }
        return promoted;
    }
}
