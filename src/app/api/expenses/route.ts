import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/server-auth';
import { generateInstallmentSchedule } from '@/lib/formatters';
import { materializeRecurring } from '@/lib/recurring-materializer';
import type { Expense } from '@/types';

interface ExpenseRow extends RowDataPacket {
  id: number;
  user_id: number;
  category_id: number | null;
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  title: string;
  expense_date: string;
  payment_type: 'cash' | 'installment';
  installment_count: number | null;
  total_amount: string;
  note: string | null;
  recurring_template_id: number | null;
  created_at: string;
  updated_at: string;
}

interface ItemRow extends RowDataPacket {
  id: number;
  expense_id: number;
  name: string;
  amount: string;
}

async function fetchExpensesForYear(userId: number, year: number): Promise<Expense[]> {
  const [rows] = await pool.query<ExpenseRow[]>(
    `SELECT e.id, e.user_id, e.category_id,
            DATE_FORMAT(e.expense_date, '%Y-%m-%d') AS expense_date,
            e.payment_type, e.installment_count, e.total_amount, e.note,
            e.recurring_template_id,
            e.created_at, e.updated_at,
            c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
            e.title
     FROM expenses e
     LEFT JOIN categories c ON c.id = e.category_id
     WHERE e.user_id = ?
       AND (
         (e.payment_type = 'cash' AND YEAR(e.expense_date) = ?)
         OR
         (e.payment_type = 'installment'
          AND YEAR(DATE_ADD(e.expense_date, INTERVAL 1 MONTH)) <= ?
          AND YEAR(DATE_ADD(e.expense_date, INTERVAL e.installment_count MONTH)) >= ?)
       )
     ORDER BY e.expense_date DESC, e.id DESC`,
    [userId, year, year, year]
  );

  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);
  const [itemRows] = await pool.query<ItemRow[]>(
    'SELECT id, expense_id, name, amount FROM expense_items WHERE expense_id IN (?)',
    [ids]
  );

  const itemMap = new Map<number, { id: number; expense_id: number; name: string; amount: number }[]>();
  for (const item of itemRows) {
    if (!itemMap.has(item.expense_id)) itemMap.set(item.expense_id, []);
    itemMap.get(item.expense_id)!.push({ ...item, amount: Number(item.amount) });
  }

  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    category_id: r.category_id ?? undefined,
    category_name: r.category_name ?? undefined,
    category_icon: r.category_icon ?? undefined,
    category_color: r.category_color ?? undefined,
    title: r.title,
    expense_date: r.expense_date,
    payment_type: r.payment_type,
    installment_count: r.installment_count ?? undefined,
    total_amount: Number(r.total_amount),
    note: r.note ?? undefined,
    items: itemMap.get(r.id) ?? [],
    recurring_template_id: r.recurring_template_id ?? undefined,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export async function GET(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ success: false, message: 'Yetkisiz' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get('year') ?? new Date().getFullYear());
    const monthParam = searchParams.get('month');
    const month = monthParam ? Number(monthParam) : undefined;

    // Tekrarlayan şablonların bu aya kadar olan harcama satırlarını üret
    await materializeRecurring(user.user_id, year, month);

    const allExpenses = await fetchExpensesForYear(user.user_id, year);
    const result: Expense[] = [];

    if (!month) {
      for (const e of allExpenses) {
        const ey = Number(e.expense_date.slice(0, 4));
        if (e.payment_type === 'cash') {
          if (ey === year) result.push(e);
        } else if (e.installment_count) {
          if (ey === year) {
            result.push(e);
          } else {
            const schedule = generateInstallmentSchedule(e.expense_date, e.total_amount, e.installment_count);
            for (const p of schedule.filter((s) => s.date.startsWith(`${year}`))) {
              result.push({ ...e, installment_display_month: p.date, installment_current_no: p.installmentNo });
            }
          }
        }
      }
    } else {
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      for (const e of allExpenses) {
        const [ey, em] = e.expense_date.split('-').map(Number);
        const isOriginalMonth = ey === year && em === month;
        if (e.payment_type === 'cash') {
          if (isOriginalMonth) result.push(e);
        } else if (e.installment_count) {
          if (isOriginalMonth) {
            result.push(e);
          } else {
            const schedule = generateInstallmentSchedule(e.expense_date, e.total_amount, e.installment_count);
            const p = schedule.find((s) => s.date === monthKey);
            if (p) result.push({ ...e, installment_display_month: monthKey, installment_current_no: p.installmentNo });
          }
        }
      }
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('[expenses GET]', err);
    return NextResponse.json({ success: false, message: 'Sunucu hatası' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ success: false, message: 'Yetkisiz' }, { status: 401 });

  const conn = await pool.getConnection();
  try {
    const { title, expense_date, payment_type, installment_count, category_id, note, items } = await req.json();
    const total_amount = (items as { name: string; amount: number }[]).reduce((s, i) => s + i.amount, 0);

    await conn.beginTransaction();

    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO expenses (user_id, category_id, title, expense_date, payment_type, installment_count, total_amount, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.user_id, category_id ?? null, title, expense_date, payment_type,
        payment_type === 'installment' ? (installment_count ?? null) : null,
        total_amount, note ?? null,
      ]
    );
    const expenseId = result.insertId;

    if (items?.length) {
      await conn.query(
        'INSERT INTO expense_items (expense_id, name, amount) VALUES ?',
        [items.map((i: { name: string; amount: number }) => [expenseId, i.name, i.amount])]
      );
    }

    await conn.commit();

    const [rows] = await conn.query<ExpenseRow[]>(
      `SELECT e.*, DATE_FORMAT(e.expense_date, '%Y-%m-%d') AS expense_date,
              c.name AS category_name, c.icon AS category_icon, c.color AS category_color
       FROM expenses e LEFT JOIN categories c ON c.id = e.category_id WHERE e.id = ?`,
      [expenseId]
    );
    const [itemRows] = await conn.query<ItemRow[]>(
      'SELECT id, expense_id, name, amount FROM expense_items WHERE expense_id = ?',
      [expenseId]
    );

    const expense: Expense = {
      ...rows[0],
      category_id: rows[0].category_id ?? undefined,
      category_name: rows[0].category_name ?? undefined,
      category_icon: rows[0].category_icon ?? undefined,
      category_color: rows[0].category_color ?? undefined,
      installment_count: rows[0].installment_count ?? undefined,
      note: rows[0].note ?? undefined,
      recurring_template_id: rows[0].recurring_template_id ?? undefined,
      total_amount: Number(rows[0].total_amount),
      items: itemRows.map((i) => ({ ...i, amount: Number(i.amount) })),
    };

    return NextResponse.json({ success: true, data: expense }, { status: 201 });
  } catch (err) {
    await conn.rollback();
    console.error('[expenses POST]', err);
    return NextResponse.json({ success: false, message: 'Sunucu hatası' }, { status: 500 });
  } finally {
    conn.release();
  }
}
