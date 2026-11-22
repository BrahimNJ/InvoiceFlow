/**
 * The seller: each user's company profile (legal name, legal form, address, SIRET, VAT regime, bank details).
 * The invoice module copies it onto an invoice when the invoice is issued.
 */
@ApplicationModule(displayName = "Company")
package com.naji.backend.company;

import org.springframework.modulith.ApplicationModule;
