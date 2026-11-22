-- The seller's details copied from the owner's company when the invoice is issued (#48). They stay NULL on a draft
-- (it follows the current company) and on invoices issued before this migration.
ALTER TABLE invoices ADD COLUMN seller_legal_name    VARCHAR(255);
ALTER TABLE invoices ADD COLUMN seller_trade_name    VARCHAR(255);
ALTER TABLE invoices ADD COLUMN seller_legal_form    VARCHAR(10);
ALTER TABLE invoices ADD COLUMN seller_share_capital NUMERIC(14, 2);
ALTER TABLE invoices ADD COLUMN seller_street        VARCHAR(255);
ALTER TABLE invoices ADD COLUMN seller_postal_code   VARCHAR(10);
ALTER TABLE invoices ADD COLUMN seller_city          VARCHAR(255);
ALTER TABLE invoices ADD COLUMN seller_country       VARCHAR(255);
ALTER TABLE invoices ADD COLUMN seller_siret         VARCHAR(14);
ALTER TABLE invoices ADD COLUMN seller_vat_number    VARCHAR(20);
ALTER TABLE invoices ADD COLUMN seller_vat_regime    VARCHAR(10);
ALTER TABLE invoices ADD COLUMN seller_registration  VARCHAR(120);
ALTER TABLE invoices ADD COLUMN seller_email         VARCHAR(255);
ALTER TABLE invoices ADD COLUMN seller_phone         VARCHAR(30);
ALTER TABLE invoices ADD COLUMN seller_iban          VARCHAR(34);
ALTER TABLE invoices ADD COLUMN seller_bic           VARCHAR(11);
