package com.naji.backend.auth;

import java.time.Instant;

/** A token value handed to the client, with its expiry. */
public record IssuedToken(String value, Instant expiresAt) {

    /** Keeps token values out of logs and exception messages. */
    @Override
    public String toString() {
        return "IssuedToken[value=***, expiresAt=" + expiresAt + "]";
    }
}
