import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getDB, initDatabase } from '../services/db';
import { exportBackupData, importBackupData } from '../services/backup';
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
  settings: AppSettings;
  isLoading: boolean;

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
  allocatedCategoriesBudget: number;
  unallocatedBudgetRemainder: number;
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
  }) => Promise<void>;
  updateRecurringBill: (bill: RecurringBill) => Promise<void>;
  deleteRecurringBill: (id: string) => Promise<void>;
  payRecurringBill: (bill: RecurringBill) => Promise<void>;

  updateBudgetCycle: (params: { id?: string; name: string; start_date: string; end_date: string; target_budget?: number }) => Promise<void>;
  setBudgetLimit: (params: {
    scope: BudgetScope;
    category_id?: string;
    subcategory_id?: string;
    amount: number;
    period?: string;
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
  const [settings, setSettings] = useState<AppSettings>({
    base_currency: 'USD',
    theme_mode: 'light',
    app_name: 'just budget',
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
      };
      setSettings(newSettings);

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

      // Active Budget Cycle
      let cycle = db.getFirstSync<BudgetCycle>(`SELECT * FROM budget_cycles WHERE is_active = 1 LIMIT 1`);
      if (!cycle) {
        cycle = db.getFirstSync<BudgetCycle>(`SELECT * FROM budget_cycles ORDER BY start_date DESC LIMIT 1`);
      }
      // Ensure the cycle's end date covers the full month (e.g., Oct 31, not Oct 30 truncated by UTC)
      if (cycle && cycle.start_date) {
        const [cy, cm] = cycle.start_date.split('-').map(Number);
        if (cy && cm) {
          const lastDay = new Date(cy, cm, 0).getDate();
          const expectedEnd = `${cy}-${String(cm).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
          if (cycle.end_date !== expectedEnd && cycle.end_date.startsWith(`${cy}-${String(cm).padStart(2, '0')}`)) {
            db.runSync(`UPDATE budget_cycles SET end_date = ? WHERE id = ?`, [expectedEnd, cycle.id]);
            cycle = { ...cycle, end_date: expectedEnd };
          }
        }
      }
      setCurrentCycle(cycle || null);

      // Transactions
      const txRows = db.getAllSync<Transaction>(`SELECT * FROM transactions ORDER BY date DESC, created_at DESC`);
      setTransactions(txRows);

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

  // Remaining budget in cycle
  const remainingCycleBalance = useMemo(() => {
    if (currentCycle?.target_budget && currentCycle.target_budget > 0) {
      return currentCycle.target_budget - spentInCycle;
    }
    return totalConvertedBalance;
  }, [currentCycle, spentInCycle, totalConvertedBalance]);

  // Daily Allowance Calculation ("Available for Day")
  const dailyAllowanceStats = useMemo<DailyAllowanceStats>(() => {
    const now = new Date();
    const todayY = now.getFullYear();
    const todayM = now.getMonth() + 1;
    const todayD = now.getDate();
    const todayStr = `${todayY}-${String(todayM).padStart(2, '0')}-${String(todayD).padStart(2, '0')}`;
    const todayDateOnly = new Date(todayY, todayM - 1, todayD, 0, 0, 0);

    let start = new Date(todayDateOnly);
    let end = new Date(todayDateOnly);
    end.setDate(end.getDate() + 30); // default 30 days ahead

    if (currentCycle && currentCycle.start_date && currentCycle.end_date) {
      const [sy, sm, sd] = currentCycle.start_date.split('-').map(Number);
      const [ey, em, ed] = currentCycle.end_date.split('-').map(Number);
      start = new Date(sy, sm - 1, sd, 0, 0, 0);
      end = new Date(ey, em - 1, ed, 0, 0, 0);
    }

    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    // Days remaining includes today as day 1:
    // e.g. Oct 27 to Oct 31: 4 days difference + 1 inclusive = 5 days (27, 28, 29, 30, 31)
    const diffDays = Math.max(0, Math.round((end.getTime() - todayDateOnly.getTime()) / (1000 * 60 * 60 * 24)));
    const daysRemaining = Math.max(1, diffDays + 1);
    const dayIndex = Math.min(totalDays, Math.max(1, totalDays - daysRemaining + 1));

    // Spent today in app currency
    const todayExpenses = transactions
      .filter((t) => t.type === 'expense' && t.date === todayStr)
      .reduce((sum, t) => sum + (t.amount || t.base_amount || 0), 0);

    // Available for day formula:
    // (Remaining Cycle Balance + Today's Expenses) / Days Remaining
    const cyclePoolForRemainingDays = Math.max(0, remainingCycleBalance);
    const baselineDaily = (cyclePoolForRemainingDays + todayExpenses) / daysRemaining;
    const availableForDay = Math.max(0, baselineDaily);
    const remainingToday = availableForDay - todayExpenses;

    return {
      totalDays,
      daysRemaining,
      dayIndex,
      availableForDay,
      spentToday: todayExpenses,
      remainingToday,
      isOverDaily: todayExpenses > availableForDay && availableForDay > 0,
    };
  }, [currentCycle, transactions, remainingCycleBalance]);

  // Overall Budget metrics
  const overallBudgetLimit = currentCycle?.target_budget || 0;
  const overallBudgetSpent = spentInCycle;
  const overallBudgetRemaining = overallBudgetLimit - overallBudgetSpent;
  const overallBudgetPercent = overallBudgetLimit > 0 ? (overallBudgetSpent / overallBudgetLimit) * 100 : 0;

  // Active period for budgets (YYYY-MM or cycle id)
  const activeBudgetPeriod = useMemo(() => {
    if (currentCycle?.start_date) {
      return currentCycle.start_date.slice(0, 7);
    }
    return new Date().toISOString().slice(0, 7);
  }, [currentCycle]);

  // Compute Category and Subcategory budget progress list
  const categoryBudgetProgressList = useMemo<BudgetProgress[]>(() => {
    // Expense categories only
    const expenseCategories = categories.filter((c) => c.type === 'expense');

    return expenseCategories.map((cat) => {
      // Find category budget limit
      const catBudget = budgets.find(
        (b) =>
          b.scope === 'category' &&
          b.category_id === cat.id &&
          (b.period === activeBudgetPeriod || b.period === currentCycle?.id || b.period === 'default')
      );
      const limit = catBudget ? catBudget.amount : 0;

      // Spent across all wallets in current cycle
      const spent = cycleTransactions
        .filter((t) => t.type === 'expense' && t.category_id === cat.id)
        .reduce((sum, t) => sum + t.base_amount, 0);

      const remaining = limit > 0 ? limit - spent : 0;
      const percent = limit > 0 ? (spent / limit) * 100 : 0;
      const isOverBudget = limit > 0 && spent > limit;
      const isNearLimit = limit > 0 && percent >= 80 && !isOverBudget;

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
          .filter((t) => t.type === 'expense' && t.category_id === cat.id && t.subcategory_id === sub.id)
          .reduce((sum, t) => sum + t.base_amount, 0);

        const subRemaining = subLimit > 0 ? subLimit - subSpent : 0;
        const subPercent = subLimit > 0 ? (subSpent / subLimit) * 100 : 0;
        const subIsOver = subLimit > 0 && subSpent > subLimit;
        const subIsNear = subLimit > 0 && subPercent >= 80 && !subIsOver;

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

  // Total allocated to category limits
  const allocatedCategoriesBudget = useMemo(() => {
    return categoryBudgetProgressList.reduce((sum, p) => sum + p.limit, 0);
  }, [categoryBudgetProgressList]);

  // Unallocated remainder
  const unallocatedBudgetRemainder = useMemo(() => {
    return Math.max(0, overallBudgetLimit - allocatedCategoriesBudget);
  }, [overallBudgetLimit, allocatedCategoriesBudget]);

  // Actions
  const addTransaction = async (params: {
    wallet_id: string;
    category_id?: string;
    subcategory_id?: string;
    type: TransactionType;
    amount: number;
    currency?: string;
    date: string;
    note?: string;
    to_wallet_id?: string;
  }) => {
    const db = getDB();
    const id = `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const txCurrency = params.currency || settings.base_currency;

    db.withTransactionSync(() => {
      db.runSync(
        `INSERT INTO transactions (id, wallet_id, category_id, subcategory_id, type, amount, currency, base_amount, date, note, to_wallet_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          params.note || null,
          params.to_wallet_id || null,
          new Date().toISOString(),
        ]
      );

      // Adjust wallet balances
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
    });

    await loadData();
  };

  const deleteTransaction = async (id: string) => {
    const db = getDB();
    const tx = transactions.find((t) => t.id === id);
    if (!tx) return;

    db.withTransactionSync(() => {
      // Reverse wallet balance changes
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
  }) => {
    const db = getDB();
    const id = `bill-${Date.now()}`;
    const billCurrency = params.currency || settings.base_currency;
    db.runSync(
      `INSERT INTO recurring_bills (id, name, amount, currency, frequency, due_day, next_due_date, category_id, wallet_id, reminder_enabled, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
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
        new Date().toISOString(),
      ]
    );
    await loadData();
  };

  const updateRecurringBill = async (bill: RecurringBill) => {
    const db = getDB();
    db.runSync(
      `UPDATE recurring_bills SET name = ?, amount = ?, currency = ?, frequency = ?, due_day = ?, next_due_date = ?, category_id = ?, wallet_id = ?, reminder_enabled = ?, is_active = ? WHERE id = ?`,
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

    // 2. Advance next due date
    const currentDue = new Date(bill.next_due_date + 'T00:00:00');
    if (bill.frequency === 'weekly') {
      currentDue.setDate(currentDue.getDate() + 7);
    } else if (bill.frequency === 'yearly') {
      currentDue.setFullYear(currentDue.getFullYear() + 1);
    } else {
      currentDue.setMonth(currentDue.getMonth() + 1);
    }
    const nextDateStr = currentDue.toISOString().slice(0, 10);

    const db = getDB();
    db.runSync(`UPDATE recurring_bills SET next_due_date = ? WHERE id = ?`, [nextDateStr, bill.id]);
    await loadData();
  };

  const updateBudgetCycle = async (params: {
    id?: string;
    name: string;
    start_date: string;
    end_date: string;
    target_budget?: number;
  }) => {
    const db = getDB();
    if (params.id) {
      db.runSync(
        `UPDATE budget_cycles SET name = ?, start_date = ?, end_date = ?, target_budget = ? WHERE id = ?`,
        [params.name, params.start_date, params.end_date, params.target_budget || null, params.id]
      );
    } else {
      const id = `cycle-${Date.now()}`;
      db.runSync(`UPDATE budget_cycles SET is_active = 0`);
      db.runSync(
        `INSERT INTO budget_cycles (id, name, start_date, end_date, target_budget, is_active) VALUES (?, ?, ?, ?, ?, 1)`,
        [id, params.name, params.start_date, params.end_date, params.target_budget || null]
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
  }) => {
    const db = getDB();
    const activePeriod = params.period || activeBudgetPeriod;

    if (params.scope === 'overall') {
      if (currentCycle) {
        db.runSync(`UPDATE budget_cycles SET target_budget = ? WHERE id = ?`, [params.amount, currentCycle.id]);
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

  return (
    <BudgetContext.Provider
      value={{
        wallets,
        categories,
        transactions,
        recurringBills,
        budgets,
        currentCycle,
        settings,
        isLoading,
        totalConvertedBalance,
        spentInCycle,
        incomeInCycle,
        remainingCycleBalance,
        dailyAllowanceStats,
        overallBudgetLimit,
        overallBudgetSpent,
        overallBudgetRemaining,
        overallBudgetPercent,
        allocatedCategoriesBudget,
        unallocatedBudgetRemainder,
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
        deleteSubcategory,
        addRecurringBill,
        updateRecurringBill,
        deleteRecurringBill,
        payRecurringBill,
        updateBudgetCycle,
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
