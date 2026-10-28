export type TransactionType = 'expense' | 'income' | 'transfer';

export interface Wallet {
  id: string;
  name: string;
  currency: string;
  starting_balance: number;
  current_balance: number;
  color: string;
  icon: string;
  is_default: boolean;
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'expense' | 'income';
  icon: string;
  color: string;
  is_default: boolean;
  subcategories?: Subcategory[];
}

export interface Transaction {
  id: string;
  wallet_id: string;
  category_id?: string | null;
  subcategory_id?: string | null;
  type: TransactionType;
  amount: number;
  currency: string;
  base_amount: number;
  date: string; // YYYY-MM-DD
  note?: string;
  to_wallet_id?: string | null;
  created_at?: string;
}

export interface BudgetCycle {
  id: string;
  name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  target_budget?: number;
  is_active: boolean;
}

export type BudgetScope = 'overall' | 'category' | 'subcategory';

export interface BudgetLimit {
  id: string;
  scope: BudgetScope;
  category_id?: string | null;
  subcategory_id?: string | null;
  amount: number;
  period: string; // cycle_id or YYYY-MM
  created_at?: string;
}

export interface BudgetProgress {
  scope: BudgetScope;
  id: string; // category_id or subcategory_id or 'overall'
  name: string;
  limit: number;
  spent: number;
  remaining: number;
  percent: number;
  isOverBudget: boolean;
  isNearLimit: boolean; // >= 80%
  color: string;
  icon?: string;
  subBudgets?: BudgetProgress[];
}

export type BillFrequency = 'weekly' | 'monthly' | 'yearly';

export interface RecurringBill {
  id: string;
  name: string;
  amount: number;
  currency: string;
  frequency: BillFrequency;
  due_day: number; // 1-31
  next_due_date: string; // YYYY-MM-DD
  category_id?: string | null;
  wallet_id: string;
  reminder_enabled: boolean;
  is_active: boolean;
  created_at?: string;
}

export interface AppSettings {
  base_currency: string;
  theme_mode: 'light' | 'dark' | 'system';
  app_name: string;
}

export interface DailyAllowanceStats {
  daysRemaining: number;
  totalDays: number;
  dayIndex: number;
  availableForDay: number;
  spentToday: number;
  remainingToday: number;
  isOverDaily: boolean;
}
