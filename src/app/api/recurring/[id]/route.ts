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
      'SELECT id FROM recurring_templates WHERE id = ? AND user_id = ?',
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
      category_id: 'category_id',
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
      await pool.query(`UPDATE recurring_templates SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    const tpl = await fetchOne(templateId, user.user_id);
    return NextResponse.json({ success: true, data: tpl });
  } catch (err) {
    console.error('[recurring PUT]', err);
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
      'DELETE FROM recurring_templates WHERE id = ? AND user_id = ?',
      [templateId, user.user_id],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, message: 'Şablon bulunamadı' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { id: templateId } });
  } catch (err) {
    console.error('[recurring DELETE]', err);
    return NextResponse.json({ success: false, message: 'Sunucu hatası' }, { status: 500 });
  }
}
