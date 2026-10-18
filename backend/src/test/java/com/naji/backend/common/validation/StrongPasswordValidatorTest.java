package com.naji.backend.common.validation;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class StrongPasswordValidatorTest {

    private record Form(@StrongPassword String password) {
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
    @ValueSource(strings = {"Correct-horse-42", "Abcdefghijk1", "Pässwörd-Çafé-2026"})
    void acceptsStrongPasswords(String password) {
        assertThat(validator.validate(new Form(password))).isEmpty();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {
            "Short-1A",           // fewer than 12 characters
            "alllowercase-123",   // no uppercase letter
            "ALLUPPERCASE-123",   // no lowercase letter
            "No-digits-at-all"    // no digit
    })
    void rejectsWeakPasswords(String password) {
        assertThat(validator.validate(new Form(password))).hasSize(1);
    }

    @Test
    void rejectsPasswordsLongerThan72Bytes() {
        // 25 x "é" = 50 bytes in UTF-8, plus 24 ASCII characters = 74 bytes
        Set<ConstraintViolation<Form>> violations = validator.validate(new Form("é".repeat(25) + "Abc1".repeat(6)));

        assertThat(violations).singleElement()
                .extracting(ConstraintViolation::getMessage)
                .isEqualTo("must not exceed 72 bytes");
    }
}
