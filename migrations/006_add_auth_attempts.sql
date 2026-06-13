-- 006_add_auth_attempts.sql — giriş/kayıt denemelerini izleyerek IP bazlı rate limit sağlar.
-- rate-limit helper bu tabloyu okur; başarılı login'de ilgili IP'nin kayıtları temizlenir,
-- eski kayıtlar ara sıra budanır. Pencere/eşik uygulama tarafında parametreyle belirlenir.

CREATE TABLE IF NOT EXISTS auth_attempts (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ip         VARCHAR(45)  NOT NULL COMMENT 'İstemci IP adresi (IPv4/IPv6)',
    email      VARCHAR(255) NULL COMMENT 'Denenen e-posta (varsa)',
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_ip_created (ip, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
