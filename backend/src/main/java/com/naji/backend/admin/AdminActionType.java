package com.naji.backend.admin;

/** What an admin did to an account. */
public enum AdminActionType {
    ROLE_CHANGED,
    ACCOUNT_SUSPENDED,
    ACCOUNT_REACTIVATED,
    /** Promoted by {@code ADMIN_EMAILS} at startup; no admin is behind it. */
    PROMOTED_AT_STARTUP
}
