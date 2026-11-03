-- A paid invoice has received its whole total and knows when (#44), so a bug cannot leave a PAID row that still
-- asks for money.
ALTER TABLE invoices ADD CONSTRAINT ck_invoices_paid
    CHECK (status <> 'PAID' OR (amount_paid = total AND paid_at IS NOT NULL));
