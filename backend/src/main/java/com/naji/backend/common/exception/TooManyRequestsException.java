package com.naji.backend.common.exception;

/** A client sent more requests than allowed; answered with 429 and a {@code Retry-After} header. */
public class TooManyRequestsException extends RuntimeException {

    public TooManyRequestsException(String message) {
        super(message);
    }
}
