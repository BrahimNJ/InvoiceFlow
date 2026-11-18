package com.naji.backend.admin;

/** What an admin did to an account. */
public enum AdminActionType {
    ROLE_CHANGED,
    ACCOUNT_SUSPENDED,
    ACCOUNT_REACTIVATED,
    /** Promoted at startup because {@code ADMIN_EMAILS} lists the account and no active admin existed. */
    PROMOTED_FROM_CONFIG
}
