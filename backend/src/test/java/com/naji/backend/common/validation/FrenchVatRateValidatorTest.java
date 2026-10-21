package com.naji.backend.common.validation;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class FrenchVatRateValidatorTest {

    private record Form(@FrenchVatRate BigDecimal vatRate) {
    }

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

    @ParameterizedTest
    @ValueSource(strings = {"20", "20.00", "10", "5.5", "5.50", "2.1", "0", "0.00"})
    void acceptsTheFrenchRatesWhateverTheScale(String rate) {
        assertThat(validator.validate(new Form(new BigDecimal(rate)))).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"19.6", "7", "5.6", "-20", "100", "2.10001"})
    void rejectsOtherRates(String rate) {
        assertThat(validator.validate(new Form(new BigDecimal(rate))))
                .singleElement()
                .satisfies(violation -> assertThat(violation.getMessage()).contains("French VAT rates"));
    }

    @Test
    void leavesNullToNotNull() {
        assertThat(validator.validate(new Form(null))).isEmpty();
    }
}
