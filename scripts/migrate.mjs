// migrate.mjs — migrations/ klasöründeki .sql dosyalarını sırayla çalıştırır.
// Uygulanan migration'lar `schema_migrations` tablosunda izlenir; tekrar çalıştırmak güvenlidir.
//
// Kullanım:  npm run migrate
// Ortam:     .env.local içindeki DB_* değişkenlerini okur.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config(); // .env de varsa

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

const cfg = {
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'outflow',
};

async function main() {
  // 1) Veritabanını oluştur (yoksa)
  const root = await mysql.createConnection({
    host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password,
    multipleStatements: true,
  });
  await root.query(
    `CREATE DATABASE IF NOT EXISTS \`${cfg.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await root.end();

  // 2) DB'ye bağlan
  const db = await mysql.createConnection({ ...cfg, multipleStatements: true });

  // 3) İzleme tablosu
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [appliedRows] = await db.query('SELECT name FROM schema_migrations');
  const applied = new Set(appliedRows.map((r) => r.name));

  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`✓ atlandı (zaten uygulandı): ${file}`);
      continue;
    }
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    process.stdout.write(`→ uygulanıyor: ${file} ... `);
    try {
      await db.query(sql);
      await db.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
      console.log('tamam');
      ran++;
    } catch (err) {
      console.log('HATA');
      console.error(err.message);
      await db.end();
      process.exit(1);
    }
  }

  await db.end();
  console.log(`\nBitti. ${ran} yeni migration uygulandı, ${files.length - ran} atlandı.`);
}

main().catch((err) => {
  console.error('Migration başarısız:', err);
  process.exit(1);
});
