package com.naji.backend.invoice;

/** When the customer has to pay, counted from the issue date. French law caps terms at 60 days or 45 days end of month. */
public enum PaymentTerms {
    ON_RECEIPT,
    NET_15,
    NET_30,
    NET_45,
    NET_60,
    END_OF_MONTH_45
}
