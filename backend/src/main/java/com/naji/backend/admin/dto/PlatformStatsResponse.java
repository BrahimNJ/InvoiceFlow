package com.naji.backend.admin.dto;

/**
 * How the platform is used, in counts only: no amount, no name, nothing that belongs to one business (ADR 0010).
 *
 * @param newUsersLast30Days accounts created in the last 30 days
 * @param invoicesIssued     invoices that left the draft state and were not cancelled (issued or paid)
 */
public record PlatformStatsResponse(
        long users,
        long admins,
        long suspendedUsers,
        long newUsersLast30Days,
        long customers,
        long invoicesIssued
) {
}
