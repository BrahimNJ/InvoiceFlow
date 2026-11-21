package com.naji.backend.company;

/** How the seller handles VAT. */
public enum VatRegime {
    /** The seller charges VAT at the French rates. */
    STANDARD,
    /** VAT exemption for small businesses: no VAT, "TVA non applicable, art. 293 B du CGI" on invoices. */
    FRANCHISE
}
