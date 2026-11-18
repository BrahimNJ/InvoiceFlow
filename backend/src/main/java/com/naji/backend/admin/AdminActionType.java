package com.naji.backend.admin;

/** What an admin did to an account. */
public enum AdminActionType {
    ROLE_CHANGED,
    ACCOUNT_SUSPENDED,
    ACCOUNT_REACTIVATED,
    /** Promoted because {@code ADMIN_EMAILS} lists the account, at startup or at sign-up; no admin is behind it. */
    PROMOTED_FROM_CONFIG
}
