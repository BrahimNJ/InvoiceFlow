package com.naji.backend.invoice;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Gives issued invoices consecutive numbers per owner and year: {@code F-2026-0001}, {@code F-2026-0002}…
 * French law requires a continuous sequence without gaps. The counter row is updated, hence locked, until the
 * issuing transaction ends: a concurrent issue waits for it, and a rolled-back issue gives its number back.
 */
@Component
@RequiredArgsConstructor
public class InvoiceNumberGenerator {

    private final JdbcTemplate jdbcTemplate;

    /** Must run in the transaction that issues the invoice, so that the number and the invoice commit together. */
    @Transactional(propagation = Propagation.MANDATORY)
    public String next(Long ownerId, int year) {
        jdbcTemplate.update("""
                insert into invoice_number_sequences (owner_id, fiscal_year, last_value) values (?, ?, 0)
                on conflict do nothing
                """, ownerId, year);
        jdbcTemplate.update("""
                update invoice_number_sequences set last_value = last_value + 1
                where owner_id = ? and fiscal_year = ?
                """, ownerId, year);
        Integer value = jdbcTemplate.queryForObject("""
                select last_value from invoice_number_sequences where owner_id = ? and fiscal_year = ?
                """, Integer.class, ownerId, year);
        return format(year, value);
    }

    static String format(int year, int value) {
        return "F-%d-%04d".formatted(year, value);
    }
}
