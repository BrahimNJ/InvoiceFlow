package com.naji.backend.admin;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;

/**
 * Writes the audit log in the transaction of the action it records: both are committed together or not at all.
 */
@Component
@RequiredArgsConstructor
@Transactional(propagation = Propagation.MANDATORY)
public class AuditLog {

    private final AdminActionRepository adminActionRepository;
    private final Clock clock;

    /** @param adminId {@code null} when no admin is behind the action (promotion from {@code ADMIN_EMAILS}) */
    public void record(Long adminId, AdminActionType action, Long targetUserId, String details) {
        adminActionRepository.save(new AdminAction(adminId, action, targetUserId, details, clock.instant()));
    }
}
