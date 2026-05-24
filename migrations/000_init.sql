-- 000_init.sql — Outflow temel şema
-- users, categories (+ seed), expenses (temel), expense_items
-- Recurring ve incomes tabloları 001 ve 002 migration'larında eklenir.

CREATE TABLE IF NOT EXISTS users (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(64)  NOT NULL UNIQUE,
    display_name  VARCHAR(128) NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
    id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name  VARCHAR(64) NOT NULL,
    icon  VARCHAR(16) NOT NULL,
    color VARCHAR(7)  NOT NULL COMMENT 'Hex renk, örn #4f46e5'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed kategoriler (SIRA ÖNEMLİ: "Birikim" id = 13). Tekrar çalıştırmada çoğalmaması için
-- yalnızca tablo boşsa eklenir.
INSERT INTO categories (name, icon, color)
SELECT * FROM (
    SELECT 'Yakıt'      AS name, '⛽'  AS icon, '#EF4444' AS color UNION ALL
    SELECT 'Market',      '🛒',  '#22C55E' UNION ALL
    SELECT 'Fatura',      '📄',  '#3B82F6' UNION ALL
    SELECT 'Giyim',       '👕',  '#8B5CF6' UNION ALL
    SELECT 'Elektronik',  '💻',  '#F59E0B' UNION ALL
    SELECT 'Sağlık',      '🏥',  '#EC4899' UNION ALL
    SELECT 'Eğlence',     '🎬',  '#F97316' UNION ALL
    SELECT 'Restoran',    '🍽️', '#84CC16' UNION ALL
    SELECT 'Ulaşım',      '🚌',  '#06B6D4' UNION ALL
    SELECT 'Alışveriş',   '🛍️', '#A855F7' UNION ALL
    SELECT 'Eğitim',      '📚',  '#10B981' UNION ALL
    SELECT 'Diğer',       '📦',  '#6B7280' UNION ALL
    SELECT 'Birikim',     '💰',  '#059669'
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM categories LIMIT 1);

CREATE TABLE IF NOT EXISTS expenses (
    id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id           INT UNSIGNED NOT NULL,
    category_id       INT UNSIGNED NULL,
    title             VARCHAR(255) NOT NULL,
    expense_date      DATE         NOT NULL,
    payment_type      ENUM('cash','installment') NOT NULL DEFAULT 'cash',
    installment_count TINYINT UNSIGNED NULL COMMENT 'NULL=peşin, 2-60=taksit',
    total_amount      DECIMAL(12,2) NOT NULL COMMENT 'Tüm kalemlerin toplamı',
    note              TEXT NULL,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_expenses_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_expenses_category
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    CONSTRAINT chk_installment_count
        CHECK (payment_type = 'cash' OR (installment_count IS NOT NULL AND installment_count >= 2)),

    INDEX idx_expenses_user_date (user_id, expense_date),
    INDEX idx_expenses_category  (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expense_items (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    expense_id INT UNSIGNED NOT NULL,
    name       VARCHAR(255) NOT NULL,
    amount     DECIMAL(12,2) NOT NULL,

    CONSTRAINT fk_items_expense
        FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
    INDEX idx_items_expense (expense_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
