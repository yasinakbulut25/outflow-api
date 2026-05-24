import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '@/lib/db';
import { signToken } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password, display_name } = await req.json();

    if (!username?.trim() || !password) {
      return NextResponse.json(
        { success: false, message: 'Kullanıcı adı ve şifre gerekli' },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: 'Şifre en az 6 karakter olmalı' },
        { status: 400 }
      );
    }

    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE username = ?',
      [username.trim()]
    );
    if (existing.length) {
      return NextResponse.json(
        { success: false, message: 'Bu kullanıcı adı zaten alınmış' },
        { status: 409 }
      );
    }

    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO users (username, display_name, password_hash) VALUES (?, ?, ?)',
      [username.trim(), display_name?.trim() || null, password_hash]
    );

    const token = signToken({ user_id: result.insertId, username: username.trim() });

    return NextResponse.json(
      {
        success: true,
        data: {
          token,
          user: { id: result.insertId, username: username.trim(), display_name: display_name?.trim() || null },
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[register]', err);
    return NextResponse.json({ success: false, message: 'Sunucu hatası' }, { status: 500 });
  }
}
