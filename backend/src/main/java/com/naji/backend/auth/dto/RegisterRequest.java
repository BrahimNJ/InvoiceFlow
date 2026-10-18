package com.naji.backend.auth.dto;

import com.naji.backend.common.validation.StrongPassword;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank @Size(max = 100) String firstName,
        @NotBlank @Size(max = 100) String lastName,
        @NotBlank @Email @Size(max = 255) String email,
        @StrongPassword String password
) {

    /** Keeps the password out of logs and exception messages. */
    @Override
    public String toString() {
        return "RegisterRequest[firstName=" + firstName + ", lastName=" + lastName + ", email=" + email
                + ", password=***]";
    }
}
