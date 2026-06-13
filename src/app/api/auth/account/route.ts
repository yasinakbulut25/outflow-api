import { NextRequest, NextResponse } from 'next/server';
import type { ResultSetHeader } from 'mysql2';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/server-auth';

// Hesap silme — kalıcı ve geri alınamaz. Kullanıcıya bağlı tüm veriler
// (harcamalar, gelirler, tekrarlayan şablonlar, şifre sıfırlama kayıtları) users
// satırına FOREIGN KEY ... ON DELETE CASCADE ile bağlı olduğundan tek DELETE ile
// birlikte silinir. Kategoriler global olduğundan etkilenmez.
export async function DELETE(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Yetkisiz' }, { status: 401 });
  }

  try {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM users WHERE id = ?', [
      user.user_id,
    ]);

    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, message: 'Kullanıcı bulunamadı' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { success: true } });
  } catch (err) {
    console.error('[auth/account] delete', err);
    return NextResponse.json({ success: false, message: 'Sunucu hatası' }, { status: 500 });
  }
}
