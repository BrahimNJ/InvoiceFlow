package com.naji.backend.company;

/** Legal form of the seller. Commercial companies, unlike sole traders, must show their share capital on invoices. */
public enum LegalForm {
    /** Entreprise individuelle. */
    EI(false),
    /** Entreprise individuelle under the micro-entrepreneur scheme. */
    EI_MICRO(false),
    EURL(true),
    SARL(true),
    SASU(true),
    SAS(true),
    SA(true),
    SNC(true),
    OTHER(false);

    private final boolean shareCapitalRequired;

    LegalForm(boolean shareCapitalRequired) {
        this.shareCapitalRequired = shareCapitalRequired;
    }

    /** Whether invoices must mention the share capital. */
    public boolean requiresShareCapital() {
        return shareCapitalRequired;
    }

    /**
     * Whether a share capital can be recorded: the forms that require one, and {@link #OTHER}, which covers companies
     * not listed here (SELARL, SCOP, SCI...) that may have to show one.
     */
    public boolean allowsShareCapital() {
        return shareCapitalRequired || this == OTHER;
    }
}
