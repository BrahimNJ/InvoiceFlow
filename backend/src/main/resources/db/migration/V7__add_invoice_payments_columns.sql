-- Payments received on an issued invoice (#44). amount_paid is the sum of its payments, kept on the invoice so that
-- the list and the key figures read the balance due without a join. An invoice whose balance reaches zero is PAID.
ALTER TABLE invoices ADD COLUMN amount_paid NUMERIC(14, 2) DEFAULT 0 NOT NULL;
ALTER TABLE invoices ADD COLUMN paid_at TIMESTAMP(6) WITH TIME ZONE;

ALTER TABLE invoices DROP CONSTRAINT ck_invoices_status;
ALTER TABLE invoices ADD CONSTRAINT ck_invoices_status CHECK (status IN ('DRAFT', 'ISSUED', 'PAID', 'CANCELLED'));

-- Never paid more than the total, and only an issued invoice can have been paid at all
ALTER TABLE invoices ADD CONSTRAINT ck_invoices_amount_paid CHECK (amount_paid >= 0 AND amount_paid <= total);
ALTER TABLE invoices ADD CONSTRAINT ck_invoices_paid_status CHECK (amount_paid = 0 OR status IN ('ISSUED', 'PAID'));
