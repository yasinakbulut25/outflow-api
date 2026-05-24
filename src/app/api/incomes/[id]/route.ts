import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/server-auth';
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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ success: false, message: 'Yetkisiz' }, { status: 401 });

  const { id } = await params;
  const incomeId = Number(id);

  try {
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM incomes WHERE id = ? AND user_id = ?',
      [incomeId, user.user_id],
    );
    if (!existing.length) {
      return NextResponse.json({ success: false, message: 'Kayıt bulunamadı' }, { status: 404 });
    }

    const body = await req.json();
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    const map: Record<string, string> = {
      title: 'title',
      amount: 'amount',
      income_date: 'income_date',
      note: 'note',
    };
    for (const key of Object.keys(map)) {
      if (key in body) {
        fields.push(`${map[key]} = ?`);
        values.push(body[key] ?? null);
      }
    }

    if (fields.length) {
      values.push(incomeId);
      await pool.query(`UPDATE incomes SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    const [rows] = await pool.query<IncomeRow[]>(
      `SELECT id, user_id, title, amount,
              DATE_FORMAT(income_date, '%Y-%m-%d') AS income_date,
              note, recurring_income_id, created_at, updated_at
       FROM incomes WHERE id = ?`,
      [incomeId],
    );

    return NextResponse.json({ success: true, data: rowToIncome(rows[0]) });
  } catch (err) {
    console.error('[incomes PUT]', err);
    return NextResponse.json({ success: false, message: 'Sunucu hatası' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ success: false, message: 'Yetkisiz' }, { status: 401 });

  const { id } = await params;
  const incomeId = Number(id);

  try {
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM incomes WHERE id = ? AND user_id = ?',
      [incomeId, user.user_id],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, message: 'Kayıt bulunamadı' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { id: incomeId } });
  } catch (err) {
    console.error('[incomes DELETE]', err);
    return NextResponse.json({ success: false, message: 'Sunucu hatası' }, { status: 500 });
  }
}
