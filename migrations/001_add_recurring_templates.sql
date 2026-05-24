-- 001_add_recurring_templates.sql — tekrarlayan ödeme şablonları
-- expenses tablosuna recurring_template_id kolonu + FK ekler.

CREATE TABLE IF NOT EXISTS recurring_templates (
    id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id              INT UNSIGNED NOT NULL,
    category_id          INT UNSIGNED NULL,
    title                VARCHAR(255) NOT NULL,
    amount               DECIMAL(12,2) NOT NULL,
    day_of_month         TINYINT UNSIGNED NOT NULL,
    start_date           DATE         NOT NULL,
    end_date             DATE         NULL,
    note                 TEXT         NULL,
    active               TINYINT(1)   NOT NULL DEFAULT 1,
    last_generated_month CHAR(7)      NULL,
    created_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_recurring_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_recurring_category
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    CONSTRAINT chk_day_of_month
        CHECK (day_of_month BETWEEN 1 AND 28),

    INDEX idx_recurring_user_active (user_id, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- expenses.recurring_template_id kolonunu + index + FK ekle.
-- migrate.mjs idempotent değildir; tekrar çalıştırmadan önce kolon varsa bu blok hata verir.
-- Gerekirse önce: ALTER TABLE expenses DROP FOREIGN KEY fk_expenses_recurring_template;
ALTER TABLE expenses
    ADD COLUMN recurring_template_id INT UNSIGNED NULL;

ALTER TABLE expenses
    ADD INDEX idx_expenses_recurring (recurring_template_id);

ALTER TABLE expenses
    ADD CONSTRAINT fk_expenses_recurring_template
    FOREIGN KEY (recurring_template_id) REFERENCES recurring_templates(id) ON DELETE SET NULL;
