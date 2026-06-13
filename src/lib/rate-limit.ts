// rate-limit.ts — auth_attempts tablosuna dayalı, IP bazlı basit rate limit.
// Serverless'ta da çalışır (durum bellekte değil, DB'de). Pencere ve eşik parametreli;
// varsayılan: IP başına 15 dakikada 10 deneme.

import type { RowDataPacket } from 'mysql2';
import pool from '@/lib/db';

const DEFAULT_WINDOW_MINUTES = 15;
const DEFAULT_MAX_ATTEMPTS = 10;

export interface RateLimitOptions {
  /** Pencere uzunluğu (dakika). Varsayılan 15. */
  windowMinutes?: number;
  /** Pencere içinde izin verilen maksimum deneme. Varsayılan 10. */
  maxAttempts?: number;
}

export interface RateLimitResult {
  /** İstek izinli mi (eşik aşılmadı mı)? false ise route 429 dönmeli. */
  allowed: boolean;
  /** Pencerede kalan deneme hakkı. */
  remaining: number;
  /** Eşik aşıldıysa tekrar denemeden önce beklenecek saniye. */
  retryAfter: number;
}

interface CountRow extends RowDataPacket {
  attempts: number;
  oldest: Date | null;
}

/**
 * Verilen IP için pencere içindeki deneme sayısını kontrol eder. Kayıt EKLEMEZ; yalnızca okur.
 * allowed=false dönerse route 429 + Retry-After dönmeli.
 */
export async function checkRateLimit(ip: string, opts: RateLimitOptions = {}): Promise<RateLimitResult> {
  const windowMinutes = opts.windowMinutes ?? DEFAULT_WINDOW_MINUTES;
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  const [rows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) AS attempts, MIN(created_at) AS oldest
       FROM auth_attempts
      WHERE ip = ? AND created_at > (NOW() - INTERVAL ? MINUTE)`,
    [ip, windowMinutes]
  );

  const attempts = Number(rows[0]?.attempts ?? 0);
  const allowed = attempts < maxAttempts;

  let retryAfter = 0;
  if (!allowed && rows[0]?.oldest) {
    const windowEndsMs = new Date(rows[0].oldest).getTime() + windowMinutes * 60_000;
    retryAfter = Math.max(1, Math.ceil((windowEndsMs - Date.now()) / 1000));
  }

  return { allowed, remaining: Math.max(0, maxAttempts - attempts), retryAfter };
}

/** Bir denemeyi kaydeder. Ara sıra (~%5) 1 günden eski kayıtları budar. */
export async function recordAuthAttempt(ip: string, email?: string | null): Promise<void> {
  await pool.query('INSERT INTO auth_attempts (ip, email) VALUES (?, ?)', [
    ip,
    email?.trim().toLowerCase() || null,
  ]);

  if (Math.random() < 0.05) {
    await pool.query('DELETE FROM auth_attempts WHERE created_at < (NOW() - INTERVAL 1 DAY)');
  }
}

/** Başarılı giriş sonrası ilgili IP'nin denemelerini temizler. */
export async function clearAuthAttempts(ip: string): Promise<void> {
  await pool.query('DELETE FROM auth_attempts WHERE ip = ?', [ip]);
}

/** İstek başlıklarından istemci IP'sini çıkarır (proxy/CDN arkasında x-forwarded-for). */
export function getClientIp(req: { headers: Headers }): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}
