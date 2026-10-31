import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getDB, initDatabase, ensureDefaultWallets, ensureDefaultIncomeCategories } from '../services/db';
import { exportBackupData, importBackupData } from '../services/backup';
import { formatCycleDateRange, getRegularCycleDates } from '../utils/format';
import {
  Wallet,
  Category,
  Subcategory,
  Transaction,
  BudgetCycle,
  AppSettings,
  DailyAllowanceStats,
  TransactionType,
  RecurringBill,
  BillFrequency,
  RecurrenceEndType,
  BudgetLimit,
  BudgetProgress,
  BudgetScope,
} from '../types';

interface BudgetContextType {
  wallets: Wallet[];
  categories: Category[];
  transactions: Transaction[];
  recurringBills: RecurringBill[];
  budgets: BudgetLimit[];
  currentCycle: BudgetCycle | null;
  allCycles: BudgetCycle[];
  settings: AppSettings;
  isLoading: boolean;
  completeOnboarding: (params: {
    currency: string;
    firstWalletName?: string;
    startingBalance?: number;
    budgetCap?: number;
    incomeGoal?: number;
  }) => Promise<void>;

  // Cycle Modal & Analytics Navigation State
  isCycleModalOpen: boolean;
  setIsCycleModalOpen: (open: boolean) => void;
  openCycleModal: () => void;
  closeCycleModal: () => void;
  analyticsFocus: 'overview' | 'expense' | 'income';
  setAnalyticsFocus: (focus: 'overview' | 'expense' | 'income') => void;

  // Computed
  totalConvertedBalance: number;
  spentInCycle: number;
  incomeInCycle: number;
  remainingCycleBalance: number;
  dailyAllowanceStats: DailyAllowanceStats;

  // Budget calculations
  overallBudgetLimit: number;
  overallBudgetSpent: number;
  overallBudgetRemaining: number;
  overallBudgetPercent: number;
  incomeGoal: number;
  incomeGoalPercent: number;
  incomeGoalRemaining: number;
  allocatedCategoriesBudget: number;
  unallocatedBudgetRemainder: number;
  allocatedCategoriesIncome: number;
  unallocatedIncomeRemainder: number;
  categoryBudgetProgressList: BudgetProgress[];

  // Actions
  addTransaction: (params: {
    wallet_id: string;
    category_id?: string;
    subcategory_id?: string;
    type: TransactionType;
    amount: number;
    currency?: string;
    date: string;
    time?: string;
    is_paid?: boolean;
    media_uri?: string;
    note?: string;
    to_wallet_id?: string;
  }) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;

  addWallet: (params: {
    name: string;
    currency?: string;
    starting_balance: number;
    color: string;
    icon: string;
  }) => Promise<void>;
  updateWallet: (wallet: Wallet) => Promise<void>;
  deleteWallet: (id: string) => Promise<void>;
  transferBetweenWallets: (params: {
    from_wallet_id: string;
    to_wallet_id: string;
    amount: number;
    date: string;
    note?: string;
  }) => Promise<void>;

  addCategory: (params: { name: string; type: 'expense' | 'income'; icon: string; color: string; initial_limit?: number }) => Promise<string>;
  updateCategory: (category: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  addSubcategory: (category_id: string, name: string, initial_limit?: number) => Promise<string>;
  updateSubcategory: (id: string, name: string) => Promise<void>;
  deleteSubcategory: (id: string) => Promise<void>;

  addRecurringBill: (params: {
    name: string;
    amount: number;
    currency?: string;
    frequency: BillFrequency;
    due_day: number;
    next_due_date: string;
    category_id?: string;
    wallet_id: string;
    reminder_enabled?: boolean;
    end_type?: RecurrenceEndType;
    end_occurrences?: number;
    end_date?: string;
  }) => Promise<void>;
  updateRecurringBill: (bill: RecurringBill) => Promise<void>;
  deleteRecurringBill: (id: string) => Promise<void>;
  payRecurringBill: (bill: RecurringBill) => Promise<void>;

  updateBudgetCycle: (params: { id?: string; name: string; start_date: string; end_date: string; target_budget?: number; target_income?: number }) => Promise<void>;
  updateCurrentCycleTarget: (type: 'budget' | 'income', amount: number) => Promise<void>;
  deleteBudgetCycle: (id: string) => Promise<void>;
  setActiveBudgetCycle: (id: string) => Promise<void>;
  setBudgetLimit: (params: {
    scope: BudgetScope;
    category_id?: string;
    subcategory_id?: string;
    amount: number;
    period?: string;
    type?: 'expense' | 'income';
  }) => Promise<void>;
  deleteBudgetLimit: (id: string) => Promise<void>;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  updateAllWalletsCurrency: (currency: string) => Promise<void>;

  exportBackup: () => Promise<boolean>;
  importBackup: () => Promise<{ success: boolean; message: string }>;
  reloadAllData: () => Promise<void>;
}

const BudgetContext = createContext<BudgetContextType | undefined>(undefined);

export const BudgetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [budgets, setBudgets] = useState<BudgetLimit[]>([]);
  const [currentCycle, setCurrentCycle] = useState<BudgetCycle | null>(null);
  const [allCycles, setAllCycles] = useState<BudgetCycle[]>([]);
  const [isCycleModalOpen, setIsCycleModalOpen] = useState<boolean>(false);
  const [analyticsFocus, setAnalyticsFocus] = useState<'overview' | 'expense' | 'income'>('overview');

  const openCycleModal = useCallback(() => setIsCycleModalOpen(true), []);
  const closeCycleModal = useCallback(() => setIsCycleModalOpen(false), []);

