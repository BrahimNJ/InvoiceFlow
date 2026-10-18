package com.naji.backend.common.exception;

/** The request conflicts with the current state of a resource (HTTP 409), e.g. a duplicate unique value. */
public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }
}
