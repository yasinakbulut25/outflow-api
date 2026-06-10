import type { RowDataPacket } from 'mysql2';
import pool from '@/lib/db';
import type { Expense } from '@/types';

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
  start_date: string;      // YYYY-MM-DD
  end_date: string | null; // YYYY-MM-DD
  note: string | null;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const clampDay = (y: number, m: number, d: number) => Math.min(d, new Date(y, m, 0).getDate());

/**
 * Aktif tekrarlayan ödeme şablonlarını, istenen yıl (ve verilmişse ay) için
 * sanal `Expense` occurrence'larına genişletir. DB'ye HİÇBİR ŞEY yazmaz —
 * şablon tek doğruluk kaynağıdır, occurrence'lar okuma anında türetilir.
 * (materializeRecurring'in yerini alır; stale-veri ve yinelenen satır sorununu kapatır.)
 */
export async function expandRecurringExpenses(
  userId: number,
  year: number,
  month?: number,
): Promise<Expense[]> {
  const [tpls] = await pool.query<TemplateRow[]>(
    `SELECT t.id, t.user_id, t.category_id, t.title, t.amount, t.day_of_month,
            DATE_FORMAT(t.start_date, '%Y-%m-%d') AS start_date,
            DATE_FORMAT(t.end_date,   '%Y-%m-%d') AS end_date,
            t.note,
            c.name AS category_name, c.icon AS category_icon, c.color AS category_color
     FROM recurring_templates t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = ? AND t.active = 1`,
    [userId],
  );

  const out: Expense[] = [];

  for (const tpl of tpls) {
    const amount = Number(tpl.amount);
    const [sy, sm] = tpl.start_date.split('-').map(Number);
    const startKey = `${sy}-${pad2(sm)}`;
    const endKey = tpl.end_date ? tpl.end_date.slice(0, 7) : null; // YYYY-MM

    const fromM = month ?? 1;
    const toM = month ?? 12;

    for (let m = fromM; m <= toM; m++) {
      const key = `${year}-${pad2(m)}`;
      if (key < startKey) continue;          // başlangıçtan önce
      if (endKey && key > endKey) break;     // bitişten sonra

      const date = `${key}-${pad2(clampDay(year, m, tpl.day_of_month))}`;
      out.push({
        id: -(tpl.id * 100 + m), // negatif → gerçek expense id'leriyle çakışmaz
        user_id: tpl.user_id,
        category_id: tpl.category_id ?? undefined,
        category_name: tpl.category_name ?? undefined,
        category_icon: tpl.category_icon ?? undefined,
        category_color: tpl.category_color ?? undefined,
        title: tpl.title,
        expense_date: date,
        payment_type: 'cash',
        total_amount: amount,
        note: tpl.note ?? undefined,
        items: [{ name: tpl.title, amount }],
        recurring_template_id: tpl.id,
        created_at: date,
        updated_at: date,
        projected: true,
      });
    }
  }

  return out;
}
