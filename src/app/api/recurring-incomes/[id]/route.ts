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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ success: false, message: 'Yetkisiz' }, { status: 401 });

  const { id } = await params;
  const templateId = Number(id);
  if (!templateId) {
    return NextResponse.json({ success: false, message: 'Geçersiz id' }, { status: 400 });
  }

  try {
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM recurring_income_templates WHERE id = ? AND user_id = ?',
      [templateId, user.user_id],
    );
    if (!existing.length) {
      return NextResponse.json({ success: false, message: 'Şablon bulunamadı' }, { status: 404 });
    }

    const body = await req.json();
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    const map: Record<string, string> = {
      title: 'title',
      amount: 'amount',
      day_of_month: 'day_of_month',
      start_date: 'start_date',
      end_date: 'end_date',
      note: 'note',
    };
    for (const key of Object.keys(map)) {
      if (key in body) {
        fields.push(`${map[key]} = ?`);
        values.push(body[key] ?? null);
      }
    }
    if ('active' in body) {
      fields.push('active = ?');
      values.push(body.active ? 1 : 0);
    }

    if (fields.length) {
      values.push(templateId);
      await pool.query(`UPDATE recurring_income_templates SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    const tpl = await fetchOne(templateId, user.user_id);
    return NextResponse.json({ success: true, data: tpl });
  } catch (err) {
    console.error('[recurring-incomes PUT]', err);
    return NextResponse.json({ success: false, message: 'Sunucu hatası' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ success: false, message: 'Yetkisiz' }, { status: 401 });

  const { id } = await params;
  const templateId = Number(id);

  try {
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM recurring_income_templates WHERE id = ? AND user_id = ?',
      [templateId, user.user_id],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, message: 'Şablon bulunamadı' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { id: templateId } });
  } catch (err) {
    console.error('[recurring-incomes DELETE]', err);
    return NextResponse.json({ success: false, message: 'Sunucu hatası' }, { status: 500 });
  }
}
