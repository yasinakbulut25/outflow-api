export interface User {
  id: number;
  username: string;
  display_name?: string;
}

export interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
}

export interface ExpenseItem {
  id?: number;
  expense_id?: number;
  name: string;
  amount: number;
}

export interface Expense {
  id: number;
  user_id: number;
  category_id?: number;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  title: string;
  expense_date: string;
  payment_type: 'cash' | 'installment';
  installment_count?: number;
  total_amount: number;
  note?: string;
  items: ExpenseItem[];
  created_at: string;
  updated_at: string;
  // Taksit gelecek bir ödeme ayında gösterilirken set edilir
  installment_display_month?: string;
  installment_current_no?: number;
  // Tekrarlayan şablondan üretildiyse set edilir
  recurring_template_id?: number;
}

export interface CreateExpensePayload {
  title: string;
  expense_date: string;
  payment_type: 'cash' | 'installment';
  installment_count?: number;
  category_id?: number;
  note?: string;
  items: { name: string; amount: number }[];
}

export interface RecurringTemplate {
  id: number;
  user_id: number;
  category_id?: number;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  title: string;
  amount: number;
  day_of_month: number;
  start_date: string;
  end_date?: string | null;
  note?: string;
  active: boolean;
  last_generated_month?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRecurringPayload {
  title: string;
  amount: number;
  day_of_month: number;
  start_date: string;
  end_date?: string | null;
  category_id?: number;
  note?: string;
}

export interface Income {
  id: number;
  user_id: number;
  title: string;
  amount: number;
  income_date: string;
  note?: string;
  recurring_income_id?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateIncomePayload {
  title: string;
  amount: number;
  income_date: string;
  note?: string;
}

export interface RecurringIncomeTemplate {
  id: number;
  user_id: number;
  title: string;
  amount: number;
  day_of_month: number;
  start_date: string;
  end_date?: string | null;
  note?: string;
  active: boolean;
  last_generated_month?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRecurringIncomePayload {
  title: string;
  amount: number;
  day_of_month: number;
  start_date: string;
  end_date?: string | null;
  note?: string;
}

export interface MonthlyTotal {
  month: string;
  total: number;
}

export interface CategoryTotal {
  name: string;
  icon: string;
  color: string;
  total: number;
}

export interface InstallmentPayment {
  month: string;
  amount: number;
  installment_no: number;
}

export interface InstallmentPlanItem {
  expense_id: number;
  title: string;
  total_amount: number;
  installment_count: number;
  monthly_payment: number;
  payments: InstallmentPayment[];
}

export interface MonthlyNet {
  month: string;
  income: number;
  expense: number;
  net: number;
}

export interface AnalyticsSummary {
  monthly_totals: MonthlyTotal[];
  category_totals: CategoryTotal[];
  installment_plan: InstallmentPlanItem[];
  income_totals: MonthlyTotal[];
  monthly_net: MonthlyNet[];
  year_summary: { total_income: number; total_expense: number; net: number };
}
