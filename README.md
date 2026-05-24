# Outflow API

Outflow'un backend'i — **Next.js (App Router) Route Handlers** + **MySQL**. Hem web hem de
React Native mobil istemciye aynı REST API'yi sunar. API sözleşmesi, veri modeli ve iş kuralları
için ana repodaki [`SPEC.md`](../outflow/SPEC.md) kaynaktır.

## Gereksinimler
- Node.js 18+
- MySQL 8+

## Kurulum

```bash
npm install
cp .env.local.example .env.local   # değerleri düzenle (DB_*, JWT_SECRET)
npm run migrate                     # veritabanını oluşturur + tüm migration'ları uygular
npm run dev                         # http://localhost:3000
```

Mobil cihazdan erişim için (aynı Wi-Fi):
```bash
npx next dev -H 0.0.0.0
# RN tarafında: EXPO_PUBLIC_API_URL=http://<bilgisayar-LAN-IP>:3000
```

## Migration

`migrations/*.sql` dosyaları sırayla çalışır; uygulananlar `schema_migrations` tablosunda izlenir,
tekrar çalıştırmak güvenlidir.

| Dosya | İçerik |
|---|---|
| `000_init.sql` | users, categories (+13 kategori seed), expenses, expense_items |
| `001_add_recurring_templates.sql` | recurring_templates + expenses.recurring_template_id |
| `002_add_incomes.sql` | recurring_income_templates + incomes |

## Endpoint'ler

| Method | Yol | Auth |
|---|---|---|
| GET | `/api/health` | ❌ |
| POST | `/api/auth/register` | ❌ |
| POST | `/api/auth/login` | ❌ |
| GET | `/api/categories` | ✅ |
| GET/POST | `/api/expenses` | ✅ |
| PUT/DELETE | `/api/expenses/{id}` | ✅ |
| GET/POST | `/api/recurring` | ✅ |
| PUT/DELETE | `/api/recurring/{id}` | ✅ |
| GET/POST | `/api/incomes` | ✅ |
| PUT/DELETE | `/api/incomes/{id}` | ✅ |
| GET/POST | `/api/recurring-incomes` | ✅ |
| PUT/DELETE | `/api/recurring-incomes/{id}` | ✅ |
| GET | `/api/analytics?year=` | ✅ |

Auth: `Authorization: Bearer <jwt>`. Yanıt: `{ success, data }` / `{ success:false, message }`.

## Deploy
- Vercel (öneri) + yönetilen MySQL (PlanetScale, Railway, Aiven vb.).
- Ortam değişkenlerini (DB_*, JWT_SECRET, CORS_ORIGIN) deploy panelinde tanımlayın.
- Migration'ları üretim DB'sine bir kez çalıştırın (`DB_* = üretim` ile `npm run migrate`).
