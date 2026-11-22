package com.naji.backend.company.dto;

import com.naji.backend.company.LegalForm;
import com.naji.backend.company.VatRegime;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Map;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/** Field and cross-field rules of {@link CompanyRequest}, reported per field as the API returns them. */
class CompanyRequestValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    @Test
    void acceptsACompleteCompany() {
        assertThat(errors(valid())).isEmpty();
    }

    @Test
    void requiresTheMandatoryFields() {
        CompanyRequest empty = new CompanyRequest(null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null);

        assertThat(errors(empty)).containsKeys(
                "legalName", "legalForm", "street", "postalCode", "city", "country", "siret", "vatRegime");
    }

    @Test
    void rejectsASiretWithABadChecksum() {
        assertThat(errors(with(valid(), "73282932000075", "FR44732829320", VatRegime.STANDARD)))
                .containsEntry("siret", "must be a valid SIRET (14 digits)");
    }

    @Test
    void requiresTheShareCapitalForACommercialCompanyOnly() {
        CompanyRequest sasWithoutCapital = new CompanyRequest("Acme", null, LegalForm.SAS, null, "1 rue de la Paix",
                "75002", "Paris", "France", "73282932000074", "FR44732829320", VatRegime.STANDARD, null, null, null,
                null, null);
        CompanyRequest soleTrader = new CompanyRequest("Jane Doe", null, LegalForm.EI_MICRO, null, "1 rue de la Paix",
                "75002", "Paris", "France", "73282932000074", null, VatRegime.FRANCHISE, null, null, null, null, null);

        assertThat(errors(sasWithoutCapital)).containsEntry("shareCapital", "is required for this legal form");
        assertThat(errors(soleTrader)).isEmpty();
    }

    @Test
    void requiresTheVatNumberUnderTheStandardRegimeOnly() {
        assertThat(errors(with(valid(), "73282932000074", null, VatRegime.STANDARD)))
                .containsEntry("vatNumber", "is required under the standard VAT regime");
        assertThat(errors(with(valid(), "73282932000074", " ", VatRegime.FRANCHISE))).isEmpty();
    }

    @Test
    void checksAFrenchVatNumberAgainstTheSiren() {
        assertThat(errors(with(valid(), "73282932000074", "FR 44 732 829 320", VatRegime.STANDARD))).isEmpty();
        assertThat(errors(with(valid(), "73282932000074", "FR45732829320", VatRegime.STANDARD)))
                .containsEntry("vatNumber", "does not match the SIREN of the SIRET");
        assertThat(errors(with(valid(), "73282932000074", "FR64443061841", VatRegime.STANDARD)))
                .containsEntry("vatNumber", "does not match the SIREN of the SIRET");
        assertThat(errors(with(valid(), "73282932000074", "FR12", VatRegime.STANDARD)))
                .containsEntry("vatNumber", "must be a VAT number such as FR44732829320");
    }

    @Test
    void acceptsAForeignVatNumberWithoutCheckingItAgainstTheSiren() {
        assertThat(errors(with(valid(), "73282932000074", "DE123456789", VatRegime.STANDARD))).isEmpty();
    }

    @Test
    void checksTheOptionalBankAndContactDetails() {
        CompanyRequest request = new CompanyRequest("Acme", null, LegalForm.SAS, new BigDecimal("1000"),
                "1 rue de la Paix", "75002", "Paris", "France", "73282932000074", "FR44732829320",
                VatRegime.STANDARD, null, "not-an-email", null, "FR7630006000011234567890188", "BNP");

        assertThat(errors(request)).containsOnlyKeys("email", "iban", "bic");
    }

    @Test
    void rejectsAZeroShareCapitalForACommercialCompany() {
        CompanyRequest request = new CompanyRequest("Acme", null, LegalForm.SARL, BigDecimal.ZERO,
                "1 rue de la Paix", "75002", "Paris", "France", "73282932000074", "FR44732829320",
                VatRegime.STANDARD, null, null, null, null, null);

        assertThat(errors(request)).containsEntry("shareCapital", "must be greater than 0 for this legal form");
    }

    @Test
    void rejectsANegativeShareCapital() {
        CompanyRequest request = new CompanyRequest("Acme", null, LegalForm.SAS, new BigDecimal("-1"),
                "1 rue de la Paix", "75002", "Paris", "France", "73282932000074", "FR44732829320",
                VatRegime.STANDARD, null, null, null, null, null);

        assertThat(errors(request)).containsOnlyKeys("shareCapital");
    }

    static CompanyRequest valid() {
        return new CompanyRequest("Acme SAS", "Acme", LegalForm.SAS, new BigDecimal("10000"), "1 rue de la Paix",
                "75002", "Paris", "France", "73282932000074", "FR44732829320", VatRegime.STANDARD, "RCS Paris",
                "billing@acme.fr", "+33 1 23 45 67 89", "FR76 3000 6000 0112 3456 7890 189", "bnpafrpp");
    }

    private static CompanyRequest with(CompanyRequest r, String siret, String vatNumber, VatRegime regime) {
        return new CompanyRequest(r.legalName(), r.tradeName(), r.legalForm(), r.shareCapital(), r.street(),
                r.postalCode(), r.city(), r.country(), siret, vatNumber, regime, r.registration(), r.email(),
                r.phone(), r.iban(), r.bic());
    }

    private static Map<String, String> errors(CompanyRequest request) {
        return validator.validate(request).stream().collect(Collectors.toMap(
                v -> v.getPropertyPath().toString(), ConstraintViolation::getMessage, (first, second) -> first));
    }
}
