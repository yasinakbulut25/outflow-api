import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/server-auth';
import type { RecurringIncomeTemplate } from '@/types';

interface IncomeTemplateRow extends RowDataPacket {
  id: number;
  user_id: number;
  title: string;
  amount: string;
  day_of_month: number;
  start_date: string;
  end_date: string | null;
  note: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

function rowToTemplate(r: IncomeTemplateRow): RecurringIncomeTemplate {
  return {
    id: r.id,
    user_id: r.user_id,
    title: r.title,
    amount: Number(r.amount),
    day_of_month: r.day_of_month,
    start_date: r.start_date,
    end_date: r.end_date,
    note: r.note ?? undefined,
    active: r.active === 1,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

async function fetchOne(id: number, userId: number): Promise<RecurringIncomeTemplate | null> {
  const [rows] = await pool.query<IncomeTemplateRow[]>(
    `SELECT id, user_id, title, amount, day_of_month,
            DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
            DATE_FORMAT(end_date,   '%Y-%m-%d') AS end_date,
            note, active, created_at, updated_at
     FROM recurring_income_templates
     WHERE id = ? AND user_id = ?`,
    [id, userId],
  );
  return rows.length ? rowToTemplate(rows[0]) : null;
}

export async function GET(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ success: false, message: 'Yetkisiz' }, { status: 401 });

  try {
    const [rows] = await pool.query<IncomeTemplateRow[]>(
      `SELECT id, user_id, title, amount, day_of_month,
              DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
              DATE_FORMAT(end_date,   '%Y-%m-%d') AS end_date,
              note, active, created_at, updated_at
       FROM recurring_income_templates
       WHERE user_id = ?
       ORDER BY active DESC, title ASC`,
      [user.user_id],
    );

    return NextResponse.json({ success: true, data: rows.map(rowToTemplate) });
  } catch (err) {
    console.error('[recurring-incomes GET]', err);
    return NextResponse.json({ success: false, message: 'Sunucu hatası' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ success: false, message: 'Yetkisiz' }, { status: 401 });

  try {
    const { title, amount, day_of_month, start_date, end_date, note } = await req.json() as {
      title?: string;
      amount?: number;
      day_of_month?: number;
      start_date?: string;
      end_date?: string | null;
      note?: string;
    };

    if (!title?.trim() || !amount || amount <= 0 || !day_of_month || !start_date) {
      return NextResponse.json({ success: false, message: 'Gerekli alanlar eksik' }, { status: 400 });
    }
    if (day_of_month < 1 || day_of_month > 28) {
      return NextResponse.json({ success: false, message: 'Gün 1-28 arasında olmalı' }, { status: 400 });
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO recurring_income_templates
        (user_id, title, amount, day_of_month, start_date, end_date, note, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [user.user_id, title.trim(), amount, day_of_month, start_date, end_date ?? null, note ?? null],
    );

    const tpl = await fetchOne(result.insertId, user.user_id);
    return NextResponse.json({ success: true, data: tpl }, { status: 201 });
  } catch (err) {
    console.error('[recurring-incomes POST]', err);
    return NextResponse.json({ success: false, message: 'Sunucu hatası' }, { status: 500 });
  }
}
