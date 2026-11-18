-- An admin can suspend an account (#46): it can no longer sign in or refresh. NULL means active.
ALTER TABLE users ADD COLUMN suspended_at TIMESTAMP(6) WITH TIME ZONE;

-- Only the two roles of the application, so a typo in a manual update cannot create an unknown role.
ALTER TABLE users ADD CONSTRAINT ck_users_role CHECK (role IN ('USER', 'ADMIN'));
