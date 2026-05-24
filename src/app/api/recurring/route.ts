import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/server-auth';
import type { RecurringTemplate } from '@/types';

interface TemplateRow extends RowDataPacket {
  id: number;
  user_id: number;
  category_id: number | null;
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  title: string;
  amount: string;
  day_of_month: number;
  start_date: string;
  end_date: string | null;
  note: string | null;
  active: number;
  last_generated_month: string | null;
  created_at: string;
  updated_at: string;
}

function rowToTemplate(r: TemplateRow): RecurringTemplate {
  return {
    id: r.id,
    user_id: r.user_id,
    category_id: r.category_id ?? undefined,
    category_name: r.category_name ?? undefined,
    category_icon: r.category_icon ?? undefined,
    category_color: r.category_color ?? undefined,
    title: r.title,
    amount: Number(r.amount),
    day_of_month: r.day_of_month,
    start_date: r.start_date,
    end_date: r.end_date,
    note: r.note ?? undefined,
    active: r.active === 1,
    last_generated_month: r.last_generated_month,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

async function fetchOne(id: number, userId: number): Promise<RecurringTemplate | null> {
  const [rows] = await pool.query<TemplateRow[]>(
    `SELECT t.id, t.user_id, t.category_id, t.title, t.amount, t.day_of_month,
            DATE_FORMAT(t.start_date, '%Y-%m-%d') AS start_date,
            DATE_FORMAT(t.end_date,   '%Y-%m-%d') AS end_date,
            t.note, t.active, t.last_generated_month, t.created_at, t.updated_at,
            c.name AS category_name, c.icon AS category_icon, c.color AS category_color
     FROM recurring_templates t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.id = ? AND t.user_id = ?`,
    [id, userId],
  );
  return rows.length ? rowToTemplate(rows[0]) : null;
}

export async function GET(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ success: false, message: 'Yetkisiz' }, { status: 401 });

  try {
    const [rows] = await pool.query<TemplateRow[]>(
      `SELECT t.id, t.user_id, t.category_id, t.title, t.amount, t.day_of_month,
              DATE_FORMAT(t.start_date, '%Y-%m-%d') AS start_date,
              DATE_FORMAT(t.end_date,   '%Y-%m-%d') AS end_date,
              t.note, t.active, t.last_generated_month, t.created_at, t.updated_at,
              c.name AS category_name, c.icon AS category_icon, c.color AS category_color
       FROM recurring_templates t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = ?
       ORDER BY t.active DESC, t.title ASC`,
      [user.user_id],
    );

    return NextResponse.json({ success: true, data: rows.map(rowToTemplate) });
  } catch (err) {
    console.error('[recurring GET]', err);
    return NextResponse.json({ success: false, message: 'Sunucu hatası' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ success: false, message: 'Yetkisiz' }, { status: 401 });

  try {
    const body = await req.json();
    const { title, amount, day_of_month, start_date, end_date, category_id, note } = body as {
      title?: string;
      amount?: number;
      day_of_month?: number;
      start_date?: string;
      end_date?: string | null;
      category_id?: number;
      note?: string;
    };

    if (!title?.trim() || !amount || amount <= 0 || !day_of_month || !start_date) {
      return NextResponse.json({ success: false, message: 'Gerekli alanlar eksik' }, { status: 400 });
    }
    if (day_of_month < 1 || day_of_month > 28) {
      return NextResponse.json({ success: false, message: 'Gün 1-28 arasında olmalı' }, { status: 400 });
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO recurring_templates
        (user_id, category_id, title, amount, day_of_month, start_date, end_date, note, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [user.user_id, category_id ?? null, title.trim(), amount, day_of_month, start_date, end_date ?? null, note ?? null],
    );

    const tpl = await fetchOne(result.insertId, user.user_id);
    return NextResponse.json({ success: true, data: tpl }, { status: 201 });
  } catch (err) {
    console.error('[recurring POST]', err);
    return NextResponse.json({ success: false, message: 'Sunucu hatası' }, { status: 500 });
  }
}
