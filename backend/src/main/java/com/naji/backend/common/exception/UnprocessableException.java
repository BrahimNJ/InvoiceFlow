package com.naji.backend.common.exception;

import java.util.Map;

/**
 * The request is well-formed but breaks a business rule (HTTP 422), e.g. issuing an incomplete invoice.
 * {@code properties} are added to the problem detail so that the client can show what to fix.
 */
public class UnprocessableException extends RuntimeException {

    private final transient Map<String, Object> properties;

    public UnprocessableException(String message, Map<String, Object> properties) {
        super(message);
        this.properties = Map.copyOf(properties);
    }

    public Map<String, Object> getProperties() {
        return properties;
    }
}
