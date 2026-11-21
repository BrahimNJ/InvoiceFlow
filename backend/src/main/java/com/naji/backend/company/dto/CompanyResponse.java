package com.naji.backend.company.dto;

import com.naji.backend.company.LegalForm;
import com.naji.backend.company.VatRegime;

import java.math.BigDecimal;
import java.time.Instant;

public record CompanyResponse(
        Long id,
        String legalName,
        String tradeName,
        LegalForm legalForm,
        BigDecimal shareCapital,
        String street,
        String postalCode,
        String city,
        String country,
        String siret,
        String siren,
        String vatNumber,
        VatRegime vatRegime,
        String registration,
        String email,
        String phone,
        String iban,
        String bic,
        Instant createdAt,
        Instant updatedAt
) {
}
