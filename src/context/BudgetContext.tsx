import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getDB, initDatabase, ensureDefaultWallets, ensureDefaultExpenseCategories, ensureDefaultIncomeCategories, restoreAllDefaultCategories } from '../services/db';
import { exportBackupData, importBackupData, pickBackupFileAsync, restoreFromBackupContentAsync } from '../services/backup';
import { hashPin, verifyPin, authenticateWithBiometrics, checkBiometricsAvailable } from '../services/security';
import { syncAllRemindersAsync, requestNotificationPermissionsAsync } from '../services/notifications';
import { formatCycleDateRange, getRegularCycleDates, formatCurrency } from '../utils/format';
import {
  Wallet,
  Category,
  Subcategory,
  Transaction,
  BudgetCycle,
  AppSettings,
  DailyAllowanceStats,
  DailyAllowanceStatus,
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
    walletBalances?: Record<string, number>;
    budgetCap?: number;
    incomeGoal?: number;
    cycleMode?: 'regular' | 'custom';
    cycleMonthStartDay?: number;
    cycleBalanceMode?: 'monthly' | 'accumulated';
    customCycleStartDate?: string;
    customCycleEndDate?: string;
    customCycleName?: string;
  }) => Promise<void>;

  // Cycle Modal & Analytics Navigation State
  isCycleModalOpen: boolean;
  setIsCycleModalOpen: (open: boolean) => void;
  openCycleModal: () => void;
  closeCycleModal: () => void;
  analyticsFocus: 'overview' | 'expense' | 'income';
  setAnalyticsFocus: (focus: 'overview' | 'expense' | 'income') => void;
  selectedCalendarDate: string;
  setSelectedCalendarDate: (date: string) => void;
  selectedTransactionIdForCalendar: string | null;
  setSelectedTransactionIdForCalendar: (id: string | null) => void;
  selectedCalendarCycle: BudgetCycle | null;
  setSelectedCalendarCycle: (cycle: BudgetCycle | null) => void;
  selectedAnalyticsCycle: BudgetCycle | null;
  setSelectedAnalyticsCycle: (cycle: BudgetCycle | null) => void;
  isViewingCurrentCycle: boolean;

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
    recurring_bill_id?: string;
    repeat_frequency?: BillFrequency;
    repeat_due_day?: number;
    repeat_end_type?: RecurrenceEndType;
    repeat_end_occurrences?: number;
    repeat_end_date?: string;
    reminder_enabled?: boolean;
  }) => Promise<void>;
  updateTransaction: (params: {
    id: string;
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
    recurring_bill_id?: string | null;
    repeat_frequency?: BillFrequency;
    repeat_due_day?: number;
    repeat_end_type?: RecurrenceEndType;
    repeat_end_occurrences?: number;
    repeat_end_date?: string;
    reminder_enabled?: boolean;
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
  restoreDefaultCategories: () => Promise<void>;

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

  // Security & App Lock
  isAppLocked: boolean;
  unlockApp: () => void;
  lockApp: () => void;
  setAppLock: (pin: string, enableBiometrics?: boolean) => Promise<boolean>;
  disableAppLock: () => Promise<boolean>;
  verifyAppPin: (pin: string) => Promise<boolean>;
  authenticateBiometrics: () => Promise<boolean>;

  exportBackup: (passphrase?: string) => Promise<boolean>;
  importBackup: (passphrase?: string) => Promise<{ success: boolean; message: string; requiresPassphrase?: boolean; incorrectPassphrase?: boolean }>;
  pickBackupFile: () => Promise<{ canceled: boolean; content?: string; isEncrypted?: boolean; fileName?: string; error?: string }>;
  restoreBackupContent: (content: string, passphrase?: string) => Promise<{ success: boolean; message: string; requiresPassphrase?: boolean; incorrectPassphrase?: boolean }>;
  requestNotificationPermissions: () => Promise<boolean>;
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
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [selectedTransactionIdForCalendar, setSelectedTransactionIdForCalendar] = useState<string | null>(null);
  const [selectedCalendarCycle, setSelectedCalendarCycle] = useState<BudgetCycle | null>(null);
  const [selectedAnalyticsCycle, setSelectedAnalyticsCycle] = useState<BudgetCycle | null>(null);

  const isViewingCurrentCycle = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (!selectedCalendarCycle) return true;
    return todayStr >= selectedCalendarCycle.start_date && todayStr <= selectedCalendarCycle.end_date;
  }, [selectedCalendarCycle]);

  const openCycleModal = useCallback(() => setIsCycleModalOpen(true), []);
  const closeCycleModal = useCallback(() => setIsCycleModalOpen(false), []);

  const [settings, setSettings] = useState<AppSettings>({
    base_currency: 'TZS',
    theme_mode: 'light',
    app_name: 'just budget',
    cycle_mode: 'regular',
    cycle_balance_mode: 'accumulated',
    cycle_target_mode: 'inherit',
    cycle_month_start_day: 1,
    app_lock_enabled: false,
    biometrics_enabled: false,
    data_encryption_enabled: false,
    notifications_enabled: true,
    bill_reminders_enabled: true,
    daily_allowance_reminder_enabled: false,
    evening_reminder_enabled: false,
    daily_reminder_time: '08:30',
    evening_reminder_time: '20:30',
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAppLocked, setIsAppLocked] = useState<boolean>(false);
  const hasInitializedLockRef = useRef<boolean>(false);
  const lastBackgroundTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background') {
        lastBackgroundTimeRef.current = Date.now();
      } else if (nextAppState === 'active') {
        // Only lock if the app was left in the background for more than 15 minutes (900 seconds).
        // Regular app usage, switching between apps, or brief checks NEVER lock the app.
        const elapsed = lastBackgroundTimeRef.current ? (Date.now() - lastBackgroundTimeRef.current) / 1000 : 0;
        if (elapsed > 60 && settings.app_lock_enabled && settings.app_pin_hash) {
          setIsAppLocked(true);
        }
      }
    });
    return () => {
      subscription.remove();
    };
  }, [settings.app_lock_enabled, settings.app_pin_hash]);

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
        base_currency: sMap['base_currency'] || 'TZS',
        theme_mode: (sMap['theme_mode'] as any) || 'light',
        app_name: sMap['app_name'] || 'just budget',
        onboarding_completed: sMap['onboarding_completed'] === '1',
        cycle_mode: (sMap['cycle_mode'] as any) || 'regular',
        cycle_balance_mode: (sMap['cycle_balance_mode'] as any) || 'accumulated',
        cycle_target_mode: (sMap['cycle_target_mode'] as any) || 'inherit',
        cycle_month_start_day: sMap['cycle_month_start_day'] ? parseInt(sMap['cycle_month_start_day'], 10) : 1,
        cycle_default_budget: sMap['cycle_default_budget'] ? parseFloat(sMap['cycle_default_budget']) : undefined,
        cycle_default_income: sMap['cycle_default_income'] ? parseFloat(sMap['cycle_default_income']) : undefined,
        app_lock_enabled: sMap['app_lock_enabled'] === '1',
        biometrics_enabled: sMap['biometrics_enabled'] === '1',
        app_pin_hash: sMap['app_pin_hash'] || undefined,
        data_encryption_enabled: sMap['data_encryption_enabled'] === '1',
        notifications_enabled: sMap['notifications_enabled'] !== '0',
        bill_reminders_enabled: sMap['bill_reminders_enabled'] !== '0',
        daily_allowance_reminder_enabled: sMap['daily_allowance_reminder_enabled'] === '1',
        evening_reminder_enabled: sMap['evening_reminder_enabled'] === '1',
        daily_reminder_time: sMap['daily_reminder_time'] || '08:30',
        evening_reminder_time: sMap['evening_reminder_time'] || '20:30',
      };
      setSettings(newSettings);

      // Ensure default wallets, expense categories, and income categories
      ensureDefaultWallets(db, newSettings.base_currency);
      ensureDefaultExpenseCategories(db);
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

      const now = new Date();
      const localTodayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // In regular mode, always ensure the active cycle corresponds to today's regular cycle dates
      if (newSettings.cycle_mode === 'regular') {
        const reg = getRegularCycleDates(newSettings.cycle_month_start_day || 1, now);
        const regId = `cycle-reg-${reg.startDate}`;

        if (!cycle || cycle.start_date !== reg.startDate || cycle.end_date !== reg.endDate) {
          let regCycle = db.getFirstSync<BudgetCycle>(
            `SELECT * FROM budget_cycles WHERE (start_date = ? AND end_date = ?) OR id = ? LIMIT 1`,
            [reg.startDate, reg.endDate, regId]
          );

          db.runSync(`UPDATE budget_cycles SET is_active = 0`);
          if (regCycle) {
            db.runSync(`UPDATE budget_cycles SET is_active = 1 WHERE id = ?`, [regCycle.id]);
            cycle = { ...regCycle, is_active: true };
          } else {
            const bVal = newSettings.cycle_default_budget ?? null;
            const iVal = newSettings.cycle_default_income ?? null;
            db.runSync(
              `INSERT OR REPLACE INTO budget_cycles (id, name, start_date, end_date, target_budget, target_income, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
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
      } else {
        // Custom mode: if no active cycle or currently active cycle has expired, check if a cycle covers today
        if (!cycle || cycle.end_date < localTodayStr) {
          const coveringCycle = db.getFirstSync<BudgetCycle>(
            `SELECT * FROM budget_cycles WHERE start_date <= ? AND end_date >= ? ORDER BY start_date DESC LIMIT 1`,
            [localTodayStr, localTodayStr]
          );
          if (coveringCycle) {
            db.runSync(`UPDATE budget_cycles SET is_active = 0`);
            db.runSync(`UPDATE budget_cycles SET is_active = 1 WHERE id = ?`, [coveringCycle.id]);
            cycle = { ...coveringCycle, is_active: true };
          } else if (!cycle) {
            cycle = db.getFirstSync<BudgetCycle>(`SELECT * FROM budget_cycles ORDER BY start_date DESC LIMIT 1`);
          }
        }
      }

      // If no active cycle exists and onboarding completed, initialize with regular cycle dates
      if (!cycle && newSettings.onboarding_completed) {
        const reg = getRegularCycleDates(newSettings.cycle_month_start_day || 1, now);
        const regId = `cycle-reg-${reg.startDate}`;
        const bVal = newSettings.cycle_default_budget ?? null;
        const iVal = newSettings.cycle_default_income ?? null;
        db.runSync(
          `INSERT OR REPLACE INTO budget_cycles (id, name, start_date, end_date, target_budget, target_income, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
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

      // Re-sync allCycles with the latest is_active status
      const updatedCycleRows = db.getAllSync<BudgetCycle>(`SELECT * FROM budget_cycles ORDER BY start_date DESC`);
      setAllCycles(updatedCycleRows.map((c) => ({ ...c, is_active: Boolean(c.is_active) })));

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
      const parsedBills = billsRows.map((b) => ({
        ...b,
        reminder_enabled: Boolean(b.reminder_enabled),
        is_active: Boolean(b.is_active),
      }));
      setRecurringBills(parsedBills);

      // Sync offline reminders (due bills, daily allowance & evening check-in)
      syncAllRemindersAsync({ settings: newSettings, recurringBills: parsedBills }).catch((err) => {
        console.warn('Reminder sync notice:', err);
      });

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

        // Lock check ONLY on cold app launch
        if (!hasInitializedLockRef.current) {
          hasInitializedLockRef.current = true;
          const db = getDB();
          const lockRow = db.getFirstSync<{ value: string }>(`SELECT value FROM settings WHERE key = 'app_lock_enabled'`);
          const pinRow = db.getFirstSync<{ value: string }>(`SELECT value FROM settings WHERE key = 'app_pin_hash'`);
          if (lockRow?.value === '1' && pinRow?.value) {
            setIsAppLocked(true);
          }
        }

        // Prompt for notification permission on startup if notifications are active
        try {
          const db = getDB();
          const notifRow = db.getFirstSync<{ value: string }>(`SELECT value FROM settings WHERE key = 'notifications_enabled'`);
          if (notifRow?.value !== '0') {
            await requestNotificationPermissionsAsync();
          }
        } catch (e) {
          console.warn('Initial notification permission prompt error:', e);
        }
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

    // Days difference between end date (midnight) and today (midnight)
    const msDiff = end.getTime() - todayDateOnly.getTime();
    const diffDays = Math.round(msDiff / (1000 * 60 * 60 * 24));

    const isPast = todayDateOnly.getTime() > end.getTime();
    const isFuture = todayDateOnly.getTime() < start.getTime();

    // Actual remaining days in cycle:
    // e.g. In Nov 1 to Nov 30: on Nov 3, diffDays is 27 (27 days left).
    // On Nov 30 (last day): diffDays is 0 (0 days left / Ends today).
    // If cycle is past: 0 days left (isEnded: true).
    // If cycle is future: totalDays left.
    const daysRemaining = isPast ? 0 : isFuture ? totalDays : Math.max(0, diffDays);

    // Day index (1-based: e.g. Day 1 on Nov 1, Day 3 on Nov 3)
    const dayIndex = isPast
      ? totalDays
      : isFuture
      ? 1
      : Math.min(
          totalDays,
          Math.max(1, Math.round((todayDateOnly.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)
        );

    // Spent today in app currency
    const todayExpenses = transactions
      .filter((t) => t.type === 'expense' && t.date === todayStr)
      .reduce((sum, t) => sum + (t.amount || t.base_amount || 0), 0);

    const curr = settings.base_currency || 'TZS';
    const targetBudget = currentCycle?.target_budget ?? 0;
    const hasTargetBudget = targetBudget > 0;
    const isBudgetOver = hasTargetBudget && spentInCycle > targetBudget;
    const budgetOverAmount = isBudgetOver ? spentInCycle - targetBudget : 0;

    // Daily Allowance ("Available for Day") formula:
    // Pool is divided by the number of daily spending buckets remaining including today (minimum 1 bucket)
    const daysForAllowance = Math.max(1, isPast ? 1 : diffDays + 1);

    let availableForDay = 0;
    let remainingToday = 0;
    let isOverDaily = false;
    let status: DailyAllowanceStatus = 'normal';
    let headlineLabel = 'AVAILABLE FOR TODAY';
    let badgeLabel: string | undefined = undefined;
    let subText = '';

    if (hasTargetBudget) {
      if (isBudgetOver) {
        status = 'budget_over';
        headlineLabel = 'BUDGET OVERSPENT';
        badgeLabel = 'Over Budget';
        availableForDay = 0;
        remainingToday = -budgetOverAmount;
        isOverDaily = true;
        subText = totalConvertedBalance > 0
          ? `Over cap by ${formatCurrency(budgetOverAmount, curr)} • Wallet has ${formatCurrency(totalConvertedBalance, curr)}`
          : `Over cap by ${formatCurrency(budgetOverAmount, curr)} • Wallet empty`;
      } else {
        const pool = Math.max(0, (targetBudget - spentInCycle) + todayExpenses);
        availableForDay = daysForAllowance > 0 ? pool / daysForAllowance : 0;
        remainingToday = availableForDay - todayExpenses;
        isOverDaily = todayExpenses > availableForDay;

        if (isOverDaily) {
          status = 'over_daily';
          headlineLabel = 'OVERSPENT TODAY';
          badgeLabel = 'Exceeded';
          const overToday = Math.abs(remainingToday);
          const remainingCycle = Math.max(0, targetBudget - spentInCycle);
          subText = `Over daily limit by ${formatCurrency(overToday, curr)} • ${formatCurrency(remainingCycle, curr)} left in cycle`;
        } else {
          status = 'normal';
          headlineLabel = 'AVAILABLE FOR TODAY';
          badgeLabel = undefined;
          subText = todayExpenses > 0
            ? `${formatCurrency(todayExpenses, curr)} spent today of ${formatCurrency(availableForDay, curr)} limit`
            : `Daily allowance: ${formatCurrency(availableForDay, curr)}`;
        }
      }
    } else {
      // No budget set: App is running on actual wallet
      const walletPool = Math.max(0, totalConvertedBalance + todayExpenses);
      if (totalConvertedBalance <= 0) {
        status = 'wallet_empty';
        headlineLabel = 'WALLET DEPLETED';
        badgeLabel = 'No Budget • Wallet Empty';
        availableForDay = 0;
        remainingToday = totalConvertedBalance;
        isOverDaily = todayExpenses > 0;
        subText = 'Running on actual wallet • No funds available';
      } else {
        availableForDay = daysForAllowance > 0 ? walletPool / daysForAllowance : 0;
        remainingToday = availableForDay - todayExpenses;
        isOverDaily = todayExpenses > availableForDay;

        if (isOverDaily) {
          status = 'wallet_over_daily';
          headlineLabel = "OVER TODAY'S PACE";
          badgeLabel = 'From Wallet';
          const overToday = Math.abs(remainingToday);
          subText = `Over pace by ${formatCurrency(overToday, curr)} • Wallet: ${formatCurrency(totalConvertedBalance, curr)}`;
        } else {
          status = 'wallet_normal';
          headlineLabel = 'AVAILABLE FOR TODAY';
          badgeLabel = 'From Wallet';
          subText = todayExpenses > 0
            ? `Wallet pace: ${formatCurrency(availableForDay, curr)} • ${formatCurrency(todayExpenses, curr)} spent today`
            : `Paced across ${daysRemaining} days • Wallet: ${formatCurrency(totalConvertedBalance, curr)}`;
        }
      }
    }

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
      isOverDaily,
      hasBudget: hasTargetBudget,
      dailyAverage,
      isEnded: isPast,
      isBudgetOver,
      budgetOverAmount,
      walletBalance: totalConvertedBalance,
      status,
      headlineLabel,
      badgeLabel,
      subText,
    };
  }, [currentCycle, transactions, remainingCycleBalance, spentInCycle, totalConvertedBalance, settings.base_currency]);

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
    recurring_bill_id?: string;
    repeat_frequency?: BillFrequency;
    repeat_due_day?: number;
    repeat_end_type?: RecurrenceEndType;
    repeat_end_occurrences?: number;
    repeat_end_date?: string;
    reminder_enabled?: boolean;
  }) => {
    const db = getDB();
    const id = `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const txCurrency = params.currency || settings.base_currency;
    const isPaid = params.is_paid !== false;

    db.withTransactionSync(() => {
      let finalBillId = params.recurring_bill_id || null;

      // If user enabled recurring commitment and no existing bill linked, create recurring_bill
      if (params.repeat_frequency && !finalBillId) {
        finalBillId = `bill-${Date.now()}`;
        const selectedCat = categories.find((c) => c.id === params.category_id);
        const billName =
          params.note || selectedCat?.name || (params.type === 'income' ? 'Recurring Income' : 'Recurring Bill');
        const dueDay =
          params.repeat_due_day !== undefined
            ? params.repeat_due_day
            : (parseInt(params.date.slice(8, 10), 10) || 1);

        db.runSync(
          `INSERT INTO recurring_bills (id, name, amount, currency, frequency, type, due_day, next_due_date, category_id, wallet_id, reminder_enabled, is_active, end_type, end_occurrences, end_date, occurrences_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 0, ?)`,
          [
            finalBillId,
            billName,
            params.amount,
            txCurrency,
            params.repeat_frequency,
            params.type === 'income' ? 'income' : 'expense',
            dueDay,
            params.date,
            params.category_id || null,
            params.wallet_id,
            params.reminder_enabled !== false ? 1 : 0,
            params.repeat_end_type || 'never',
            params.repeat_end_occurrences || null,
            params.repeat_end_date || null,
            new Date().toISOString(),
          ]
        );
      }

      db.runSync(
        `INSERT INTO transactions (id, wallet_id, category_id, subcategory_id, type, amount, currency, base_amount, date, time, is_paid, media_uri, note, to_wallet_id, recurring_bill_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          finalBillId,
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

  const updateTransaction = async (params: {
    id: string;
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
    recurring_bill_id?: string | null;
    repeat_frequency?: BillFrequency;
    repeat_due_day?: number;
    repeat_end_type?: RecurrenceEndType;
    repeat_end_occurrences?: number;
    repeat_end_date?: string;
    reminder_enabled?: boolean;
  }) => {
    const db = getDB();
    const tx = transactions.find((t) => t.id === params.id);
    if (!tx) return;

    const isOldPaid = tx.is_paid !== false;
    const isNewPaid = params.is_paid !== false;
    const newCurrency = params.currency || tx.currency || settings.base_currency;

    db.withTransactionSync(() => {
      // Manage recurring bill association
      let updatedBillId =
        params.recurring_bill_id !== undefined ? params.recurring_bill_id : (tx.recurring_bill_id || null);

      if (params.repeat_frequency) {
        const selectedCat = categories.find((c) => c.id === params.category_id);
        const billName =
          params.note || selectedCat?.name || (params.type === 'income' ? 'Recurring Income' : 'Recurring Bill');
        const dueDay =
          params.repeat_due_day !== undefined
            ? params.repeat_due_day
            : (parseInt(params.date.slice(8, 10), 10) || 1);

        if (updatedBillId) {
          // Update existing recurring bill
          db.runSync(
            `UPDATE recurring_bills SET name = ?, amount = ?, currency = ?, frequency = ?, type = ?, due_day = ?, next_due_date = ?, category_id = ?, wallet_id = ?, reminder_enabled = ?, end_type = ?, end_occurrences = ?, end_date = ? WHERE id = ?`,
            [
              billName,
              params.amount,
              newCurrency,
              params.repeat_frequency,
              params.type === 'income' ? 'income' : 'expense',
              dueDay,
              params.date,
              params.category_id || null,
              params.wallet_id,
              params.reminder_enabled !== false ? 1 : 0,
              params.repeat_end_type || 'never',
              params.repeat_end_occurrences || null,
              params.repeat_end_date || null,
              updatedBillId,
            ]
          );
        } else {
          // Create new recurring bill
          updatedBillId = `bill-${Date.now()}`;
          db.runSync(
            `INSERT INTO recurring_bills (id, name, amount, currency, frequency, type, due_day, next_due_date, category_id, wallet_id, reminder_enabled, is_active, end_type, end_occurrences, end_date, occurrences_count, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 0, ?)`,
            [
              updatedBillId,
              billName,
              params.amount,
              newCurrency,
              params.repeat_frequency,
              params.type === 'income' ? 'income' : 'expense',
              dueDay,
              params.date,
              params.category_id || null,
              params.wallet_id,
              params.reminder_enabled !== false ? 1 : 0,
              params.repeat_end_type || 'never',
              params.repeat_end_occurrences || null,
              params.repeat_end_date || null,
              new Date().toISOString(),
            ]
          );
        }
      } else if (params.repeat_frequency === undefined && (params.recurring_bill_id === null || params.recurring_bill_id === '')) {
        // Explicitly disabled recurrence
        if (updatedBillId) {
          db.runSync(`DELETE FROM recurring_bills WHERE id = ?`, [updatedBillId]);
          updatedBillId = null;
        }
      }

      // 1. Revert old balance effect (if old was paid)
      if (isOldPaid) {
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

      // 2. Update transaction row
      const nowIso = new Date().toISOString();
      db.runSync(
        `UPDATE transactions SET
           wallet_id = ?,
           category_id = ?,
           subcategory_id = ?,
           type = ?,
           amount = ?,
           currency = ?,
           base_amount = ?,
           date = ?,
           time = ?,
           is_paid = ?,
           media_uri = ?,
           note = ?,
           to_wallet_id = ?,
           recurring_bill_id = ?,
           updated_at = ?
         WHERE id = ?`,
        [
          params.wallet_id,
          params.category_id || null,
          params.subcategory_id || null,
          params.type,
          params.amount,
          newCurrency,
          params.amount,
          params.date,
          params.time || null,
          isNewPaid ? 1 : 0,
          params.media_uri || null,
          params.note || null,
          params.to_wallet_id || null,
          updatedBillId,
          nowIso,
          params.id,
        ]
      );

      // 3. Apply new balance effect (if new is paid)
      if (isNewPaid) {
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
          db.runSync(`UPDATE wallets SET current_balance = current_balance - ? WHERE id = ?`, [
            params.amount,
            params.wallet_id,
          ]);
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

  const restoreDefaultCategories = async () => {
    const db = getDB();
    restoreAllDefaultCategories(db);
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
    // 1. Record transaction (expense or income)
    await addTransaction({
      wallet_id: bill.wallet_id,
      category_id: bill.category_id || undefined,
      type: bill.type === 'income' ? 'income' : 'expense',
      amount: bill.amount,
      currency: bill.currency,
      date: new Date().toISOString().slice(0, 10),
      note: `${bill.type === 'income' ? 'Income Received' : 'Bill Paid'}: ${bill.name}`,
      recurring_bill_id: bill.id,
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
      const existing = db.getFirstSync<{ id: string }>(`SELECT id FROM budget_cycles WHERE id = ?`, [params.id]);
      if (existing) {
        db.runSync(
          `UPDATE budget_cycles SET name = ?, start_date = ?, end_date = ?, target_budget = ?, target_income = ? WHERE id = ?`,
          [params.name, params.start_date, params.end_date, params.target_budget ?? null, params.target_income ?? null, params.id]
        );
      } else {
        db.runSync(`UPDATE budget_cycles SET is_active = 0`);
        db.runSync(
          `INSERT INTO budget_cycles (id, name, start_date, end_date, target_budget, target_income, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [params.id, params.name, params.start_date, params.end_date, params.target_budget ?? null, params.target_income ?? null]
        );
      }
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
    const db = getDB();
    if (!currentCycle) {
      const reg = getRegularCycleDates(settings.cycle_month_start_day || 1);
      const regId = `cycle-reg-${reg.startDate}`;
      const targetB = type === 'budget' ? amount : null;
      const targetI = type === 'income' ? amount : null;
      db.runSync(
        `INSERT OR REPLACE INTO budget_cycles (id, name, start_date, end_date, target_budget, target_income, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [regId, reg.name, reg.startDate, reg.endDate, targetB, targetI]
      );
    } else {
      if (type === 'budget') {
        db.runSync(`UPDATE budget_cycles SET target_budget = ? WHERE id = ?`, [amount, currentCycle.id]);
      } else {
        db.runSync(`UPDATE budget_cycles SET target_income = ? WHERE id = ?`, [amount, currentCycle.id]);
      }
    }
    // Sync default targets so future cycles inherit this setting
    if (settings.cycle_mode === 'regular') {
      if (type === 'budget') {
        db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('cycle_default_budget', ?)`, [amount.toString()]);
      } else {
        db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('cycle_default_income', ?)`, [amount.toString()]);
      }
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
    if (newSettings.app_lock_enabled !== undefined) {
      db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('app_lock_enabled', ?)`, [newSettings.app_lock_enabled ? '1' : '0']);
    }
    if (newSettings.biometrics_enabled !== undefined) {
      db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('biometrics_enabled', ?)`, [newSettings.biometrics_enabled ? '1' : '0']);
    }
    if (newSettings.app_pin_hash !== undefined) {
      db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('app_pin_hash', ?)`, [newSettings.app_pin_hash]);
    }
    if (newSettings.data_encryption_enabled !== undefined) {
      db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('data_encryption_enabled', ?)`, [newSettings.data_encryption_enabled ? '1' : '0']);
    }
    if (newSettings.notifications_enabled !== undefined) {
      db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('notifications_enabled', ?)`, [newSettings.notifications_enabled ? '1' : '0']);
    }
    if (newSettings.bill_reminders_enabled !== undefined) {
      db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('bill_reminders_enabled', ?)`, [newSettings.bill_reminders_enabled ? '1' : '0']);
    }
    if (newSettings.daily_allowance_reminder_enabled !== undefined) {
      db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('daily_allowance_reminder_enabled', ?)`, [newSettings.daily_allowance_reminder_enabled ? '1' : '0']);
    }
    if (newSettings.evening_reminder_enabled !== undefined) {
      db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('evening_reminder_enabled', ?)`, [newSettings.evening_reminder_enabled ? '1' : '0']);
    }
    if (newSettings.daily_reminder_time !== undefined) {
      db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('daily_reminder_time', ?)`, [newSettings.daily_reminder_time]);
    }
    if (newSettings.evening_reminder_time !== undefined) {
      db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('evening_reminder_time', ?)`, [newSettings.evening_reminder_time]);
    }
    await loadData();
  };

  const requestNotificationPermissions = async (): Promise<boolean> => {
    return await requestNotificationPermissionsAsync();
  };

  const updateAllWalletsCurrency = async (currency: string) => {
    const db = getDB();
    db.runSync(`UPDATE wallets SET currency = ?`, [currency]);
    db.runSync(`UPDATE recurring_bills SET currency = ?`, [currency]);
    db.runSync(`UPDATE transactions SET currency = ?`, [currency]);
    await loadData();
  };

  const unlockApp = useCallback(() => {
    setIsAppLocked(false);
  }, []);

  const lockApp = useCallback(() => {
    if (settings.app_lock_enabled && settings.app_pin_hash) {
      setIsAppLocked(true);
    }
  }, [settings.app_lock_enabled, settings.app_pin_hash]);

  const setAppLock = async (pin: string, enableBiometrics?: boolean): Promise<boolean> => {
    const pinHash = await hashPin(pin);
    await updateSettings({
      app_lock_enabled: true,
      app_pin_hash: pinHash,
      biometrics_enabled: Boolean(enableBiometrics),
    });
    return true;
  };

  const disableAppLock = async (): Promise<boolean> => {
    await updateSettings({
      app_lock_enabled: false,
      biometrics_enabled: false,
    });
    setIsAppLocked(false);
    return true;
  };

  const verifyAppPin = async (pin: string): Promise<boolean> => {
    if (!settings.app_pin_hash) return false;
    const valid = await verifyPin(pin, settings.app_pin_hash);
    if (valid) {
      setIsAppLocked(false);
    }
    return valid;
  };

  const authenticateBiometrics = async (): Promise<boolean> => {
    if (!settings.biometrics_enabled) return false;
    const success = await authenticateWithBiometrics('Unlock Just Budget');
    if (success) {
      setIsAppLocked(false);
    }
    return success;
  };

  const exportBackup = async (passphrase?: string): Promise<boolean> => {
    return await exportBackupData(passphrase);
  };

  const importBackup = async (passphrase?: string): Promise<{ success: boolean; message: string; requiresPassphrase?: boolean; incorrectPassphrase?: boolean }> => {
    const result = await importBackupData(passphrase);
    if (result.success) {
      await loadData();
    }
    return result;
  };

  const pickBackupFile = async () => {
    return await pickBackupFileAsync();
  };

  const restoreBackupContent = async (content: string, passphrase?: string) => {
    const result = await restoreFromBackupContentAsync(content, passphrase);
    if (result.success) {
      await loadData();
    }
    return result;
  };

  const completeOnboarding = async (params: {
    currency: string;
    firstWalletName?: string;
    startingBalance?: number;
    walletBalances?: Record<string, number>;
    budgetCap?: number;
    incomeGoal?: number;
    cycleMode?: 'regular' | 'custom';
    cycleMonthStartDay?: number;
    cycleBalanceMode?: 'monthly' | 'accumulated';
    customCycleStartDate?: string;
    customCycleEndDate?: string;
    customCycleName?: string;
  }) => {
    const db = getDB();
    const curr = params.currency || 'TZS';
    const cMode = params.cycleMode || 'regular';
    const cBalMode = params.cycleBalanceMode || 'accumulated';
    const cStartDay = params.cycleMonthStartDay || 1;

    db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('base_currency', ?)`, [curr]);
    db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('onboarding_completed', '1')`);
    db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('cycle_mode', ?)`, [cMode]);
    db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('cycle_balance_mode', ?)`, [cBalMode]);
    db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('cycle_month_start_day', ?)`, [cStartDay.toString()]);

    // Ensure default wallets and sync currency
    ensureDefaultWallets(db, curr);
    db.runSync(`UPDATE wallets SET currency = ?`, [curr]);

    // Apply starting balances for each wallet configured during onboarding
    if (params.walletBalances && Object.keys(params.walletBalances).length > 0) {
      for (const [wName, bal] of Object.entries(params.walletBalances)) {
        const trimmed = wName.trim();
        if (!trimmed) continue;
        const balNum = typeof bal === 'number' && !isNaN(bal) ? Math.max(0, bal) : 0;
        const existing = db.getFirstSync<{ id: string }>(
          `SELECT id FROM wallets WHERE LOWER(name) = LOWER(?)`,
          [trimmed]
        );
        if (existing) {
          db.runSync(
            `UPDATE wallets SET starting_balance = ?, current_balance = ? WHERE id = ?`,
            [balNum, balNum, existing.id]
          );
        } else if (balNum > 0) {
          const wId = `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          db.runSync(
            `INSERT INTO wallets (id, name, currency, starting_balance, current_balance, color, icon, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
            [wId, trimmed, curr, balNum, balNum, '#10B981', 'cash']
          );
        }
      }
    } else if (params.firstWalletName && params.firstWalletName.trim()) {
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

    // Set up initial cycle
    const targetB = params.budgetCap !== undefined && params.budgetCap > 0 ? params.budgetCap : null;
    const targetI = params.incomeGoal !== undefined && params.incomeGoal > 0 ? params.incomeGoal : null;
    db.runSync(`UPDATE budget_cycles SET is_active = 0`);

    if (cMode === 'custom' && params.customCycleStartDate && params.customCycleEndDate) {
      const cId = `cycle-custom-${Date.now()}`;
      const cName = params.customCycleName || formatCycleDateRange(params.customCycleStartDate, params.customCycleEndDate);
      db.runSync(
        `INSERT OR REPLACE INTO budget_cycles (id, name, start_date, end_date, target_budget, target_income, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [cId, cName, params.customCycleStartDate, params.customCycleEndDate, targetB, targetI]
      );
    } else {
      const reg = getRegularCycleDates(cStartDay);
      const regId = `cycle-reg-${reg.startDate}`;
      db.runSync(
        `INSERT OR REPLACE INTO budget_cycles (id, name, start_date, end_date, target_budget, target_income, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [regId, reg.name, reg.startDate, reg.endDate, targetB, targetI]
      );
    }

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
        selectedCalendarDate,
        setSelectedCalendarDate,
        selectedTransactionIdForCalendar,
        setSelectedTransactionIdForCalendar,
        selectedCalendarCycle,
        setSelectedCalendarCycle,
        selectedAnalyticsCycle,
        setSelectedAnalyticsCycle,
        isViewingCurrentCycle,
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
        updateTransaction,
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
        restoreDefaultCategories,
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
        isAppLocked,
        unlockApp,
        lockApp,
        setAppLock,
        disableAppLock,
        verifyAppPin,
        authenticateBiometrics,
        exportBackup,
        importBackup,
        pickBackupFile,
        restoreBackupContent,
        requestNotificationPermissions,
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
