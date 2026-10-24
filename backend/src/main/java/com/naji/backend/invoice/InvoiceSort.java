package com.naji.backend.invoice;

/** Sortable columns of the invoices list, with the entity property each one sorts on. */
public enum InvoiceSort {
    CREATED_AT("createdAt"),
    NUMBER("number"),
    CUSTOMER("customer.name"),
    ISSUE_DATE("issueDate"),
    DUE_DATE("dueDate"),
    TOTAL("total");

    private final String property;

    InvoiceSort(String property) {
        this.property = property;
    }

    public String property() {
        return property;
    }
}
