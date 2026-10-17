package com.naji.backend.customer.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CustomerRequest(
        @NotBlank @Size(max = 255) String name,
        @NotBlank @Email String email,
        @Size(max = 30) String phone,
        String street,
        @Size(max = 10) String postalCode,
        String city,
        String country,
        @Pattern(regexp = "\\d{14}", message = "must be 14 digits") String siret,
        @Size(max = 20) String vatNumber
) {
}
