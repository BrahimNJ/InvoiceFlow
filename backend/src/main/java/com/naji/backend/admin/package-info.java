/**
 * Admin back-office (ADR 0010): manages accounts and reads platform aggregates.
 * It never reads the customers, products, invoices or payments of another user.
 */
@ApplicationModule(displayName = "Admin")
package com.naji.backend.admin;

import org.springframework.modulith.ApplicationModule;
