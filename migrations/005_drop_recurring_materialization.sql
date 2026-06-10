-- 005_drop_recurring_materialization.sql
-- Tekrarlayan ödeme/gelir artık DB'ye materyalize EDİLMİYOR; occurrence'lar okuma
-- anında şablondan türetiliyor (recurring-expander / recurring-income-expander).
-- Bu migration eski materyalize satırları temizler ve artık kullanılmayan
-- last_generated_month kolonlarını kaldırır.
--
-- ⚠️ Yıkıcı ama güvenli: override modeli olmadığından bu satırlar şablonla birebir
-- aynıydı; silindiklerinde sanal occurrence olarak yeniden üretilirler.

-- Materyalize edilmiş tekrarlayan harcamalar (expense_items FK'si ON DELETE CASCADE → birlikte silinir)
DELETE FROM expenses WHERE recurring_template_id IS NOT NULL;

-- Materyalize edilmiş tekrarlayan gelirler
DELETE FROM incomes WHERE recurring_income_id IS NOT NULL;

-- Artık kullanılmayan idempotent-materyalizasyon imleci
ALTER TABLE recurring_templates        DROP COLUMN last_generated_month;
ALTER TABLE recurring_income_templates DROP COLUMN last_generated_month;
