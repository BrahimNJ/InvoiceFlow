package com.naji.backend.common.exception;

public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String resource, Long id) {
        super(resource + " with id " + id + " not found");
    }

    /** For a resource that is not looked up by id, such as the signed-in user's company. */
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
