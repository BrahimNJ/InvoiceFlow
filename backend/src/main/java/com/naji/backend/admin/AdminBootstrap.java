package com.naji.backend.admin;

import com.naji.backend.auth.UserRegistered;
import com.naji.backend.user.Role;
import com.naji.backend.user.User;
import com.naji.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Gives the admin role to the accounts listed in {@code ADMIN_EMAILS} at startup: the only way to get the first admin,
 * since no endpoint lets a user promote themselves. Idempotent and never demotes. An email that has no account yet is
 * promoted when it signs up.
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

    /**
     * Promotes a listed email as soon as it signs up, in the registration transaction, so its first access token
     * already carries the admin role and no restart is needed.
     */
    @EventListener
    @Transactional
    public void onRegistered(UserRegistered event) {
        if (properties.emails().contains(event.email())) {
            promote(List.of(event.email()));
        }
    }

    /** Returns the accounts that became admin during this call. */
    List<User> promote(List<String> emails) {
        List<User> promoted = new ArrayList<>();
        int unknown = 0;
        for (String email : emails) {
            Optional<User> user = userRepository.findByEmail(email);
            if (user.isEmpty()) {
                unknown++;
            } else if (!user.get().isAdmin()) {
                user.get().setRole(Role.ADMIN);
                promoted.add(user.get());
                auditLog.record(null, AdminActionType.PROMOTED_FROM_CONFIG, user.get().getId(), null);
                // Ids only: emails are personal data and stay out of the logs
                log.info("User {} promoted to admin from ADMIN_EMAILS", user.get().getId());
            }
        }
        if (unknown > 0) {
            log.warn("ADMIN_EMAILS lists {} account(s) that do not exist yet", unknown);
        }
        return promoted;
    }
}
