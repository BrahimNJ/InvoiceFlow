package com.naji.backend.common.validation;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class SiretAndIbanValidatorTest {

    @ParameterizedTest
    @ValueSource(strings = {"73282932000074", "44306184100047", "35600000000048", "35600000049837"})
    void acceptsSiretsWithAValidChecksum(String siret) {
        assertThat(SiretValidator.isValid(siret)).isTrue();
        assertThat(new SiretValidator().isValid(siret, null)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"73282932000075", "12345678901234", "7328293200007", "732829320000740", "7328293200007A",
            "732 829 320 00074", "", "35600000012345"})
    void rejectsMalformedSiretsOrBadChecksums(String siret) {
        assertThat(SiretValidator.isValid(siret)).isFalse();
    }

    @Test
    void nullSiretIsLeftToNotBlank() {
        assertThat(new SiretValidator().isValid(null, null)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"FR7630006000011234567890189", "fr76 3000 6000 0112 3456 7890 189", "DE89370400440532013000"})
    void acceptsValidIbansWhateverTheSpacingAndCase(String iban) {
        assertThat(IbanValidator.isValid(iban)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"FR7630006000011234567890188", "FR76", "7630006000011234567890189", "FR76-3000-6000"})
    void rejectsMalformedIbansOrBadChecksums(String iban) {
        assertThat(IbanValidator.isValid(iban)).isFalse();
    }

    @Test
    void nullOrBlankIbanIsValidAndNormalizationCompactsAndUpperCases() {
        assertThat(new IbanValidator().isValid(null, null)).isTrue();
        assertThat(new IbanValidator().isValid("  ", null)).isTrue();
        assertThat(IbanValidator.normalize("fr76 3000 6000")).isEqualTo("FR7630006000");
    }
}
