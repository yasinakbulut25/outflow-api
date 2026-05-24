import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/server-auth';
import type { RowDataPacket } from 'mysql2';

interface CategoryRow extends RowDataPacket {
  id: number;
  name: string;
  icon: string;
  color: string;
}

export async function GET(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Yetkisiz' }, { status: 401 });
  }

  try {
    const [rows] = await pool.query<CategoryRow[]>(
      'SELECT id, name, icon, color FROM categories ORDER BY id'
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error('[categories]', err);
    return NextResponse.json({ success: false, message: 'Sunucu hatası' }, { status: 500 });
  }
}
