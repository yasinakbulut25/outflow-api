-- 003_add_social_auth.sql — Google ve Apple ile giriş için users tablosuna kolon ekle.
-- password_hash NULL yapılabilir hale gelir; sosyal giriş kullanıcıları şifre ayarlamaz.

ALTER TABLE users
  MODIFY COLUMN password_hash VARCHAR(255) NULL,
  ADD COLUMN google_id VARCHAR(255) NULL,
  ADD COLUMN apple_id  VARCHAR(255) NULL,
  ADD UNIQUE INDEX idx_google_id (google_id),
  ADD UNIQUE INDEX idx_apple_id  (apple_id);
