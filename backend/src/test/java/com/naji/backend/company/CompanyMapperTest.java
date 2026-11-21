package com.naji.backend.company;

import com.naji.backend.company.dto.CompanyRequest;
import com.naji.backend.company.dto.CompanyResponse;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class CompanyMapperTest {

    private final CompanyMapper mapper = new CompanyMapper();

    @Test
    void normalizesTheIdentifiersAndTrimsTheText() {
        Company company = new Company();
        mapper.updateEntity(company, new CompanyRequest(" Acme SAS ", "  ", LegalForm.SAS, new BigDecimal("10000"),
                "1 rue de la Paix", "75002", "Paris", "France", "73282932000074", "fr 44 732 829 320",
                VatRegime.STANDARD, " RCS Paris ", "", null, "fr76 3000 6000 0112 3456 7890 189", "bnpafrpp"));

        assertThat(company.getLegalName()).isEqualTo("Acme SAS");
        assertThat(company.getTradeName()).isNull();
        assertThat(company.getVatNumber()).isEqualTo("FR44732829320");
        assertThat(company.getRegistration()).isEqualTo("RCS Paris");
        assertThat(company.getEmail()).isNull();
        assertThat(company.getIban()).isEqualTo("FR7630006000011234567890189");
        assertThat(company.getBic()).isEqualTo("BNPAFRPP");
        assertThat(company.getShareCapital()).isEqualByComparingTo("10000");
    }

    @Test
    void dropsTheShareCapitalAndBlankOptionalsForASoleTrader() {
        Company company = new Company();
        mapper.updateEntity(company, new CompanyRequest("Jane Doe", null, LegalForm.EI, new BigDecimal("500"),
                "1 rue de la Paix", "75002", "Paris", "France", "73282932000074", null, VatRegime.FRANCHISE,
                null, null, null, " ", null));

        assertThat(company.getShareCapital()).isNull();
        assertThat(company.getVatNumber()).isNull();
        assertThat(company.getIban()).isNull();
        assertThat(company.getBic()).isNull();
    }

    @Test
    void keepsAnOptionalShareCapitalForAnUnlistedLegalForm() {
        Company company = new Company();
        mapper.updateEntity(company, new CompanyRequest("Cabinet Martin SELARL", null, LegalForm.OTHER,
                new BigDecimal("5000"), "1 rue de la Paix", "75002", "Paris", "France", "73282932000074",
                "FR44732829320", VatRegime.STANDARD, null, null, null, null, null));

        assertThat(company.getShareCapital()).isEqualByComparingTo("5000");
        assertThat(LegalForm.OTHER.requiresShareCapital()).isFalse();
        assertThat(LegalForm.EI.allowsShareCapital()).isFalse();
    }

    @Test
    void exposesTheSirenInTheResponse() {
        Company company = new Company();
        company.setId(3L);
        company.setLegalName("Acme SAS");
        company.setSiret("73282932000074");

        CompanyResponse response = mapper.toResponse(company);

        assertThat(response.id()).isEqualTo(3L);
        assertThat(response.siren()).isEqualTo("732829320");
    }
}
