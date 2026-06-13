import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import type { RowDataPacket } from 'mysql2';
import pool from '@/lib/db';
import { checkRateLimit, recordAuthAttempt, getClientIp } from '@/lib/rate-limit';
import { sendPasswordResetEmail } from '@/lib/email';
import {
  generateOtp,
  OTP_TTL_MINUTES,
  OTP_RESEND_COOLDOWN_SECONDS,
} from '@/lib/password-reset';

interface UserRow extends RowDataPacket {
  id: number;
}
interface ResetRow extends RowDataPacket {
  age_seconds: number;
}

// Genel (kullanıcı varlığını sızdırmayan) başarı yanıtı.
const GENERIC_OK = {
  success: true,
  data: { message: 'Eğer bu e-posta kayıtlıysa, bir doğrulama kodu gönderildi.' },
};

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limit = await checkRateLimit(ip);
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, message: 'Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
      );
    }

    const { email } = await req.json();
    if (!email?.trim()) {
      return NextResponse.json({ success: false, message: 'E-posta gerekli' }, { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();
    await recordAuthAttempt(ip, normalizedEmail);

    const [users] = await pool.query<UserRow[]>('SELECT id FROM users WHERE email = ?', [
      normalizedEmail,
    ]);
    const user = users[0];

    // Kullanıcı yoksa: varlığı sızdırmamak için yine genel başarı dön (kod üretme/gönderme yok).
    if (!user) return NextResponse.json(GENERIC_OK);

    // Cooldown: çok kısa süre önce kod gönderildiyse yenisini üretme (e-posta bombardımanını önler).
    const [existing] = await pool.query<ResetRow[]>(
      'SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) AS age_seconds FROM password_resets WHERE user_id = ?',
      [user.id]
    );
    if (existing[0] && existing[0].age_seconds < OTP_RESEND_COOLDOWN_SECONDS) {
      return NextResponse.json(GENERIC_OK);
    }

    const code = generateOtp();
    const codeHash = await bcrypt.hash(code, 10);
    await pool.query(
      `INSERT INTO password_resets (user_id, code_hash, expires_at, attempts)
         VALUES (?, ?, (NOW() + INTERVAL ? MINUTE), 0)
       ON DUPLICATE KEY UPDATE
         code_hash = VALUES(code_hash),
         expires_at = VALUES(expires_at),
         attempts = 0,
         created_at = CURRENT_TIMESTAMP`,
      [user.id, codeHash, OTP_TTL_MINUTES]
    );

    await sendPasswordResetEmail(normalizedEmail, code);

    return NextResponse.json(GENERIC_OK);
  } catch (err) {
    console.error('[forgot-password]', err);
    return NextResponse.json({ success: false, message: 'Sunucu hatası' }, { status: 500 });
  }
}
