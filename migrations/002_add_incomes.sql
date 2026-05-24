-- 002_add_incomes.sql — aylık gelirler
-- recurring_income_templates (maaş gibi tekrarlayan gelir) + incomes (tek seferlik / materyalize gelir)

CREATE TABLE IF NOT EXISTS recurring_income_templates (
    id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id              INT UNSIGNED NOT NULL,
    title                VARCHAR(255) NOT NULL,
    amount               DECIMAL(12,2) NOT NULL,
    day_of_month         TINYINT UNSIGNED NOT NULL COMMENT '1-28',
    start_date           DATE         NOT NULL,
    end_date             DATE         NULL COMMENT 'NULL = süresiz',
    note                 TEXT         NULL,
    active               TINYINT(1)   NOT NULL DEFAULT 1,
    last_generated_month CHAR(7)      NULL COMMENT 'YYYY-MM, idempotent materyalizasyon için',
    created_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_recurring_income_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_income_day_of_month
        CHECK (day_of_month BETWEEN 1 AND 28),

    INDEX idx_recurring_income_user_active (user_id, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS incomes (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id             INT UNSIGNED NOT NULL,
    title               VARCHAR(255) NOT NULL COMMENT 'Gelir kaynağı, örn "Maaş", "Freelance"',
    amount              DECIMAL(12,2) NOT NULL,
    income_date         DATE         NOT NULL,
    note                TEXT         NULL,
    recurring_income_id INT UNSIGNED NULL COMMENT 'Gelir şablonundan üretildiyse dolu',
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_incomes_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_incomes_recurring_template
        FOREIGN KEY (recurring_income_id) REFERENCES recurring_income_templates(id) ON DELETE SET NULL,

    INDEX idx_incomes_user_date (user_id, income_date),
    INDEX idx_incomes_recurring (recurring_income_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
