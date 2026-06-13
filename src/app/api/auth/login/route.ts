import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';
import { signToken } from '@/lib/server-auth';
import { checkRateLimit, recordAuthAttempt, clearAuthAttempts, getClientIp } from '@/lib/rate-limit';
import type { RowDataPacket } from 'mysql2';

interface UserRow extends RowDataPacket {
  id: number;
  email: string;
  name: string | null;
  password_hash: string;
}

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

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'E-posta ve şifre gerekli' },
        { status: 400 }
      );
    }

    const [rows] = await pool.query<UserRow[]>(
      'SELECT id, email, name, password_hash FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    );

    const user = rows[0];
    if (!user?.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
      await recordAuthAttempt(ip, email);
      return NextResponse.json(
        { success: false, message: 'E-posta veya şifre hatalı' },
        { status: 401 }
      );
    }

    await clearAuthAttempts(ip);
    const token = signToken({ user_id: user.id });

    return NextResponse.json({
      success: true,
      data: { token, user: { id: user.id, email: user.email, name: user.name } },
    });
  } catch (err) {
    console.error('[login]', err);
    return NextResponse.json({ success: false, message: 'Sunucu hatası' }, { status: 500 });
  }
}
