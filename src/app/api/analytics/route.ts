import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/server-auth';
import { generateInstallmentSchedule } from '@/lib/formatters';
import { materializeRecurring } from '@/lib/recurring-materializer';
import { materializeRecurringIncome } from '@/lib/recurring-income-materializer';
import type { AnalyticsSummary } from '@/types';

interface ExpenseRow extends RowDataPacket {
  id: number;
  category_id: number | null;
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  title: string;
  expense_date: string;
  payment_type: 'cash' | 'installment';
  installment_count: number | null;
  total_amount: string;
}

interface IncomeRow extends RowDataPacket {
  income_date: string;
  amount: string;
}

export async function GET(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ success: false, message: 'Yetkisiz' }, { status: 401 });

  try {
    const year = Number(new URL(req.url).searchParams.get('year') ?? new Date().getFullYear());

    // Veri eksiksiz olsun diye tekrarlayan gider ve gelirleri bu yıla kadar materyalize et
    await materializeRecurring(user.user_id, year);
    await materializeRecurringIncome(user.user_id, year);

    // Bu yıla ilgili harcamalar
    const [rows] = await pool.query<ExpenseRow[]>(
      `SELECT e.id, e.category_id, e.title,
              DATE_FORMAT(e.expense_date, '%Y-%m-%d') AS expense_date,
              e.payment_type, e.installment_count, e.total_amount,
              c.name AS category_name, c.icon AS category_icon, c.color AS category_color
       FROM expenses e
       LEFT JOIN categories c ON c.id = e.category_id
       WHERE e.user_id = ?
         AND (
           (e.payment_type = 'cash' AND YEAR(e.expense_date) = ?)
           OR
           (e.payment_type = 'installment'
            AND YEAR(DATE_ADD(e.expense_date, INTERVAL 1 MONTH)) <= ?
            AND YEAR(DATE_ADD(e.expense_date, INTERVAL e.installment_count MONTH)) >= ?)
         )`,
      [user.user_id, year, year, year]
    );

    const monthlyMap = new Map<string, number>();
    const categoryMap = new Map<number, { name: string; icon: string; color: string; total: number }>();
    const installmentMap = new Map<number, { title: string; total_amount: number; installment_count: number; payments: { month: string; amount: number; installment_no: number }[] }>();

    for (const e of rows) {
      const ey = Number(e.expense_date.slice(0, 4));
      const total = Number(e.total_amount);

      if (e.payment_type === 'cash') {
        const monthKey = e.expense_date.slice(0, 7);
        monthlyMap.set(monthKey, (monthlyMap.get(monthKey) ?? 0) + total);

        if (e.category_id) {
          const cat = categoryMap.get(e.category_id) ?? { name: e.category_name ?? '', icon: e.category_icon ?? '', color: e.category_color ?? '', total: 0 };
          categoryMap.set(e.category_id, { ...cat, total: cat.total + total });
        }
      } else if (e.installment_count) {
        const schedule = generateInstallmentSchedule(e.expense_date, total, e.installment_count);

        for (const p of schedule) {
          if (p.date.startsWith(`${year}`)) {
            monthlyMap.set(p.date, (monthlyMap.get(p.date) ?? 0) + p.amount);
          }
        }

        if (ey === year && e.category_id) {
          const cat = categoryMap.get(e.category_id) ?? { name: e.category_name ?? '', icon: e.category_icon ?? '', color: e.category_color ?? '', total: 0 };
          categoryMap.set(e.category_id, { ...cat, total: cat.total + total });
        }

        const paymentsInYear = schedule.filter((p) => p.date.startsWith(`${year}`));
        if (paymentsInYear.length) {
          installmentMap.set(e.id, {
            title: e.title,
            total_amount: total,
            installment_count: e.installment_count,
            payments: paymentsInYear.map((p) => ({ month: p.date, amount: p.amount, installment_no: p.installmentNo })),
          });
        }
      }
    }

    // Bu yıla ait gelirler (aylık toplam)
    const [incomeRows] = await pool.query<IncomeRow[]>(
      `SELECT DATE_FORMAT(income_date, '%Y-%m-%d') AS income_date, amount
       FROM incomes
       WHERE user_id = ? AND YEAR(income_date) = ?`,
      [user.user_id, year]
    );

    const incomeMap = new Map<string, number>();
    for (const r of incomeRows) {
      const monthKey = r.income_date.slice(0, 7);
      incomeMap.set(monthKey, (incomeMap.get(monthKey) ?? 0) + Number(r.amount));
    }

    // Aylık net: gelir ve gider aylarının birleşimi
    const allMonths = new Set<string>([...monthlyMap.keys(), ...incomeMap.keys()]);
    const monthly_net = Array.from(allMonths)
      .sort((a, b) => a.localeCompare(b))
      .map((month) => {
        const income = incomeMap.get(month) ?? 0;
        const expense = monthlyMap.get(month) ?? 0;
        return { month, income, expense, net: income - expense };
      });

    const total_income = Array.from(incomeMap.values()).reduce((s, v) => s + v, 0);
    const total_expense = Array.from(monthlyMap.values()).reduce((s, v) => s + v, 0);

    const analytics: AnalyticsSummary = {
      monthly_totals: Array.from(monthlyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, total]) => ({ month, total })),
      category_totals: Array.from(categoryMap.values()).sort((a, b) => b.total - a.total),
      installment_plan: Array.from(installmentMap.entries()).map(([expense_id, plan]) => ({
        expense_id,
        title: plan.title,
        total_amount: plan.total_amount,
        installment_count: plan.installment_count,
        monthly_payment: plan.payments[0]?.amount ?? 0,
        payments: plan.payments,
      })),
      income_totals: Array.from(incomeMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, total]) => ({ month, total })),
      monthly_net,
      year_summary: { total_income, total_expense, net: total_income - total_expense },
    };

    return NextResponse.json({ success: true, data: analytics });
  } catch (err) {
    console.error('[analytics]', err);
    return NextResponse.json({ success: false, message: 'Sunucu hatası' }, { status: 500 });
  }
}
