import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/server-auth';
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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ success: false, message: 'Yetkisiz' }, { status: 401 });

  const { id } = await params;
  const expenseId = Number(id);

  const conn = await pool.getConnection();
  try {
    const [existing] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM expenses WHERE id = ? AND user_id = ?',
      [expenseId, user.user_id]
    );
    if (!existing.length) {
      return NextResponse.json({ success: false, message: 'Kayıt bulunamadı' }, { status: 404 });
    }

    const { title, expense_date, payment_type, installment_count, category_id, note, items } = await req.json();
    const total_amount = (items as { name: string; amount: number }[]).reduce((s, i) => s + i.amount, 0);

    await conn.beginTransaction();

    await conn.query(
      `UPDATE expenses SET category_id = ?, title = ?, expense_date = ?, payment_type = ?,
       installment_count = ?, total_amount = ?, note = ? WHERE id = ?`,
      [
        category_id ?? null, title, expense_date, payment_type,
        payment_type === 'installment' ? (installment_count ?? null) : null,
        total_amount, note ?? null, expenseId,
      ]
    );

    await conn.query('DELETE FROM expense_items WHERE expense_id = ?', [expenseId]);

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

    return NextResponse.json({ success: true, data: expense });
  } catch (err) {
    await conn.rollback();
    console.error('[expenses PUT]', err);
    return NextResponse.json({ success: false, message: 'Sunucu hatası' }, { status: 500 });
  } finally {
    conn.release();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ success: false, message: 'Yetkisiz' }, { status: 401 });

  const { id } = await params;
  const expenseId = Number(id);

  try {
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM expenses WHERE id = ? AND user_id = ?',
      [expenseId, user.user_id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, message: 'Kayıt bulunamadı' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { id: expenseId } });
  } catch (err) {
    console.error('[expenses DELETE]', err);
    return NextResponse.json({ success: false, message: 'Sunucu hatası' }, { status: 500 });
  }
}
