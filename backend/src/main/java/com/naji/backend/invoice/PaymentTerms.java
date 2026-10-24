package com.naji.backend.invoice;

import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;

/** When the customer has to pay, counted from the issue date. French law caps terms at 60 days or 45 days end of month. */
public enum PaymentTerms {
    ON_RECEIPT(0),
    NET_15(15),
    NET_30(30),
    NET_45(45),
    NET_60(60),
    /** 45 days after the issue date, then the end of that month (the usual reading of "45 jours fin de mois"). */
    END_OF_MONTH_45(45);

    private final int days;

    PaymentTerms(int days) {
        this.days = days;
    }

    public LocalDate dueDate(LocalDate issueDate) {
        LocalDate due = issueDate.plusDays(days);
        return this == END_OF_MONTH_45 ? due.with(TemporalAdjusters.lastDayOfMonth()) : due;
    }
}
