# Outflow API

Backend for Outflow, a personal finance tracking app. Built with **Next.js App Router Route Handlers** and **MySQL** — serves both the web client and the React Native mobile app from a single REST API.

## What it does

Outflow lets users track their income and expenses with support for:

- **Installment purchases** — split a purchase into N months, automatically distributed across the payment calendar
- **Recurring expenses** — define a template once (rent, subscriptions, etc.) and have it materialize each month automatically
- **Recurring income** — salary-style income that auto-generates every month
- **One-off income** — ad-hoc income entries per month
- **Analytics** — monthly income/expense/net summary, category breakdown, and installment load calendar
- **Multi-user** — each user manages their own data independently, authenticated via JWT

The full API contract, data model, and business rules live in [`SPEC.md`](./SPEC.md).

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Next.js 15 (App Router) |
| Database | MySQL 8 via `mysql2` |
| Auth | JWT (HS256, 7-day expiry) + bcrypt |
| Language | TypeScript |

## Requirements

- Node.js 18+
- MySQL 8+

## Setup

```bash
npm install
cp .env.local.example .env.local
```

Edit `.env.local` and fill in your database credentials and a strong JWT secret:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=outflow
JWT_SECRET=a-long-random-secret
CORS_ORIGIN=*
```

Run migrations and start the dev server:

```bash
npm run migrate   # creates the database and applies all migrations
npm run dev       # http://localhost:3000
```

To expose the API on your local network (e.g. for a React Native device on the same Wi-Fi):

```bash
npx next dev -H 0.0.0.0
# On the mobile side: EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:3000
```

## Migrations

SQL files under `migrations/` run in order. Applied migrations are tracked in a `schema_migrations` table — rerunning is safe.

| File | Contents |
|---|---|
| `000_init.sql` | `users`, `categories` (+ 13 seed rows), `expenses`, `expense_items` |
| `001_add_recurring_templates.sql` | `recurring_templates`, `expenses.recurring_template_id` |
| `002_add_incomes.sql` | `recurring_income_templates`, `incomes` |

## API endpoints

All protected endpoints require `Authorization: Bearer <token>`. Every response follows `{ success, data }` / `{ success: false, message }`.

| Method | Path | Auth |
|---|---|---|
| GET | `/api/health` | — |
| POST | `/api/auth/register` | — |
| POST | `/api/auth/login` | — |
| GET | `/api/categories` | ✓ |
| GET, POST | `/api/expenses` | ✓ |
| PUT, DELETE | `/api/expenses/:id` | ✓ |
| GET, POST | `/api/recurring` | ✓ |
| PUT, DELETE | `/api/recurring/:id` | ✓ |
| GET, POST | `/api/incomes` | ✓ |
| PUT, DELETE | `/api/incomes/:id` | ✓ |
| GET, POST | `/api/recurring-incomes` | ✓ |
| PUT, DELETE | `/api/recurring-incomes/:id` | ✓ |
| GET | `/api/analytics?year=` | ✓ |

## Deploy

Vercel + a managed MySQL provider (PlanetScale, Railway, Aiven, etc.) is the recommended setup.

1. Set all `DB_*`, `JWT_SECRET`, and `CORS_ORIGIN` environment variables in your hosting dashboard.
2. Run migrations once against the production database: `DB_* pointing at prod npm run migrate`.
