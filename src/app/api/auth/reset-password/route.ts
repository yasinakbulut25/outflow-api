import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import type { ResultSetHeader } from 'mysql2';
import pool from '@/lib/db';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { verifyResetToken } from '@/lib/server-auth';

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

    const { resetToken, newPassword } = await req.json();

    const payload = resetToken ? verifyResetToken(String(resetToken)) : null;
    if (!payload) {
      return NextResponse.json(
        { success: false, message: 'Oturum süresi doldu. Lütfen baştan deneyin.' },
        { status: 401 }
      );
    }
    if (!newPassword || String(newPassword).length < 6) {
      return NextResponse.json(
        { success: false, message: 'Şifre en az 6 karakter olmalı' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [passwordHash, payload.user_id]
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, message: 'Kullanıcı bulunamadı' }, { status: 404 });
    }

    // Güvenlik: bu kullanıcıya ait varsa kalan tüm sıfırlama kayıtlarını da temizle.
    await pool.query('DELETE FROM password_resets WHERE user_id = ?', [payload.user_id]);

    return NextResponse.json({ success: true, data: { message: 'Şifren güncellendi' } });
  } catch (err) {
    console.error('[reset-password]', err);
    return NextResponse.json({ success: false, message: 'Sunucu hatası' }, { status: 500 });
  }
}
