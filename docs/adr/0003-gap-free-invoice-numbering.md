# 0003. Gap-free invoice numbering

- Status: accepted
- Date: 2026-10-24

## Context and problem

French law requires invoice numbers to follow a continuous chronological sequence without gaps (Code général des
impôts, annexe II, art. 242 nonies A). Numbers are per seller and, in InvoiceFlow, restart each fiscal year:
`F-2026-0001`, `F-2026-0002`… Two invoices may be issued at the same moment, and an issue may fail after a number
was taken.

## Options considered

| Option | For | Against |
|--------|-----|---------|
| Database sequence (`nextval`) | Fast, concurrent | Sequences are not transactional: a rolled-back issue leaves a hole |
| `max(number) + 1` | No extra table | Two concurrent issues read the same maximum: duplicate numbers |
| **Counter row per owner and year, updated in the issuing transaction** | The row lock serialises concurrent issues; a rollback releases the number | Issues of one owner are serialised (acceptable: a few per day) |

## Decision

`InvoiceNumberGenerator.next` runs with `Propagation.MANDATORY` inside the transaction that issues the invoice. It
inserts the owner's counter row for the year if missing (`on conflict do nothing`), increments it with an `UPDATE`
(which locks the row until commit) and reads the new value. A unique constraint on `(owner_id, number)` is the last
line of defence.

## Consequences

- No holes and no duplicates, verified by a test that issues invoices from parallel threads.
- Drafts have no number; only issuing consumes one, so deleting a draft never creates a gap.
- Cancelling an issued invoice keeps its number (a credit note will follow), as the law requires.
