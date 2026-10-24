package com.naji.backend.invoice;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class PaymentTermsTest {

    @ParameterizedTest
    @CsvSource({
            "ON_RECEIPT, 2026-10-24, 2026-10-24",
            "NET_15, 2026-10-24, 2026-11-08",
            "NET_30, 2026-10-24, 2026-11-23",
            "NET_45, 2026-10-24, 2026-12-08",
            "NET_60, 2026-12-15, 2027-02-13",
            // 45 days, then the end of that month
            "END_OF_MONTH_45, 2026-10-24, 2026-12-31",
            "END_OF_MONTH_45, 2026-01-10, 2026-02-28",
            "END_OF_MONTH_45, 2028-01-10, 2028-02-29",
            "END_OF_MONTH_45, 2026-01-15, 2026-03-31",
    })
    void dueDate_countsFromTheIssueDate(PaymentTerms terms, LocalDate issueDate, LocalDate expected) {
        assertThat(terms.dueDate(issueDate)).isEqualTo(expected);
    }
}
