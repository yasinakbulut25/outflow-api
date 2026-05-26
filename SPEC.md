# 💸 Outflow — Tam Proje Spesifikasyonu ve Sıfırdan İnşa Planı

> Bu doküman, bir AI modelinin (veya bir geliştiricinin) **sıfırdan, eksiksiz ve doğru** şekilde
> Outflow uygulamasını baştan sona inşa edebilmesi için hazırlanmıştır. Hem uygulamanın **ne işe
> yaradığını ve kullanıcı davranışlarını**, hem de **tüm teknik gereksinimleri, veritabanı şemasını
> ve API sözleşmesini** içerir. Adım adım izlenebilir bir uygulama planı sunar.
>
> **Önemli:** Bu belge, projenin gerçek (mevcut) mimarisini yansıtır. Backend **PHP değildir** —
> backend ve frontend tek bir **Next.js (App Router)** uygulaması içinde, **Route Handlers** ile
> birlikte çalışır. Veritabanı **MySQL**'dir ve `mysql2` ile erişilir.

---

## 📋 İçindekiler

1. [Proje Genel Bakış ve Amaç](#1-proje-genel-bakış-ve-amaç)
2. [Özellikler (Kullanıcı Gözünden)](#2-özellikler-kullanıcı-gözünden)
3. [Kullanıcı Senaryoları ve Davranış Gereksinimleri](#3-kullanıcı-senaryoları-ve-davranış-gereksinimleri)
4. [Teknik Yığın (Tech Stack)](#4-teknik-yığın-tech-stack)
5. [Proje Dizin Yapısı](#5-proje-dizin-yapısı)
6. [Veritabanı Şeması (MySQL) — Tam SQL](#6-veritabanı-şeması-mysql--tam-sql)
7. [Kimlik Doğrulama Mimarisi (JWT)](#7-kimlik-doğrulama-mimarisi-jwt)
8. [API Sözleşmesi (Route Handlers)](#8-api-sözleşmesi-route-handlers)
9. [İş Kuralları ve Hesaplamalar](#9-iş-kuralları-ve-hesaplamalar)
10. [Frontend Mimarisi](#10-frontend-mimarisi)
11. [Redux Store Yapısı](#11-redux-store-yapısı)
12. [Sayfa ve Bileşen Detayları](#12-sayfa-ve-bileşen-detayları)
13. [Tasarım Sistemi](#13-tasarım-sistemi)
14. [PWA Konfigürasyonu](#14-pwa-konfigürasyonu)
15. [Ortam Değişkenleri](#15-ortam-değişkenleri)
16. [Güvenlik Gereksinimleri](#16-güvenlik-gereksinimleri)
17. [Hata Yönetimi](#17-hata-yönetimi)
18. [Adım Adım İnşa Planı (AI İçin)](#18-adım-adım-i̇nşa-planı-ai-i̇çin)
19. [Kabul Kriterleri / Test Senaryoları](#19-kabul-kriterleri--test-senaryoları)

---

## 1. Proje Genel Bakış ve Amaç

**Outflow**, kişisel harcama takip uygulamasıdır. Birden fazla kullanıcı kendi harcamalarını
bağımsız olarak yönetir. Uygulama harcamaları **aylara ve günlere** bölerek listeler; hem **peşin**
hem **taksitli** alımları destekler. Taksitli alımlarda aylık taksit tutarı otomatik hesaplanır ve
ödeme takvimi gelecek aylara dağıtılarak gösterilir. Ayrıca **tekrarlayan (abonelik tarzı)**
ödemeler ve **birikim** kayıtları desteklenir. Analitik ekranı kategori, aylık özet ve taksit
yükünü görselleştirir. Uygulama **PWA**'dır (yüklenebilir, offline cache).

### Temel Değer Önerisi
- Aylık nakit akışını ve gelecekteki taksit yükünü net görmek.
- Çok kalemli alımları tek harcama altında gruplamak.
- Sabit/aylık ödemeleri (kira, Netflix vb.) bir kez tanımlayıp otomatik üretmek.
- Birikimleri ayrı bir görünümde izlemek.

---

## 2. Özellikler (Kullanıcı Gözünden)

- ✅ Kayıt olma (signup) ve giriş (login) — kullanıcı adı + şifre
- ✅ Harcama ekleme / düzenleme / silme
- ✅ Bir harcama içinde **birden fazla kalem** (line-item)
- ✅ Peşin / taksitli ödeme seçimi
- ✅ Otomatik taksit hesaplama + gelecek aylara dağıtılan ödeme takvimi
- ✅ Harcamaların aya ve güne göre gruplanması (accordion görünüm)
- ✅ Yıl seçici + ay filtresi
- ✅ Tekrarlayan ödemeler (recurring templates) — otomatik aylık materyalizasyon
- ✅ Birikim (savings) kaydı ve ayrı birikim ekranı
- ✅ **Aylık gelirler** — tekrarlayan gelir (maaş gibi her ay otomatik) + aya özel ek gelir
- ✅ Analitik: aylık özet, kategori dağılımı, taksit yükü takvimi, **gelir/gider/net (son durum)**
- ✅ Türk Lirası para formatı (`4250 → 4.250 ₺`, kuruşlu girişte `4.250,90 ₺`)
- ✅ Kategori sistemi (ikon + renk)
- ✅ Responsive + mobil alt navigasyon
- ✅ PWA (yüklenebilir uygulama, offline cache)
- ✅ Toast bildirimleri

---

## 3. Kullanıcı Senaryoları ve Davranış Gereksinimleri

### 3.1 Kayıt ve Giriş
- Kullanıcı `/signup` üzerinden kullanıcı adı, şifre (min. 6 karakter) ve opsiyonel görünen ad ile
  hesap açar. Başarılı kayıt **anında JWT döner** ve kullanıcı giriş yapmış sayılır → `/expenses`.
- Var olan kullanıcı `/login` üzerinden giriş yapar. Token `localStorage`'a yazılır.
- Token yoksa veya geçersizse korumalı sayfalara erişim engellenir (`AuthGuard` → `/login`).

### 3.2 Harcama Ekleme (Peşin)
```
1. Kullanıcı "+ Harcama Ekle" tıklar → modal açılır.
2. Başlık ("Yakıt"), Tarih (varsayılan bugün), Kategori (Yakıt) seçilir.
3. Ödeme tipi: Peşin.
4. Kalem: "Benzin" → Tutar girilir (CurrencyInput ile).
5. Kaydet → POST /api/expenses → liste güncellenir, ilgili ay/gün altında görünür.
```

### 3.3 Çok Kalemli Taksitli Alım
```
1. Modal açılır. Başlık "Online Alışveriş", Kategori "Alışveriş".
2. Ödeme tipi: Taksitli → Taksit sayısı: 12 (min 2, max 60).
3. Kalemler: Kulaklık 2.500, Ayakkabı 3.500, Çanta 3.000.
4. Toplam otomatik: 9.000 ₺. Aylık taksit otomatik: 750,00 ₺.
5. Taksit başlangıcı: alım ayının BİR SONRAKİ ayı (ayın 1'i).
6. Kaydet → POST /api/expenses (items dizisiyle).
7. Liste: kart başlığında toplam + "12 Taksit · Aylık 750,00 ₺" rozeti + kalem detayları +
   taksit takvimi (gelecek aylar).
```

### 3.4 Taksitin Gelecek Aylarda Görünmesi
- Taksitli bir harcama, **satın alındığı ayda kendi kartı** olarak görünür.
- Sonraki aylarda/yıllarda ise **o aya düşen taksit ödemesi** olarak listelenir
  (`installment_display_month` ve `installment_current_no` alanlarıyla işaretlenir).
- Örnek: 15 Mayıs 2025'te 12 taksitli alım → Haziran 2025 … Mayıs 2026 aylarında ödeme satırı.

### 3.5 Tekrarlayan Ödeme (Abonelik)
```
1. /recurring sayfasında "+ Şablon" ile kira/Netflix gibi sabit gider tanımlanır:
   başlık, tutar, ayın günü (1-28), başlangıç tarihi, opsiyonel bitiş tarihi, kategori.
2. Şablon aktifken, harcama listesi her açıldığında ilgili aylar için
   gerçek `expenses` satırları OTOMATİK üretilir (materializasyon — bkz. §9.3).
3. Üretilen harcamalar normal harcama gibi görünür (recurring_template_id ile işaretli).
```

### 3.6 Birikim
- `/birikimler` ekranı, özel **"Birikim" kategorisindeki** (id = 13) harcamaları gösterir.
- Ekleme akışı normal harcama gibidir ancak kategori otomatik "Birikim" olarak sabitlenir.
- Üstte toplam birikim ve kayıt sayısı özetlenir (yeşil tema).

### 3.7 Aylık Gelirler
```
1. /gelirler sayfasında iki tür gelir yönetilir:
   a) TEKRARLAYAN GELİR (maaş gibi): başlık ("Maaş"), tutar, ayın günü (1-28),
      başlangıç tarihi, opsiyonel bitiş. Aktifken HER AY otomatik gelir satırı üretilir
      (recurring ödemelerle aynı materyalizasyon mantığı — bkz. §9.6).
   b) AYA ÖZEL EK GELİR (tek seferlik): "bu ay şundan şu kadar geldi" → başlık, tutar,
      tarih, not. Sadece girildiği aya yazılır.
2. Gelirler harcamalardan AYRI tablolarda tutulur, harcama listesine karışmaz.
3. Analitikte gelirler giderlerle birlikte hesaplanır: her ay için
   "toplam gelir – toplam gider = net (son durum)" gösterilir (bkz. §8.11, §9.7).
```

### 3.8 Düzenleme / Silme
- Kart üzerindeki ✏️ → modal mevcut verilerle dolu açılır → Güncelle → `PUT /api/expenses/{id}`.
  (Güncelleme stratejisi: `expense_items` silinir, yeniden eklenir.)
- 🗑 → onay modalı → `DELETE /api/expenses/{id}`.

### 3.9 Filtreleme
- Yıl seçici (varsayılan aralık: 2026 → gelecek yıl). Ay filtresi: "Tümü" + Ocak–Aralık.
- Yıl veya ay değişince `fetchExpenses` yeniden çağrılır.

---

## 4. Teknik Yığın (Tech Stack)

| Katman | Teknoloji | Sürüm |
|---|---|---|
| Framework | Next.js (App Router) | ^15.5 |
| Dil | TypeScript | ^5.4 |
| UI Kütüphanesi | HeroUI | ^2.4 |
| Stil | Tailwind CSS | ^4.3 (`@tailwindcss/postcss`) |
| Animasyon | Framer Motion | ^11 |
| State | Redux Toolkit + react-redux | ^2.3 / ^9.1 |
| Grafik | Recharts | ^2.12 |
| PWA | `@ducanh2912/next-pwa` | ^10.2 |
| Backend | Next.js Route Handlers (`app/api/**/route.ts`) | — |
| DB Sürücüsü | `mysql2/promise` (connection pool) | ^3.22 |
| Veritabanı | MySQL | 8+ |
| Auth | `jsonwebtoken` (JWT, HS256, 7 gün) | ^9 |
| Şifre | `bcryptjs` (hash, salt rounds = 10) | ^3 |
| HTTP | Native Fetch (client `lib/api.ts` wrapper) | — |

> **Kritik kural:** Backend ayrı bir PHP servisi DEĞİLDİR. Tüm API uçları Next.js içinde
> `src/app/api/**/route.ts` Route Handler'ları olarak yaşar ve MySQL'e `mysql2` pool ile bağlanır.

---

## 5. Proje Dizin Yapısı

```
outflow/
├── public/
│   ├── icons/                        # PWA ikonları (192, 512, maskable)
│   └── manifest.json
├── migrations/
│   ├── 000_init.sql                  # users, categories, expenses, expense_items + seed
│   ├── 001_add_recurring_templates.sql
│   └── 002_add_incomes.sql           # incomes + recurring_income_templates
├── scripts/
│   ├── generate-icons.mjs            # PWA ikon üretimi
│   └── generate-heroui-theme.mjs     # HeroUI tema CSS üretimi
├── src/
│   ├── app/
│   │   ├── layout.tsx                # Root layout (Redux Provider, HeroUI Provider, Toast)
│   │   ├── page.tsx                  # / → /expenses (veya /login) redirect
│   │   ├── globals.css
│   │   ├── heroui-theme.css          # script ile üretilen tema
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   ├── (app)/
│   │   │   ├── layout.tsx            # AuthGuard + Navbar + Sidebar + MobileBottomNav
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── expenses/page.tsx     # Ana ekran
│   │   │   ├── birikimler/page.tsx   # Birikim ekranı (kategori 13)
│   │   │   ├── recurring/page.tsx    # Tekrarlayan ödeme şablonları
│   │   │   ├── gelirler/page.tsx     # Aylık gelirler (gelir + tekrarlayan gelir)
│   │   │   └── analytics/page.tsx
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts        # POST
│   │       │   └── register/route.ts     # POST
│   │       ├── categories/route.ts       # GET
│   │       ├── expenses/
│   │       │   ├── route.ts              # GET (liste), POST (ekle)
│   │       │   └── [id]/route.ts         # PUT (güncelle), DELETE (sil)
│   │       ├── recurring/
│   │       │   ├── route.ts              # GET (liste), POST (ekle)
│   │       │   └── [id]/route.ts         # PUT, DELETE
│   │       ├── incomes/
│   │       │   ├── route.ts              # GET (liste), POST (ekle)
│   │       │   └── [id]/route.ts         # PUT, DELETE
│   │       ├── recurring-incomes/
│   │       │   ├── route.ts              # GET (liste), POST (ekle)
│   │       │   └── [id]/route.ts         # PUT, DELETE
│   │       └── analytics/route.ts        # GET (özet)
│   ├── components/
│   │   ├── auth/{LoginForm,SignupForm}.tsx
│   │   ├── expenses/
│   │   │   ├── ExpenseList.tsx
│   │   │   ├── MonthGroup.tsx
│   │   │   ├── DayGroup.tsx
│   │   │   ├── ExpenseCard.tsx
│   │   │   ├── ExpenseItems.tsx
│   │   │   ├── InstallmentTimeline.tsx
│   │   │   ├── AddExpenseModal.tsx
│   │   │   ├── ExpenseItemForm.tsx
│   │   │   └── DeleteConfirmModal.tsx
│   │   ├── recurring/RecurringTemplateModal.tsx
│   │   ├── income/{IncomeList,IncomeCard,AddIncomeModal,RecurringIncomeModal}.tsx
│   │   ├── analytics/{MonthlySummaryChart,CategoryBreakdown,InstallmentBurden}.tsx
│   │   ├── layout/{Navbar,Sidebar,MobileBottomNav,AuthGuard}.tsx
│   │   └── ui/{CurrencyInput,LoadingSpinner,EmptyState,SkeletonCard,ToastContainer}.tsx
│   ├── store/
│   │   ├── index.ts                  # configureStore
│   │   ├── hooks.ts                  # useAppDispatch, useAppSelector
│   │   └── slices/{authSlice,expensesSlice,recurringSlice,incomeSlice,uiSlice}.ts
│   ├── lib/
│   │   ├── db.ts                     # mysql2 pool
│   │   ├── server-auth.ts            # JWT sign/verify, getAuthUser(req)
│   │   ├── api.ts                    # client fetch wrapper
│   │   ├── formatters.ts             # para/tarih/taksit yardımcıları
│   │   ├── groupExpenses.ts          # ay/gün gruplama
│   │   ├── recurring-materializer.ts # şablon → expenses üretimi
│   │   ├── recurring-income-materializer.ts # gelir şablonu → incomes üretimi
│   │   └── mockData.ts               # (opsiyonel) geliştirme verisi
│   └── types/index.ts                # tüm TypeScript tipleri
├── .env.local.example
├── next.config.js
├── postcss.config.js
├── tailwind.config.ts                # (Tailwind v4 ise css-first; gerekirse)
├── tsconfig.json
└── package.json
```

---

## 6. Veritabanı Şeması (MySQL) — Tam SQL

> Tüm tablolar `InnoDB`, `utf8mb4`, `utf8mb4_unicode_ci`. Para alanları `DECIMAL(12,2)`.
> Aşağıdaki SQL `migrations/000_init.sql` dosyasının içeriğidir.

### 6.1 `users`
```sql
CREATE TABLE users (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(64)  NOT NULL UNIQUE,
    display_name  VARCHAR(128) NULL,
    password_hash VARCHAR(255) NOT NULL,            -- bcrypt hash
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 6.2 `categories`
```sql
CREATE TABLE categories (
    id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name  VARCHAR(64) NOT NULL,
    icon  VARCHAR(16) NOT NULL,                      -- emoji
    color VARCHAR(7)  NOT NULL COMMENT 'Hex, örn #4f46e5'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed (SIRA ÖNEMLİ: "Birikim" id = 13 olmalı, birikim ekranı bu id'yi kullanır)
INSERT INTO categories (name, icon, color) VALUES
('Yakıt',      '⛽',  '#EF4444'),  -- 1
('Market',     '🛒',  '#22C55E'),  -- 2
('Fatura',     '📄',  '#3B82F6'),  -- 3
('Giyim',      '👕',  '#8B5CF6'),  -- 4
('Elektronik', '💻',  '#F59E0B'),  -- 5
('Sağlık',     '🏥',  '#EC4899'),  -- 6
('Eğlence',    '🎬',  '#F97316'),  -- 7
('Restoran',   '🍽️', '#84CC16'),  -- 8
('Ulaşım',     '🚌',  '#06B6D4'),  -- 9
('Alışveriş',  '🛍️', '#A855F7'),  -- 10
('Eğitim',     '📚',  '#10B981'),  -- 11
('Diğer',      '📦',  '#6B7280'),  -- 12
('Birikim',    '💰',  '#059669');  -- 13  ← BIRIKIM_CATEGORY_ID
```

### 6.3 `expenses`
```sql
CREATE TABLE expenses (
    id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id               INT UNSIGNED NOT NULL,
    category_id           INT UNSIGNED NULL,
    title                 VARCHAR(255) NOT NULL,
    expense_date          DATE         NOT NULL,
    payment_type          ENUM('cash','installment') NOT NULL DEFAULT 'cash',
    installment_count     TINYINT UNSIGNED NULL COMMENT 'NULL=peşin, 2-60=taksit',
    total_amount          DECIMAL(12,2) NOT NULL COMMENT 'Tüm kalemlerin toplamı',
    note                  TEXT NULL,
    recurring_template_id INT UNSIGNED NULL COMMENT 'Şablondan üretildiyse dolu',
    created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_expenses_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_expenses_category
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    CONSTRAINT chk_installment_count
        CHECK (payment_type = 'cash' OR (installment_count IS NOT NULL AND installment_count >= 2)),

    INDEX idx_expenses_user_date (user_id, expense_date),
    INDEX idx_expenses_category  (category_id),
    INDEX idx_expenses_recurring (recurring_template_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 6.4 `expense_items`
```sql
CREATE TABLE expense_items (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    expense_id INT UNSIGNED NOT NULL,
    name       VARCHAR(255) NOT NULL,
    amount     DECIMAL(12,2) NOT NULL,

    CONSTRAINT fk_items_expense
        FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
    INDEX idx_items_expense (expense_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 6.5 `recurring_templates` (migration `001`)
```sql
CREATE TABLE recurring_templates (
    id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id              INT UNSIGNED NOT NULL,
    category_id          INT UNSIGNED NULL,
    title                VARCHAR(255) NOT NULL,
    amount               DECIMAL(12,2) NOT NULL,
    day_of_month         TINYINT UNSIGNED NOT NULL COMMENT '1-28',
    start_date           DATE NOT NULL,
    end_date             DATE NULL COMMENT 'NULL = süresiz',
    note                 TEXT NULL,
    active               TINYINT(1) NOT NULL DEFAULT 1,
    last_generated_month CHAR(7) NULL COMMENT 'YYYY-MM, idempotent materyalizasyon için',
    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_recurring_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_recurring_category
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    CONSTRAINT chk_day_of_month
        CHECK (day_of_month BETWEEN 1 AND 28),

    INDEX idx_recurring_user_active (user_id, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- expenses.recurring_template_id FK'sını ekle (000'da kolon zaten varsa sadece FK):
ALTER TABLE expenses
    ADD CONSTRAINT fk_expenses_recurring_template
    FOREIGN KEY (recurring_template_id) REFERENCES recurring_templates(id) ON DELETE SET NULL;
```

### 6.6 `incomes` (migration `002`)
Tek seferlik gelirler ve tekrarlayan gelir şablonundan üretilen aylık gelir satırları.
```sql
CREATE TABLE incomes (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id             INT UNSIGNED NOT NULL,
    title               VARCHAR(255) NOT NULL COMMENT 'Gelir kaynağı, örn "Maaş", "Freelance"',
    amount              DECIMAL(12,2) NOT NULL,
    income_date         DATE NOT NULL,
    note                TEXT NULL,
    recurring_income_id INT UNSIGNED NULL COMMENT 'Gelir şablonundan üretildiyse dolu',
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_incomes_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    INDEX idx_incomes_user_date (user_id, income_date),
    INDEX idx_incomes_recurring (recurring_income_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 6.7 `recurring_income_templates` (migration `002`)
Maaş gibi her ay tekrarlayan gelir tanımları. `incomes`'a aylık materyalize edilir (bkz. §9.6).
```sql
CREATE TABLE recurring_income_templates (
    id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id              INT UNSIGNED NOT NULL,
    title                VARCHAR(255) NOT NULL,
    amount               DECIMAL(12,2) NOT NULL,
    day_of_month         TINYINT UNSIGNED NOT NULL COMMENT '1-28',
    start_date           DATE NOT NULL,
    end_date             DATE NULL COMMENT 'NULL = süresiz',
    note                 TEXT NULL,
    active               TINYINT(1) NOT NULL DEFAULT 1,
    last_generated_month CHAR(7) NULL COMMENT 'YYYY-MM, idempotent materyalizasyon için',
    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_recurring_income_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_income_day_of_month
        CHECK (day_of_month BETWEEN 1 AND 28),

    INDEX idx_recurring_income_user_active (user_id, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- incomes.recurring_income_id FK'sını ekle:
ALTER TABLE incomes
    ADD CONSTRAINT fk_incomes_recurring_template
    FOREIGN KEY (recurring_income_id) REFERENCES recurring_income_templates(id) ON DELETE SET NULL;
```

### 6.8 Varlık İlişkisi (ER)
```
users 1───* expenses *───1 categories
            │
            *
        expense_items

users 1───* recurring_templates 1───* expenses   (recurring_template_id)
recurring_templates *───1 categories

users 1───* incomes
users 1───* recurring_income_templates 1───* incomes   (recurring_income_id)
```

### 6.9 Önemli Sorgular
**Bir yıla ait, ilgili taksitler dahil harcamalar:**
```sql
SELECT e.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
FROM expenses e
LEFT JOIN categories c ON c.id = e.category_id
WHERE e.user_id = :user_id
  AND (
    (e.payment_type = 'cash' AND YEAR(e.expense_date) = :year)
    OR
    (e.payment_type = 'installment'
     AND YEAR(DATE_ADD(e.expense_date, INTERVAL 1 MONTH)) <= :year
     AND YEAR(DATE_ADD(e.expense_date, INTERVAL e.installment_count MONTH)) >= :year)
  )
ORDER BY e.expense_date DESC, e.id DESC;
```
> Not: Taksit ödemelerinin tek tek aylara dağıtılması SQL'de değil, **uygulama katmanında**
> `generateInstallmentSchedule()` ile yapılır.

---

## 7. Kimlik Doğrulama Mimarisi (JWT)

`src/lib/server-auth.ts`:
```typescript
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const SECRET = process.env.JWT_SECRET ?? 'changeme';

export interface TokenPayload { user_id: number; username: string; }

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload | null {
  try { return jwt.verify(token, SECRET) as TokenPayload; }
  catch { return null; }
}

export function getAuthUser(req: NextRequest): TokenPayload | null {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyToken(auth.slice(7));
}
```

- **Token üretimi:** login ve register başarılı olunca `signToken({ user_id, username })`.
- **Token saklama (client):** `localStorage['auth_token']`.
- **Token gönderimi:** her korumalı istekte `Authorization: Bearer <token>`.
- **Doğrulama:** her korumalı Route Handler başında `getAuthUser(req)`; `null` ise `401`.
- **Kullanıcı izolasyonu:** her sorguda `WHERE user_id = :user_id`.

---

## 8. API Sözleşmesi (Route Handlers)

### Genel Kurallar
- Tüm uçlar JSON döner. Başarı: `{ success: true, data: ... }`.
  Hata: `{ success: false, message: "..." }` + uygun HTTP kodu.
- Korumalı uçlar `getAuthUser` ile JWT doğrular; başarısızsa `401 { success:false, message:'Yetkisiz' }`.
- Sunucu hatası → `500 { success:false, message:'Sunucu hatası' }` (ve `console.error`).

### Endpoint Tablosu
| Method | Yol | Auth | Açıklama |
|---|---|---|---|
| POST | `/api/auth/register` | ❌ | Kayıt, JWT döner |
| POST | `/api/auth/login` | ❌ | Giriş, JWT döner |
| GET | `/api/categories` | ✅ | Kategori listesi |
| GET | `/api/expenses?year=&month=` | ✅ | Harcama listesi (taksitler dağıtılmış) |
| POST | `/api/expenses` | ✅ | Harcama ekle |
| PUT | `/api/expenses/{id}` | ✅ | Harcama güncelle |
| DELETE | `/api/expenses/{id}` | ✅ | Harcama sil |
| GET | `/api/recurring` | ✅ | Şablon listesi |
| POST | `/api/recurring` | ✅ | Şablon ekle |
| PUT | `/api/recurring/{id}` | ✅ | Şablon güncelle |
| DELETE | `/api/recurring/{id}` | ✅ | Şablon sil |
| GET | `/api/incomes?year=&month=` | ✅ | Gelir listesi (tekrarlayanlar materyalize) |
| POST | `/api/incomes` | ✅ | Gelir ekle |
| PUT | `/api/incomes/{id}` | ✅ | Gelir güncelle |
| DELETE | `/api/incomes/{id}` | ✅ | Gelir sil |
| GET | `/api/recurring-incomes` | ✅ | Tekrarlayan gelir şablonları |
| POST | `/api/recurring-incomes` | ✅ | Gelir şablonu ekle |
| PUT | `/api/recurring-incomes/{id}` | ✅ | Gelir şablonu güncelle |
| DELETE | `/api/recurring-incomes/{id}` | ✅ | Gelir şablonu sil |
| GET | `/api/analytics?year=` | ✅ | Analiz özeti (gelir/gider/net dahil) |

### 8.1 `POST /api/auth/register`
**İstek:** `{ username, password, display_name? }`
- `username` boşsa veya `password` yoksa → `400`.
- `password.length < 6` → `400 "Şifre en az 6 karakter olmalı"`.
- Kullanıcı adı alınmışsa → `409 "Bu kullanıcı adı zaten alınmış"`.
- `bcrypt.hash(password, 10)` → INSERT → `signToken`.
**Yanıt (201):** `{ success:true, data:{ token, user:{ id, username, display_name } } }`

### 8.2 `POST /api/auth/login`
**İstek:** `{ username, password }`
- Eksikse → `400`. Kullanıcı yoksa veya `bcrypt.compare` başarısızsa → `401 "Kullanıcı adı veya şifre hatalı"`.
**Yanıt:** `{ success:true, data:{ token, user } }`

### 8.3 `GET /api/categories`
- Tüm kategorileri döner: `{ success:true, data: Category[] }`.

### 8.4 `GET /api/expenses?year=YYYY&month=MM`
1. `getAuthUser` → `401` değilse devam.
2. **Önce** `materializeRecurring(user_id, year, month)` çağrılır (bkz. §9.3).
3. O yıla ait harcamalar (peşin + ilgili taksitliler) çekilir (§6.7 sorgusu), kalemler eşlenir.
4. **Taksit dağıtımı (uygulama katmanı):**
   - `month` **yoksa** (tüm yıl):
     - Peşin: `expense_date` yılı == `year` ise ekle.
     - Taksitli (§3.4): satın alındığı yıl == `year` ise kartı kendi ayında ekle; **ayrıca her
       durumda** `generateInstallmentSchedule` ile o yıla düşen her ödeme için
       `{...e, installment_display_month, installment_current_no}` kopyası ekle. Böylece "Tümü"
       görünümü ay-bazlı görünümle tutarlıdır (taksit ödemeleri aynı yıl içinde de yayılır).
   - `month` **varsa:** aynı mantık ama tek aya (`YYYY-MM`) göre.
**Yanıt:** `{ success:true, data: Expense[] }`

### 8.5 `POST /api/expenses`
**İstek:** `CreateExpensePayload` = `{ title, expense_date, payment_type, installment_count?, category_id?, note?, items:[{name,amount}] }`
- `total_amount = Σ items.amount` (sunucuda hesaplanır).
- Transaction: `expenses` INSERT → `expense_items` toplu INSERT → commit.
- `payment_type==='installment'` değilse `installment_count` NULL'a zorlanır.
**Yanıt (201):** eklenen `Expense` (kategori + items dahil).

### 8.6 `PUT /api/expenses/{id}`
- Önce sahiplik kontrolü: `SELECT id FROM expenses WHERE id=? AND user_id=?` → yoksa `404`.
- Transaction: `expenses` UPDATE → `expense_items` DELETE → yeniden INSERT → commit.
**Yanıt:** güncellenen `Expense`.

### 8.7 `DELETE /api/expenses/{id}`
- `DELETE FROM expenses WHERE id=? AND user_id=?`. `affectedRows===0` → `404`.
- `expense_items` FK CASCADE ile otomatik silinir.
**Yanıt:** `{ success:true, data:{ id } }`

### 8.8 `GET /api/recurring`
- Kullanıcının şablonları: `ORDER BY active DESC, title ASC`. Her satır `RecurringTemplate`'e map'lenir
  (`amount: Number`, `active: r.active===1`, kategori join).

### 8.9 `POST /api/recurring`
**İstek:** `CreateRecurringPayload` = `{ title, amount, day_of_month, start_date, end_date?, category_id?, note? }`
- Zorunlular eksik veya `amount<=0` → `400`. `day_of_month` 1–28 dışı → `400`.
- INSERT (`active=1`) → eklenen şablonu döner.

### 8.10 `PUT/DELETE /api/recurring/{id}`
- Sahiplik kontrolü zorunlu. PUT alanları günceller; DELETE şablonu siler
  (üretilmiş `expenses` satırlarının `recurring_template_id`'si FK `SET NULL`).

### 8.11 `GET /api/incomes?year=YYYY&month=MM`
1. `getAuthUser` → `401` değilse devam.
2. **Önce** `materializeRecurringIncome(user_id, year, month)` çağrılır (bkz. §9.6).
3. `incomes` tablosundan `WHERE user_id=? AND YEAR(income_date)=?` (varsa `AND MONTH=?`)
   sorgulanır, `ORDER BY income_date DESC, id DESC`.
**Yanıt:** `{ success:true, data: Income[] }`

### 8.12 `POST /api/incomes`
**İstek:** `CreateIncomePayload` = `{ title, amount, income_date, note? }`
- `title` boş veya `amount<=0` veya `income_date` yoksa → `400`.
- INSERT → eklenen `Income` döner (201).

### 8.13 `PUT/DELETE /api/incomes/{id}`
- Sahiplik kontrolü zorunlu (`WHERE id=? AND user_id=?`); yoksa `404`.
- PUT alanları günceller; DELETE geliri siler. **Yanıt:** güncel `Income` / `{ id }`.

### 8.14 `GET /api/recurring-incomes`
- Kullanıcının gelir şablonları: `ORDER BY active DESC, title ASC`. `RecurringIncomeTemplate[]` döner
  (`amount: Number`, `active: r.active===1`).

### 8.15 `POST /api/recurring-incomes`
**İstek:** `CreateRecurringIncomePayload` = `{ title, amount, day_of_month, start_date, end_date?, note? }`
- Zorunlular eksik veya `amount<=0` → `400`. `day_of_month` 1–28 dışı → `400`.
- INSERT (`active=1`) → eklenen şablon (201).

### 8.16 `PUT/DELETE /api/recurring-incomes/{id}`
- Sahiplik kontrolü zorunlu. PUT alanları günceller; DELETE şablonu siler
  (üretilmiş `incomes` satırlarının `recurring_income_id`'si FK `SET NULL`).

### 8.17 `GET /api/analytics?year=YYYY`
Yıla ilgili **harcamaları ve gelirleri** çeker, bellekte aşağıdaki çıktıları üretir:
- **monthly_totals:** peşinler kendi ayına; taksitliler ödeme aylarına dağıtılmış gider toplamı.
- **category_totals:** peşin tüm tutar kendi ayına; taksitli **tüm tutar satın alma yılına**
  (yalnız o yıl satın alındıysa). Azalan sıralı.
- **installment_plan:** o yıla düşen ödemeleri olan taksitli alımların listesi
  (`monthly_payment`, `payments[]`).
- **income_totals:** her ay için `incomes` toplamı (`YYYY-MM` → tutar).
- **monthly_net:** her ay için `{ month, income, expense, net }` — `net = income - expense`
  (gider = o ayki `monthly_totals` değeri). "Bu ay son durum" budur.
- **year_summary:** `{ total_income, total_expense, net }` (yıl geneli).
**Yanıt:** `{ success:true, data: AnalyticsSummary }`

---

## 9. İş Kuralları ve Hesaplamalar

### 9.1 Taksit Hesabı
```
Aylık taksit = ROUND(total_amount / installment_count, 2)
İlk taksit ayı = (expense_date'in ayı + 1), ayın 1'i
Son taksit ayı = İlk taksit ayı + (installment_count - 1)
```
`src/lib/formatters.ts` referans implementasyonu:
```typescript
export function calculateInstallmentAmount(total: number, count: number): number {
  return Math.round((total / count) * 100) / 100;
}
export function getInstallmentStartMonth(expenseDate: string): Date {
  const d = new Date(expenseDate + 'T00:00:00');
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}
export function generateInstallmentSchedule(expenseDate: string, totalAmount: number, installmentCount: number) {
  const monthlyAmount = calculateInstallmentAmount(totalAmount, installmentCount);
  const startDate = getInstallmentStartMonth(expenseDate);
  const schedule = [];
  for (let i = 0; i < installmentCount; i++) {
    const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
    schedule.push({ date: d.toISOString().slice(0, 7), amount: monthlyAmount, installmentNo: i + 1 });
  }
  return schedule;
}
```

### 9.2 Para Formatı
```typescript
// Görüntüleme (sembolsüz): 4250 → "4.250"  | 4250.9 → "4.250,9"
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
}
// Girdi: sadece rakam → sayı. Son 2 hane kuruş.
//   "1"→0.01  "100"→1.00  "425000"→4250.00
export function parseCurrencyInput(rawDigits: string): number {
  if (!rawDigits) return 0;
  const padded = rawDigits.padStart(3, '0');
  return parseFloat(`${padded.slice(0, -2) || '0'}.${padded.slice(-2)}`);
}
```
> `CurrencyInput` bileşeni yalnız rakam alır, sağdan sola doldurur (kuruş→lira), blur'da tam formatı gösterir.

### 9.3 Tekrarlayan Ödeme Materyalizasyonu (`recurring-materializer.ts`)
**Amaç:** Aktif şablonları, gerekli her ay için gerçek `expenses` satırına dönüştürmek. **İdempotent.**
- **Üst sınır ayı (upper bound):** `max(görüntülenen ay/yıl, bugünün ayı)`.
  - Geçmiş görünüm → bugüne kadar üret (diğer aylar bozulmasın).
  - Gelecek ay görünümü → o aya kadar uzat (abonelik önceden görünsün).
  - Gelecek yıl (ay yok) → tüm yılı üret (Aralık'a kadar).
- Her aktif şablon için başlangıç ayı = `last_generated_month + 1` (yoksa `start_date` ayı).
- `end_date` aşılırsa dur.
- Her ay: `day = min(day_of_month, ayın gün sayısı)` (clamp). `expense_date = YYYY-MM-DD`.
- **İdempotency:** `recurring_template_id` + `YYYY-MM` için kayıt varsa atla.
- Üretim: `expenses` (`payment_type='cash'`, `recurring_template_id` dolu) + tek `expense_items` satırı.
- Her adımda `last_generated_month = YYYY-MM` güncellenir.

### 9.4 Birikim Kuralı
- `BIRIKIM_CATEGORY_ID = 13`. `/birikimler` sadece `category_id === 13` olan harcamaları gösterir.
- Birikim ekleme modalında kategori bu id'ye sabitlenir (`forcedCategoryId`).

### 9.5 Yıl/Ay Aralığı
- Yıl seçici varsayılan aralık: `2026 … (currentYear + 1)`. Ay filtresi: `null (Tümü)` veya 1–12.

### 9.6 Tekrarlayan Gelir Materyalizasyonu (`recurring-income-materializer.ts`)
`recurring-materializer.ts` (§9.3) ile **birebir aynı mantık**, tek fark hedef tablo `incomes`:
- Üst sınır ayı = `max(görüntülenen ay/yıl, bugünün ayı)` (geçmiş→bugüne, gelecek ay→o aya,
  gelecek yıl→tüm yıl).
- Her aktif `recurring_income_templates` için başlangıç ayı = `last_generated_month + 1`
  (yoksa `start_date` ayı), `end_date` aşılırsa dur.
- Her ay: `day = min(day_of_month, ayın gün sayısı)` → `income_date = YYYY-MM-DD`.
- **İdempotency:** `recurring_income_id` + `YYYY-MM` için kayıt varsa atla.
- Üretim: `incomes` satırı (`recurring_income_id` dolu). Her adımda `last_generated_month` güncellenir.
- Maaş örneği: "Maaş", 30.000 ₺, `day_of_month=1`, `start_date=2026-01-01`, süresiz → her ayın
  1'inde 30.000 ₺ gelir otomatik üretilir.

### 9.7 Net Bakiye (Son Durum) Hesabı
- Aylık gider = analitik `monthly_totals[ay]` (peşin + dağıtılmış taksit).
- Aylık gelir = `income_totals[ay]` (tek seferlik + materyalize tekrarlayan gelirler).
- **Aylık net = gelir − gider** → pozitifse artı (yeşil), negatifse eksi (kırmızı) gösterilir.
- Yıl geneli: `year_summary = { total_income, total_expense, net }`.
- Birikimler (kategori 13) gider tarafında sayılır (harcama olarak kaydedilir); gelir DEĞİLDİR.

---

## 10. Frontend Mimarisi

### 10.1 `src/lib/api.ts` (client fetch wrapper)
```typescript
const API_BASE = ''; // aynı origin; Next.js route handlers

async function apiFetch<T>(endpoint: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('auth_token');
    if (typeof window !== 'undefined') window.location.href = '/login';
    return { success: false, message: 'Oturum süresi doldu' };
  }
  return res.json() as Promise<{ success: boolean; data?: T; message?: string }>;
}

export const api = {
  login:    (username: string, password: string) => apiFetch('/api/auth/login',    { method:'POST', body: JSON.stringify({ username, password }) }),
  register: (p: { username:string; password:string; display_name?:string }) => apiFetch('/api/auth/register', { method:'POST', body: JSON.stringify(p) }),
  getCategories: () => apiFetch('/api/categories'),
  getExpenses: (p:{ year:number; month?:number }) => apiFetch(`/api/expenses?year=${p.year}${p.month?`&month=${p.month}`:''}`),
  createExpense: (d) => apiFetch('/api/expenses', { method:'POST', body: JSON.stringify(d) }),
  updateExpense: (id:number, d) => apiFetch(`/api/expenses/${id}`, { method:'PUT', body: JSON.stringify(d) }),
  deleteExpense: (id:number) => apiFetch(`/api/expenses/${id}`, { method:'DELETE' }),
  getRecurring: () => apiFetch('/api/recurring'),
  createRecurring: (d) => apiFetch('/api/recurring', { method:'POST', body: JSON.stringify(d) }),
  updateRecurring: (id:number,d) => apiFetch(`/api/recurring/${id}`, { method:'PUT', body: JSON.stringify(d) }),
  deleteRecurring: (id:number) => apiFetch(`/api/recurring/${id}`, { method:'DELETE' }),
  getIncomes: (p:{ year:number; month?:number }) => apiFetch(`/api/incomes?year=${p.year}${p.month?`&month=${p.month}`:''}`),
  createIncome: (d) => apiFetch('/api/incomes', { method:'POST', body: JSON.stringify(d) }),
  updateIncome: (id:number,d) => apiFetch(`/api/incomes/${id}`, { method:'PUT', body: JSON.stringify(d) }),
  deleteIncome: (id:number) => apiFetch(`/api/incomes/${id}`, { method:'DELETE' }),
  getRecurringIncomes: () => apiFetch('/api/recurring-incomes'),
  createRecurringIncome: (d) => apiFetch('/api/recurring-incomes', { method:'POST', body: JSON.stringify(d) }),
  updateRecurringIncome: (id:number,d) => apiFetch(`/api/recurring-incomes/${id}`, { method:'PUT', body: JSON.stringify(d) }),
  deleteRecurringIncome: (id:number) => apiFetch(`/api/recurring-incomes/${id}`, { method:'DELETE' }),
  getAnalytics: (year:number) => apiFetch(`/api/analytics?year=${year}`),
};
```

### 10.2 `src/lib/groupExpenses.ts`
Harcamaları `MonthGroup[]` (yıl, ay, toplam, peşin, taksit toplamı, `days: DayGroup[]`) yapısına
gruplar. Aylar ve günler en yeni en üstte sıralı. Taksit gösterim aylarında
`installment_display_month` kullanılır.

### 10.3 `src/types/index.ts` (özet)
```typescript
export interface User { id:number; username:string; display_name?:string; }
export interface Category { id:number; name:string; icon:string; color:string; }
export interface ExpenseItem { id?:number; expense_id?:number; name:string; amount:number; }
export interface Expense {
  id:number; user_id:number; category_id?:number;
  category_name?:string; category_icon?:string; category_color?:string;
  title:string; expense_date:string; payment_type:'cash'|'installment';
  installment_count?:number; total_amount:number; note?:string; items:ExpenseItem[];
  created_at:string; updated_at:string;
  installment_display_month?:string; installment_current_no?:number; // taksit gösterim ayı
  recurring_template_id?:number;
}
export interface CreateExpensePayload {
  title:string; expense_date:string; payment_type:'cash'|'installment';
  installment_count?:number; category_id?:number; note?:string;
  items:{ name:string; amount:number }[];
}
export interface RecurringTemplate {
  id:number; user_id:number; category_id?:number;
  category_name?:string; category_icon?:string; category_color?:string;
  title:string; amount:number; day_of_month:number; start_date:string;
  end_date?:string|null; note?:string; active:boolean;
  last_generated_month?:string|null; created_at:string; updated_at:string;
}
export interface CreateRecurringPayload {
  title:string; amount:number; day_of_month:number; start_date:string;
  end_date?:string|null; category_id?:number; note?:string;
}
export interface Income {
  id:number; user_id:number; title:string; amount:number; income_date:string;
  note?:string; recurring_income_id?:number; created_at:string; updated_at:string;
}
export interface CreateIncomePayload { title:string; amount:number; income_date:string; note?:string; }
export interface RecurringIncomeTemplate {
  id:number; user_id:number; title:string; amount:number; day_of_month:number;
  start_date:string; end_date?:string|null; note?:string; active:boolean;
  last_generated_month?:string|null; created_at:string; updated_at:string;
}
export interface CreateRecurringIncomePayload {
  title:string; amount:number; day_of_month:number; start_date:string; end_date?:string|null; note?:string;
}
export interface MonthlyTotal { month:string; total:number; }
export interface CategoryTotal { name:string; icon:string; color:string; total:number; }
export interface InstallmentPayment { month:string; amount:number; installment_no:number; }
export interface InstallmentPlanItem {
  expense_id:number; title:string; total_amount:number;
  installment_count:number; monthly_payment:number; payments:InstallmentPayment[];
}
export interface MonthlyNet { month:string; income:number; expense:number; net:number; }
export interface AnalyticsSummary {
  monthly_totals:MonthlyTotal[]; category_totals:CategoryTotal[]; installment_plan:InstallmentPlanItem[];
  income_totals:MonthlyTotal[]; monthly_net:MonthlyNet[];
  year_summary:{ total_income:number; total_expense:number; net:number };
}
```

---

## 11. Redux Store Yapısı

`configureStore` ile 5 slice: `auth`, `expenses`, `recurring`, `income`, `ui`.

- **authSlice:** `user`, `token`, `loading`, `error`. Thunk'lar: `loginThunk`, `registerThunk`.
  Reducer'lar: `logout`, `setUserFromStorage` (token payload'ını decode edip user'ı kurar).
  `fulfilled`'da token `localStorage`'a yazılır.
- **expensesSlice:** `items`, `categories`, `loading`, `error`, `selectedYear`, `selectedMonth`.
  Thunk'lar: `fetchExpenses({year,month})`, `fetchCategories`, `createExpense`, `updateExpense`,
  `deleteExpense`. Reducer'lar: `setSelectedYear`, `setSelectedMonth`.
- **recurringSlice:** `templates`, `loading`. Thunk'lar: `fetchRecurring`, `createRecurring`,
  `updateRecurring`, `deleteRecurring`.
- **incomeSlice:** `incomes`, `recurringIncomes`, `loading`, `selectedYear`, `selectedMonth`.
  Thunk'lar: `fetchIncomes({year,month})`, `createIncome`, `updateIncome`, `deleteIncome`,
  `fetchRecurringIncomes`, `createRecurringIncome`, `updateRecurringIncome`, `deleteRecurringIncome`.
- **uiSlice:** `toasts[]`. Reducer'lar: `addToast({message,type})`, `removeToast(id)`.

---

## 12. Sayfa ve Bileşen Detayları

### `/login`, `/signup`
- Form alanları + submit. Başarıda token saklanır → `/expenses` yönlendirme. Hata Alert ile gösterilir.

### `/expenses` (Ana ekran)
- Üst bar: yıl seçici + ay tabları (Tümü/aylar, yatay scroll) + "+ Harcama Ekle".
- Liste: `groupExpensesByMonthAndDay` → `MonthGroup` (accordion) → `DayGroup` → `ExpenseCard`.
- `ExpenseCard`: ikon+başlık+tutar+düzenle/sil. Taksitliyse "N Taksit · Aylık X ₺" rozeti,
  `ExpenseItems` (kalemler) ve `InstallmentTimeline` (geçmiş=soluk, bu ay=vurgulu, gelecek=normal).

### `AddExpenseModal`
| Alan | Tip | Zorunlu |
|---|---|---|
| Başlık | text | ✅ |
| Tarih | date (varsayılan bugün) | ✅ |
| Kategori | select (ikon+renk) | ❌ (birikimde sabit) |
| Ödeme Tipi | toggle Peşin/Taksitli | ✅ |
| Taksit Sayısı | number (2–60) | taksitliyse ✅ |
| Hesaplanan Taksit | read-only | — |
| Not | textarea | ❌ |
| Kalemler | dinamik liste (`ExpenseItemForm`), min 1 | ✅ |

Toplam ve aylık taksit anlık hesaplanır. `CurrencyInput` kuralları §9.2.

### `/recurring`
- Şablon listesi (aktif/pasif). `RecurringTemplateModal` ile ekle/düzenle (başlık, tutar,
  ayın günü 1–28, başlangıç/bitiş tarihi, kategori, not). Silme onaylı.

### `/birikimler`
- Yeşil özet barı (toplam birikim + kayıt sayısı), yıl/ay filtresi, `category_id===13` listesi,
  kategori sabitli ekleme modalı.

### `/gelirler`
- Mavi/teal temalı özet barı: seçili dönem **toplam gelir** + kayıt sayısı.
- İki sekme/bölüm:
  - **Tekrarlayan gelirler** (maaş vb.): `RecurringIncomeModal` ile ekle/düzenle (başlık, tutar,
    ayın günü 1–28, başlangıç/bitiş tarihi, not). Aktif/pasif. Silme onaylı.
  - **Bu ayın gelirleri**: yıl/ay filtresi + `IncomeList` (`IncomeCard`). `AddIncomeModal` ile
    tek seferlik ek gelir ekle/düzenle (başlık, tutar, tarih, not).
- Tekrarlayan gelir şablonundan üretilen satırlar `recurring_income_id` ile işaretli ve rozetlenir.

### `/analytics`
- Yıllık özet kartları: **toplam gelir**, **toplam gider**, **net (son durum)**, peşin, taksitli,
  bu ay taksit yükü.
- `MonthlySummaryChart` (Recharts — aylık **gelir vs gider** karşılaştırmalı bar + net çizgisi).
- `CategoryBreakdown` (kategori dağılımı, yüzde).
- `InstallmentBurden` (gelecek ayların taksit yükü).
- Aylık net tablosu/listesi: her ay `gelir · gider · net` (net pozitif yeşil, negatif kırmızı).

### `/dashboard`
- Genel özet (kısa istatistikler + hızlı erişim).

### Layout / Guard
- `(app)/layout.tsx`: `AuthGuard` (token yoksa `/login`) + `Navbar` + `Sidebar` (desktop) +
  `MobileBottomNav` (mobil).

---

## 13. Tasarım Sistemi

```css
/* Renkler */
background:#ffffff; foreground:#0f172a; surface:#f8fafc; border:#e2e8f0;
muted:#64748b; accent:#0f172a; success:#22c55e; warning:#f59e0b; danger:#ef4444;
birikim/emerald: #059669 / #10b981;
```
- **Kart:** `bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md`.
- **Peşin rozeti:** yeşil; **Taksit rozeti:** amber. **Birikim teması:** emerald.
- **Tutarlar:** `font-mono tabular-nums`.
- **Responsive:** mobil tek kolon + alt nav; tablet hamburger; desktop sidebar + iki kolon.
- **Animasyon:** Framer Motion (accordion, sayfa geçişleri).

---

## 14. PWA Konfigürasyonu

`next.config.js` — `@ducanh2912/next-pwa` ile:
```javascript
const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
});
module.exports = withPWA({ /* next config */ });
```
`public/manifest.json`: `name "Outflow"`, `start_url "/expenses"`, `display "standalone"`,
`theme_color "#0f172a"`, ikonlar 192/512/maskable. İkonlar `scripts/generate-icons.mjs` ile üretilir.

---

## 15. Ortam Değişkenleri

`.env.local`:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=outflow
JWT_SECRET=uzun-rastgele-bir-secret
```
`src/lib/db.ts`:
```typescript
import mysql from 'mysql2/promise';
const pool = mysql.createPool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'outflow',
  waitForConnections: true, connectionLimit: 10, timezone: '+00:00',
});
export default pool;
```

---

## 16. Güvenlik Gereksinimleri

1. Her korumalı uçta `getAuthUser(req)` ile JWT doğrulaması; başarısızsa `401`.
2. **Kullanıcı izolasyonu:** tüm sorgularda `user_id = ?`; sahiplik kontrolü (PUT/DELETE).
3. **Prepared statements** (`mysql2` parametreli sorgular) — SQL injection koruması.
4. Şifre `bcrypt` (rounds 10); düz şifre asla saklanmaz/loglanmaz.
5. JWT 7 gün; `JWT_SECRET` env'den, asla repoda sabit değil.
6. `total_amount` istemciden DEĞİL, sunucuda kalemlerden hesaplanır.
7. Üretimde HTTPS.

---

## 17. Hata Yönetimi

- Client: `401` → logout + `/login`. `500` → "Sunucu hatası" toast. `!ok` → `message` toast.
  Ağ hatası → "İnternet bağlantınızı kontrol edin".
- Toast tipleri: success / warning / error. Örnekler: "Harcama eklendi" (success),
  "Harcama silindi" (warning), "Kullanıcı adı veya şifre hatalı" (error).
- Server: tüm handler'lar `try/catch`, transaction'lar hata halinde `rollback`, `console.error`.

---

## 18. Adım Adım İnşa Planı (AI İçin)

> Aşağıdaki adımları **sırayla** uygula. Her adım, bir öncekinin üzerine eklenir.

**Adım 0 — Proje iskeleti**
1. `npx create-next-app@latest outflow --ts --app --eslint` (src dizini kullan).
2. Bağımlılıkları kur: `@heroui/react framer-motion @reduxjs/toolkit react-redux recharts
   mysql2 jsonwebtoken bcryptjs @ducanh2912/next-pwa tailwindcss@4 @tailwindcss/postcss`
   ve dev tipleri (`@types/jsonwebtoken @types/bcryptjs`).
3. `tsconfig.json` path alias: `@/* → src/*`.

**Adım 1 — Veritabanı**
1. `migrations/000_init.sql` (§6.1–6.4 + categories seed), `001_add_recurring_templates.sql` (§6.5)
   ve `002_add_incomes.sql` (§6.6–6.7).
2. `CREATE DATABASE outflow;` sonra migration'ları sırayla çalıştır.
3. `.env.local` (§15) ve `src/lib/db.ts` (§15).

**Adım 2 — Tipler ve yardımcılar**
1. `src/types/index.ts` (§10.3).
2. `src/lib/formatters.ts` (§9.1, §9.2 + `formatDate`, `formatDayHeader`, `getMonthName`,
   `formatMonthYear`, `isCurrentMonth`, `isPastMonth`).
3. `src/lib/groupExpenses.ts` (§10.2).
4. `src/lib/server-auth.ts` (§7).
5. `src/lib/recurring-materializer.ts` (§9.3) ve `src/lib/recurring-income-materializer.ts` (§9.6).
6. `src/lib/api.ts` (§10.1).

**Adım 3 — Auth API**
1. `POST /api/auth/register` (§8.1), `POST /api/auth/login` (§8.2).

**Adım 4 — Çekirdek API**
1. `GET /api/categories` (§8.3).
2. `GET,POST /api/expenses` (§8.4, §8.5) — GET'te önce `materializeRecurring`, sonra taksit dağıtımı.
3. `PUT,DELETE /api/expenses/[id]` (§8.6, §8.7).
4. `GET,POST /api/recurring` + `PUT,DELETE /api/recurring/[id]` (§8.8–8.10).
5. `GET,POST /api/incomes` + `PUT,DELETE /api/incomes/[id]` (§8.11–8.13) — GET'te önce
   `materializeRecurringIncome`.
6. `GET,POST /api/recurring-incomes` + `PUT,DELETE /api/recurring-incomes/[id]` (§8.14–8.16).
7. `GET /api/analytics` (§8.17) — gelir/gider/net dahil.

**Adım 5 — Redux**
1. `store/index.ts`, `store/hooks.ts`, 5 slice (§11): auth, expenses, recurring, income, ui.

**Adım 6 — Layout & Guard**
1. Root `layout.tsx` (Providers + ToastContainer). `(app)/layout.tsx` (AuthGuard + Navbar +
   Sidebar + MobileBottomNav). `page.tsx` redirect.

**Adım 7 — Auth sayfaları**
1. `(auth)/login`, `(auth)/signup` + `LoginForm`, `SignupForm`.

**Adım 8 — Harcama UI**
1. `CurrencyInput`, `LoadingSpinner`, `EmptyState`, `SkeletonCard`.
2. `ExpenseList → MonthGroup → DayGroup → ExpenseCard → ExpenseItems + InstallmentTimeline`.
3. `AddExpenseModal` + `ExpenseItemForm` + `DeleteConfirmModal`.
4. `/expenses` sayfası (§12).

**Adım 9 — Recurring & Birikim**
1. `RecurringTemplateModal` + `/recurring`.
2. `/birikimler` (kategori 13, `forcedCategoryId`).

**Adım 9.5 — Gelirler**
1. `IncomeList`, `IncomeCard`, `AddIncomeModal`, `RecurringIncomeModal`.
2. `/gelirler` sayfası (tekrarlayan gelir + tek seferlik gelir, §12).
3. Navbar/Sidebar/MobileBottomNav'a "Gelirler" girişi ekle.

**Adım 10 — Analytics & Dashboard**
1. `MonthlySummaryChart`, `CategoryBreakdown`, `InstallmentBurden` + `/analytics`.
2. `/dashboard`.

**Adım 11 — PWA & Tasarım**
1. `next.config.js` (next-pwa), `manifest.json`, ikon scriptleri, tema CSS.
2. Tailwind tema + global stiller.

**Adım 12 — Doğrulama**
1. `npm run build` ve `npm run lint` temiz.
2. §19'daki test senaryolarını manuel çalıştır.

---

## 19. Kabul Kriterleri / Test Senaryoları

- [ ] Kayıt → otomatik giriş → `/expenses`. Aynı kullanıcı adı tekrar → `409`.
- [ ] Giriş yanlış şifre → `401` + toast.
- [ ] Peşin harcama eklenir, doğru ay/gün altında görünür; tutar `1.234,56` formatında.
- [ ] Çok kalemli taksitli alım: toplam = kalemler toplamı; aylık taksit = ROUND(toplam/n,2).
- [ ] Taksitli alım sonraki aylarda ödeme satırı olarak görünür (`installment_current_no` doğru).
- [ ] Tekrarlayan şablon: liste açıldığında ilgili aylarda otomatik harcama üretilir; tekrar
      açınca **çoğalmaz** (idempotent).
- [ ] `day_of_month=31` Şubat'ta ayın son gününe clamp edilir.
- [ ] Birikim ekranı yalnız kategori 13 kayıtlarını gösterir; ekleme kategoriyi 13'e sabitler.
- [ ] Tekrarlayan gelir (maaş) eklenince ilgili tüm aylarda otomatik gelir üretilir; liste tekrar
      açılınca **çoğalmaz** (idempotent).
- [ ] Aya özel tek seferlik ek gelir yalnız girildiği ayda görünür.
- [ ] Analitik: her ay için `gelir − gider = net` doğru; `year_summary.net` tutarlı.
- [ ] Net pozitifse yeşil, negatifse kırmızı gösterilir.
- [ ] Analitik: aylık toplamlar peşin+dağıtılmış taksit; kategori dağılımı azalan sıralı.
- [ ] Başka kullanıcının harcaması okunamaz/güncellenemez/silinemez (user_id izolasyonu).
- [ ] Token silindiğinde/expire olduğunda korumalı sayfa → `/login`.
- [ ] PWA yüklenebilir; `manifest.json` ve ikonlar geçerli.
- [ ] `npm run build` hatasız.

---

*Bu doküman, Outflow'u sıfırdan tek bir Next.js full-stack uygulaması olarak (MySQL + JWT)
eksiksiz inşa etmek için gereken tüm bilgiyi içerir. Frontend ve API aynı kod tabanında yaşar;
sözleşme §8'deki endpoint ve yanıt formatlarıyla, veri modeli §6'daki şema ile tanımlanmıştır.*
