package com.naji.backend.auth;

/**
 * Published inside the registration transaction, before the first tokens are issued: a synchronous listener can still
 * change the new account (the admin module promotes the emails listed in {@code ADMIN_EMAILS}).
 *
 * @param email normalized email of the new account
 */
public record UserRegistered(Long userId, String email) {
}
