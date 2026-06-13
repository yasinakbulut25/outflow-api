import { NextRequest, NextResponse } from 'next/server';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '@/lib/db';
import { signToken } from '@/lib/server-auth';
import { sendWelcomeEmail } from '@/lib/email';

interface GoogleUserInfo {
  sub: string;
  name?: string;
  email?: string;
}

interface UserRow extends RowDataPacket {
  id: number;
  email: string | null;
  name: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const { access_token } = await req.json();
    if (!access_token) {
      return NextResponse.json({ success: false, message: 'access_token gerekli' }, { status: 400 });
    }

    const gRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!gRes.ok) {
      return NextResponse.json({ success: false, message: 'Geçersiz Google token' }, { status: 401 });
    }
    const info: GoogleUserInfo = await gRes.json();

    // Önce google_id ile ara
    const [byGoogleId] = await pool.query<UserRow[]>(
      'SELECT id, email, name FROM users WHERE google_id = ?',
      [info.sub],
    );
    if (byGoogleId.length > 0) {
      const user = byGoogleId[0];
      const token = signToken({ user_id: user.id });
      return NextResponse.json({
        success: true,
        data: { token, user: { id: user.id, email: user.email, name: user.name } },
      });
    }

    // Aynı email ile kayıtlı kullanıcı varsa google_id bağla (hesap birleştirme)
    if (info.email) {
      const [byEmail] = await pool.query<UserRow[]>(
        'SELECT id, email, name FROM users WHERE email = ?',
        [info.email.toLowerCase()],
      );
      if (byEmail.length > 0) {
        const user = byEmail[0];
        await pool.query('UPDATE users SET google_id = ? WHERE id = ?', [info.sub, user.id]);
        const token = signToken({ user_id: user.id });
        return NextResponse.json({
          success: true,
          data: { token, user: { id: user.id, email: user.email, name: user.name } },
        });
      }
    }

    // Yeni kullanıcı oluştur
    const email = info.email?.toLowerCase() ?? null;
    const name = info.name ?? null;

    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO users (email, name, google_id) VALUES (?, ?, ?)',
      [email, name, info.sub],
    );

    const token = signToken({ user_id: result.insertId });

    // İlk kez kayıt olan kullanıcıya hoş geldin e-postası — gönderim hatası akışı bozmamalı.
    if (email) {
      try {
        await sendWelcomeEmail(email, name ?? undefined);
      } catch (mailErr) {
        console.error('[auth/google] welcome email failed', mailErr);
      }
    }

    return NextResponse.json(
      { success: true, data: { token, user: { id: result.insertId, email, name } } },
      { status: 201 },
    );
  } catch (err) {
    console.error('[auth/google]', err);
    return NextResponse.json({ success: false, message: 'Sunucu hatası' }, { status: 500 });
  }
}
