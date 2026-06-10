import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/server-auth';
import { expandRecurringIncomes } from '@/lib/recurring-income-expander';
import type { Income } from '@/types';

interface IncomeRow extends RowDataPacket {
  id: number;
  user_id: number;
  title: string;
  amount: string;
  income_date: string;
  note: string | null;
  recurring_income_id: number | null;
  created_at: string;
  updated_at: string;
}

function rowToIncome(r: IncomeRow): Income {
  return {
    id: r.id,
    user_id: r.user_id,
    title: r.title,
    amount: Number(r.amount),
    income_date: r.income_date,
    note: r.note ?? undefined,
    recurring_income_id: r.recurring_income_id ?? undefined,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function GET(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ success: false, message: 'Yetkisiz' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get('year') ?? new Date().getFullYear());
    const monthParam = searchParams.get('month');
    const month = monthParam ? Number(monthParam) : undefined;

    const conditions = ['user_id = ?', 'YEAR(income_date) = ?'];
    const queryParams: (number)[] = [user.user_id, year];
    if (month) {
      conditions.push('MONTH(income_date) = ?');
      queryParams.push(month);
    }

    const [rows] = await pool.query<IncomeRow[]>(
      `SELECT id, user_id, title, amount,
              DATE_FORMAT(income_date, '%Y-%m-%d') AS income_date,
              note, recurring_income_id, created_at, updated_at
       FROM incomes
       WHERE ${conditions.join(' AND ')}
       ORDER BY income_date DESC, id DESC`,
      queryParams,
    );

    // Tekrarlayan gelirleri şablondan türet (DB'ye yazmadan) ve sonuca ekle.
    const recurring = await expandRecurringIncomes(user.user_id, year, month);

    return NextResponse.json({ success: true, data: [...rows.map(rowToIncome), ...recurring] });
  } catch (err) {
    console.error('[incomes GET]', err);
    return NextResponse.json({ success: false, message: 'Sunucu hatası' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ success: false, message: 'Yetkisiz' }, { status: 401 });

  try {
    const { title, amount, income_date, note } = await req.json();

    if (!title?.trim() || !amount || amount <= 0 || !income_date) {
      return NextResponse.json({ success: false, message: 'Gerekli alanlar eksik' }, { status: 400 });
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO incomes (user_id, title, amount, income_date, note)
       VALUES (?, ?, ?, ?, ?)`,
      [user.user_id, title.trim(), amount, income_date, note ?? null],
    );

    const [rows] = await pool.query<IncomeRow[]>(
      `SELECT id, user_id, title, amount,
              DATE_FORMAT(income_date, '%Y-%m-%d') AS income_date,
              note, recurring_income_id, created_at, updated_at
       FROM incomes WHERE id = ?`,
      [result.insertId],
    );

    return NextResponse.json({ success: true, data: rowToIncome(rows[0]) }, { status: 201 });
  } catch (err) {
    console.error('[incomes POST]', err);
    return NextResponse.json({ success: false, message: 'Sunucu hatası' }, { status: 500 });
  }
}
