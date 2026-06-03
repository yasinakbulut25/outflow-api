-- 004_user_profile_refactor.sql — username → email, display_name → name
-- Giriş kimliği username yerine email oldu.

ALTER TABLE users
  ADD COLUMN email VARCHAR(255) NULL AFTER id,
  ADD COLUMN name  VARCHAR(128) NULL AFTER email,
  DROP COLUMN username,
  DROP COLUMN display_name,
  ADD UNIQUE INDEX idx_email (email);
