package com.naji.backend.customer.dto;

import java.time.Instant;

public record CustomerResponse(
        Long id,
        String name,
        String email,
        String phone,
        String street,
        String postalCode,
        String city,
        String country,
        String siret,
        String vatNumber,
        Instant createdAt,
        Instant updatedAt
) {
}
