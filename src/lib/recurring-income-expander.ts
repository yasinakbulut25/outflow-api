import type { RowDataPacket } from 'mysql2';
import pool from '@/lib/db';
import type { Income } from '@/types';

interface IncomeTemplateRow extends RowDataPacket {
  id: number;
  user_id: number;
  title: string;
  amount: string;
  day_of_month: number;
  start_date: string;      // YYYY-MM-DD
  end_date: string | null; // YYYY-MM-DD
  note: string | null;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const clampDay = (y: number, m: number, d: number) => Math.min(d, new Date(y, m, 0).getDate());

/**
 * Aktif tekrarlayan gelir şablonlarını (maaş gibi) sanal `Income` occurrence'larına
 * genişletir. recurring-expander ile birebir aynı mantık; kategori yok.
 * DB'ye yazmaz (materializeRecurringIncome'un yerini alır).
 */
export async function expandRecurringIncomes(
  userId: number,
  year: number,
  month?: number,
): Promise<Income[]> {
  const [tpls] = await pool.query<IncomeTemplateRow[]>(
    `SELECT id, user_id, title, amount, day_of_month,
            DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
            DATE_FORMAT(end_date,   '%Y-%m-%d') AS end_date,
            note
     FROM recurring_income_templates
     WHERE user_id = ? AND active = 1`,
    [userId],
  );

  const out: Income[] = [];

  for (const tpl of tpls) {
    const amount = Number(tpl.amount);
    const [sy, sm] = tpl.start_date.split('-').map(Number);
    const startKey = `${sy}-${pad2(sm)}`;
    const endKey = tpl.end_date ? tpl.end_date.slice(0, 7) : null;

    const fromM = month ?? 1;
    const toM = month ?? 12;

    for (let m = fromM; m <= toM; m++) {
      const key = `${year}-${pad2(m)}`;
      if (key < startKey) continue;
      if (endKey && key > endKey) break;

      const date = `${key}-${pad2(clampDay(year, m, tpl.day_of_month))}`;
      out.push({
        id: -(tpl.id * 100 + m),
        user_id: tpl.user_id,
        title: tpl.title,
        amount,
        income_date: date,
        note: tpl.note ?? undefined,
        recurring_income_id: tpl.id,
        created_at: date,
        updated_at: date,
        projected: true,
      });
    }
  }

  return out;
}
