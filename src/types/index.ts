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
  time?: string; // HH:MM
  note?: string;
  is_paid?: boolean;
  media_uri?: string;
  to_wallet_id?: string | null;
  created_at?: string;
}

export interface BudgetCycle {
  id: string;
  name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  target_budget?: number;
  target_income?: number;
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
export type RecurrenceEndType = 'never' | 'after_occurrences' | 'on_date';

export interface RecurringBill {
  id: string;
  name: string;
  amount: number;
  currency: string;
  frequency: BillFrequency;
  due_day: number; // 1-31 (or 1-7 for weekly)
  next_due_date: string; // YYYY-MM-DD
  category_id?: string | null;
  wallet_id: string;
  reminder_enabled: boolean;
  is_active: boolean;
  end_type?: RecurrenceEndType;
  end_occurrences?: number;
  end_date?: string; // YYYY-MM-DD
  occurrences_count?: number;
  created_at?: string;
}

export type CycleMode = 'regular' | 'custom';
export type CycleBalanceMode = 'monthly' | 'accumulated';
export type CycleTargetMode = 'inherit' | 'monthly';

export interface AppSettings {
  base_currency: string;
  theme_mode: 'light' | 'dark' | 'system';
  app_name: string;
  onboarding_completed?: boolean;
  cycle_mode?: CycleMode;
  cycle_balance_mode?: CycleBalanceMode;
  cycle_target_mode?: CycleTargetMode;
  cycle_month_start_day?: number;
  cycle_default_budget?: number;
  cycle_default_income?: number;
}

export interface DailyAllowanceStats {
  daysRemaining: number;
  totalDays: number;
  dayIndex: number;
  availableForDay: number;
  spentToday: number;
  remainingToday: number;
  isOverDaily: boolean;
  hasBudget: boolean;
  dailyAverage: number;
}
