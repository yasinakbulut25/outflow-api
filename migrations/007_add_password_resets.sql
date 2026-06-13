-- 007_add_password_resets.sql — şifre sıfırlama (OTP) akışı.
-- Kullanıcı "şifremi unuttum" dediğinde 6 haneli kod üretilir; kodun YALNIZCA bcrypt
-- hash'i saklanır (düz kod DB'de tutulmaz). Kod 5 dakika geçerlidir ve en fazla 5 yanlış
-- denemeye izin verilir; doğrulanınca veya süre dolunca satır silinir.
-- Kullanıcı başına tek aktif kod tutulur (user_id UNIQUE → yeni istek eskisini ezer).

CREATE TABLE IF NOT EXISTS password_resets (
    user_id    INT UNSIGNED NOT NULL PRIMARY KEY,
    code_hash  VARCHAR(255) NOT NULL COMMENT 'OTP kodunun bcrypt hash''i (düz kod saklanmaz)',
    expires_at TIMESTAMP    NOT NULL COMMENT 'Kodun son geçerlilik anı (UTC)',
    attempts   TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Yanlış doğrulama denemesi sayısı',
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_expires (expires_at),
    CONSTRAINT fk_password_resets_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
