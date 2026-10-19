-- Customers created before authentication (#19) have no owner. They were test data: they are removed
-- so that every customer belongs to exactly one user from now on.
DELETE FROM customers;

ALTER TABLE customers ADD COLUMN owner_id BIGINT NOT NULL;
ALTER TABLE customers
    ADD CONSTRAINT fk_customers_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE;

CREATE INDEX idx_customers_owner_id ON customers (owner_id);
