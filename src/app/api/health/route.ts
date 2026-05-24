import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// Sağlık kontrolü — deploy doğrulaması için. DB bağlantısını da test eder.
export async function GET() {
  try {
    await pool.query('SELECT 1');
    return NextResponse.json({ success: true, data: { status: 'ok', db: 'up' } });
  } catch {
    return NextResponse.json(
      { success: false, message: 'DB bağlantısı yok' },
      { status: 503 }
    );
  }
}
