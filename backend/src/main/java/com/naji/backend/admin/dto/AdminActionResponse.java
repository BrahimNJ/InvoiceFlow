package com.naji.backend.admin.dto;

import com.naji.backend.admin.AdminActionType;

import java.time.Instant;

/**
 * One line of the audit log.
 *
 * @param adminEmail {@code null} for a promotion from {@code ADMIN_EMAILS}
 */
public record AdminActionResponse(
        Long id,
        AdminActionType action,
        Long adminId,
        String adminEmail,
        Long targetUserId,
        String targetEmail,
        String details,
        Instant createdAt
) {
}
