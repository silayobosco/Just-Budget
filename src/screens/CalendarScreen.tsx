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

  // Effective cycle budget calculations
  const effectiveSpent = useMemo(() => {
    return transactions
      .filter(
        (t) =>
          t.type === 'expense' &&
          t.date >= activeCycleRange.startDate &&
          t.date <= activeCycleRange.endDate
      )
      .reduce((sum, t) => sum + t.base_amount, 0);
  }, [transactions, activeCycleRange]);

  const effectiveIncome = useMemo(() => {
    return transactions
      .filter(
        (t) =>
          t.type === 'income' &&
          t.date >= activeCycleRange.startDate &&
          t.date <= activeCycleRange.endDate
      )
      .reduce((sum, t) => sum + (t.base_amount || t.amount || 0), 0);
  }, [transactions, activeCycleRange]);

  const effectiveTarget = effectiveCycle?.target_budget ?? (settings.cycle_default_budget !== undefined ? Number(settings.cycle_default_budget) : totalConvertedBalance);
  const curr = settings.base_currency;

  // Target Cards Progress (replacing docked balance breakdown with HomeScreen top header target cards)
  const expenseSwitcherProgress = useMemo(() => {
    const target = effectiveTarget > 0 ? effectiveTarget : overallBudgetLimit;
    const hasTarget = target > 0;
    const percent = hasTarget ? Math.round((effectiveSpent / target) * 100) : 0;
    const isOver = hasTarget && effectiveSpent > target;
    const remaining = Math.max(0, target - effectiveSpent);
    const overBy = Math.max(0, effectiveSpent - target);

    return {
      hasTarget,
      percent,
      isOver,
      remaining,
      overBy,
      badgeText: hasTarget ? (isOver ? `⚠️ ${percent}%` : `${percent}%`) : '+ Set Cap',
      subText: hasTarget
        ? isOver
          ? `⚠️ ${formatCurrency(overBy, curr)} over`
          : `${formatCurrency(remaining, curr)} left`
        : 'Tap to set budget cap',
    };
  }, [effectiveTarget, overallBudgetLimit, effectiveSpent, curr]);

  const incomeSwitcherProgress = useMemo(() => {
    const goal = effectiveCycle?.target_income && effectiveCycle.target_income > 0
      ? effectiveCycle.target_income
      : (settings.cycle_default_income !== undefined ? Number(settings.cycle_default_income) : 0);
    const hasGoal = goal > 0;
    const percent = hasGoal ? Math.round((effectiveIncome / goal) * 100) : 0;
    const isReached = hasGoal && effectiveIncome >= goal;
    const remaining = Math.max(0, goal - effectiveIncome);

    return {
      hasGoal,
      goal,
      percent,
      isReached,
      remaining,
      badgeText: hasGoal ? (isReached ? '🎉 100%' : `${percent}%`) : '+ Set Goal',
      subText: hasGoal
        ? isReached
          ? '🎉 Goal reached'
          : `Goal: ${formatCurrency(goal, curr)}`
        : 'Tap to set income goal',
    };
  }, [effectiveCycle, settings.cycle_default_income, effectiveIncome, curr]);

  const cycleScrollRef = useRef<any>(null);

  useEffect(() => {
    if (cycleList.length > 0) {
      const activeIdx = cycleList.findIndex(
        (c) => c.start_date === activeCycleRange.startDate
      );
      if (activeIdx >= 0) {
        const chipEstimatedWidth = 145;
        const targetX = Math.max(0, activeIdx * chipEstimatedWidth - 110);
        setTimeout(() => {
          cycleScrollRef.current?.scrollTo({ x: targetX, animated: true });
        }, 150);
      }
    }
  }, [cycleList, activeCycleRange.startDate]);

  // References for continuous transactions scrolling
  const transactionsScrollRef = useRef<any>(null);
  const dayLayoutsRef = useRef<Record<string, number>>({});
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

  // Handle cycle chip selection: if cycle doesn't contain current date, highlight as selected cycle (NOT current)
  const handlePressCycleChip = async (c: BudgetCycle, isCurrent: boolean, isSelected: boolean) => {
    if (isSelected) {
      setModeSwitcherVisible(true);
      return;
    }

    const isContToday = todayStr >= c.start_date && todayStr <= c.end_date;
    const targetDate = isContToday ? todayStr : c.start_date;

    if (isContToday) {
      // Contains today's date -> It is the current cycle
      setSelectedCalendarCycle(null);
    } else {
      // Does NOT contain today's date -> Do not make it current cycle in DB, just highlight as selected
      setSelectedCalendarCycle(c);
    }
    setSelectedDate(targetDate);
    scrollToDate(targetDate);
  };

  // Collapsible Calendar View state: Collapsed to 1-week row by default for maximum transaction list space
  const [isCalendarCollapsed, setIsCalendarCollapsed] = useState<boolean>(true);

  // Navigate to previous cycle (moving calendar left)
  const goToPreviousCycle = () => {
    const currentStart = effectiveCycle?.start_date || activeCycleRange.startDate;
    const activeIdx = cycleList.findIndex((c) => c.start_date === currentStart);
    if (activeIdx > 0) {
      const prev = cycleList[activeIdx - 1];
      const isContToday = todayStr >= prev.start_date && todayStr <= prev.end_date;
      const targetDate = isContToday ? todayStr : prev.start_date;
      if (isContToday) {
        setSelectedCalendarCycle(null);
      } else {
        setSelectedCalendarCycle(prev);
      }
      setSelectedDate(targetDate);
      scrollToDate(targetDate);
    }
  };

  // Navigate to next cycle (moving calendar right)
  const goToNextCycle = () => {
    const currentStart = effectiveCycle?.start_date || activeCycleRange.startDate;
    const activeIdx = cycleList.findIndex((c) => c.start_date === currentStart);
    if (activeIdx >= 0 && activeIdx < cycleList.length - 1) {
      const next = cycleList[activeIdx + 1];
      const isContToday = todayStr >= next.start_date && todayStr <= next.end_date;
      const targetDate = isContToday ? todayStr : next.start_date;
      if (isContToday) {
        setSelectedCalendarCycle(null);
      } else {
        setSelectedCalendarCycle(next);
      }
      setSelectedDate(targetDate);
      scrollToDate(targetDate);
    }
  };

  // Calendar horizontal swipe gesture listener (swiping left for next cycle, right for previous cycle)
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx < -40) {
            goToNextCycle();
          } else if (gestureState.dx > 40) {
            goToPreviousCycle();
          }
        },
      }),
    [cycleList, currentCycle, activeCycleRange, effectiveCycle, todayStr]
  );

  // Synchronize selectedDate when activeCycleRange is changed externally (e.g. tapping cycle chip or swiping calendar)
  const prevActiveCycleStartRef = useRef<string>(activeCycleRange.startDate);
  useEffect(() => {
    if (prevActiveCycleStartRef.current !== activeCycleRange.startDate) {
      prevActiveCycleStartRef.current = activeCycleRange.startDate;
      if (activeCycleRange.startDate && activeCycleRange.endDate) {
        const isSelectedInCycle = selectedDate >= activeCycleRange.startDate && selectedDate <= activeCycleRange.endDate;
        if (!isSelectedInCycle) {
          const isTodayInCycle = todayStr >= activeCycleRange.startDate && todayStr <= activeCycleRange.endDate;
          const targetDate = isTodayInCycle ? todayStr : activeCycleRange.startDate;
          setSelectedDate(targetDate);
        }
      }
    }
  }, [activeCycleRange.startDate, activeCycleRange.endDate, selectedDate, todayStr, setSelectedDate]);

  // Generate ALL days in the whole active cycle (with weekday alignment)
  const cycleCalendarDays = useMemo(() => {
    const { startDate, endDate } = activeCycleRange;
    if (!startDate || !endDate) return [];

    const [sy, sm, sd] = startDate.split('-').map(Number);
    const [ey, em, ed] = endDate.split('-').map(Number);

    const startObj = new Date(sy, sm - 1, sd, 12, 0, 0);
    const endObj = new Date(ey, em - 1, ed, 12, 0, 0);

    const startDayOfWeek = startObj.getDay(); // 0 is Sunday

    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const days: {
      dateStr: string;
      dayNumber: number;
      monthShort: string;
      showMonthLabel: boolean;
      inCycle: boolean;
      weekIndex: number;
    }[] = [];

    // Leading padding cells so cycle start aligns on its weekday column
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({
        dateStr: '',
        dayNumber: 0,
        monthShort: '',
        showMonthLabel: false,
        inCycle: false,
        weekIndex: 0,
      });
    }

    const cur = new Date(startObj);
    let cellCount = startDayOfWeek;

    while (cur <= endObj) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const dayNumber = cur.getDate();
      const monthShort = shortMonths[cur.getMonth()];
      const weekIndex = Math.floor(cellCount / 7);

      const isCycleStart = cur.getTime() === startObj.getTime();
      const isFirstOfMonth = dayNumber === 1;
      const showMonthLabel = isCycleStart || isFirstOfMonth;

      days.push({
        dateStr,
        dayNumber,
        monthShort,
        showMonthLabel,
        inCycle: true,
        weekIndex,
      });

      cellCount++;
      cur.setDate(cur.getDate() + 1);
    }

    // Trailing padding cells to complete final week
    const remainder = cellCount % 7;
    if (remainder !== 0) {
      const needed = 7 - remainder;
      const lastWeekIndex = Math.floor((cellCount - 1) / 7);
      for (let i = 0; i < needed; i++) {
        days.push({
          dateStr: '',
          dayNumber: 0,
          monthShort: '',
          showMonthLabel: false,
          inCycle: false,
          weekIndex: lastWeekIndex,
        });
      }
    }

    return days;
  }, [activeCycleRange]);

  // Displayed calendar days: all cycle days when expanded, or 1-week row of selected date when collapsed
  const displayedCalendarDays = useMemo(() => {
    if (!isCalendarCollapsed) {
      return cycleCalendarDays;
    }
    const selectedCell = cycleCalendarDays.find((cell) => cell.dateStr === selectedDate);
    const activeWeekIndex = selectedCell?.weekIndex ?? 0;
    return cycleCalendarDays.filter((cell) => cell.weekIndex === activeWeekIndex);
  }, [cycleCalendarDays, isCalendarCollapsed, selectedDate]);

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

  // Group transactions by date
  const transactionsByDate = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    transactions.forEach((tx) => {
      if (!map[tx.date]) {
        map[tx.date] = [];
      }
      map[tx.date].push(tx);
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
  // Stable cycle mapping over cycleList ensures no jumping or layout displacement while scrolling
  const feedCycleGroups = useMemo(() => {
    if (cycleList.length === 0) return [];

    return cycleList.map((c) => {
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

      const cycleSpent = transactions
        .filter((t) => t.type === 'expense' && t.date >= c.start_date && t.date <= c.end_date)
        .reduce((sum, t) => sum + (t.base_amount || t.amount || 0), 0);

      const cycleIncome = transactions
        .filter((t) => t.type === 'income' && t.date >= c.start_date && t.date <= c.end_date)
        .reduce((sum, t) => sum + (t.base_amount || t.amount || 0), 0);

      const isCurrent = todayStr >= c.start_date && todayStr <= c.end_date;
      const isSelected = effectiveCycle ? c.start_date === effectiveCycle.start_date : isCurrent;
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
        days,
      };
    });
  }, [cycleList, transactions, todayStr, effectiveCycle?.start_date]);

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

  // Tapping a date on the calendar scrolls transactions to that date
  const handleSelectDateFromCalendar = (dateStr: string) => {
    setSelectedDate(dateStr);
    scrollToDate(dateStr);
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

      // Smoothly update effective cycle when scrolling across cycle boundaries
      const currentRange = activeCycleRangeRef.current;
      if (currentRange.startDate && currentRange.endDate) {
        if (closestDate < currentRange.startDate || closestDate > currentRange.endDate) {
          const targetCycle = cycleListRef.current.find(
            (c) => closestDate >= c.start_date && closestDate <= c.end_date
          );
          if (targetCycle && targetCycle.start_date !== effectiveCycleRef.current?.start_date) {
            const isContToday = todayStrRef.current >= targetCycle.start_date && todayStrRef.current <= targetCycle.end_date;
            effectiveCycleRef.current = isContToday ? null : targetCycle;
            setSelectedCalendarCycle(isContToday ? null : targetCycle);
          }
        }
      }
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
        {isViewingCurrentCycle ? (
          /* CURRENT CYCLE VIEW: Available for Today */
          <View style={styles.currentCycleBannerContent}>
            {/* Available for Today Row */}
            <View style={styles.todayBalanceRow}>
              <View>
                <Text
                  style={[styles.todayBalanceLabel, { color: theme.onSurfaceVariant }]}
                  maxFontSizeMultiplier={1.2}
                >
                  AVAILABLE FOR TODAY
                </Text>
                <Text
                  style={[
                    styles.todayBalanceAmount,
                    { color: dailyAllowanceStats.remainingToday >= 0 ? theme.primary : theme.error },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  maxFontSizeMultiplier={1.2}
                >
                  {wallets.length === 0 && overallBudgetLimit === 0
                    ? formatCurrency(0, settings.base_currency)
                    : formatCurrency(dailyAllowanceStats.remainingToday, settings.base_currency)}
                </Text>
              </View>

              {/* Wallet summary pill */}
              <View
                style={[
                  styles.walletSumPill,
                  {
                    backgroundColor: theme.pillBg,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="wallet-outline"
                  size={14}
                  color={theme.primary}
                />
                <Text
                  style={[
                    styles.walletSumText,
                    {
                      color: theme.onSurface,
                      fontWeight: '700',
                    },
                  ]}
                >
                  {formatCurrency(totalConvertedBalance, settings.base_currency)}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          /* NON-CURRENT CYCLE VIEW: Horizontal list of cycles with selected highlighted (not current) */
          <View>
            <View style={styles.nonCurrentHeaderRow}>
              <View style={styles.nonCurrentTitleLeft}>
                <MaterialCommunityIcons name="history" size={15} color={theme.primary} />
                <Text style={[styles.nonCurrentBrowsingLabel, { color: theme.onSurfaceVariant }]}>
                  Browsing Cycles • Tap to View
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.returnToTodayBtn, { backgroundColor: theme.primaryContainer }]}
                onPress={handleGoToToday}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="arrow-u-left-top" size={13} color={theme.onPrimaryContainer} />
                <Text style={[styles.returnToTodayText, { color: theme.onPrimaryContainer }]}>
                  Return to Current
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.cycleChipsWrapper}>
              <ScrollView
                ref={cycleScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[
                  styles.cycleChipsScroll,
                  cycleList.length <= 2 && { justifyContent: 'center', minWidth: '100%' },
                ]}
              >
                {cycleList.length === 0 && !isRegularMode ? (
                  <TouchableOpacity
                    style={[
                      styles.cycleChip,
                      {
                        backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.25)' : theme.primaryContainer,
                        borderColor: theme.primary,
                      },
                    ]}
                    onPress={() => openCycleModal()}
                    activeOpacity={0.75}
                  >
                    <MaterialCommunityIcons name="calendar-plus" size={15} color={theme.primary} />
                    <Text style={[styles.cycleChipText, { color: theme.onPrimaryContainer, fontWeight: '700' }]}>
                      + Create Custom Period
                    </Text>
                  </TouchableOpacity>
                ) : (
                  cycleList.map((c) => {
                    const isContToday = todayStr >= c.start_date && todayStr <= c.end_date;
                    const isSelected = effectiveCycle ? c.start_date === effectiveCycle.start_date : isContToday;
                    const displayName = c.name || formatCycleDateRange(c.start_date, c.end_date);
                    const dateSub = formatCycleDateRange(c.start_date, c.end_date);

                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.cycleChip,
                          {
                            backgroundColor: isSelected
                              ? (isDarkMode ? 'rgba(99, 102, 241, 0.25)' : theme.primaryContainer)
                              : theme.pillBg,
                            borderColor: isSelected ? theme.primary : isContToday ? (isDarkMode ? '#818CF8' : theme.primary) : 'transparent',
                          },
                          isSelected && M3Elevation.level1,
                        ]}
                        onPress={() => handlePressCycleChip(c, isContToday, isSelected)}
                        onLongPress={() => openCycleModal()}
                        delayLongPress={350}
                        activeOpacity={0.75}
                      >
                        <MaterialCommunityIcons
                          name={isSelected ? 'calendar-check' : isContToday ? 'calendar-star' : 'calendar-outline'}
                          size={15}
                          color={isSelected ? (isDarkMode ? '#A5B4FC' : theme.primary) : isContToday ? theme.secondary : theme.onSurfaceVariant}
                        />
                        <View style={styles.chipTextCol}>
                          <Text
                            style={[
                              styles.cycleChipText,
                              {
                                color: isSelected ? (isDarkMode ? '#E0E7FF' : theme.onPrimaryContainer) : theme.onSurface,
                                fontWeight: isSelected || isContToday ? '800' : '600',
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {displayName}
                          </Text>
                          {c.name && c.name !== dateSub && (
                            <Text
                              style={[
                                styles.cycleChipSubText,
                                {
                                  color: isSelected ? (isDarkMode ? '#C7D2FE' : theme.primary) : theme.onSurfaceVariant,
                                },
                              ]}
                              numberOfLines={1}
                            >
                              {dateSub}
                            </Text>
                          )}
                        </View>
                        {isContToday && !isSelected && (
                          <View
                            style={[
                              styles.activeBadgePill,
                              { backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.35)' : theme.primaryContainer },
                            ]}
                          >
                            <Text style={[styles.activeBadgeText, { color: isDarkMode ? '#C7D2FE' : theme.primary }]}>
                              Current
                            </Text>
                          </View>
                        )}
                        {isSelected && (
                          <View
                            style={[
                              styles.activeBadgePill,
                              { backgroundColor: isDarkMode ? '#818CF8' : theme.primary },
                            ]}
                          >
                            <Text style={[styles.activeBadgeText, { color: isDarkMode ? '#0F172A' : theme.onPrimary }]}>
                              {isContToday ? 'Current' : 'Selected'}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}

                {!isRegularMode && cycleList.length > 0 && (
                  <TouchableOpacity
                    style={[
                      styles.cycleChip,
                      {
                        backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : theme.pillBg,
                        borderColor: 'transparent',
                      },
                    ]}
                    onPress={() => openCycleModal()}
                    activeOpacity={0.75}
                  >
                    <MaterialCommunityIcons name="plus" size={15} color={theme.primary} />
                    <Text style={[styles.cycleChipText, { color: theme.primary, fontWeight: '700' }]}>
                      Add Period
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          </View>
        )}

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
            onPress={openCycleModal}
            activeOpacity={0.8}
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

            {/* Main Headline: Amount To Go */}
            <View style={styles.heroAmountRow}>
              <Text
                style={[styles.switcherTabAmount, { color: isDarkMode ? '#34D399' : theme.success }]}
                numberOfLines={1}
              >
                {incomeSwitcherProgress.hasGoal
                  ? formatCurrency(incomeSwitcherProgress.remaining, curr)
                  : '+ Set Goal'}
              </Text>
              {incomeSwitcherProgress.hasGoal && (
                <Text style={[styles.heroAmountCaption, { color: theme.onSurfaceVariant }]}>TO GO</Text>
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
            onPress={openCycleModal}
            activeOpacity={0.8}
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

            {/* Main Headline: Amount Left */}
            <View style={styles.heroAmountRow}>
              <Text
                style={[
                  styles.switcherTabAmount,
                  { color: expenseSwitcherProgress.isOver ? (isDarkMode ? '#F87171' : '#DC2626') : (isDarkMode ? '#F87171' : theme.error) },
                ]}
                numberOfLines={1}
              >
                {expenseSwitcherProgress.hasTarget
                  ? expenseSwitcherProgress.isOver
                    ? `-${formatCurrency(expenseSwitcherProgress.overBy, curr)}`
                    : formatCurrency(expenseSwitcherProgress.remaining, curr)
                  : '+ Set Cap'}
              </Text>
              {expenseSwitcherProgress.hasTarget && (
                <Text style={[styles.heroAmountCaption, { color: theme.onSurfaceVariant }]}>LEFT</Text>
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

      {/* 2. DOCKED CALENDAR SECTION (COLLAPSIBLE, SWIPEABLE FOR PREV/NEXT CYCLE) */}
      <View
        style={[
          styles.dockedCalendarContainer,
          {
            backgroundColor: theme.surface,
            borderBottomColor: theme.divider,
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* CALENDAR CYCLE HEADER WITH PREV / NEXT CYCLE BUTTONS */}
        <View style={styles.monthHeaderRow}>
          <TouchableOpacity
            style={styles.cycleNavArrowBtn}
            onPress={goToPreviousCycle}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Previous Cycle"
          >
            <MaterialCommunityIcons name="chevron-left" size={24} color={theme.onSurface} />
          </TouchableOpacity>

          <View style={{ flex: 1, marginHorizontal: 4 }}>
            <Text style={[styles.monthTitle, { color: theme.onSurface }]} numberOfLines={1}>
              {activeCycleRange.name}
            </Text>
            <Text style={[styles.cycleViewModeSub, { color: theme.onSurfaceVariant }]}>
              {isCalendarCollapsed ? 'Week View • Tap to expand' : 'Full Cycle View • Tap to collapse'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.cycleNavArrowBtn}
            onPress={goToNextCycle}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Next Cycle"
          >
            <MaterialCommunityIcons name="chevron-right" size={24} color={theme.onSurface} />
          </TouchableOpacity>

          <View style={styles.calendarHeaderRightActions}>
            <TouchableOpacity
              style={[styles.todayBtn, { backgroundColor: theme.pillBg }]}
              onPress={handleGoToToday}
              activeOpacity={0.7}
            >
              <Text style={[styles.todayBtnText, { color: theme.primary }]}>Today</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.collapseToggleBtn,
                {
                  backgroundColor: isCalendarCollapsed
                    ? (isDarkMode ? 'rgba(99, 102, 241, 0.22)' : theme.primaryContainer)
                    : theme.pillBg,
                },
              ]}
              onPress={() => setIsCalendarCollapsed(!isCalendarCollapsed)}
              activeOpacity={0.7}
              accessibilityLabel={isCalendarCollapsed ? 'Expand Calendar to Full Cycle' : 'Collapse Calendar to Week View'}
            >
              <MaterialCommunityIcons
                name={isCalendarCollapsed ? 'calendar-expand-horizontal' : 'calendar-collapse-horizontal'}
                size={14}
                color={isCalendarCollapsed ? (isDarkMode ? '#A5B4FC' : theme.primary) : theme.onSurfaceVariant}
              />
              <Text
                style={[
                  styles.collapseToggleText,
                  {
                    color: isCalendarCollapsed ? (isDarkMode ? '#E0E7FF' : theme.onPrimaryContainer) : theme.onSurfaceVariant,
                    fontWeight: isCalendarCollapsed ? '800' : '600',
                  },
                ]}
              >
                {isCalendarCollapsed ? 'Expand' : 'Collapse'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* WEEKDAYS ROW */}
        <View style={styles.weekdaysRow}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <Text key={d} style={[styles.weekdayText, { color: theme.onSurfaceVariant }]}>
              {d}
            </Text>
          ))}
        </View>

        {/* CALENDAR GRID (FULL CYCLE OR 1-WEEK ROW) */}
        <View style={styles.gridContainer}>
          {displayedCalendarDays.map((cell, idx) => {
            if (!cell.inCycle) {
              return <View key={idx} style={styles.emptyCell} />;
            }

            const isSelected = cell.dateStr === selectedDate;
            const spend = dailySpendMap[cell.dateStr] || 0;
            const hasSpend = spend > 0;
            const isToday = cell.dateStr === new Date().toISOString().slice(0, 10);

            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.calendarCell,
                  {
                    backgroundColor: isSelected ? theme.primaryContainer : theme.cardBg,
                    borderColor: isSelected ? theme.primary : isToday ? theme.secondary : theme.divider,
                  },
                  isSelected && M3Elevation.level1,
                ]}
                onPress={() => handleSelectDateFromCalendar(cell.dateStr)}
                activeOpacity={0.7}
              >
                {cell.showMonthLabel && (
                  <Text
                    style={[
                      styles.cellMonthLabel,
                      {
                        color: isSelected ? (isDarkMode ? '#C7D2FE' : theme.primary) : theme.primary,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {cell.monthShort}
                  </Text>
                )}
                <Text
                  style={[
                    styles.cellDayNum,
                    {
                      color: isSelected ? theme.onPrimaryContainer : theme.onSurface,
                      fontWeight: isSelected || isToday ? '800' : '500',
                    },
                  ]}
                >
                  {cell.dayNumber}
                </Text>

                {hasSpend && (
                  <View style={[styles.spendDot, { backgroundColor: spend > 80 ? theme.error : theme.primary }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* COLLAPSE / EXPAND HANDLE BAR (ALLOWS QUICK TOGGLE FOR MORE TRANSACTION ROOM) */}
        <TouchableOpacity
          style={styles.collapseHandleBar}
          onPress={() => setIsCalendarCollapsed(!isCalendarCollapsed)}
          activeOpacity={0.7}
        >
          <View style={[styles.collapseHandlePill, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.18)' : theme.divider }]} />
          <View style={styles.collapseHintRow}>
            <MaterialCommunityIcons
              name={isCalendarCollapsed ? 'chevron-down' : 'chevron-up'}
              size={14}
              color={theme.onSurfaceVariant}
            />
            <Text style={[styles.collapseHintText, { color: theme.onSurfaceVariant }]}>
              {isCalendarCollapsed ? 'Show Full Cycle Calendar' : 'Collapse to Week View for More Room'}
            </Text>
          </View>
        </TouchableOpacity>
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
          <React.Fragment key={group.cycle.id || group.startDate}>
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

              return (
                <View
                  key={dateStr}
                  onLayout={(e) => {
                    dayLayoutsRef.current[dateStr] = e.nativeEvent.layout.y;
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
                  <View style={styles.daySectionHeader}>
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
                  </View>

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

                      return (
                        <TouchableOpacity
                          key={tx.id}
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
                      );
                    })
                  )}
                </View>
              );
            })}
          </React.Fragment>
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
                Total: {formatCurrency(effectiveSpent, curr)}
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
                Total: {formatCurrency(effectiveIncome, curr)}
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
  dayTxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: M3Shape.large,
    padding: 12,
    marginBottom: 8,
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
