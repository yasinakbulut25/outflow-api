import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';
import { signToken } from '@/lib/server-auth';
import type { RowDataPacket } from 'mysql2';

interface UserRow extends RowDataPacket {
  id: number;
  username: string;
  display_name: string | null;
  password_hash: string;
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: 'Kullanıcı adı ve şifre gerekli' },
        { status: 400 }
      );
    }

    const [rows] = await pool.query<UserRow[]>(
      'SELECT id, username, display_name, password_hash FROM users WHERE username = ?',
      [username]
    );

    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return NextResponse.json(
        { success: false, message: 'Kullanıcı adı veya şifre hatalı' },
        { status: 401 }
      );
    }

    const token = signToken({ user_id: user.id, username: user.username });

    return NextResponse.json({
      success: true,
      data: {
        token,
        user: { id: user.id, username: user.username, display_name: user.display_name },
      },
    });
  } catch (err) {
    console.error('[login]', err);
    return NextResponse.json({ success: false, message: 'Sunucu hatası' }, { status: 500 });
  }
}
