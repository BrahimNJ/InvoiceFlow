package com.naji.backend.company;

import com.naji.backend.common.validation.IbanValidator;
import com.naji.backend.company.dto.CompanyRequest;
import com.naji.backend.company.dto.CompanyResponse;
import org.springframework.stereotype.Component;

import java.util.Locale;

/**
 * Maps the company DTOs. Blank optional fields are stored as {@code null}; the VAT number, IBAN and BIC are stored
 * compact and upper case. The share capital is dropped for legal forms that cannot show one (sole traders).
 */
@Component
public class CompanyMapper {

    public void updateEntity(Company company, CompanyRequest request) {
        company.setLegalName(request.legalName().trim());
        company.setTradeName(trimToNull(request.tradeName()));
        company.setLegalForm(request.legalForm());
        company.setShareCapital(request.legalForm().allowsShareCapital() ? request.shareCapital() : null);
        company.setStreet(request.street().trim());
        company.setPostalCode(request.postalCode().trim());
        company.setCity(request.city().trim());
        company.setCountry(request.country().trim());
        company.setSiret(request.siret());
        String vatNumber = trimToNull(request.vatNumber());
        company.setVatNumber(vatNumber == null ? null : VatNumbers.normalize(vatNumber));
        company.setVatRegime(request.vatRegime());
        company.setRegistration(trimToNull(request.registration()));
        company.setEmail(trimToNull(request.email()));
        company.setPhone(trimToNull(request.phone()));
        String iban = trimToNull(request.iban());
        company.setIban(iban == null ? null : IbanValidator.normalize(iban));
        String bic = trimToNull(request.bic());
        company.setBic(bic == null ? null : bic.toUpperCase(Locale.ROOT));
    }

    public CompanyResponse toResponse(Company company) {
        return new CompanyResponse(
                company.getId(),
                company.getLegalName(),
                company.getTradeName(),
                company.getLegalForm(),
                company.getShareCapital(),
                company.getStreet(),
                company.getPostalCode(),
                company.getCity(),
                company.getCountry(),
                company.getSiret(),
                company.getSiren(),
                company.getVatNumber(),
                company.getVatRegime(),
                company.getRegistration(),
                company.getEmail(),
                company.getPhone(),
                company.getIban(),
                company.getBic(),
                company.getCreatedAt(),
                company.getUpdatedAt()
        );
    }

    private static String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