  const [settings, setSettings] = useState<AppSettings>({
    base_currency: 'USD',
    theme_mode: 'light',
    app_name: 'just budget',
    cycle_mode: 'regular',
    cycle_balance_mode: 'monthly',
    cycle_target_mode: 'monthly',
    cycle_month_start_day: 1,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    try {
      const db = getDB();

      // Settings
      const settingsRows = db.getAllSync<{ key: string; value: string }>(`SELECT key, value FROM settings`);
      const sMap: Record<string, string> = {};
      settingsRows.forEach((r) => {
        sMap[r.key] = r.value;
      });
      const newSettings: AppSettings = {
        base_currency: sMap['base_currency'] || 'USD',
        theme_mode: (sMap['theme_mode'] as any) || 'light',
        app_name: sMap['app_name'] || 'just budget',
        onboarding_completed: sMap['onboarding_completed'] === '1',
        cycle_mode: (sMap['cycle_mode'] as any) || 'regular',
        cycle_balance_mode: (sMap['cycle_balance_mode'] as any) || 'monthly',
        cycle_target_mode: (sMap['cycle_target_mode'] as any) || 'monthly',
        cycle_month_start_day: sMap['cycle_month_start_day'] ? parseInt(sMap['cycle_month_start_day'], 10) : 1,
        cycle_default_budget: sMap['cycle_default_budget'] ? parseFloat(sMap['cycle_default_budget']) : undefined,
        cycle_default_income: sMap['cycle_default_income'] ? parseFloat(sMap['cycle_default_income']) : undefined,
      };
      setSettings(newSettings);

      // Ensure default wallets and income categories
      ensureDefaultWallets(db, newSettings.base_currency);
      ensureDefaultIncomeCategories(db);

      // Wallets (all aligned with the base currency)
      let walletsRows = db.getAllSync<Wallet>(`SELECT * FROM wallets ORDER BY is_default DESC, name ASC`);
      if (walletsRows.some((w) => w.currency !== newSettings.base_currency)) {
        db.runSync(`UPDATE wallets SET currency = ?`, [newSettings.base_currency]);
        walletsRows = db.getAllSync<Wallet>(`SELECT * FROM wallets ORDER BY is_default DESC, name ASC`);
      }
      setWallets(walletsRows);

      // Categories + Subcategories
      const catRows = db.getAllSync<Category>(`SELECT * FROM categories ORDER BY name ASC`);
      const subRows = db.getAllSync<Subcategory>(`SELECT * FROM subcategories ORDER BY name ASC`);
      const categoriesWithSubs = catRows.map((c) => ({
        ...c,
        is_default: Boolean(c.is_default),
        subcategories: subRows.filter((s) => s.category_id === c.id),
      }));
      setCategories(categoriesWithSubs);

      // All Cycles
      const allCycleRows = db.getAllSync<BudgetCycle>(`SELECT * FROM budget_cycles ORDER BY start_date DESC`);
      setAllCycles(allCycleRows.map((c) => ({ ...c, is_active: Boolean(c.is_active) })));

      // Active Budget Cycle
      let cycle = db.getFirstSync<BudgetCycle>(`SELECT * FROM budget_cycles WHERE is_active = 1 LIMIT 1`);
      if (!cycle) {
        cycle = db.getFirstSync<BudgetCycle>(`SELECT * FROM budget_cycles ORDER BY start_date DESC LIMIT 1`);
      }

      // If in regular calendar mode, align active cycle with the regular cycle dates
      if (newSettings.cycle_mode === 'regular') {
        const reg = getRegularCycleDates(newSettings.cycle_month_start_day || 1);
        if (cycle) {
          if (cycle.start_date !== reg.startDate || cycle.end_date !== reg.endDate) {
            db.runSync(
              `UPDATE budget_cycles SET name = ?, start_date = ?, end_date = ? WHERE id = ?`,
              [reg.name, reg.startDate, reg.endDate, cycle.id]
            );
            cycle = { ...cycle, name: reg.name, start_date: reg.startDate, end_date: reg.endDate };
          }
        } else if (newSettings.onboarding_completed) {
          const regId = `cycle-reg-${reg.startDate}`;
          const bVal = newSettings.cycle_default_budget ?? null;
          const iVal = newSettings.cycle_default_income ?? null;
          db.runSync(
            `INSERT INTO budget_cycles (id, name, start_date, end_date, target_budget, target_income, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [regId, reg.name, reg.startDate, reg.endDate, bVal, iVal]
          );
          cycle = {
            id: regId,
            name: reg.name,
            start_date: reg.startDate,
            end_date: reg.endDate,
            target_budget: bVal ?? undefined,
            target_income: iVal ?? undefined,
            is_active: true,
          };
        }
      }

      // If Inherit mode is active and default targets exist, ensure cycle reflects defaults
      if (cycle && newSettings.cycle_target_mode === 'inherit') {
        let changed = false;
        let b = cycle.target_budget;
        let i = cycle.target_income;
        if (newSettings.cycle_default_budget !== undefined && cycle.target_budget !== newSettings.cycle_default_budget) {
          b = newSettings.cycle_default_budget;
          changed = true;
        }
        if (newSettings.cycle_default_income !== undefined && cycle.target_income !== newSettings.cycle_default_income) {
          i = newSettings.cycle_default_income;
          changed = true;
        }
        if (changed) {
          db.runSync(`UPDATE budget_cycles SET target_budget = ?, target_income = ? WHERE id = ?`, [b ?? null, i ?? null, cycle.id]);
          cycle = { ...cycle, target_budget: b, target_income: i };
        }
      }

      // Ensure cycle name is nicely formatted like "27 Oct – 28 Nov '26"
      if (cycle && cycle.start_date && cycle.end_date) {
        const prettyRange = formatCycleDateRange(cycle.start_date, cycle.end_date);
        if (cycle.name !== prettyRange && !cycle.name.includes('–') && !cycle.name.includes('-')) {
          db.runSync(`UPDATE budget_cycles SET name = ? WHERE id = ?`, [prettyRange, cycle.id]);
          cycle = { ...cycle, name: prettyRange };
        }
      }

      setCurrentCycle(cycle || null);

      // Transactions
      const txRows = db.getAllSync<Transaction>(`SELECT * FROM transactions ORDER BY date DESC, created_at DESC`);
      setTransactions(
        txRows.map((t) => ({
          ...t,
          is_paid: t.is_paid !== undefined ? Boolean(t.is_paid) : true,
        }))
      );

      // Recurring Bills
      const billsRows = db.getAllSync<RecurringBill>(`SELECT * FROM recurring_bills ORDER BY next_due_date ASC`);
      setRecurringBills(
        billsRows.map((b) => ({
          ...b,
          reminder_enabled: Boolean(b.reminder_enabled),
          is_active: Boolean(b.is_active),
        }))
      );

      // Budgets (overall, category, subcategory limits)
      const budgetRows = db.getAllSync<BudgetLimit>(`SELECT * FROM budgets`);
      setBudgets(budgetRows);
    } catch (err) {
      console.error('Error loading budget data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const start = async () => {
      try {
        await initDatabase();
        await loadData();
      } catch (err) {
        console.error('Database initialization error:', err);
        setIsLoading(false);
      }
    };
    start();
  }, [loadData]);

  // Computed total net worth (sum of all wallet balances)
  const totalConvertedBalance = useMemo(() => {
    return wallets.reduce((total, w) => total + w.current_balance, 0);
  }, [wallets]);

  // Cycle range transactions
  const cycleTransactions = useMemo(() => {
    if (!currentCycle) return transactions;
    return transactions.filter(
      (tx) => tx.date >= currentCycle.start_date && tx.date <= currentCycle.end_date
    );
  }, [transactions, currentCycle]);

  // Total spent in cycle
  const spentInCycle = useMemo(() => {
    return cycleTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount || t.base_amount || 0), 0);
  }, [cycleTransactions]);

  // Total income in cycle
  const incomeInCycle = useMemo(() => {
    return cycleTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + (t.amount || t.base_amount || 0), 0);
  }, [cycleTransactions]);

  // Accumulated rollover surplus/deficit if balance mode is 'accumulated'
  const accumulatedRollover = useMemo(() => {
    if (settings.cycle_balance_mode !== 'accumulated' || !currentCycle) return 0;
    const priorTx = transactions.filter((t) => t.date < currentCycle.start_date);
    const priorIncome = priorTx
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + (t.amount || t.base_amount || 0), 0);
    const priorExpense = priorTx
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount || t.base_amount || 0), 0);
    return priorIncome - priorExpense;
  }, [settings.cycle_balance_mode, currentCycle, transactions]);

  // Remaining budget in cycle
  const remainingCycleBalance = useMemo(() => {
    if (currentCycle?.target_budget && currentCycle.target_budget > 0) {
      const base = currentCycle.target_budget - spentInCycle;
      return settings.cycle_balance_mode === 'accumulated' ? base + accumulatedRollover : base;
    }
    return totalConvertedBalance;
  }, [currentCycle, spentInCycle, totalConvertedBalance, settings.cycle_balance_mode, accumulatedRollover]);

  // Daily Allowance Calculation ("Available for Day")
  const dailyAllowanceStats = useMemo<DailyAllowanceStats>(() => {
    const now = new Date();
    const todayY = now.getFullYear();
    const todayM = now.getMonth() + 1;
    const todayD = now.getDate();
    const todayStr = `${todayY}-${String(todayM).padStart(2, '0')}-${String(todayD).padStart(2, '0')}`;
    const todayDateOnly = new Date(todayY, todayM - 1, todayD, 0, 0, 0);

    let start: Date;
    let end: Date;

    if (currentCycle && currentCycle.start_date && currentCycle.end_date) {
      const [sy, sm, sd] = currentCycle.start_date.split('-').map(Number);
      const [ey, em, ed] = currentCycle.end_date.split('-').map(Number);
      start = new Date(sy, sm - 1, sd, 0, 0, 0);
      end = new Date(ey, em - 1, ed, 0, 0, 0);
    } else {
      // Default to current calendar month (1st of month to last day of month)
      const lastDayOfMonth = new Date(todayY, todayM, 0).getDate();
      start = new Date(todayY, todayM - 1, 1, 0, 0, 0);
      end = new Date(todayY, todayM - 1, lastDayOfMonth, 0, 0, 0);
    }

    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    // Days remaining includes today as day 1:
    // e.g. Oct 29 to Oct 31: 2 days difference + 1 inclusive = 3 days (29, 30, 31)
    const diffDays = Math.max(0, Math.round((end.getTime() - todayDateOnly.getTime()) / (1000 * 60 * 60 * 24)));
    const daysRemaining = Math.max(1, diffDays + 1);
    const dayIndex = Math.min(totalDays, Math.max(1, totalDays - daysRemaining + 1));

    // Spent today in app currency
    const todayExpenses = transactions
      .filter((t) => t.type === 'expense' && t.date === todayStr)
      .reduce((sum, t) => sum + (t.amount || t.base_amount || 0), 0);

    const hasTargetBudget = (currentCycle?.target_budget ?? 0) > 0;

    // Daily Allowance ("Available for Day") formula:
    // If target budget is set, pool = remaining cycle balance + today's expenses.
    // Otherwise, pool = total wallets balance + today's expenses.
    // Available for day = pool / days remaining in defined month.
    const pool = hasTargetBudget
      ? Math.max(0, remainingCycleBalance + todayExpenses)
      : Math.max(0, totalConvertedBalance + todayExpenses);

    const baselineDaily = daysRemaining > 0 ? pool / daysRemaining : 0;
    const availableForDay = Math.max(0, baselineDaily);
    const remainingToday = availableForDay - todayExpenses;

    // Daily average spent so far in this cycle
    const daysElapsed = Math.max(1, dayIndex);
    const dailyAverage = Math.round(spentInCycle / daysElapsed);

    return {
      totalDays,
      daysRemaining,
      dayIndex,
      availableForDay,
      spentToday: todayExpenses,
      remainingToday,
      isOverDaily: todayExpenses > availableForDay && availableForDay > 0,
      hasBudget: hasTargetBudget,
      dailyAverage,
    };
  }, [currentCycle, transactions, remainingCycleBalance, spentInCycle, totalConvertedBalance]);

  // Overall Budget metrics
  const overallBudgetLimit = currentCycle?.target_budget || 0;
  const overallBudgetSpent = spentInCycle;
  const overallBudgetRemaining = overallBudgetLimit - overallBudgetSpent;
  const overallBudgetPercent = overallBudgetLimit > 0 ? (overallBudgetSpent / overallBudgetLimit) * 100 : 0;

  // Income Goal metrics
  const incomeGoal = currentCycle?.target_income || (currentCycle?.target_budget || 0);
  const incomeGoalPercent = incomeGoal > 0 ? (incomeInCycle / incomeGoal) * 100 : 0;
  const incomeGoalRemaining = incomeGoal > 0 ? Math.max(0, incomeGoal - incomeInCycle) : 0;

  // Active period for budgets (YYYY-MM or cycle id)
  const activeBudgetPeriod = useMemo(() => {
    if (currentCycle?.start_date) {
      return currentCycle.start_date.slice(0, 7);
    }
    return new Date().toISOString().slice(0, 7);
  }, [currentCycle]);

  // Compute Category and Subcategory budget progress list for both expenses & income
  const categoryBudgetProgressList = useMemo<BudgetProgress[]>(() => {
    return categories.map((cat) => {
      const isExpense = cat.type === 'expense';

      // Find category budget limit / target
      const catBudget = budgets.find(
        (b) =>
          b.scope === 'category' &&
          b.category_id === cat.id &&
          (b.period === activeBudgetPeriod || b.period === currentCycle?.id || b.period === 'default')
      );
      const limit = catBudget ? catBudget.amount : 0;

      // Spent / Earned across all wallets in current cycle
      const spent = cycleTransactions
        .filter((t) => t.type === cat.type && t.category_id === cat.id)
        .reduce((sum, t) => sum + t.base_amount, 0);

      const remaining = limit > 0 ? (isExpense ? limit - spent : Math.max(0, limit - spent)) : 0;
      const percent = limit > 0 ? (spent / limit) * 100 : 0;
      const isOverBudget = isExpense ? (limit > 0 && spent > limit) : (limit > 0 && spent >= limit);
      const isNearLimit = isExpense ? (limit > 0 && percent >= 80 && !isOverBudget) : (limit > 0 && percent >= 80 && !isOverBudget);

      // Subcategories
      const subBudgets: BudgetProgress[] = (cat.subcategories || []).map((sub) => {
        const subBudget = budgets.find(
          (b) =>
            b.scope === 'subcategory' &&
            b.subcategory_id === sub.id &&
            (b.period === activeBudgetPeriod || b.period === currentCycle?.id || b.period === 'default')
        );
        const subLimit = subBudget ? subBudget.amount : 0;
        const subSpent = cycleTransactions
          .filter((t) => t.type === cat.type && t.category_id === cat.id && t.subcategory_id === sub.id)
          .reduce((sum, t) => sum + t.base_amount, 0);

        const subRemaining = subLimit > 0 ? (isExpense ? subLimit - subSpent : Math.max(0, subLimit - subSpent)) : 0;
        const subPercent = subLimit > 0 ? (subSpent / subLimit) * 100 : 0;
        const subIsOver = isExpense ? (subLimit > 0 && subSpent > subLimit) : (subLimit > 0 && subSpent >= subLimit);
        const subIsNear = isExpense ? (subLimit > 0 && subPercent >= 80 && !subIsOver) : (subLimit > 0 && subPercent >= 80 && !subIsOver);

        return {
          scope: 'subcategory' as BudgetScope,
          id: sub.id,
          name: sub.name,
          limit: subLimit,
          spent: subSpent,
          remaining: subRemaining,
          percent: subPercent,
          isOverBudget: subIsOver,
          isNearLimit: subIsNear,
          color: cat.color,
          icon: 'circle-small',
        };
      });

      return {
        scope: 'category' as BudgetScope,
        id: cat.id,
        name: cat.name,
        limit,
        spent,
        remaining,
        percent,
        isOverBudget,
        isNearLimit,
        color: cat.color,
        icon: cat.icon,
        subBudgets,
      };
    });
  }, [categories, budgets, cycleTransactions, activeBudgetPeriod, currentCycle]);

  // Total allocated to expense category limits
  const allocatedCategoriesBudget = useMemo(() => {
    return categoryBudgetProgressList
      .filter((p) => {
        const cat = categories.find((c) => c.id === p.id);
        return cat?.type === 'expense';
      })
      .reduce((sum, p) => sum + p.limit, 0);
  }, [categoryBudgetProgressList, categories]);

  // Unallocated expense budget remainder
  const unallocatedBudgetRemainder = useMemo(() => {
    return Math.max(0, overallBudgetLimit - allocatedCategoriesBudget);
  }, [overallBudgetLimit, allocatedCategoriesBudget]);

  // Total allocated to income category targets
  const allocatedCategoriesIncome = useMemo(() => {
    return categoryBudgetProgressList
      .filter((p) => {
        const cat = categories.find((c) => c.id === p.id);
        return cat?.type === 'income';
      })
      .reduce((sum, p) => sum + p.limit, 0);
  }, [categoryBudgetProgressList, categories]);

  // Unallocated income target remainder
  const unallocatedIncomeRemainder = useMemo(() => {
    return Math.max(0, incomeGoal - allocatedCategoriesIncome);
  }, [incomeGoal, allocatedCategoriesIncome]);

  // Actions
  const addTransaction = async (params: {
    wallet_id: string;
    category_id?: string;
    subcategory_id?: string;
    type: TransactionType;
    amount: number;
    currency?: string;
    date: string;
    time?: string;
    is_paid?: boolean;
    media_uri?: string;
    note?: string;
    to_wallet_id?: string;
  }) => {
    const db = getDB();
    const id = `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const txCurrency = params.currency || settings.base_currency;
    const isPaid = params.is_paid !== false;

    db.withTransactionSync(() => {
      db.runSync(
        `INSERT INTO transactions (id, wallet_id, category_id, subcategory_id, type, amount, currency, base_amount, date, time, is_paid, media_uri, note, to_wallet_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          params.wallet_id,
          params.category_id || null,
          params.subcategory_id || null,
          params.type,
          params.amount,
          txCurrency,
          params.amount,
          params.date,
          params.time || null,
          isPaid ? 1 : 0,
          params.media_uri || null,
          params.note || null,
          params.to_wallet_id || null,
          new Date().toISOString(),
        ]
      );

      // Adjust wallet balances (if paid)
      if (isPaid) {
        if (params.type === 'expense') {
          db.runSync(`UPDATE wallets SET current_balance = current_balance - ? WHERE id = ?`, [
            params.amount,
            params.wallet_id,
          ]);
        } else if (params.type === 'income') {
          db.runSync(`UPDATE wallets SET current_balance = current_balance + ? WHERE id = ?`, [
            params.amount,
            params.wallet_id,
          ]);
        } else if (params.type === 'transfer' && params.to_wallet_id) {
          // deduct from source wallet
          db.runSync(`UPDATE wallets SET current_balance = current_balance - ? WHERE id = ?`, [
            params.amount,
            params.wallet_id,
          ]);
          // credit to destination wallet
          db.runSync(`UPDATE wallets SET current_balance = current_balance + ? WHERE id = ?`, [
            params.amount,
            params.to_wallet_id,
          ]);
        }
      }
    });

    await loadData();
  };

  const deleteTransaction = async (id: string) => {
    const db = getDB();
    const tx = transactions.find((t) => t.id === id);
    if (!tx) return;

    db.withTransactionSync(() => {
      const isPaid = tx.is_paid !== false;
      // Reverse wallet balance changes (if was paid)
      if (isPaid) {
        if (tx.type === 'expense') {
          db.runSync(`UPDATE wallets SET current_balance = current_balance + ? WHERE id = ?`, [
            tx.amount,
            tx.wallet_id,
          ]);
        } else if (tx.type === 'income') {
          db.runSync(`UPDATE wallets SET current_balance = current_balance - ? WHERE id = ?`, [
            tx.amount,
            tx.wallet_id,
          ]);
        } else if (tx.type === 'transfer' && tx.to_wallet_id) {
          db.runSync(`UPDATE wallets SET current_balance = current_balance + ? WHERE id = ?`, [
            tx.amount,
            tx.wallet_id,
          ]);
          db.runSync(`UPDATE wallets SET current_balance = current_balance - ? WHERE id = ?`, [
            tx.amount,
            tx.to_wallet_id,
          ]);
        }
      }

      db.runSync(`DELETE FROM transactions WHERE id = ?`, [id]);
    });

    await loadData();
  };

  const addWallet = async (params: {
    name: string;
    currency?: string;
    starting_balance: number;
    color: string;
    icon: string;
  }) => {
    const db = getDB();
    const id = `w-${Date.now()}`;
    const wCurrency = params.currency || settings.base_currency;
    db.runSync(
      `INSERT INTO wallets (id, name, currency, starting_balance, current_balance, color, icon, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [id, params.name, wCurrency, params.starting_balance, params.starting_balance, params.color, params.icon]
    );
    await loadData();
  };

  const updateWallet = async (wallet: Wallet) => {
    const db = getDB();
    db.runSync(
      `UPDATE wallets SET name = ?, currency = ?, current_balance = ?, color = ?, icon = ?, is_default = ? WHERE id = ?`,
      [wallet.name, wallet.currency, wallet.current_balance, wallet.color, wallet.icon, wallet.is_default ? 1 : 0, wallet.id]
    );
    await loadData();
  };

  const deleteWallet = async (id: string) => {
    const db = getDB();
    db.runSync(`DELETE FROM wallets WHERE id = ?`, [id]);
    await loadData();
  };

  const transferBetweenWallets = async (params: {
    from_wallet_id: string;
    to_wallet_id: string;
    amount: number;
    date: string;
    note?: string;
  }) => {
    const fromWallet = wallets.find((w) => w.id === params.from_wallet_id);
    if (!fromWallet) return;

    await addTransaction({
      wallet_id: params.from_wallet_id,
      to_wallet_id: params.to_wallet_id,
      type: 'transfer',
      amount: params.amount,
      currency: fromWallet.currency,
      date: params.date,
      note: params.note || 'Wallet Transfer',
    });
  };

  const addCategory = async (params: {
    name: string;
    type: 'expense' | 'income';
    icon: string;
    color: string;
    initial_limit?: number;
  }): Promise<string> => {
    const db = getDB();
    const id = `cat-${Date.now()}`;
    db.runSync(
      `INSERT INTO categories (id, name, type, icon, color, is_default) VALUES (?, ?, ?, ?, ?, 0)`,
      [id, params.name, params.type, params.icon, params.color]
    );

    if (params.initial_limit && params.initial_limit > 0) {
      const bId = `b-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      db.runSync(
        `INSERT INTO budgets (id, scope, category_id, subcategory_id, amount, period) VALUES (?, 'category', ?, NULL, ?, ?)`,
        [bId, id, params.initial_limit, activeBudgetPeriod]
      );
    }

    await loadData();
    return id;
  };

  const updateCategory = async (category: Category) => {
    const db = getDB();
    db.runSync(
      `UPDATE categories SET name = ?, type = ?, icon = ?, color = ? WHERE id = ?`,
      [category.name, category.type, category.icon, category.color, category.id]
    );
    await loadData();
  };

  const deleteCategory = async (id: string) => {
    const db = getDB();
    db.runSync(`DELETE FROM budgets WHERE category_id = ?`, [id]);
    db.runSync(`DELETE FROM subcategories WHERE category_id = ?`, [id]);
    db.runSync(`DELETE FROM categories WHERE id = ?`, [id]);
    await loadData();
  };

  const addSubcategory = async (category_id: string, name: string, initial_limit?: number): Promise<string> => {
    const db = getDB();
    const id = `sub-${Date.now()}`;
    db.runSync(`INSERT INTO subcategories (id, category_id, name) VALUES (?, ?, ?)`, [id, category_id, name]);

    if (initial_limit && initial_limit > 0) {
      const bId = `b-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      db.runSync(
        `INSERT INTO budgets (id, scope, category_id, subcategory_id, amount, period) VALUES (?, 'subcategory', ?, ?, ?, ?)`,
        [bId, category_id, id, initial_limit, activeBudgetPeriod]
      );
    }

    await loadData();
    return id;
  };

  const updateSubcategory = async (id: string, name: string) => {
    const db = getDB();
    db.runSync(`UPDATE subcategories SET name = ? WHERE id = ?`, [name, id]);
    await loadData();
  };

  const deleteSubcategory = async (id: string) => {
    const db = getDB();
    db.runSync(`DELETE FROM budgets WHERE subcategory_id = ?`, [id]);
    db.runSync(`DELETE FROM subcategories WHERE id = ?`, [id]);
    await loadData();
  };

  const addRecurringBill = async (params: {
    name: string;
    amount: number;
    currency?: string;
    frequency: BillFrequency;
    due_day: number;
    next_due_date: string;
    category_id?: string;
    wallet_id: string;
    reminder_enabled?: boolean;
    end_type?: RecurrenceEndType;
    end_occurrences?: number;
    end_date?: string;
  }) => {
    const db = getDB();
    const id = `bill-${Date.now()}`;
    const billCurrency = params.currency || settings.base_currency;
    db.runSync(
      `INSERT INTO recurring_bills (id, name, amount, currency, frequency, due_day, next_due_date, category_id, wallet_id, reminder_enabled, is_active, end_type, end_occurrences, end_date, occurrences_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 0, ?)`,
      [
        id,
        params.name,
        params.amount,
        billCurrency,
        params.frequency,
        params.due_day,
        params.next_due_date,
        params.category_id || null,
        params.wallet_id,
        params.reminder_enabled !== false ? 1 : 0,
        params.end_type || 'never',
        params.end_occurrences || null,
        params.end_date || null,
        new Date().toISOString(),
      ]
    );
    await loadData();
  };

  const updateRecurringBill = async (bill: RecurringBill) => {
    const db = getDB();
    db.runSync(
      `UPDATE recurring_bills SET name = ?, amount = ?, currency = ?, frequency = ?, due_day = ?, next_due_date = ?, category_id = ?, wallet_id = ?, reminder_enabled = ?, is_active = ?, end_type = ?, end_occurrences = ?, end_date = ?, occurrences_count = ? WHERE id = ?`,
      [
        bill.name,
        bill.amount,
        bill.currency,
        bill.frequency,
        bill.due_day,
        bill.next_due_date,
        bill.category_id || null,
        bill.wallet_id,
        bill.reminder_enabled ? 1 : 0,
        bill.is_active ? 1 : 0,
        bill.end_type || 'never',
        bill.end_occurrences || null,
        bill.end_date || null,
        bill.occurrences_count || 0,
        bill.id,
      ]
    );
    await loadData();
  };

  const deleteRecurringBill = async (id: string) => {
    const db = getDB();
    db.runSync(`DELETE FROM recurring_bills WHERE id = ?`, [id]);
    await loadData();
  };

  const payRecurringBill = async (bill: RecurringBill) => {
    // 1. Record expense transaction
    await addTransaction({
      wallet_id: bill.wallet_id,
      category_id: bill.category_id || undefined,
      type: 'expense',
      amount: bill.amount,
      currency: bill.currency,
      date: new Date().toISOString().slice(0, 10),
      note: `Bill Paid: ${bill.name}`,
    });

    // 2. Advance next due date and evaluate end condition
    const currentDue = new Date(bill.next_due_date + 'T00:00:00');
    if (bill.frequency === 'weekly') {
      currentDue.setDate(currentDue.getDate() + 7);
    } else if (bill.frequency === 'yearly') {
      currentDue.setFullYear(currentDue.getFullYear() + 1);
    } else {
      currentDue.setMonth(currentDue.getMonth() + 1);
    }
    const nextDateStr = currentDue.toISOString().slice(0, 10);
    const newCount = (bill.occurrences_count || 0) + 1;

    let stillActive = bill.is_active ? 1 : 0;
    if (bill.end_type === 'after_occurrences' && bill.end_occurrences && newCount >= bill.end_occurrences) {
      stillActive = 0;
    } else if (bill.end_type === 'on_date' && bill.end_date && nextDateStr > bill.end_date) {
      stillActive = 0;
    }

    const db = getDB();
    db.runSync(
      `UPDATE recurring_bills SET next_due_date = ?, occurrences_count = ?, is_active = ? WHERE id = ?`,
      [nextDateStr, newCount, stillActive, bill.id]
    );
    await loadData();
  };

  const updateBudgetCycle = async (params: {
    id?: string;
    name: string;
    start_date: string;
    end_date: string;
    target_budget?: number;
    target_income?: number;
  }) => {
    const db = getDB();
    if (params.id) {
      db.runSync(
        `UPDATE budget_cycles SET name = ?, start_date = ?, end_date = ?, target_budget = ?, target_income = ? WHERE id = ?`,
        [params.name, params.start_date, params.end_date, params.target_budget ?? null, params.target_income ?? null, params.id]
      );
    } else {
      const id = `cycle-${Date.now()}`;
      db.runSync(`UPDATE budget_cycles SET is_active = 0`);
      db.runSync(
        `INSERT INTO budget_cycles (id, name, start_date, end_date, target_budget, target_income, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [id, params.name, params.start_date, params.end_date, params.target_budget ?? null, params.target_income ?? null]
      );
    }
    await loadData();
  };

  const setBudgetLimit = async (params: {
    scope: BudgetScope;
    category_id?: string;
    subcategory_id?: string;
    amount: number;
    period?: string;
    type?: 'expense' | 'income';
  }) => {
    const db = getDB();
    const activePeriod = params.period || activeBudgetPeriod;

    if (params.scope === 'overall') {
      if (currentCycle) {
        if (params.type === 'income') {
          db.runSync(`UPDATE budget_cycles SET target_income = ? WHERE id = ?`, [params.amount, currentCycle.id]);
        } else {
          db.runSync(`UPDATE budget_cycles SET target_budget = ? WHERE id = ?`, [params.amount, currentCycle.id]);
        }
      }
    }

    // Check if an existing budget exists for this scope & target & period
    let existing: BudgetLimit | null = null;
    if (params.scope === 'category') {
      existing = db.getFirstSync<BudgetLimit>(
        `SELECT * FROM budgets WHERE scope = 'category' AND category_id = ? AND (period = ? OR period = ?)`,
        [params.category_id || '', activePeriod, currentCycle?.id || '']
      );
    } else if (params.scope === 'subcategory') {
      existing = db.getFirstSync<BudgetLimit>(
        `SELECT * FROM budgets WHERE scope = 'subcategory' AND subcategory_id = ? AND (period = ? OR period = ?)`,
        [params.subcategory_id || '', activePeriod, currentCycle?.id || '']
      );
    } else if (params.scope === 'overall') {
      existing = db.getFirstSync<BudgetLimit>(
        `SELECT * FROM budgets WHERE scope = 'overall' AND (period = ? OR period = ?)`,
        [activePeriod, currentCycle?.id || '']
      );
    }

    if (existing) {
      if (params.amount <= 0) {
        // If amount is 0 or negative, remove the limit
        db.runSync(`DELETE FROM budgets WHERE id = ?`, [existing.id]);
      } else {
        db.runSync(`UPDATE budgets SET amount = ? WHERE id = ?`, [params.amount, existing.id]);
      }
    } else if (params.amount > 0) {
      const id = `b-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      db.runSync(
        `INSERT INTO budgets (id, scope, category_id, subcategory_id, amount, period) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, params.scope, params.category_id || null, params.subcategory_id || null, params.amount, activePeriod]
      );
    }

    await loadData();
  };

  const deleteBudgetLimit = async (id: string) => {
    const db = getDB();
    db.runSync(`DELETE FROM budgets WHERE id = ?`, [id]);
    await loadData();
  };

  const updateCurrentCycleTarget = async (type: 'budget' | 'income', amount: number) => {
    if (!currentCycle) return;
    const db = getDB();
    if (type === 'budget') {
      db.runSync(`UPDATE budget_cycles SET target_budget = ? WHERE id = ?`, [amount, currentCycle.id]);
    } else {
      db.runSync(`UPDATE budget_cycles SET target_income = ? WHERE id = ?`, [amount, currentCycle.id]);
    }
    await loadData();
  };

  const deleteBudgetCycle = async (id: string) => {
    const db = getDB();
    db.runSync(`DELETE FROM budget_cycles WHERE id = ?`, [id]);
    await loadData();
  };

  const setActiveBudgetCycle = async (id: string) => {
    const db = getDB();
    db.runSync(`UPDATE budget_cycles SET is_active = 0`);
    db.runSync(`UPDATE budget_cycles SET is_active = 1 WHERE id = ?`, [id]);
    await loadData();
  };

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    const db = getDB();
    if (newSettings.base_currency) {
      const newBase = newSettings.base_currency;
      db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('base_currency', ?)`, [newBase]);
      db.runSync(`UPDATE wallets SET currency = ?`, [newBase]);
      db.runSync(`UPDATE recurring_bills SET currency = ?`, [newBase]);
      db.runSync(`UPDATE transactions SET currency = ?`, [newBase]);
    }
    if (newSettings.theme_mode) {
      db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('theme_mode', ?)`, [newSettings.theme_mode]);
    }
    if (newSettings.cycle_mode) {
      db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('cycle_mode', ?)`, [newSettings.cycle_mode]);
    }
    if (newSettings.cycle_balance_mode) {
      db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('cycle_balance_mode', ?)`, [newSettings.cycle_balance_mode]);
    }
    if (newSettings.cycle_target_mode) {
      db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('cycle_target_mode', ?)`, [newSettings.cycle_target_mode]);
    }
    if (newSettings.cycle_month_start_day !== undefined) {
      db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('cycle_month_start_day', ?)`, [newSettings.cycle_month_start_day.toString()]);
    }
    if (newSettings.cycle_default_budget !== undefined) {
      db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('cycle_default_budget', ?)`, [newSettings.cycle_default_budget.toString()]);
    }
    if (newSettings.cycle_default_income !== undefined) {
      db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('cycle_default_income', ?)`, [newSettings.cycle_default_income.toString()]);
    }
    await loadData();
  };

  const updateAllWalletsCurrency = async (currency: string) => {
    const db = getDB();
    db.runSync(`UPDATE wallets SET currency = ?`, [currency]);
    db.runSync(`UPDATE recurring_bills SET currency = ?`, [currency]);
    db.runSync(`UPDATE transactions SET currency = ?`, [currency]);
    await loadData();
  };

  const exportBackup = async (): Promise<boolean> => {
    return await exportBackupData();
  };

  const importBackup = async (): Promise<{ success: boolean; message: string }> => {
    const result = await importBackupData();
    if (result.success) {
      await loadData();
    }
    return result;
  };

  const completeOnboarding = async (params: {
    currency: string;
    firstWalletName?: string;
    startingBalance?: number;
    budgetCap?: number;
    incomeGoal?: number;
  }) => {
    const db = getDB();
    const curr = params.currency || 'USD';
    db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('base_currency', ?)`, [curr]);
    db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('onboarding_completed', '1')`);

    // Ensure default wallets and sync currency
    ensureDefaultWallets(db, curr);
    db.runSync(`UPDATE wallets SET currency = ?`, [curr]);

    // Create first custom wallet if specified and not duplicate
    if (params.firstWalletName && params.firstWalletName.trim()) {
      const trimmed = params.firstWalletName.trim();
      const existing = db.getFirstSync<{ id: string }>(`SELECT id FROM wallets WHERE LOWER(name) = LOWER(?)`, [trimmed]);
      if (existing) {
        if (params.startingBalance && params.startingBalance > 0) {
          db.runSync(`UPDATE wallets SET starting_balance = ?, current_balance = ? WHERE id = ?`, [params.startingBalance, params.startingBalance, existing.id]);
        }
      } else {
        const wId = `w-${Date.now()}`;
        const startBal = params.startingBalance || 0;
        db.runSync(
          `INSERT INTO wallets (id, name, currency, starting_balance, current_balance, color, icon, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
          [wId, trimmed, curr, startBal, startBal, '#10B981', 'cash']
        );
      }
    } else if (params.startingBalance && params.startingBalance > 0) {
      db.runSync(`UPDATE wallets SET starting_balance = ?, current_balance = ? WHERE id = 'w-cash'`, [params.startingBalance, params.startingBalance]);
    }

    // Set up initial cycle if budget or income target provided
    const reg = getRegularCycleDates(1);
    const regId = `cycle-reg-${reg.startDate}`;
    const targetB = params.budgetCap !== undefined && params.budgetCap > 0 ? params.budgetCap : null;
    const targetI = params.incomeGoal !== undefined && params.incomeGoal > 0 ? params.incomeGoal : null;

    db.runSync(`UPDATE budget_cycles SET is_active = 0`);
    db.runSync(
      `INSERT INTO budget_cycles (id, name, start_date, end_date, target_budget, target_income, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [regId, reg.name, reg.startDate, reg.endDate, targetB, targetI]
    );

    if (targetB) {
      db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('cycle_default_budget', ?)`, [targetB.toString()]);
    }
    if (targetI) {
      db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('cycle_default_income', ?)`, [targetI.toString()]);
    }

    await loadData();
  };

  return (
    <BudgetContext.Provider
      value={{
        wallets,
        categories,
        transactions,
        recurringBills,
        budgets,
        currentCycle,
        allCycles,
        settings,
        isLoading,
        completeOnboarding,
        isCycleModalOpen,
        setIsCycleModalOpen,
        openCycleModal,
        closeCycleModal,
        analyticsFocus,
        setAnalyticsFocus,
        totalConvertedBalance,
        spentInCycle,
        incomeInCycle,
        remainingCycleBalance,
        dailyAllowanceStats,
        overallBudgetLimit,
        overallBudgetSpent,
        overallBudgetRemaining,
        overallBudgetPercent,
        incomeGoal,
        incomeGoalPercent,
        incomeGoalRemaining,
        allocatedCategoriesBudget,
        unallocatedBudgetRemainder,
        allocatedCategoriesIncome,
        unallocatedIncomeRemainder,
        categoryBudgetProgressList,
        addTransaction,
        deleteTransaction,
        addWallet,
        updateWallet,
        deleteWallet,
        transferBetweenWallets,
        addCategory,
        updateCategory,
        deleteCategory,
        addSubcategory,
        updateSubcategory,
        deleteSubcategory,
        addRecurringBill,
        updateRecurringBill,
        deleteRecurringBill,
        payRecurringBill,
        updateBudgetCycle,
        updateCurrentCycleTarget,
        deleteBudgetCycle,
        setActiveBudgetCycle,
        setBudgetLimit,
        deleteBudgetLimit,
        updateSettings,
        updateAllWalletsCurrency,
        exportBackup,
        importBackup,
        reloadAllData: loadData,
      }}
    >
      {children}
    </BudgetContext.Provider>
  );
};

export const useBudget = (): BudgetContextType => {
  const context = useContext(BudgetContext);
  if (!context) {
    throw new Error('useBudget must be used within a BudgetProvider');
  }
  return context;
};
