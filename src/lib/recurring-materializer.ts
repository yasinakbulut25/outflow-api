import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '@/lib/db';

interface TemplateRow extends RowDataPacket {
  id: number;
  user_id: number;
  category_id: number | null;
  title: string;
  amount: string;
  day_of_month: number;
  start_date: string;       // YYYY-MM-DD
  end_date: string | null;  // YYYY-MM-DD
  note: string | null;
  active: number;
  last_generated_month: string | null; // "YYYY-MM"
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, new Date(year, month, 0).getDate());
}

function nextMonth(y: number, m: number): [number, number] {
  return m === 12 ? [y + 1, 1] : [y, m + 1];
}

/**
 * Tekrarlayan ödeme şablonlarını gerçek `expenses` satırlarına dönüştürür.
 * İdempotent: bir şablon + ay için kayıt zaten varsa atlanır.
 */
export async function materializeRecurring(
  userId: number,
  targetYear: number,
  targetMonth?: number,
): Promise<void> {
  const now = new Date();
  const nowY = now.getFullYear();
  const nowM = now.getMonth() + 1;

  let upperY = nowY;
  let upperM = nowM;

  if (targetMonth) {
    if (targetYear > nowY || (targetYear === nowY && targetMonth > nowM)) {
      upperY = targetYear;
      upperM = targetMonth;
    }
  } else if (targetYear > nowY) {
    upperY = targetYear;
    upperM = 12;
  }

  const [tpls] = await pool.query<TemplateRow[]>(
    `SELECT id, user_id, category_id, title, amount, day_of_month,
            DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
            DATE_FORMAT(end_date,   '%Y-%m-%d') AS end_date,
            note, active, last_generated_month
     FROM recurring_templates
     WHERE user_id = ? AND active = 1`,
    [userId],
  );

  for (const tpl of tpls) {
    const amount = Number(tpl.amount);
    const [sy, sm] = tpl.start_date.split('-').map(Number);

    let y = sy;
    let m = sm;

    if (tpl.last_generated_month) {
      const [ly, lm] = tpl.last_generated_month.split('-').map(Number);
      const [ny, nm] = nextMonth(ly, lm);
      if (ny > y || (ny === y && nm > m)) {
        y = ny;
        m = nm;
      }
    }

    const endDate = tpl.end_date ? new Date(tpl.end_date + 'T00:00:00') : null;

    while (y < upperY || (y === upperY && m <= upperM)) {
      const monthFirst = new Date(y, m - 1, 1);
      if (endDate && monthFirst > endDate) break;

      const key = `${y}-${pad2(m)}`;
      const day = clampDay(y, m, tpl.day_of_month);
      const expenseDate = `${y}-${pad2(m)}-${pad2(day)}`;

      const [existing] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM expenses
         WHERE recurring_template_id = ? AND DATE_FORMAT(expense_date, '%Y-%m') = ?`,
        [tpl.id, key],
      );

      if (!existing.length) {
        const conn = await pool.getConnection();
        try {
          await conn.beginTransaction();
          const [ins] = await conn.query<ResultSetHeader>(
            `INSERT INTO expenses
              (user_id, category_id, title, expense_date, payment_type, installment_count,
               total_amount, note, recurring_template_id)
             VALUES (?, ?, ?, ?, 'cash', NULL, ?, ?, ?)`,
            [tpl.user_id, tpl.category_id, tpl.title, expenseDate, amount, tpl.note, tpl.id],
          );
          await conn.query(
            'INSERT INTO expense_items (expense_id, name, amount) VALUES (?, ?, ?)',
            [ins.insertId, tpl.title, amount],
          );
          await conn.commit();
        } catch (err) {
          await conn.rollback();
          throw err;
        } finally {
          conn.release();
        }
      }

      await pool.query(
        'UPDATE recurring_templates SET last_generated_month = ? WHERE id = ?',
        [key, tpl.id],
      );

      [y, m] = nextMonth(y, m);
    }
  }
}
