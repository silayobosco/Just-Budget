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
  goal_amount?: number | null;
  goal_deadline?: string | null; // YYYY-MM-DD
  spendable_amount?: number | null;
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
  exclude_from_analytics?: boolean;
  sort_order?: number;
  subcategories?: Subcategory[];
}

export interface Transaction {
  id: string;
  wallet_id: string;
  category_id?: string | null;
  subcategory_id?: string | null;
  type: TransactionType;
  amount: number;
  tax_amount?: number | null;
  currency: string;
  base_amount: number;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  note?: string;
  is_paid?: boolean;
  media_uri?: string;
  to_wallet_id?: string | null;
  recurring_bill_id?: string | null;
  created_at?: string;
  updated_at?: string;
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
  type?: 'expense' | 'income';
  due_day: number; // 1-31 (or 1-7 for weekly)
  next_due_date: string; // YYYY-MM-DD
  category_id?: string | null;
  subcategory_id?: string | null;
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
export type DailyLeftoverMode = 'spread' | 'next_day' | 'lock_savings';

export interface AppSettings {
  base_currency: string;
  theme_mode: 'light' | 'dark' | 'system';
  app_name: string;
  onboarding_completed?: boolean;
  cycle_mode?: CycleMode;
  cycle_balance_mode?: CycleBalanceMode;
  cycle_target_mode?: CycleTargetMode;
  daily_leftover_mode?: DailyLeftoverMode;
  lock_savings_wallet_id?: string;
  cycle_month_start_day?: number;
  cycle_default_budget?: number;
  cycle_default_income?: number;
  app_lock_enabled?: boolean;
  biometrics_enabled?: boolean;
  app_pin_hash?: string;
  data_encryption_enabled?: boolean;
  notifications_enabled?: boolean;
  bill_reminders_enabled?: boolean;
  daily_allowance_reminder_enabled?: boolean;
  evening_reminder_enabled?: boolean;
  daily_reminder_time?: string;
  evening_reminder_time?: string;
}

export type DailyAllowanceStatus =
  | 'normal'
  | 'over_daily'
  | 'budget_over'
  | 'wallet_normal'
  | 'wallet_over_daily'
  | 'wallet_empty';

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
  isEnded?: boolean;
  isBudgetOver: boolean;
  budgetOverAmount: number;
  walletBalance: number;
  status: DailyAllowanceStatus;
  headlineLabel: string;
  badgeLabel?: string;
  subText: string;
  leftoverMode?: DailyLeftoverMode;
  savedLeftoverPool?: number;
}

export type DebtType = 'lent' | 'borrowed';
export type DebtStatus = 'open' | 'settled';

export interface DebtItem {
  id: string;
  type: DebtType;
  person_name: string;
  amount: number;
  paid_amount: number;
  currency: string;
  date: string; // YYYY-MM-DD
  due_date?: string | null; // YYYY-MM-DD
  note?: string | null;
  wallet_id?: string | null;
  origin_transaction_id?: string | null;
  status: DebtStatus;
  created_at?: string;
  updated_at?: string;
}

export interface DebtSettlement {
  id: string;
  transaction_id?: string | null;
  debt_id: string;
  debt_type: DebtType;
  person_name: string;
  applied_amount: number;
  excess_amount: number;
  excess_mode?: 'tip' | 'credit' | 'none' | null;
  created_debt_id?: string | null;
  currency: string;
  created_at?: string;
}
