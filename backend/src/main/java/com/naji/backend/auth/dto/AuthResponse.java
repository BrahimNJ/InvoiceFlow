package com.naji.backend.auth.dto;

import com.naji.backend.user.dto.UserResponse;

/**
 * Body of a successful register, login or refresh. The refresh token is never in the body:
 * it travels in an HttpOnly cookie.
 *
 * @param expiresIn access token lifetime in seconds (OAuth 2.0 style), to refresh before it expires
 */
public record AuthResponse(
        String accessToken,
        String tokenType,
        long expiresIn,
        UserResponse user
) {

    public static final String BEARER = "Bearer";
}
