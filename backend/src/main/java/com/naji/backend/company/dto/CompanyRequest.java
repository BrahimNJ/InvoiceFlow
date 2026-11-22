package com.naji.backend.company.dto;

import com.naji.backend.common.validation.Iban;
import com.naji.backend.common.validation.Siret;
import com.naji.backend.company.LegalForm;
import com.naji.backend.company.VatRegime;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * The seller details. Besides the field rules, {@link ConsistentCompany} requires the share capital for commercial
 * companies and the VAT number under the standard VAT regime, and checks the VAT number format and, for a French
 * one, its key against the SIREN. Spaces and lower case are tolerated in the VAT number, IBAN and BIC.
 */
@ConsistentCompany
public record CompanyRequest(
        @NotBlank @Size(max = 255) String legalName,
        @Size(max = 255) String tradeName,
        @NotNull LegalForm legalForm,
        @DecimalMin("0") @Digits(integer = 12, fraction = 2) BigDecimal shareCapital,
        @NotBlank @Size(max = 255) String street,
        @NotBlank @Size(max = 10) String postalCode,
        @NotBlank @Size(max = 255) String city,
        @NotBlank @Size(max = 255) String country,
        @NotBlank @Siret String siret,
        @Size(max = 30) String vatNumber,
        @NotNull VatRegime vatRegime,
        @Size(max = 120) String registration,
        @Email @Size(max = 255) String email,
        @Size(max = 30) String phone,
        @Size(max = 50) @Iban String iban,
        @Pattern(regexp = "\\s*([A-Za-z]{6}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?)?\\s*",
                message = "must be a BIC of 8 or 11 characters") String bic
) {
}
