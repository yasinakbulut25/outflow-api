import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import type { RowDataPacket } from 'mysql2';
import pool from '@/lib/db';
import { checkRateLimit, recordAuthAttempt, getClientIp } from '@/lib/rate-limit';
import { signResetToken } from '@/lib/server-auth';
import { OTP_MAX_ATTEMPTS } from '@/lib/password-reset';

interface ResetRow extends RowDataPacket {
  user_id: number;
  code_hash: string;
  attempts: number;
  expired: number;
}

const INVALID = { success: false as const, message: 'Kod geçersiz veya süresi dolmuş' };

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
    await recordAuthAttempt(ip, undefined);

    const { email, code } = await req.json();
    if (!email?.trim() || !/^\d{6}$/.test(String(code ?? ''))) {
      return NextResponse.json({ success: false, message: 'E-posta ve 6 haneli kod gerekli' }, { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();

    // Kullanıcı + aktif sıfırlama kaydını tek sorguda al (expired'ı DB saatine göre hesapla).
    const [rows] = await pool.query<ResetRow[]>(
      `SELECT pr.user_id, pr.code_hash, pr.attempts, (pr.expires_at < NOW()) AS expired
         FROM password_resets pr
         JOIN users u ON u.id = pr.user_id
        WHERE u.email = ?`,
      [normalizedEmail]
    );
    const row = rows[0];
    if (!row) return NextResponse.json(INVALID, { status: 400 });

    // Süresi dolmuş veya deneme hakkı bitmiş → kaydı sil, geçersiz dön.
    if (row.expired || row.attempts >= OTP_MAX_ATTEMPTS) {
      await pool.query('DELETE FROM password_resets WHERE user_id = ?', [row.user_id]);
      return NextResponse.json(INVALID, { status: 400 });
    }

    const match = await bcrypt.compare(String(code), row.code_hash);
    if (!match) {
      const attempts = row.attempts + 1;
      if (attempts >= OTP_MAX_ATTEMPTS) {
        // Son hak da yanlış → kodu iptal et.
        await pool.query('DELETE FROM password_resets WHERE user_id = ?', [row.user_id]);
        return NextResponse.json(
          { success: false, message: 'Çok fazla yanlış deneme. Lütfen yeni kod isteyin.' },
          { status: 400 }
        );
      }
      await pool.query('UPDATE password_resets SET attempts = ? WHERE user_id = ?', [
        attempts,
        row.user_id,
      ]);
      const remaining = OTP_MAX_ATTEMPTS - attempts;
      return NextResponse.json(
        { success: false, message: `Kod hatalı. ${remaining} deneme hakkın kaldı.` },
        { status: 400 }
      );
    }

    // Doğrulandı → kodu hemen sil (tek kullanımlık) ve şifre belirleme için kısa ömürlü token ver.
    await pool.query('DELETE FROM password_resets WHERE user_id = ?', [row.user_id]);
    const resetToken = signResetToken(row.user_id);

    return NextResponse.json({ success: true, data: { resetToken } });
  } catch (err) {
    console.error('[verify-otp]', err);
    return NextResponse.json({ success: false, message: 'Sunucu hatası' }, { status: 500 });
  }
}
