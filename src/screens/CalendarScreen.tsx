import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  PanResponder,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Animated,
  Pressable,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBudget } from '../context/BudgetContext';
import { lightTheme, darkTheme, M3Shape, M3Elevation } from '../theme';
import { formatCurrency, formatCycleDateRange, getRegularCycleDates } from '../utils/format';
import { DateRangePickerModal } from '../components/DateRangePickerModal';
import { CycleModeSwitcherModal } from '../components/CycleModeSwitcherModal';
import { TransactionDetailModal } from '../components/TransactionDetailModal';
import { TransactionDetailsModal } from '../components/TransactionDetailsModal';
import { CategoryPickerSheet } from '../components/CategoryPickerSheet';
import { Transaction, BudgetCycle, TransactionType } from '../types';

interface CalendarScreenProps {
  onNavigateTab?: (tab: any) => void;
}

export const CalendarScreen: React.FC<CalendarScreenProps> = ({ onNavigateTab }) => {
  const {
    settings,
    currentCycle,
    allCycles,
    updateBudgetCycle,
    setActiveBudgetCycle,
    updateSettings,
    openCycleModal,
    transactions,
    categories,
    wallets,
    remainingCycleBalance,
    spentInCycle,
    totalConvertedBalance,
    selectedCalendarDate,
    setSelectedCalendarDate,
    selectedTransactionIdForCalendar,
    setSelectedTransactionIdForCalendar,
    selectedCalendarCycle,
    setSelectedCalendarCycle,
    selectedAnalyticsCycle,
    setSelectedAnalyticsCycle,
    isViewingCurrentCycle,
    dailyAllowanceStats,
    overallBudgetLimit,
    updateTransaction,
    deleteTransaction,
    addTransaction,
    incomeInCycle,
    addSubcategory,
    setAnalyticsFocus,
  } = useBudget();

  const isDarkMode = settings.theme_mode === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Selected date on calendar (bound to global calendar date)
  const selectedDate = selectedCalendarDate;
  const setSelectedDate = setSelectedCalendarDate;

  // Floating Action Button (FAB) Speed-Dial & Add Transaction Modal states
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [addCategorySheetVisible, setAddCategorySheetVisible] = useState(false);
  const [addPrefilledCategoryId, setAddPrefilledCategoryId] = useState<string | undefined>(undefined);
  const [addPrefilledSubcategoryId, setAddPrefilledSubcategoryId] = useState<string | undefined>(undefined);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addModalType, setAddModalType] = useState<TransactionType>('expense');
  const fabAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(fabAnim, {
      toValue: isFabOpen ? 1 : 0,
      useNativeDriver: true,
      tension: 65,
      friction: 10,
    }).start();
  }, [isFabOpen]);

  const fabRotate = fabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const speedDialTranslateY = fabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  const speedDialScale = fabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });

  const speedDialOpacity = fabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const handleOpenAddFlow = (type: TransactionType) => {
    setIsFabOpen(false);
    setAddModalType(type);
    setAddPrefilledCategoryId(undefined);
    setAddPrefilledSubcategoryId(undefined);
    setAddCategorySheetVisible(true);
  };

  const handleCategorySelectedForAdd = ({
    categoryId,
    subcategoryId,
  }: {
    categoryId?: string;
    subcategoryId?: string;
  }) => {
    setAddPrefilledCategoryId(categoryId);
    setAddPrefilledSubcategoryId(subcategoryId);
    setAddCategorySheetVisible(false);
    setAddModalVisible(true);
  };

  const handleSaveNewTransaction = async (txData: {
    amount: number;
    wallet_id: string;
    category_id?: string;
    subcategory_id?: string;
    type: TransactionType;
    currency: string;
    date: string;
    time?: string;
    is_paid: boolean;
    note?: string;
    media_uri?: string;
  }) => {
    await addTransaction({
      wallet_id: txData.wallet_id || wallets[0]?.id || '',
      category_id: txData.category_id,
      subcategory_id: txData.subcategory_id,
      type: txData.type,
      amount: txData.amount,
      currency: txData.currency,
      date: txData.date,
      time: txData.time,
      is_paid: txData.is_paid,
      note: txData.note,
      media_uri: txData.media_uri,
    });
    setAddModalVisible(false);
  };

  // Transaction Detail & Edit Modal states
  const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // Auto-open transaction detail if navigating from home screen history sheet
  useEffect(() => {
    if (selectedTransactionIdForCalendar) {
      const match = transactions.find((t) => t.id === selectedTransactionIdForCalendar);
      if (match) {
        setViewingTransaction(match);
      }
      setSelectedTransactionIdForCalendar(null);
    }
  }, [selectedTransactionIdForCalendar, transactions, setSelectedTransactionIdForCalendar]);

  const handleStartEdit = (tx: Transaction) => {
    setEditingTransaction(tx);
    setEditModalVisible(true);
  };

  const handleSaveEditedTransaction = async (txData: {
    amount: number;
    wallet_id: string;
    category_id?: string;
    subcategory_id?: string;
    type: any;
    currency: string;
    date: string;
    time?: string;
    is_paid: boolean;
    note?: string;
    media_uri?: string;
  }) => {
    if (!editingTransaction) return;

    await updateTransaction({
      id: editingTransaction.id,
      amount: txData.amount,
      wallet_id: txData.wallet_id,
      category_id: txData.category_id,
      subcategory_id: txData.subcategory_id,
      type: txData.type,
      currency: txData.currency,
      date: txData.date,
      time: txData.time,
      is_paid: txData.is_paid,
      note: txData.note,
      media_uri: txData.media_uri,
    });

    // Keep viewing modal in sync with edited fields
    setViewingTransaction((prev) =>
      prev && prev.id === editingTransaction.id
        ? {
            ...prev,
            amount: txData.amount,
            wallet_id: txData.wallet_id,
            category_id: txData.category_id,
            subcategory_id: txData.subcategory_id,
            type: txData.type,
            currency: txData.currency,
            date: txData.date,
            time: txData.time,
            is_paid: txData.is_paid,
            note: txData.note,
            media_uri: txData.media_uri,
          }
        : prev
    );

    setEditModalVisible(false);
    setEditingTransaction(null);
  };

  // Visual Date Range Picker Modal State (connecting range polyline/band)
  const [dateRangePickerVisible, setDateRangePickerVisible] = useState<boolean>(false);

  const handleSaveDateRange = async (newStart: string, newEnd: string) => {
    await updateBudgetCycle({
      id: currentCycle?.id,
      name: currentCycle?.name || 'Budget Cycle',
      start_date: newStart,
      end_date: newEnd,
      target_budget: currentCycle?.target_budget,
      target_income: currentCycle?.target_income,
    });
  };

  // Shift Mode Switcher Modal (Tap active chip: shift between regular and custom, no editing)
  const [modeSwitcherVisible, setModeSwitcherVisible] = useState<boolean>(false);

  const isRegularMode = settings.cycle_mode === 'regular';
  const startDay = settings.cycle_month_start_day || 1;

  // Horizontal list of cycles based on active mode
  const cycleList = useMemo(() => {
    if (isRegularMode) {
      // REGULAR CALENDAR: Generate timeline of regular months based on startDay
      // Spanning past months through current to future coming months (-6 to +12 months)
      const list: BudgetCycle[] = [];
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      // Range: from 6 months ago to 12 months ahead
      for (let offset = -6; offset <= 12; offset++) {
        const d = new Date(currentYear, currentMonth + offset, startDay);
        const reg = getRegularCycleDates(startDay, d);
        const regId = `cycle-reg-${reg.startDate}`;

        // Match existing cycle record if available
        const existing = allCycles.find(
          (c) => c.id === regId || (c.start_date === reg.startDate && c.end_date === reg.endDate)
        );

        const isCurrent = now >= new Date(reg.startDate) && now <= new Date(reg.endDate);

        list.push({
          id: existing?.id || regId,
          name: existing?.name || reg.name,
          start_date: reg.startDate,
          end_date: reg.endDate,
          target_budget: existing?.target_budget ?? (settings.cycle_default_budget !== undefined ? Number(settings.cycle_default_budget) : undefined),
          target_income: existing?.target_income ?? (settings.cycle_default_income !== undefined ? Number(settings.cycle_default_income) : undefined),
          is_active: isCurrent,
        });
      }

      return list;
    } else {
      // CUSTOM PERIODS: ONLY show custom-created periods (exclude regular cycle records)
      const customOnly = (allCycles || []).filter((c) => !c.id.startsWith('cycle-reg-'));
      return customOnly.sort((a, b) => a.start_date.localeCompare(b.start_date));
    }
  }, [
    isRegularMode,
    startDay,
    allCycles,
    settings.cycle_default_budget,
    settings.cycle_default_income,
  ]);

  // Today's cycle (the cycle that actually contains today's date)
  const todayCycle = useMemo(() => {
    const match = cycleList.find((c) => todayStr >= c.start_date && todayStr <= c.end_date);
    if (match) return match;
    if (currentCycle && todayStr >= currentCycle.start_date && todayStr <= currentCycle.end_date) {
      return currentCycle;
    }
    const reg = getRegularCycleDates(startDay);
    return {
      id: `cycle-reg-${reg.startDate}`,
      name: reg.name,
      start_date: reg.startDate,
      end_date: reg.endDate,
      target_budget: settings.cycle_default_budget !== undefined ? Number(settings.cycle_default_budget) : undefined,
      target_income: settings.cycle_default_income !== undefined ? Number(settings.cycle_default_income) : undefined,
      is_active: true,
    };
  }, [cycleList, todayStr, currentCycle, startDay, settings.cycle_default_budget, settings.cycle_default_income]);

  // Effective cycle currently being displayed (defaults to today's cycle)
  const effectiveCycle = selectedCalendarCycle || todayCycle;

  // Active cycle date boundaries (for showing the WHOLE displayed cycle in the calendar)
  const activeCycleRange = useMemo(() => {
    if (effectiveCycle?.start_date && effectiveCycle?.end_date) {
      return {
        startDate: effectiveCycle.start_date,
        endDate: effectiveCycle.end_date,
        name: effectiveCycle.name || formatCycleDateRange(effectiveCycle.start_date, effectiveCycle.end_date),
      };
    }
    const reg = getRegularCycleDates(settings.cycle_month_start_day || 1);
    return {
      startDate: reg.startDate,
      endDate: reg.endDate,
      name: reg.name,
    };
  }, [effectiveCycle, settings.cycle_month_start_day]);

  const curr = settings.base_currency;

  // Format short date helper: e.g. "2 Nov"
  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d} ${monthNames[m - 1]}`;
  };

  // Focused cycle matching selectedDate (or falling back to effectiveCycle/todayCycle)
  const focusedCycle = useMemo(() => {
    const targetDate = selectedDate || todayStr;
    const match = cycleList.find(
      (c) => targetDate >= c.start_date && targetDate <= c.end_date
    );
    if (match) return match;
    const allMatch = allCycles.find(
      (c) => targetDate >= c.start_date && targetDate <= c.end_date
    );
    if (allMatch) return allMatch;
    return effectiveCycle || todayCycle;
  }, [selectedDate, todayStr, cycleList, allCycles, effectiveCycle, todayCycle]);

  // Target Cards & Balance calculations dynamically filtered to the focused date (at end of that day)
  const focusedValues = useMemo(() => {
    const targetDate = selectedDate || todayStr;
    const isPast = targetDate < todayStr;
    const isToday = targetDate === todayStr;
    const cycle = focusedCycle;

    // 1. Target Budget & Expenses up to targetDate
    const cycleCap =
      cycle?.target_budget ??
      (settings.cycle_default_budget !== undefined
        ? Number(settings.cycle_default_budget)
        : overallBudgetLimit);
    const hasTarget = cycleCap > 0;

    const spentUpToDate = transactions
      .filter(
        (t) =>
          t.type === 'expense' &&
          t.date >= cycle.start_date &&
          t.date <= targetDate
      )
      .reduce((sum, t) => sum + (t.base_amount || t.amount || 0), 0);

    const expensePercent = hasTarget ? Math.round((spentUpToDate / cycleCap) * 100) : 0;
    const isOverBudget = hasTarget && spentUpToDate > cycleCap;
    const expenseRemaining = Math.max(0, cycleCap - spentUpToDate);
    const expenseOverBy = Math.max(0, spentUpToDate - cycleCap);

    // 2. Income Goal & Income up to targetDate
    const cycleGoal =
      cycle?.target_income && cycle.target_income > 0
        ? cycle.target_income
        : settings.cycle_default_income !== undefined
        ? Number(settings.cycle_default_income)
        : 0;
    const hasGoal = cycleGoal > 0;

    const incomeUpToDate = transactions
      .filter(
        (t) =>
          t.type === 'income' &&
          t.date >= cycle.start_date &&
          t.date <= targetDate
      )
      .reduce((sum, t) => sum + (t.base_amount || t.amount || 0), 0);

    const incomePercent = hasGoal ? Math.round((incomeUpToDate / cycleGoal) * 100) : 0;
    const isIncomeReached = hasGoal && incomeUpToDate >= cycleGoal;
    const incomeRemaining = Math.max(0, cycleGoal - incomeUpToDate);

    // 3. Wallet Balance as of the end of targetDate
    const txsAfterDate = transactions.filter((t) => t.date > targetDate);
    const spentAfter = txsAfterDate
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + (t.base_amount || t.amount || 0), 0);
    const incomeAfter = txsAfterDate
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + (t.base_amount || t.amount || 0), 0);
    const walletBalanceAtEndOfDate = totalConvertedBalance + spentAfter - incomeAfter;

    // 4. Daily Allowance / Available at end of targetDate
    let availableAmount = dailyAllowanceStats.remainingToday;
    let daysRemaining = dailyAllowanceStats.daysRemaining;
    if (isPast) {
      const [sy, sm, sd] = cycle.start_date.split('-').map(Number);
      const [ey, em, ed] = cycle.end_date.split('-').map(Number);
      const [fy, fm, fd] = targetDate.split('-').map(Number);
      const cycleEnd = new Date(ey, em - 1, ed, 0, 0, 0);
      const focDateObj = new Date(fy, fm - 1, fd, 0, 0, 0);

      const diffDays = Math.round((cycleEnd.getTime() - focDateObj.getTime()) / 86400000);
      const daysForAllowance = Math.max(1, diffDays + 1);
      daysRemaining = Math.max(0, diffDays);

      const spentBefore = transactions
        .filter(
          (t) =>
            t.type === 'expense' &&
            t.date >= cycle.start_date &&
            t.date < targetDate
        )
        .reduce((sum, t) => sum + (t.base_amount || t.amount || 0), 0);

      const spentOnDate = transactions
        .filter((t) => t.type === 'expense' && t.date === targetDate)
        .reduce((sum, t) => sum + (t.base_amount || t.amount || 0), 0);

      const poolAtStart = hasTarget
        ? Math.max(0, cycleCap - spentBefore)
        : Math.max(0, walletBalanceAtEndOfDate + spentOnDate);

      const dailyAllowance = daysForAllowance > 0 ? poolAtStart / daysForAllowance : 0;
      availableAmount = dailyAllowance - spentOnDate;
    }

    return {
      targetDate,
      isPast,
      isToday,
      cycle,
      availableAmount,
      daysRemaining,
      walletBalance: isToday ? totalConvertedBalance : walletBalanceAtEndOfDate,
      spentUpToDate,
      cycleCap,
      hasTarget,
      expensePercent,
      isOverBudget,
      expenseRemaining,
      expenseOverBy,
      incomeUpToDate,
      cycleGoal,
      hasGoal,
      incomePercent,
      isIncomeReached,
      incomeRemaining,
    };
  }, [
    selectedDate,
    todayStr,
    focusedCycle,
    settings,
    overallBudgetLimit,
    transactions,
    totalConvertedBalance,
    dailyAllowanceStats.remainingToday,
  ]);

  const effectiveSpent = focusedValues.spentUpToDate;
  const effectiveIncome = focusedValues.incomeUpToDate;

  // Target Cards Progress (replacing docked balance breakdown with HomeScreen top header target cards)
  const expenseSwitcherProgress = useMemo(() => {
    return {
      hasTarget: focusedValues.hasTarget,
      percent: focusedValues.expensePercent,
      isOver: focusedValues.isOverBudget,
      remaining: focusedValues.expenseRemaining,
      overBy: focusedValues.expenseOverBy,
      badgeText: focusedValues.hasTarget
        ? focusedValues.isOverBudget
          ? `⚠️ ${focusedValues.expensePercent}%`
          : `${focusedValues.expensePercent}%`
        : '+ Set Cap',
      subText: focusedValues.hasTarget
        ? focusedValues.isOverBudget
          ? `⚠️ ${formatCurrency(focusedValues.expenseOverBy, curr)} over`
          : `Cap: ${formatCurrency(focusedValues.cycleCap, curr)}`
        : 'Tap to set budget cap',
    };
  }, [focusedValues, curr]);

  const incomeSwitcherProgress = useMemo(() => {
    return {
      hasGoal: focusedValues.hasGoal,
      goal: focusedValues.cycleGoal,
      percent: focusedValues.incomePercent,
      isReached: focusedValues.isIncomeReached,
      remaining: focusedValues.incomeRemaining,
      badgeText: focusedValues.hasGoal
        ? focusedValues.isIncomeReached
          ? '🎉 100%'
          : `${focusedValues.incomePercent}%`
        : '+ Set Goal',
      subText: focusedValues.hasGoal
        ? focusedValues.isIncomeReached
          ? '🎉 Goal reached'
          : `Goal: ${formatCurrency(focusedValues.cycleGoal, curr)}`
        : 'Tap to set income goal',
    };
  }, [focusedValues, curr]);

  // References for continuous transactions scrolling
  const transactionsScrollRef = useRef<any>(null);
  const dayLayoutsRef = useRef<Record<string, number>>({});
  const cycleLayoutsRef = useRef<Record<string, number>>({});
  const childYOffsetsRef = useRef<Record<string, number>>({});
  const isProgrammaticScrollRef = useRef<boolean>(false);

  // Scroll transactions list to a specific date card smoothly
  const scrollToDate = (dateStr: string, animated: boolean = true) => {
    setTimeout(() => {
      const targetY = dayLayoutsRef.current[dateStr];
      if (targetY !== undefined && transactionsScrollRef.current) {
        isProgrammaticScrollRef.current = true;
        transactionsScrollRef.current.scrollTo({ y: Math.max(0, targetY - 8), animated });
        setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 450);
      }
    }, 100);
  };

  // Format date header nicely: e.g. "Today • Saturday, 31 Oct"
  const formatSelectedDateHeader = (dateStr: string) => {
    if (!dateStr) return '';
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d, 12, 0, 0);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const prefix = dateStr === todayStr ? 'Today • ' : dateStr === yesterdayStr ? 'Yesterday • ' : '';
    return `${prefix}${dayNames[dateObj.getDay()]}, ${d} ${monthNames[m - 1]} ${y}`;
  };

  // Format transaction time nicely: e.g. "2:30 PM"
  const formatTxTime = (timeStr?: string, createdAtStr?: string): string => {
    if (timeStr && timeStr.trim()) {
      const clean = timeStr.trim();
      if (/AM|PM/i.test(clean)) return clean;
      if (clean.includes(':')) {
        const [hStr, mStr] = clean.split(':');
        let h = parseInt(hStr, 10);
        const m = (mStr || '00').slice(0, 2);
        if (!isNaN(h)) {
          const ampm = h >= 12 ? 'PM' : 'AM';
          h = h % 12;
          if (h === 0) h = 12;
          return `${h}:${m} ${ampm}`;
        }
      }
      return clean;
    }
    if (createdAtStr) {
      try {
        const d = new Date(createdAtStr);
        if (!isNaN(d.getTime())) {
          let h = d.getHours();
          const m = String(d.getMinutes()).padStart(2, '0');
          const ampm = h >= 12 ? 'PM' : 'AM';
          h = h % 12;
          if (h === 0) h = 12;
          return `${h}:${m} ${ampm}`;
        }
      } catch {
        // ignore
      }
    }
    return '';
  };

  // Group transactions by date, arranged with latest transaction last
  const transactionsByDate = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    transactions.forEach((tx) => {
      if (!map[tx.date]) {
        map[tx.date] = [];
      }
      map[tx.date].push(tx);
    });

    Object.keys(map).forEach((d) => {
      map[d].sort((a, b) => {
        // Compare time strings (e.g. "09:00" vs "14:30")
        const timeA = a.time || (a.created_at ? a.created_at.slice(11, 16) : '');
        const timeB = b.time || (b.created_at ? b.created_at.slice(11, 16) : '');

        if (timeA && timeB) {
          const cmp = timeA.localeCompare(timeB);
          if (cmp !== 0) return cmp; // earlier first, latest last
        } else if (timeA) {
          return -1;
        } else if (timeB) {
          return 1;
        }

        // Fall back to created_at (oldest first, latest last)
        if (a.created_at && b.created_at) {
          const createdCmp = a.created_at.localeCompare(b.created_at);
          if (createdCmp !== 0) return createdCmp;
        }

        return (a.id || '').localeCompare(b.id || '');
      });
    });

    return map;
  }, [transactions]);

  // Aggregate spending per day
  const dailySpendMap = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        map[t.date] = (map[t.date] || 0) + t.base_amount;
      });
    return map;
  }, [transactions]);

  // Group continuous feed by cycles (with title before each cycle list)
  // Only shows cycles that have transactions registered (or current cycle if no transactions exist yet)
  const feedCycleGroups = useMemo(() => {
    if (cycleList.length === 0) return [];

    return cycleList
      .map((c) => {
        const cycleTxs = transactions.filter(
          (t) => t.date >= c.start_date && t.date <= c.end_date
        );

        const isCurrent = todayStr >= c.start_date && todayStr <= c.end_date;
        const hasTransactions = cycleTxs.length > 0;

        // ONLY show if there was transaction registered (or if there are no transactions at all in the app, show current cycle)
        if (!hasTransactions && !(isCurrent && transactions.length === 0)) {
          return null;
        }

        const [sy, sm, sd] = c.start_date.split('-').map(Number);
        const [ey, em, ed] = c.end_date.split('-').map(Number);
        const cur = new Date(sy, sm - 1, sd, 12, 0, 0);
        const endD = new Date(ey, em - 1, ed, 12, 0, 0);

        const days: string[] = [];
        while (cur <= endD) {
          const y = cur.getFullYear();
          const m = String(cur.getMonth() + 1).padStart(2, '0');
          const d = String(cur.getDate()).padStart(2, '0');
          days.push(`${y}-${m}-${d}`);
          cur.setDate(cur.getDate() + 1);
        }

        days.sort();

        const cycleSpent = cycleTxs
          .filter((t) => t.type === 'expense')
          .reduce((sum, t) => sum + (t.base_amount || t.amount || 0), 0);

        const cycleIncome = cycleTxs
          .filter((t) => t.type === 'income')
          .reduce((sum, t) => sum + (t.base_amount || t.amount || 0), 0);

        const isSelected = focusedCycle ? c.start_date === focusedCycle.start_date : isCurrent;
        const displayName = c.name || formatCycleDateRange(c.start_date, c.end_date);

        return {
          cycle: c,
          displayName,
          startDate: c.start_date,
          endDate: c.end_date,
          isCurrent,
          isSelected,
          cycleSpent,
          cycleIncome,
          hasTransactions,
          days,
        };
      })
      .filter(Boolean) as {
        cycle: BudgetCycle;
        displayName: string;
        startDate: string;
        endDate: string;
        isCurrent: boolean;
        isSelected: boolean;
        cycleSpent: number;
        cycleIncome: number;
        hasTransactions: boolean;
        days: string[];
      }[];
  }, [cycleList, transactions, todayStr, focusedCycle?.start_date]);

  // Flattened feed days for continuous scrolling layout
  const feedDays = useMemo(() => {
    const dates: string[] = [];
    feedCycleGroups.forEach((g) => {
      g.days.forEach((d) => {
        if (!dates.includes(d)) dates.push(d);
      });
    });
    dates.sort();
    return dates;
  }, [feedCycleGroups]);

  // Open Analytics screen focused on a specific cycle
  const handleOpenCycleAnalytics = (cycle: BudgetCycle) => {
    setSelectedAnalyticsCycle(cycle);
    onNavigateTab?.('analytics');
  };

  // Keep refs synchronized for fast scroll event handling without stale closures
  const activeCycleRangeRef = useRef(activeCycleRange);
  activeCycleRangeRef.current = activeCycleRange;

  const effectiveCycleRef = useRef<BudgetCycle | null>(effectiveCycle);
  effectiveCycleRef.current = effectiveCycle;

  const cycleListRef = useRef(cycleList);
  cycleListRef.current = cycleList;

  const feedDaysRef = useRef(feedDays);
  feedDaysRef.current = feedDays;

  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;

  const todayStrRef = useRef(todayStr);
  todayStrRef.current = todayStr;

  // Return to today and current cycle
  const handleGoToToday = () => {
    const nowToday = new Date().toISOString().slice(0, 10);
    setSelectedCalendarCycle(null);
    setSelectedDate(nowToday);
    scrollToDate(nowToday);
  };

  // Scrolling transactions updates the selected date smoothly without causing re-render jumps
  const handleTransactionsScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isProgrammaticScrollRef.current) return;

    const scrollY = e.nativeEvent.contentOffset.y;
    let closestDate = selectedDateRef.current;
    let minDiff = Infinity;

    // Only inspect layout positions for dates currently loaded in feedDays
    for (const dStr of feedDaysRef.current) {
      const yPos = dayLayoutsRef.current[dStr];
      if (yPos === undefined) continue;
      const diff = Math.abs(yPos - (scrollY + 12));
      if (diff < minDiff) {
        minDiff = diff;
        closestDate = dStr;
      }
    }

    if (closestDate && closestDate !== selectedDateRef.current) {
      selectedDateRef.current = closestDate;
      setSelectedDate(closestDate);
    }
  };

  // Initial scroll to selected date or today
  const hasInitiallyScrolledRef = useRef(false);
  useEffect(() => {
    if (hasInitiallyScrolledRef.current) return;
    const targetDate = selectedDate || new Date().toISOString().slice(0, 10);
    let attempts = 0;
    const checkAndScroll = () => {
      attempts++;
      const targetY = dayLayoutsRef.current[targetDate];
      if (targetY !== undefined && transactionsScrollRef.current) {
        isProgrammaticScrollRef.current = true;
        transactionsScrollRef.current.scrollTo({ y: Math.max(0, targetY - 8), animated: false });
        hasInitiallyScrolledRef.current = true;
        setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 300);
      } else if (attempts < 15) {
        setTimeout(checkAndScroll, 80);
      }
    };
    const timer = setTimeout(checkAndScroll, 150);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* 1. DOCKED TOP BANNER (MERGED WITH TOP BAR) */}
      <View
        style={[
          styles.dockedTopBanner,
          {
            backgroundColor: theme.surface,
            borderBottomColor: theme.divider,
          },
          M3Elevation.level1,
        ]}
      >
        {/* AVAILABLE FOR TODAY BANNER */}
        <View style={styles.currentCycleBannerContent}>
            {/* Available for Today / Focused Date Row */}
            <View style={styles.todayBalanceRow}>
              <TouchableOpacity
                onPress={handleGoToToday}
                activeOpacity={focusedValues.isPast ? 0.7 : 1}
                disabled={!focusedValues.isPast}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text
                    style={[styles.todayBalanceLabel, { color: theme.onSurfaceVariant }]}
                    maxFontSizeMultiplier={1.2}
                  >
                    {focusedValues.isPast
                      ? `AVAILABLE AT END OF ${formatShortDate(focusedValues.targetDate).toUpperCase()}`
                      : 'AVAILABLE FOR TODAY'}
                  </Text>
                  {focusedValues.isPast && (
                    <View
                      style={{
                        backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.25)' : theme.primaryContainer,
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                        borderRadius: 10,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 9,
                          fontWeight: '700',
                          color: isDarkMode ? '#C7D2FE' : theme.onPrimaryContainer,
                        }}
                      >
                        Today ↩
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.todayBalanceAmount,
                    { color: focusedValues.availableAmount >= 0 ? theme.primary : theme.error },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  maxFontSizeMultiplier={1.2}
                >
                  {wallets.length === 0 && overallBudgetLimit === 0
                    ? formatCurrency(0, curr)
                    : formatCurrency(focusedValues.availableAmount, curr)}
                </Text>
              </TouchableOpacity>

              {/* Days Left chip - Tap to open Cycle Type picker */}
              <TouchableOpacity
                style={[
                  styles.walletSumPill,
                  {
                    backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.16)' : theme.pillBg,
                    borderColor: isDarkMode ? 'rgba(129, 140, 248, 0.32)' : 'rgba(0, 0, 0, 0.08)',
                  },
                ]}
                onPress={() => setModeSwitcherVisible(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Switch Cycle Type"
              >
                <MaterialCommunityIcons
                  name="calendar-clock-outline"
                  size={14}
                  color={isDarkMode ? '#A5B4FC' : theme.primary}
                />
                <Text
                  style={[
                    styles.walletSumText,
                    {
                      color: isDarkMode ? '#E0E7FF' : theme.onSurface,
                      fontWeight: '700',
                    },
                  ]}
                >
                  {focusedValues.isPast
                    ? focusedValues.daysRemaining === 0
                      ? 'Ended'
                      : `${focusedValues.daysRemaining} days left`
                    : dailyAllowanceStats.isEnded
                    ? 'Ended'
                    : dailyAllowanceStats.daysRemaining === 0
                    ? 'Ends today'
                    : dailyAllowanceStats.daysRemaining === 1
                    ? '1 day left'
                    : `${dailyAllowanceStats.daysRemaining} days left`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

        {/* DUAL DISPLAY TARGET CARDS: INCOME GOAL (LEFT) & BUDGET CAP (RIGHT) FROM HOMESCREEN */}
        <View style={styles.dualCardsRow}>
          {/* Income Goal Card (Left) */}
          <TouchableOpacity
            style={[
              styles.heroDisplayCard,
              {
                backgroundColor: theme.cardBg,
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : theme.divider,
              },
              M3Elevation.level1,
            ]}
            onPress={() => {
              setSelectedAnalyticsCycle(focusedCycle || currentCycle || undefined);
              setAnalyticsFocus('income');
              onNavigateTab?.('analytics');
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Open Income Analysis"
          >
            {/* Background Progress Fill Track */}
            {incomeSwitcherProgress.hasGoal && (
              <View
                style={[
                  styles.cardProgressFillTrack,
                  {
                    width: `${Math.min(100, Math.max(0, incomeSwitcherProgress.percent))}%`,
                    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.20)' : 'rgba(16, 185, 129, 0.12)',
                  },
                ]}
              />
            )}

            {/* Header: Dot + Title + Badge */}
            <View style={styles.switcherHeaderRow}>
              <View style={styles.switcherIconTextRow}>
                <View style={[styles.tabDot, { backgroundColor: theme.success }]} />
                <Text style={[styles.switcherTabTitle, { color: theme.onSurfaceVariant }]}>
                  INCOME GOAL
                </Text>
              </View>

              {incomeSwitcherProgress.badgeText && (
                <View
                  style={[
                    styles.switcherBadgePill,
                    {
                      backgroundColor: incomeSwitcherProgress.isReached
                        ? (isDarkMode ? 'rgba(5, 150, 105, 0.35)' : '#D1FAE5')
                        : (isDarkMode ? 'rgba(255, 255, 255, 0.12)' : theme.pillBg),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.switcherBadgeText,
                      {
                        color: incomeSwitcherProgress.isReached
                          ? (isDarkMode ? '#6EE7B7' : '#059669')
                          : (isDarkMode ? '#A7F3D0' : theme.success),
                      },
                    ]}
                  >
                    {incomeSwitcherProgress.badgeText}
                  </Text>
                </View>
              )}
            </View>

            {/* Main Headline: Amount Earned */}
            <View style={styles.heroAmountRow}>
              <Text
                style={[styles.switcherTabAmount, { color: isDarkMode ? '#34D399' : theme.success }]}
                numberOfLines={1}
              >
                {incomeSwitcherProgress.hasGoal
                  ? formatCurrency(effectiveIncome, curr)
                  : '+ Set Goal'}
              </Text>
              {incomeSwitcherProgress.hasGoal && (
                <Text style={[styles.heroAmountCaption, { color: theme.onSurfaceVariant }]}>EARNED</Text>
              )}
            </View>

            {/* Subtext: Target or Reached */}
            <Text
              style={[
                styles.switcherProgressSubtext,
                {
                  color: incomeSwitcherProgress.isReached
                    ? (isDarkMode ? '#6EE7B7' : '#059669')
                    : theme.onSurfaceVariant,
                },
              ]}
              numberOfLines={1}
            >
              {incomeSwitcherProgress.subText}
            </Text>

            {/* Bottom Progress Line */}
            {incomeSwitcherProgress.hasGoal && (
              <View style={styles.switcherBottomLineTrack}>
                <View
                  style={[
                    styles.switcherBottomLineFill,
                    {
                      width: `${Math.min(100, Math.max(0, incomeSwitcherProgress.percent))}%`,
                      backgroundColor: theme.success,
                    },
                  ]}
                />
              </View>
            )}
          </TouchableOpacity>

          {/* Budget Cap Card (Right) */}
          <TouchableOpacity
            style={[
              styles.heroDisplayCard,
              {
                backgroundColor: theme.cardBg,
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : theme.divider,
              },
              M3Elevation.level1,
            ]}
            onPress={() => {
              setSelectedAnalyticsCycle(focusedCycle || currentCycle || undefined);
              setAnalyticsFocus('expense');
              onNavigateTab?.('analytics');
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Open Budget Cap Analysis"
          >
            {/* Background Progress Fill Track */}
            {expenseSwitcherProgress.hasTarget && (
              <View
                style={[
                  styles.cardProgressFillTrack,
                  {
                    width: `${Math.min(100, Math.max(0, expenseSwitcherProgress.percent))}%`,
                    backgroundColor: expenseSwitcherProgress.isOver
                      ? (isDarkMode ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.15)')
                      : (isDarkMode ? 'rgba(239, 68, 68, 0.18)' : 'rgba(239, 68, 68, 0.10)'),
                  },
                ]}
              />
            )}

            {/* Header: Dot + Title + Badge */}
            <View style={styles.switcherHeaderRow}>
              <View style={styles.switcherIconTextRow}>
                <View style={[styles.tabDot, { backgroundColor: theme.error }]} />
                <Text style={[styles.switcherTabTitle, { color: theme.onSurfaceVariant }]}>
                  BUDGET CAP
                </Text>
              </View>

              {expenseSwitcherProgress.badgeText && (
                <View
                  style={[
                    styles.switcherBadgePill,
                    {
                      backgroundColor: expenseSwitcherProgress.isOver
                        ? (isDarkMode ? 'rgba(220, 38, 38, 0.35)' : '#FEE2E2')
                        : (isDarkMode ? 'rgba(255, 255, 255, 0.12)' : theme.pillBg),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.switcherBadgeText,
                      {
                        color: expenseSwitcherProgress.isOver
                          ? (isDarkMode ? '#FCA5A5' : '#DC2626')
                          : (isDarkMode ? '#F87171' : theme.error),
                      },
                    ]}
                  >
                    {expenseSwitcherProgress.badgeText}
                  </Text>
                </View>
              )}
            </View>

            {/* Main Headline: Amount Used */}
            <View style={styles.heroAmountRow}>
              <Text
                style={[
                  styles.switcherTabAmount,
                  { color: expenseSwitcherProgress.isOver ? (isDarkMode ? '#F87171' : '#DC2626') : (isDarkMode ? '#F87171' : theme.error) },
                ]}
                numberOfLines={1}
              >
                {expenseSwitcherProgress.hasTarget
                  ? formatCurrency(effectiveSpent, curr)
                  : '+ Set Cap'}
              </Text>
              {expenseSwitcherProgress.hasTarget && (
                <Text style={[styles.heroAmountCaption, { color: theme.onSurfaceVariant }]}>USED</Text>
              )}
            </View>

            {/* Subtext: Cap or Over status */}
            <Text
              style={[
                styles.switcherProgressSubtext,
                {
                  color: expenseSwitcherProgress.isOver
                    ? (isDarkMode ? '#FCA5A5' : '#DC2626')
                    : theme.onSurfaceVariant,
                },
              ]}
              numberOfLines={1}
            >
              {expenseSwitcherProgress.subText}
            </Text>

            {/* Bottom Progress Line */}
            {expenseSwitcherProgress.hasTarget && (
              <View style={styles.switcherBottomLineTrack}>
                <View
                  style={[
                    styles.switcherBottomLineFill,
                    {
                      width: `${Math.min(100, Math.max(0, expenseSwitcherProgress.percent))}%`,
                      backgroundColor: expenseSwitcherProgress.isOver
                        ? '#EF4444'
                        : theme.error,
                    },
                  ]}
                />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>



      {/* 3. CONTINUOUS DAY-BY-DAY TRANSACTIONS SCROLL LIST GROUPED BY CYCLES */}
      <ScrollView
        ref={transactionsScrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.transactionsScrollContent}
        onScroll={handleTransactionsScroll}
        scrollEventThrottle={16}
      >
        {feedCycleGroups.map((group) => (
          <View
            key={group.cycle.id || group.startDate}
            style={styles.cycleGroupSection}
            onLayout={(e) => {
              const cY = e.nativeEvent.layout.y;
              const gKey = group.cycle.id || group.startDate;
              cycleLayoutsRef.current[gKey] = cY;
              for (const d of group.days) {
                if (childYOffsetsRef.current[d] !== undefined) {
                  dayLayoutsRef.current[d] = cY + childYOffsetsRef.current[d];
                }
              }
            }}
          >
            {/* Cycle Title Card Header (Tapping opens the Analysis page for this cycle) */}
            <TouchableOpacity
              style={[
                styles.cycleGroupHeaderCard,
                {
                  backgroundColor: group.isSelected
                    ? (isDarkMode ? 'rgba(99, 102, 241, 0.22)' : '#EEF2FF')
                    : (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : theme.cardBg),
                  borderColor: group.isSelected
                    ? (isDarkMode ? '#818CF8' : theme.primary)
                    : theme.divider,
                },
                M3Elevation.level1,
              ]}
              onPress={() => handleOpenCycleAnalytics(group.cycle)}
              activeOpacity={0.75}
              accessibilityLabel={`Open Analysis for cycle ${group.displayName}`}
            >
              <View style={styles.cycleGroupHeaderLeft}>
                <View
                  style={[
                    styles.cycleGroupIconWrap,
                    {
                      backgroundColor: group.isSelected
                        ? (isDarkMode ? '#818CF8' : theme.primary)
                        : (isDarkMode ? 'rgba(99, 102, 241, 0.2)' : theme.pillBg),
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="chart-pie"
                    size={18}
                    color={group.isSelected ? (isDarkMode ? '#0F172A' : '#FFFFFF') : theme.primary}
                  />
                </View>
                <View style={styles.cycleGroupTitleCol}>
                  <View style={styles.cycleGroupTitleRow}>
                    <Text
                      style={[
                        styles.cycleGroupTitleText,
                        { color: theme.onSurface },
                        group.isSelected && { fontWeight: '800' },
                      ]}
                      numberOfLines={1}
                    >
                      {group.displayName}
                    </Text>
                    {group.isCurrent && (
                      <View
                        style={[
                          styles.cycleCurrentBadge,
                          { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.25)' : '#D1FAE5' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.cycleCurrentBadgeText,
                            { color: isDarkMode ? '#6EE7B7' : '#047857' },
                          ]}
                        >
                          Current
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.cycleGroupMetaText, { color: theme.onSurfaceVariant }]}>
                    Spent: {formatCurrency(group.cycleSpent, curr)}
                    {group.cycleIncome > 0 && ` • Income: ${formatCurrency(group.cycleIncome, curr)}`}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.openAnalyticsActionPill,
                  {
                    backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.25)' : theme.primaryContainer,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.openAnalyticsActionText,
                    { color: isDarkMode ? '#C7D2FE' : theme.onPrimaryContainer },
                  ]}
                >
                  Analysis
                </Text>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={15}
                  color={isDarkMode ? '#C7D2FE' : theme.onPrimaryContainer}
                />
              </View>
            </TouchableOpacity>

            {/* Days and Transactions in this Cycle */}
            {group.days.map((dateStr) => {
              const dayTxs = transactionsByDate[dateStr] || [];
              const spend = dailySpendMap[dateStr] || 0;
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === new Date().toISOString().slice(0, 10);

              if (dayTxs.length === 0 && !isToday && !isSelected) {
                return null;
              }

              return (
                <View
                  key={dateStr}
                  onLayout={(e) => {
                    const localY = e.nativeEvent.layout.y;
                    childYOffsetsRef.current[dateStr] = localY;
                    const gKey = group.cycle.id || group.startDate;
                    const cY = cycleLayoutsRef.current[gKey] || 0;
                    dayLayoutsRef.current[dateStr] = cY + localY;
                  }}
                  style={[
                    styles.daySectionCard,
                    isSelected && {
                      borderLeftColor: theme.primary,
                      borderLeftWidth: 3,
                      paddingLeft: 8,
                    },
                  ]}
                >
                  {/* Day Header */}
                  <TouchableOpacity
                    style={styles.daySectionHeader}
                    onPress={() => {
                      setSelectedDate(dateStr);
                      scrollToDate(dateStr);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.daySectionTitle,
                          {
                            color: isSelected
                              ? theme.primary
                              : isToday
                              ? (isDarkMode ? '#A5B4FC' : theme.primary)
                              : theme.onSurface,
                            fontWeight: isSelected || isToday ? '800' : '600',
                          },
                        ]}
                      >
                        {formatSelectedDateHeader(dateStr)}
                      </Text>
                    </View>

                    {spend > 0 && (
                      <Text style={[styles.daySectionSpend, { color: theme.error }]}>
                        -{formatCurrency(spend, settings.base_currency)}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* Transactions for this Day */}
                  {dayTxs.length === 0 ? (
                    <View style={styles.compactEmptyDayRow}>
                      <View
                        style={[
                          styles.emptyDayDot,
                          { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.18)' : theme.divider },
                        ]}
                      />
                      <Text style={[styles.compactEmptyDayText, { color: theme.onSurfaceVariant }]}>
                        No transactions
                      </Text>
                    </View>
                  ) : (
                    dayTxs.map((tx) => {
                      const cat = categories.find((c) => c.id === tx.category_id);
                      const sub = cat?.subcategories?.find((s) => s.id === tx.subcategory_id);
                      const wallet = wallets.find((w) => w.id === tx.wallet_id);
                      const isExpense = tx.type === 'expense';
                      const isTransfer = tx.type === 'transfer';

                      const mainTitle = isTransfer
                        ? 'Transfer'
                        : sub?.name || cat?.name || (isExpense ? 'Expense' : 'Income');

                      const subMeta = [
                        sub ? cat?.name : null,
                        wallet?.name,
                        tx.note || null,
                      ]
                        .filter(Boolean)
                        .join(' • ');

                      const txTime = formatTxTime(tx.time, tx.created_at);

                      return (
                        <View key={tx.id} style={styles.dayTxWrapper}>
                          {txTime ? (
                            <View style={styles.dayTxTimeHeaderRow}>
                              <MaterialCommunityIcons
                                name="clock-time-four-outline"
                                size={11}
                                color={theme.onSurfaceVariant}
                                style={{ marginRight: 4 }}
                              />
                              <Text style={[styles.dayTxTimeText, { color: theme.onSurfaceVariant }]}>
                                {txTime}
                              </Text>
                            </View>
                          ) : null}

                          <TouchableOpacity
                            style={[
                              styles.dayTxItem,
                              { backgroundColor: theme.cardBg, borderColor: theme.divider },
                            ]}
                            onPress={() => setViewingTransaction(tx)}
                            activeOpacity={0.7}
                          >
                            <View
                              style={[
                                styles.catDot,
                                {
                                  backgroundColor: isTransfer
                                    ? theme.tertiary
                                    : cat?.color || (isExpense ? theme.error : theme.success),
                                },
                              ]}
                            />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <Text style={[styles.dayTxTitle, { color: theme.onSurface }]}>
                                {mainTitle}
                              </Text>
                              <Text style={[styles.dayTxMeta, { color: theme.onSurfaceVariant }]} numberOfLines={1}>
                                {subMeta}
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.dayTxAmount,
                                {
                                  color: isExpense
                                    ? theme.error
                                    : isTransfer
                                    ? theme.tertiary
                                    : theme.success,
                                },
                              ]}
                            >
                              {isExpense ? '-' : isTransfer ? '' : '+'}
                              {formatCurrency(tx.amount, tx.currency || settings.base_currency)}
                            </Text>
                            <MaterialCommunityIcons
                              name="chevron-right"
                              size={18}
                              color={theme.onSurfaceVariant}
                              style={{ marginLeft: 6 }}
                            />
                          </TouchableOpacity>
                        </View>
                      );
                    })
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* SHIFT CYCLE MODE MODAL (TAP ACTIVE CHIP: SHIFT BETWEEN REGULAR & CUSTOM, NO EDITING) */}
      <CycleModeSwitcherModal
        visible={modeSwitcherVisible}
        onClose={() => setModeSwitcherVisible(false)}
      />

      {/* VISUAL DATE RANGE PICKER (CONNECTING POLYLINE / BAND RANGE PICKER) */}
      <DateRangePickerModal
        visible={dateRangePickerVisible}
        initialStartDate={currentCycle?.start_date}
        initialEndDate={currentCycle?.end_date}
        onClose={() => setDateRangePickerVisible(false)}
        onSave={handleSaveDateRange}
      />

      {/* TRANSACTION FULL DETAILS MODAL (OPENED WHEN HISTORY ITEM IS CLICKED) */}
      <TransactionDetailModal
        visible={Boolean(viewingTransaction)}
        transaction={viewingTransaction}
        categories={categories}
        wallets={wallets}
        theme={theme}
        baseCurrency={settings.base_currency}
        onClose={() => setViewingTransaction(null)}
        onEdit={handleStartEdit}
        onDelete={deleteTransaction}
      />

      {/* EDIT TRANSACTION MODAL */}
      {Boolean(editingTransaction) && (
        <TransactionDetailsModal
          visible={editModalVisible}
          txType={editingTransaction?.type || 'expense'}
          initialAmount={editingTransaction?.amount || 0}
          initialWalletId={editingTransaction?.wallet_id || ''}
          initialCategoryId={editingTransaction?.category_id || undefined}
          initialSubcategoryId={editingTransaction?.subcategory_id || undefined}
          initialDate={editingTransaction?.date}
          initialTime={editingTransaction?.time}
          initialNote={editingTransaction?.note}
          initialMediaUri={editingTransaction?.media_uri}
          initialIsPaid={editingTransaction?.is_paid}
          initialCurrency={editingTransaction?.currency}
          isEditing={true}
          wallets={wallets}
          categories={categories}
          theme={theme}
          baseCurrency={settings.base_currency}
          onClose={() => {
            setEditModalVisible(false);
            setEditingTransaction(null);
          }}
          onSave={handleSaveEditedTransaction}
          onAddSubcategory={addSubcategory}
        />
      )}

      {/* FAB OVERLAY BACKDROP */}
      {isFabOpen && (
        <Pressable
          style={styles.fabBackdrop}
          onPress={() => setIsFabOpen(false)}
        />
      )}

      {/* FLOATING SPEED DIAL ACTION BUTTONS (FLOATING VERTICAL, EXPENSE ON TOP) */}
      <Animated.View
        pointerEvents={isFabOpen ? 'auto' : 'none'}
        style={[
          styles.fabSpeedDialContainer,
          {
            opacity: speedDialOpacity,
            transform: [{ translateY: speedDialTranslateY }, { scale: speedDialScale }],
          },
        ]}
      >
        {/* Record Expense Button (Top) */}
        <TouchableOpacity
          style={[
            styles.fabRecordBtn,
            {
              backgroundColor: theme.errorContainer,
              borderColor: theme.error,
            },
            M3Elevation.level3,
          ]}
          onPress={() => handleOpenAddFlow('expense')}
          activeOpacity={0.85}
          accessibilityLabel="Record Expense"
        >
          <View style={styles.fabRecordBtnContent}>
            <View style={styles.fabRecordHeaderRow}>
              <MaterialCommunityIcons name="minus-circle" size={16} color={theme.error} />
              <Text
                style={[styles.fabRecordBtnTitle, { color: theme.onErrorContainer }]}
                numberOfLines={1}
              >
                Record Expense
              </Text>
            </View>
            <View
              style={[
                styles.fabRecordBadge,
                {
                  backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.85)',
                  borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
                },
              ]}
            >
              <Text
                style={[
                  styles.fabRecordBadgeText,
                  { color: isDarkMode ? '#FCA5A5' : '#B91C1C' },
                ]}
                numberOfLines={1}
              >
                {expenseSwitcherProgress.hasTarget
                  ? expenseSwitcherProgress.isOver
                    ? `Over: ${formatCurrency(expenseSwitcherProgress.overBy, curr)}`
                    : `Remain: ${formatCurrency(expenseSwitcherProgress.remaining, curr)}`
                  : `Total: ${formatCurrency(effectiveSpent, curr)}`}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Record Income Button (Bottom - Below Expense, Above FAB) */}
        <TouchableOpacity
          style={[
            styles.fabRecordBtn,
            {
              backgroundColor: theme.successContainer,
              borderColor: theme.success,
            },
            M3Elevation.level3,
          ]}
          onPress={() => handleOpenAddFlow('income')}
          activeOpacity={0.85}
          accessibilityLabel="Record Income"
        >
          <View style={styles.fabRecordBtnContent}>
            <View style={styles.fabRecordHeaderRow}>
              <MaterialCommunityIcons name="plus-circle" size={16} color={theme.success} />
              <Text
                style={[styles.fabRecordBtnTitle, { color: theme.onSuccessContainer }]}
                numberOfLines={1}
              >
                Record Income
              </Text>
            </View>
            <View
              style={[
                styles.fabRecordBadge,
                {
                  backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.85)',
                  borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
                },
              ]}
            >
              <Text
                style={[
                  styles.fabRecordBadgeText,
                  { color: isDarkMode ? '#6EE7B7' : '#047857' },
                ]}
                numberOfLines={1}
              >
                {incomeSwitcherProgress.hasGoal
                  ? incomeSwitcherProgress.isReached
                    ? '🎉 Reached'
                    : `Remain: ${formatCurrency(incomeSwitcherProgress.remaining, curr)}`
                  : `Total: ${formatCurrency(effectiveIncome, curr)}`}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* FLOATING ACTION BUTTON (BOTTOM RIGHT) */}
      <TouchableOpacity
        style={[
          styles.fabMainBtn,
          {
            backgroundColor: theme.primary,
          },
          M3Elevation.level3,
        ]}
        onPress={() => setIsFabOpen(!isFabOpen)}
        activeOpacity={0.85}
        accessibilityLabel={isFabOpen ? 'Close record menu' : 'Add transaction'}
      >
        <Animated.View style={{ transform: [{ rotate: fabRotate }] }}>
          <MaterialCommunityIcons name="plus" size={28} color={theme.onPrimary} />
        </Animated.View>
      </TouchableOpacity>

      {/* CATEGORY PICKER SHEET (STEP 1: OPENS FIRST ON RECORD) */}
      <CategoryPickerSheet
        visible={addCategorySheetVisible}
        txType={addModalType}
        amount={0}
        walletId={wallets[0]?.id || ''}
        wallets={wallets}
        categories={categories}
        theme={theme}
        baseCurrency={settings.base_currency}
        selectOnly={true}
        confirmButtonText="Next"
        onClose={() => setAddCategorySheetVisible(false)}
        onSave={handleCategorySelectedForAdd}
        onOpenMoreOptions={handleCategorySelectedForAdd}
        onAddSubcategory={addSubcategory}
      />

      {/* ADD TRANSACTION MODAL (STEP 2: FOCUSED AMOUNT FIELD) */}
      <TransactionDetailsModal
        visible={addModalVisible}
        txType={addModalType}
        initialAmount={0}
        initialWalletId={wallets[0]?.id || ''}
        initialCategoryId={addPrefilledCategoryId}
        initialSubcategoryId={addPrefilledSubcategoryId}
        initialDate={selectedDate || todayStr}
        isEditing={false}
        wallets={wallets}
        categories={categories}
        theme={theme}
        baseCurrency={settings.base_currency}
        onClose={() => setAddModalVisible(false)}
        onSave={handleSaveNewTransaction}
        onAddSubcategory={addSubcategory}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dockedTopBanner: {
    borderBottomWidth: 1,
    paddingTop: 6,
    paddingBottom: 8,
  },
  currentCycleBannerContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 2,
  },
  todayBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  todayBalanceLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  todayBalanceAmount: {
    fontSize: 22,
    fontWeight: '900',
  },
  walletSumPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: M3Shape.full,
  },
  walletSumText: {
    fontSize: 12,
  },
  nonCurrentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  nonCurrentTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nonCurrentBrowsingLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  returnToTodayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: M3Shape.full,
  },
  returnToTodayText: {
    fontSize: 11,
    fontWeight: '800',
  },
  dualCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    marginBottom: 4,
    paddingHorizontal: 16,
  },
  heroDisplayCard: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: M3Shape.large,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  cardProgressFillTrack: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 0,
  },
  switcherHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
    zIndex: 2,
  },
  switcherIconTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tabDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  switcherTabTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  switcherBadgePill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: M3Shape.full,
  },
  switcherBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    zIndex: 2,
  },
  switcherTabAmount: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  heroAmountCaption: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  switcherProgressSubtext: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
    zIndex: 2,
  },
  switcherBottomLineTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  switcherBottomLineFill: {
    height: '100%',
  },
  cycleChipsWrapper: {
    paddingVertical: 2,
    marginBottom: 4,
  },
  cycleChipsScroll: {
    paddingHorizontal: 12,
    gap: 8,
    alignItems: 'center',
  },
  cycleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: M3Shape.full,
    borderWidth: 1.5,
  },
  chipTextCol: {
    justifyContent: 'center',
  },
  cycleChipText: {
    fontSize: 12,
  },
  cycleChipSubText: {
    fontSize: 9.5,
    marginTop: 1,
  },
  activeBadgePill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: M3Shape.full,
    marginLeft: 2,
  },
  activeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  dockedCalendarContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
  },
  cycleNavArrowBtn: {
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionsScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 85,
  },
  cycleGroupSection: {
    marginBottom: 20,
  },
  cycleGroupHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: M3Shape.large,
    borderWidth: 1.5,
    marginBottom: 12,
    marginTop: 4,
  },
  cycleGroupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  cycleGroupIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cycleGroupTitleCol: {
    flex: 1,
  },
  cycleGroupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cycleGroupTitleText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  cycleCurrentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: M3Shape.full,
  },
  cycleCurrentBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  cycleGroupMetaText: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  openAnalyticsActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: M3Shape.full,
    gap: 2,
  },
  openAnalyticsActionText: {
    fontSize: 11,
    fontWeight: '800',
  },
  daySectionCard: {
    marginBottom: 14,
    borderRadius: M3Shape.medium,
    paddingVertical: 2,
  },
  cycleBoundaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: M3Shape.full,
    alignSelf: 'flex-start',
    marginBottom: 8,
    marginTop: 4,
  },
  cycleBoundaryText: {
    fontSize: 11,
    fontWeight: '800',
  },
  daySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  daySectionTitle: {
    fontSize: 14,
  },
  daySectionSpend: {
    fontSize: 13,
    fontWeight: '700',
  },
  compactEmptyDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 4,
  },
  emptyDayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  compactEmptyDayText: {
    fontSize: 11.5,
  },
  monthHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  cycleViewModeSub: {
    fontSize: 11,
    marginTop: 2,
  },
  calendarHeaderRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: M3Shape.full,
  },
  todayBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  collapseToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: M3Shape.full,
  },
  collapseToggleText: {
    fontSize: 11,
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '600',
    width: 40,
    textAlign: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  calendarCell: {
    width: `${100 / 7}%`,
    height: 48,
    borderWidth: 1,
    borderRadius: M3Shape.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  cellMonthLabel: {
    fontSize: 8,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: -1,
  },
  emptyCell: {
    width: `${100 / 7}%`,
    height: 48,
  },
  cellDayNum: {
    fontSize: 14,
  },
  spendDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 2,
  },
  collapseHandleBar: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    marginTop: -4,
    marginBottom: 8,
  },
  collapseHandlePill: {
    width: 32,
    height: 3.5,
    borderRadius: 2,
    marginBottom: 4,
  },
  collapseHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  collapseHintText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  dayDetailsCard: {
    marginTop: 8,
  },
  dayDetailsHeader: {
    marginBottom: 10,
  },
  dayDetailsTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  dayDetailsSub: {
    fontSize: 13,
    marginTop: 2,
  },
  emptyDayBox: {
    padding: 18,
    borderRadius: M3Shape.large,
    alignItems: 'center',
  },
  emptyDayText: {
    fontSize: 13,
  },
  dayTxWrapper: {
    marginBottom: 8,
  },
  dayTxTimeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
    paddingLeft: 4,
  },
  dayTxTimeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dayTxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: M3Shape.large,
    padding: 12,
  },
  catDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dayTxTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  dayTxMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  dayTxAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modeSwitcherBox: {
    width: '100%',
    maxWidth: 360,
    borderRadius: M3Shape.extraLarge,
    padding: 20,
    gap: 12,
  },
  modeSwitcherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modeSwitcherTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modeSwitcherSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: M3Shape.large,
    borderWidth: 1.5,
    gap: 12,
  },
  modeCardIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeCardTitle: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  modeCardDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  modeActivePill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: M3Shape.full,
  },
  modeActivePillText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  modeHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: M3Shape.medium,
    marginTop: 4,
  },
  modeHintText: {
    fontSize: 11,
    flex: 1,
    lineHeight: 15,
  },
  fabBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    zIndex: 90,
  },
  fabSpeedDialContainer: {
    position: 'absolute',
    right: 18,
    bottom: 84,
    zIndex: 95,
    gap: 10,
    alignItems: 'flex-end',
  },
  fabRecordBtn: {
    borderRadius: M3Shape.large,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 165,
    justifyContent: 'center',
  },
  fabRecordBtnContent: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
  },
  fabRecordHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fabRecordBtnTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  fabRecordBadge: {
    paddingHorizontal: 8,
    paddingVertical: 1.5,
    borderRadius: M3Shape.full,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 1,
  },
  fabRecordBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  fabMainBtn: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
});
