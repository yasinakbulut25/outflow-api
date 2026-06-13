import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '@/lib/db';
import { signToken } from '@/lib/server-auth';
import { checkRateLimit, recordAuthAttempt, getClientIp } from '@/lib/rate-limit';
import { sendWelcomeEmail } from '@/lib/email';

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

    const { email, name, password } = await req.json();

    if (!email?.trim() || !password) {
      return NextResponse.json(
        { success: false, message: 'E-posta ve şifre gerekli' },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: 'Şifre en az 6 karakter olmalı' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ?',
      [normalizedEmail]
    );
    if (existing.length) {
      return NextResponse.json(
        { success: false, message: 'Bu e-posta zaten kayıtlı' },
        { status: 409 }
      );
    }

    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)',
      [normalizedEmail, name?.trim() || null, password_hash]
    );

    const token = signToken({ user_id: result.insertId });

    // Hoş geldin e-postası — gönderim başarısız olsa bile kayıt akışını bozmamalı.
    try {
      await sendWelcomeEmail(normalizedEmail, name?.trim() || undefined);
    } catch (mailErr) {
      console.error('[register] welcome email failed', mailErr);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          token,
          user: { id: result.insertId, email: normalizedEmail, name: name?.trim() || null },
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[register]', err);
    return NextResponse.json({ success: false, message: 'Sunucu hatası' }, { status: 500 });
  }
}
