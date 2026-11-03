# 0009. Payments in their own module, applied to the invoice in the same transaction

- Status: accepted
- Date: 2026-11-02

## Context and problem

Issue #44 records the payments received on issued invoices. A payment changes its invoice: the amount paid, the
balance due, and the status, which becomes `PAID` when nothing is left to pay. The invoice list and its key figures
(outstanding, overdue) must read the balance of every invoice on a page without loading its payments. Two payments
recorded at the same time must never add up to more than the total.

## Options considered

| Option | For | Against |
|--------|-----|---------|
| Payments inside the `invoice` module | No module boundary to cross | The invoice module keeps growing; payments, reminders and reconciliation would all land there |
| **`payment` module calling a public `InvoicePayments` API, in one transaction** | Clear owner for payments; the invoice module stays the only writer of invoices; balance and payments always agree | Two modules in one transaction: they cannot be split into services without rework |
| `payment` module publishing events that the invoice module handles | Loosest coupling | The balance is updated after the payment, so a second payment can exceed the total meanwhile; eventual consistency to explain on screen |
| Balance computed from the payments on every read | No stored total to keep in sync | A join or a sub-query on every list page and key figure |

## Decision

- A new `payment` module owns the `payments` table (Flyway V8), its entity, service, controller and DTOs. Payments
  refer to their invoice by id only.
- The invoice module exposes `InvoicePayments`, the only way for another module to change an invoice's payment state:
  `receive(owner, invoice, amount, date)`, `giveBack(owner, invoice, amount)` and `requireInvoice(owner, invoice)`.
  It locks the invoice row (`SELECT … FOR UPDATE`), checks the status, the balance and the date, then updates
  `amount_paid`, the status and `paidAt`.
- `InvoicePayments` runs with `Propagation.MANDATORY`: it must join the caller's transaction, so a payment row and the
  amount paid on its invoice are committed together or not at all.
- The invoice stores `amount_paid` (Flyway V7); database checks keep it between 0 and the total, and non-zero only on
  issued or paid invoices.
- Payments are never edited: a mistake is deleted, which gives the amount back and reopens a paid invoice.

## Consequences

- The module diagram gains `payment --> invoice` and `payment --> common`; `invoice` does not know about payments,
  so there is no cycle (verified by `ModularityTest`).
- List pages and key figures read the balance from the invoice row; `InvoiceRepository.balances` sums
  `total - amountPaid` over issued invoices.
- Concurrent payments on one invoice queue on its row lock, like issuing does (ADR 0003).
- An invoice with payments cannot be cancelled. Refunds and corrections will need credit notes, a separate task.
- `amount_paid` duplicates the sum of the payments. Only `InvoicePayments` writes it, in the same transaction as the
  payment, and `PaymentFlowIntegrationTest` checks that they agree through the real stack.
