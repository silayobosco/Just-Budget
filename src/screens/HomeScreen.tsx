import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  PanResponder,
  useWindowDimensions,
  TextInput,
  Alert,
  Keyboard,
  Pressable,
  Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBudget } from '../context/BudgetContext';
import { getDB } from '../services/db';
import { lightTheme, darkTheme, M3Shape, M3Elevation } from '../theme';
import { Transaction, TransactionType, BillFrequency, RecurrenceEndType } from '../types';
import { formatCurrency, formatTypingNumber, parseCleanNumber } from '../utils/format';
import { formatLocalDate } from '../utils/date';
import { CategoryManagerModal } from '../components/CategoryManagerModal';
import { CategoryPickerSheet } from '../components/CategoryPickerSheet';
import { TransactionDetailsModal } from '../components/TransactionDetailsModal';
import { DateRangePickerModal } from '../components/DateRangePickerModal';
import { CycleModeSwitcherModal } from '../components/CycleModeSwitcherModal';
import { OverdueBillReminderBanner } from '../components/OverdueBillReminderBanner';

import { TabType } from '../components/BottomTabs';

// Safe arithmetic evaluator for basic calculation on dialpad
export const evaluateMathExpression = (expr: string): number => {
  if (!expr) return 0;
  let clean = expr.replace(/Ã—/g, '*').replace(/Ã·/g, '/').replace(/,/g, '');
  clean = clean.replace(/[+\-*/.]+$/, '').trim();
  if (!clean) return 0;
  try {
    if (!/^[0-9+\-*/. ()]+$/.test(clean)) return 0;
    const result = new Function(`"use strict"; return (${clean})`)();
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return Math.round(result * 100) / 100;
    }
  } catch { }
  return parseFloat(clean) || 0;
};

interface HomeScreenProps {
  onNavigateTab?: (tab: TabType) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigateTab }) => {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  // Responsive device tiers
  const isTinyScreen = windowHeight < 660; // e.g. iPhone SE, compact budget Androids
  const isCompactScreen = windowHeight < 740; // e.g. iPhone 13 mini, compact displays

  // Collapsed sheet snap points: default 90, with 170 / 190 / 317 depending on where user left it last
  const COLLAPSED_SNAPS = [90, 170, 200, 317] as const;

  const [collapsedHeight, setCollapsedHeight] = useState<number>(() => {
    try {
      const db = getDB();
      const row = db.getFirstSync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'home_collapsed_sheet_height'"
      );
      if (row?.value) {
        const val = parseInt(row.value, 10);
        if ([90, 170, 190, 317].includes(val)) {
          return val;
        }
      }
    } catch { }
    return 90;
  });

  const saveCollapsedHeight = (height: number) => {
    try {
      const db = getDB();
      db.runSync(
        `INSERT INTO settings (key, value) VALUES ('home_collapsed_sheet_height', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [height.toString()]
      );
    } catch (err) {
      console.error('Failed to save home_collapsed_sheet_height:', err);
    }
  };

  // Basic Calculation Side of Keyboard toggle state (persisted in SQLite)
  const [showCalcSide, setShowCalcSide] = useState<boolean>(() => {
    try {
      const db = getDB();
      const row = db.getFirstSync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'home_show_calc_side'"
      );
      return row?.value === '1';
    } catch { }
    return false;
  });

  const toggleCalcSide = () => {
    setShowCalcSide((prev) => {
      const next = !prev;
      try {
        const db = getDB();
        db.runSync(
          `INSERT INTO settings (key, value) VALUES ('home_show_calc_side', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          [next ? '1' : '0']
        );
      } catch (err) {
        console.error('Failed to save home_show_calc_side:', err);
      }
      return next;
    });
  };

  // Responsive dial pad, button and row dimensions
  const dialKeyHeight = isTinyScreen ? 38 : isCompactScreen ? 42 : 46;
  const dialRowMargin = isTinyScreen ? 4 : isCompactScreen ? 5 : 6;
  const dialKeyFontSize = isTinyScreen ? 20 : isCompactScreen ? 22 : 23;
  const recordButtonHeight = isTinyScreen ? 46 : isCompactScreen ? 48 : 52;
  const amountFontSize = isTinyScreen ? 32 : isCompactScreen ? 38 : 44;

  const {
    settings,
    dailyAllowanceStats,
    totalConvertedBalance,
    totalSpendableBalance,
    spentInCycle,
    incomeInCycle,
    currentCycle,
    overallBudgetLimit,
    categoryBudgetProgressList,
    budgets,
    transactions,
    recurringBills,
    debts,
    payRecurringBill,
    categories,
    wallets,
    addTransaction,
    addWallet,
    addSubcategory,
    addRecurringBill,
    updateBudgetCycle,
    updateCurrentCycleTarget,
    updateSettings,
    transferBetweenWallets,
    deleteTransaction,
    getEffectiveAmount,
    setAnalyticsFocus,
    setSelectedCalendarDate,
    setSelectedTransactionIdForCalendar,
    isCycleModalOpen,
    closeCycleModal,
  } = useBudget();

  const theme = settings.theme_mode === 'dark' ? darkTheme : lightTheme;
  const curr = settings.base_currency;
  const isDarkMode = settings.theme_mode === 'dark';

  // Quick Target Dialogue State (Long-press on Income Goal / Budget Cap)
  const [quickTargetModalVisible, setQuickTargetModalVisible] = useState<boolean>(false);
  const [quickTargetType, setQuickTargetType] = useState<'budget' | 'income'>('budget');
  const [quickTargetInput, setQuickTargetInput] = useState<string>('');

  // Daily Allowance Breakdown Modal State (Triggered on Tap of Available for Today Amount)
  const [allowanceDetailVisible, setAllowanceDetailVisible] = useState<boolean>(false);

  const handleOpenQuickTarget = (type: 'budget' | 'income') => {
    setQuickTargetType(type);
    if (type === 'budget') {
      const val = currentCycle?.target_budget ? formatTypingNumber(currentCycle.target_budget.toString()) : '';
      setQuickTargetInput(val);
    } else {
      const val = currentCycle?.target_income ? formatTypingNumber(currentCycle.target_income.toString()) : '';
      setQuickTargetInput(val);
    }
    setQuickTargetModalVisible(true);
  };

  const handleSaveQuickTarget = async () => {
    const num = parseCleanNumber(quickTargetInput);
    await updateCurrentCycleTarget(quickTargetType, num);
    setQuickTargetModalVisible(false);
  };

  // Amount & Wallet Entry State
  const [amountStr, setAmountStr] = useState<string>('0');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');

  // 2-Step Recording Modals State
  const [activeTxType, setActiveTxType] = useState<TransactionType>('expense');
  const [keypadSheetVisible, setKeypadSheetVisible] = useState(false);
  const [keypadType, setKeypadType] = useState<'expense' | 'income'>('expense');
  const [loanModalVisible, setLoanModalVisible] = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [prefilledCategoryId, setPrefilledCategoryId] = useState<string | undefined>(undefined);
  const [prefilledSubcategoryId, setPrefilledSubcategoryId] = useState<string | undefined>(undefined);

  // Floating Action Button (FAB) Speed-Dial states
  const [isFabOpen, setIsFabOpen] = useState(false);
  const fabAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(fabAnim, {
      toValue: isFabOpen ? 1 : 0,
      useNativeDriver: true,
      tension: 65,
      friction: 10,
    }).start();
  }, [isFabOpen, fabAnim]);

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

  // Quick Wallet modal
  const [quickWalletModalVisible, setQuickWalletModalVisible] = useState(false);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletBal, setNewWalletBal] = useState('0');

  // Category Manager modal
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);

  // Budget Cycle & Date Range Modal State
  const [cycleModalVisible, setCycleModalVisible] = useState(false);
  const [cycleModeModalVisible, setCycleModeModalVisible] = useState(false);
  const [dateRangePickerVisible, setDateRangePickerVisible] = useState(false);

  // Auto-select initial wallet
  useEffect(() => {
    if (wallets.length > 0 && !selectedWalletId) {
      const preferred = wallets.find((w) => w.is_default) || wallets[0];
      setSelectedWalletId(preferred.id);
    }
  }, [wallets, selectedWalletId]);

  // Cursor tracking inside amount input
  const [amountSelection, setAmountSelection] = useState<{ start: number; end: number }>({
    start: 1,
    end: 1,
  });
  const amountInputRef = useRef<any>(null);

  // Keep amount input focused so cursor is visible, ensuring system soft keyboard is never shown
  useEffect(() => {
    Keyboard.dismiss();
    const timer = setTimeout(() => {
      amountInputRef.current?.focus();
      Keyboard.dismiss();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // Handle direct text changes
  const handleAmountChange = (text: string) => {
    if (!text || text === '') {
      setAmountStr('0');
      setAmountSelection({ start: 1, end: 1 });
      return;
    }
    const cleaned = text.replace(/[*]/g, 'Ã—').replace(/[/]/g, 'Ã·').replace(/[^0-9.+Ã—Ã·\- ,]/g, '');
    const formatted = formatTypingNumber(cleaned);
    setAmountStr(formatted || '0');
  };

  // Dial Pad Keypress (Digits, Decimal, Calculation Operators & Equals)
  const handleKeyPress = (val: string) => {
    amountInputRef.current?.focus();
    const rawStart = amountSelection.start ?? amountStr.length;
    const rawEnd = amountSelection.end ?? amountStr.length;
    const curStart = Math.min(amountStr.length, Math.max(0, rawStart));
    const curEnd = Math.min(amountStr.length, Math.max(0, rawEnd));

    if (val === 'clear') {
      setAmountStr('0');
      setAmountSelection({ start: 1, end: 1 });
      setTimeout(() => amountInputRef.current?.setSelection?.(1, 1), 10);
      return;
    }

    if (val === 'backspace') {
      if (curStart !== curEnd) {
        const before = amountStr.slice(0, curStart);
        const after = amountStr.slice(curEnd);
        const nextClean = (before + after).replace(/,/g, '');
        const next = formatTypingNumber(nextClean) || '0';
        setAmountStr(next);
        const newPos = Math.min(next.length, curStart);
        setAmountSelection({ start: newPos, end: newPos });
        setTimeout(() => amountInputRef.current?.setSelection?.(newPos, newPos), 10);
      } else if (curStart > 0) {
        let deleteCount = 1;
        // If backspacing over a spaced operator like " + ", remove cleanly
        if (curStart >= 2 && amountStr.slice(curStart - 2, curStart) === ' ') {
          deleteCount = 2;
        } else if (curStart >= 3 && amountStr.slice(curStart - 3, curStart).endsWith(' ')) {
          deleteCount = 3;
        } else if (amountStr[curStart - 1] === ',') {
          deleteCount = 2;
        }
        const before = amountStr.slice(0, Math.max(0, curStart - deleteCount));
        const after = amountStr.slice(curEnd);
        const nextClean = (before + after).replace(/,/g, '');
        const next = formatTypingNumber(nextClean) || '0';
        setAmountStr(next);

        const cleanBeforeLen = before.replace(/,/g, '').length;
        let newPos = next.length;
        let passed = 0;
        for (let i = 0; i < next.length; i++) {
          if (next[i] !== ',') passed++;
          if (passed === cleanBeforeLen) {
            newPos = i + 1;
            break;
          }
        }
        if (cleanBeforeLen === 0) newPos = next === '0' ? 1 : 0;
        setAmountSelection({ start: newPos, end: newPos });
        setTimeout(() => amountInputRef.current?.setSelection?.(newPos, newPos), 10);
      }
      return;
    }

    // Equals ('=') evaluates the math expression immediately
    if (val === '=') {
      const result = evaluateMathExpression(amountStr);
      const resStr = formatTypingNumber(result.toString());
      setAmountStr(resStr);
      setAmountSelection({ start: resStr.length, end: resStr.length });
      setTimeout(() => amountInputRef.current?.setSelection?.(resStr.length, resStr.length), 10);
      return;
    }

    // Basic calculation operators (+, -, Ã—, Ã·)
    if (['+', '-', 'Ã—', 'Ã·'].includes(val)) {
      // If trailing operator already exists, replace it
      const operatorRegex = / [+\-Ã—Ã·] $/;
      if (operatorRegex.test(amountStr)) {
        const next = amountStr.replace(operatorRegex, ` ${val} `);
        setAmountStr(next);
        setAmountSelection({ start: next.length, end: next.length });
        return;
      }
      // If equation already has a first number and operator, solve first then chain operator
      if (/[0-9] [+\-Ã—Ã·] [0-9]/.test(amountStr)) {
        const result = evaluateMathExpression(amountStr);
        const next = `${formatTypingNumber(result.toString())} ${val} `;
        setAmountStr(next);
        setAmountSelection({ start: next.length, end: next.length });
        return;
      }
      const next = `${amountStr} ${val} `;
      setAmountStr(next);
      setAmountSelection({ start: next.length, end: next.length });
      setTimeout(() => amountInputRef.current?.setSelection?.(next.length, next.length), 10);
      return;
    }

    if (val === '.') {
      // Check last number segment in amountStr
      const parts = amountStr.split(/ [+\-Ã—Ã·] /);
      const lastPart = parts[parts.length - 1] || '';
      if (lastPart.includes('.')) {
        const selectedText = amountStr.slice(curStart, curEnd);
        if (!selectedText.includes('.')) return;
      }
      const before = amountStr.slice(0, curStart);
      const after = amountStr.slice(curEnd);
      const next = before + '.' + after;
      setAmountStr(next);
      const nextPos = curStart + 1;
      setAmountSelection({ start: nextPos, end: nextPos });
      setTimeout(() => amountInputRef.current?.setSelection?.(nextPos, nextPos), 10);
      return;
    }

    // Digit typed
    if (amountStr === '0') {
      setAmountStr(val);
      setAmountSelection({ start: 1, end: 1 });
      setTimeout(() => amountInputRef.current?.setSelection?.(1, 1), 10);
      return;
    }

    const before = amountStr.slice(0, curStart);
    const after = amountStr.slice(curEnd);
    const rawCandidate = before + val + after;
    const cleanCandidate = rawCandidate.replace(/,/g, '');

    // Check decimal constraint on current number segment
    const segments = cleanCandidate.split(/ [+\-Ã—Ã·] /);
    const currentSegment = segments[segments.length - 1] || '';
    const decParts = currentSegment.split('.');
    if (decParts.length === 2 && decParts[1].length > 2) return;
    if (cleanCandidate.replace(/[^0-9]/g, '').length >= 15) return;

    const formattedCandidate = formatTypingNumber(cleanCandidate);
    setAmountStr(formattedCandidate);

    const cleanBeforeLen = (before + val).replace(/,/g, '').length;
    let nextPos = formattedCandidate.length;
    let passed = 0;
    for (let i = 0; i < formattedCandidate.length; i++) {
      if (formattedCandidate[i] !== ',') passed++;
      if (passed === cleanBeforeLen) {
        nextPos = i + 1;
        break;
      }
    }
    setAmountSelection({ start: nextPos, end: nextPos });
    setTimeout(() => amountInputRef.current?.setSelection?.(nextPos, nextPos), 10);
  };

  // Math calculation properties
  const hasOperator = useMemo(() => /[+\-Ã—Ã·]/.test(amountStr), [amountStr]);
  const isEquationReady = useMemo(() => /[0-9] [+\-Ã—Ã·] [0-9]/.test(amountStr), [amountStr]);
  const evaluatedAmount = useMemo(() => evaluateMathExpression(amountStr), [amountStr]);
  const parsedAmount = evaluatedAmount;

  // Responsive font size for longer calculation expressions
  const dynamicAmountFontSize = useMemo(() => {
    if (amountStr.length > 11) {
      return isTinyScreen ? 20 : isCompactScreen ? 24 : 28;
    }
    if (amountStr.length > 7) {
      return isTinyScreen ? 25 : isCompactScreen ? 30 : 34;
    }
    return amountFontSize;
  }, [amountStr, isTinyScreen, isCompactScreen, amountFontSize]);

  // Dial pad row configurations (3 columns vs 4 columns with basic calculation side)
  const dialPadRows = useMemo(() => {
    if (!showCalcSide) {
      return [
        ['1', '2', '3'],
        ['4', '5', '6'],
        ['7', '8', '9'],
        ['.', '0', 'backspace'],
      ];
    }
    return [
      ['1', '2', '3', 'Ã·'],
      ['4', '5', '6', 'Ã—'],
      ['7', '8', '9', '-'],
      ['.', '0', 'backspace', isEquationReady ? '=' : '+'],
    ];
  }, [showCalcSide, isEquationReady]);

  // Duplicate warning detection
  const isDuplicate = useMemo(() => {
    if (parsedAmount <= 0 || !selectedWalletId) return false;
    const today = formatLocalDate(new Date());
    return transactions.some((t) => {
      return (
        t.date === today &&
        t.wallet_id === selectedWalletId &&
        Math.abs(t.amount - parsedAmount) < 0.001
      );
    });
  }, [transactions, selectedWalletId, parsedAmount]);

  // Budget Cap Progress
  const expenseSwitcherProgress = useMemo(() => {
    const hasTarget = overallBudgetLimit > 0;
    const percent = hasTarget ? Math.round((spentInCycle / overallBudgetLimit) * 100) : 0;
    const isOver = hasTarget && spentInCycle > overallBudgetLimit;
    const remaining = Math.max(0, overallBudgetLimit - spentInCycle);
    const overBy = Math.max(0, spentInCycle - overallBudgetLimit);

    return {
      hasTarget,
      percent,
      isOver,
      remaining,
      overBy,
      badgeText: hasTarget ? (isOver ? `âš ï¸ ${percent}%` : `${percent}%`) : '+ Set Cap',
      subText: hasTarget
        ? isOver
          ? `âš ï¸ ${formatCurrency(overBy, curr)} over`
          : `${formatCurrency(remaining, curr)} left of ${formatCurrency(overallBudgetLimit, curr)}`
        : 'Tap to set budget cap',
    };
  }, [overallBudgetLimit, spentInCycle, curr]);

  // Income Goal Progress
  const incomeSwitcherProgress = useMemo(() => {
    const goal = currentCycle?.target_income && currentCycle.target_income > 0 ? currentCycle.target_income : 0;
    const hasGoal = goal > 0;
    const percent = hasGoal ? Math.round((incomeInCycle / goal) * 100) : 0;
    const isReached = hasGoal && incomeInCycle >= goal;
    const remaining = Math.max(0, goal - incomeInCycle);

    return {
      hasGoal,
      goal,
      percent,
      isReached,
      remaining,
      badgeText: hasGoal ? (isReached ? 'ðŸŽ‰ 100%' : `${percent}%`) : '+ Set Goal',
      subText: hasGoal
        ? isReached
          ? 'ðŸŽ‰ Goal reached'
          : `${formatCurrency(remaining, curr)} to reach goal`
        : 'Tap to set income goal',
    };
  }, [currentCycle, incomeInCycle, curr]);

  // Flow Triggers: Open Keypad Sheet or Record Income/Expense
  const handleOpenKeypad = (type: 'expense' | 'income') => {
    setKeypadType(type);
    setKeypadSheetVisible(true);
    setTimeout(() => {
      amountInputRef.current?.focus();
      Keyboard.dismiss();
    }, 120);
  };

  const handleOpenRecordFlow = (type: TransactionType) => {
    if (parsedAmount <= 0) {
      Alert.alert('Enter Amount', `Please enter an amount greater than 0 before recording ${type}.`);
      return;
    }
    // If user has a calculation pending, resolve it to final value
    if (hasOperator) {
      setAmountStr(parsedAmount.toString());
    }
    if (!selectedWalletId && wallets.length === 0) {
      setKeypadSheetVisible(false);
      setNewWalletName('');
      setNewWalletBal('0');
      setQuickWalletModalVisible(true);
      return;
    }
    setKeypadSheetVisible(false);
    setActiveTxType(type);
    setCategoryPickerVisible(true);
  };

  // Step 1: Fast Save from Category Picker Sheet
  const handleQuickSaveCategory = async ({
    categoryId,
    subcategoryId,
  }: {
    categoryId?: string;
    subcategoryId?: string;
  }) => {
    const todayStr = formatLocalDate(new Date());
    const d = new Date();
    const timeNow = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    await addTransaction({
      wallet_id: selectedWalletId || wallets[0].id,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      type: activeTxType,
      amount: parsedAmount,
      currency: curr,
      date: todayStr,
      time: timeNow,
      is_paid: true,
    });

    setAmountStr('0');
    setCategoryPickerVisible(false);
  };

  // Step 1: Open Step 2 Full Details
  const handleOpenMoreOptions = ({
    categoryId,
    subcategoryId,
  }: {
    categoryId?: string;
    subcategoryId?: string;
  }) => {
    setPrefilledCategoryId(categoryId);
    setPrefilledSubcategoryId(subcategoryId);
    setCategoryPickerVisible(false);
    setTimeout(() => {
      setDetailsModalVisible(true);
    }, 280);
  };

  // Step 2: Save Full Details
  const handleSaveTransactionDetails = async (txData: {
    amount: number;
    wallet_id: string;
    to_wallet_id?: string;
    category_id?: string;
    subcategory_id?: string;
    type: TransactionType;
    currency: string;
    date: string;
    time?: string;
    is_paid: boolean;
    tax_amount?: number;
    note?: string;
    media_uri?: string;
    repeat_frequency?: BillFrequency;
    repeat_due_day?: number;
    repeat_end_type?: RecurrenceEndType;
    repeat_end_occurrences?: number;
    repeat_end_date?: string;
    reminder_enabled?: boolean;
  }) => {
    await addTransaction({
      wallet_id: txData.wallet_id,
      to_wallet_id: txData.to_wallet_id,
      category_id: txData.category_id,
      subcategory_id: txData.subcategory_id,
      type: txData.type,
      amount: txData.amount,
      currency: txData.currency,
      date: txData.date,
      time: txData.time,
      is_paid: txData.is_paid,
      tax_amount: txData.tax_amount,
      note: txData.note,
      media_uri: txData.media_uri,
      repeat_frequency: txData.repeat_frequency,
      repeat_due_day: txData.repeat_due_day,
      repeat_end_type: txData.repeat_end_type,
      repeat_end_occurrences: txData.repeat_end_occurrences,
      repeat_end_date: txData.repeat_end_date,
      reminder_enabled: txData.reminder_enabled,
    });

    setAmountStr('0');
    setDetailsModalVisible(false);
  };

  // Quick Add Wallet
  const handleSaveQuickWallet = async () => {
    if (!newWalletName.trim()) return;
    const initialBal = parseCleanNumber(newWalletBal);
    await addWallet({
      name: newWalletName.trim(),
      currency: curr,
      starting_balance: initialBal,
      color: '#3B82F6',
      icon: 'wallet',
    });
    setNewWalletName('');
    setNewWalletBal('0');
    setQuickWalletModalVisible(false);
  };

  // Budget Cycle & Visual Date Range handlers
  const handleSaveCycle = async (params: {
    id?: string;
    name: string;
    start_date: string;
    end_date: string;
    target_budget?: number;
    target_income?: number;
  }) => {
    await updateBudgetCycle(params);
  };

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

  // Group transactions descending by date for History Sheet
  const groupedTransactions = useMemo(() => {
    const map = new Map<string, any[]>();
    transactions.forEach((tx) => {
      const d = tx.date;
      if (!map.has(d)) {
        map.set(d, []);
      }
      map.get(d)!.push(tx);
    });

    const groups: {
      date: string;
      displayDate: string;
      totalSpent: number;
      totalIncome: number;
      items: any[];
    }[] = [];

    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .forEach(([d, items]) => {
        let displayDate = d;
        if (d === todayStr) displayDate = 'Today';
        else if (d === yesterdayStr) displayDate = 'Yesterday';

        const daySpent = items
          .filter((t) => t.type === 'expense')
          .reduce((sum, t) => sum + (t.amount || t.base_amount || 0), 0);
        const dayIncome = items
          .filter((t) => t.type === 'income')
          .reduce((sum, t) => sum + (t.amount || t.base_amount || 0), 0);

        const sortedItems = [...items].sort((a, b) => {
          const timeA = a.created_at || a.id;
          const timeB = b.created_at || b.id;
          return timeB.localeCompare(timeA);
        });

        groups.push({
          date: d,
          displayDate,
          totalSpent: daySpent,
          totalIncome: dayIncome,
          items: sortedItems,
        });
      });

    return groups;
  }, [transactions]);

  // Measured layout heights for top sheet pull-down
  const [screenContainerHeight, setScreenContainerHeight] = useState(0);

  const maxExpandedSheetHeight = useMemo(() => {
    if (screenContainerHeight > 0) {
      return Math.max(380, screenContainerHeight - 6);
    }
    return Math.max(380, windowHeight - 210);
  }, [screenContainerHeight, windowHeight]);

  const historyContentHeight = useMemo(() => {
    if (transactions.length === 0) return 75;
    const groupsHeight = groupedTransactions.length * 30 + Math.max(0, groupedTransactions.length - 1) * 14;
    const itemsHeight = transactions.length * 60;
    return groupsHeight + itemsHeight;
  }, [groupedTransactions, transactions]);

  const expandedSheetHeight = useMemo(() => {
    const totalTarget = 240 + historyContentHeight;
    return Math.min(maxExpandedSheetHeight, Math.max(380, totalTarget));
  }, [historyContentHeight, maxExpandedSheetHeight]);

  const historyScrollRef = useRef<any>(null);
  const animatedHeight = useRef(new Animated.Value(collapsedHeight)).current;
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const isExpandedRef = useRef(false);
  const currentHeightRef = useRef(collapsedHeight);
  const gestureStartHeightRef = useRef(collapsedHeight);

  useEffect(() => {
    if (isExpandedRef.current) {
      Animated.timing(animatedHeight, {
        toValue: expandedSheetHeight,
        duration: 180,
        useNativeDriver: false,
      }).start();
    }
  }, [expandedSheetHeight]);

  // Smoothly reveal history sticky header when expanding past 317 toward expandedSheetHeight
  const historyHeaderOpacity = animatedHeight.interpolate({
    inputRange: [317, 360],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const historyHeaderHeight = animatedHeight.interpolate({
    inputRange: [317, 360],
    outputRange: [0, 40],
    extrapolate: 'clamp',
  });

  // Smoothly fade target cards (Income Goal & Budget Cap) between 90 and 170
  const dualCardsOpacity = animatedHeight.interpolate({
    inputRange: [90, 140, 170],
    outputRange: [0, 0.4, 1],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    const id = animatedHeight.addListener(({ value }) => {
      currentHeightRef.current = value;
    });
    return () => {
      animatedHeight.removeListener(id);
    };
  }, [animatedHeight]);

  const openSheet = () => {
    Animated.spring(animatedHeight, {
      toValue: expandedSheetHeight,
      useNativeDriver: false,
      bounciness: 3,
      speed: 14,
    }).start();
    setIsSheetExpanded(true);
    isExpandedRef.current = true;
  };

  const snapToCollapsed = (snapHeight: number) => {
    Animated.spring(animatedHeight, {
      toValue: snapHeight,
      useNativeDriver: false,
      bounciness: 3,
      speed: 14,
    }).start(() => {
      historyScrollRef.current?.scrollTo?.({ y: 0, animated: false });
    });
    setIsSheetExpanded(false);
    isExpandedRef.current = false;
    setCollapsedHeight(snapHeight);
    saveCollapsedHeight(snapHeight);
  };

  const closeSheet = () => {
    snapToCollapsed(collapsedHeight);
  };

  // Dashboard glance stats: Savings Rate, Loans Summary, Next Bill, Recent Transactions
  const savingsRateStats = useMemo(() => {
    const net = incomeInCycle - spentInCycle;
    const rate = incomeInCycle > 0 ? Math.round((net / incomeInCycle) * 100) : 0;
    return { net, rate, hasIncome: incomeInCycle > 0 };
  }, [incomeInCycle, spentInCycle]);

  const loansSummary = useMemo(() => {
    const open = debts.filter((d) => d.status === 'open');
    const owedToYou = open
      .filter((d) => d.type === 'lent')
      .reduce((sum, d) => sum + Math.max(0, d.amount - (d.paid_amount || 0)), 0);
    const youOwe = open
      .filter((d) => d.type === 'borrowed')
      .reduce((sum, d) => sum + Math.max(0, d.amount - (d.paid_amount || 0)), 0);
    return { openCount: open.length, owedToYou, youOwe };
  }, [debts]);

  const nextBill = useMemo(() => {
    const todayStr = formatLocalDate(new Date());
    const upcoming = recurringBills
      .filter((b) => b.is_active && b.next_due_date > todayStr)
      .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date));
    return upcoming[0] || null;
  }, [recurringBills]);

  const recentTransactions = useMemo(() => {
    const todayStr = formatLocalDate(new Date());
    return transactions
      .filter((t) => t.date === todayStr)
      .sort((a, b) => (b.created_at || b.id).localeCompare(a.created_at || a.id))
      .slice(0, 5);
  }, [transactions]);

  const fallbackRecentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => (b.date !== a.date ? b.date.localeCompare(a.date) : (b.created_at || b.id).localeCompare(a.created_at || a.id)))
      .slice(0, 4);
  }, [transactions]);

  const goalWallets = useMemo(() => {
    return wallets.filter((w) => w.goal_amount && w.goal_amount > 0);
  }, [wallets]);

  const fundraisingGoals = useMemo(() => {
    return categories
      .filter((c) => c.exclude_from_analytics)
      .map((cat) => {
        const limitObj = budgets.find((b) => b.scope === 'category' && b.category_id === cat.id && b.amount > 0);
        const target = limitObj?.amount || 0;
        const raised = transactions
          .filter((t) => t.category_id === cat.id)
          .reduce((sum, t) => sum + (t.type === 'income' ? (t.amount || 0) : -(t.amount || 0)), 0);
        return { cat, target, raised: Math.max(0, raised) };
      });
  }, [categories, budgets, transactions]);

  const topCategoryWatchlist = useMemo(() => {
    const withLimit = categoryBudgetProgressList
      .filter((p) => p.limit > 0)
      .sort((a, b) => b.percent - a.percent);
    const withoutLimit = categoryBudgetProgressList
      .filter((p) => p.limit <= 0 && p.spent > 0)
      .sort((a, b) => b.spent - a.spent);
    return [...withLimit, ...withoutLimit].slice(0, 4);
  }, [categoryBudgetProgressList]);

  const handlePressHistoryItem = (tx: Transaction) => {
    setSelectedCalendarDate(tx.date);
    setSelectedTransactionIdForCalendar(tx.id);
    onNavigateTab?.('calendar');
  };

  const toggleSheet = () => {
    if (isExpandedRef.current) {
      closeSheet();
    } else {
      openSheet();
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        gestureStartHeightRef.current = currentHeightRef.current;
      },
      onPanResponderMove: (_, gestureState) => {
        let nextH = gestureStartHeightRef.current + gestureState.dy;
        if (nextH < 90) {
          nextH = 90 + (nextH - 90) * 0.2;
        } else if (nextH > expandedSheetHeight) {
          nextH = expandedSheetHeight + (nextH - expandedSheetHeight) * 0.2;
        }
        animatedHeight.setValue(nextH);
      },
      onPanResponderRelease: (_, gestureState) => {
        const currentH = currentHeightRef.current;
        const startH = gestureStartHeightRef.current;
        const allSnaps = [90, 170, 190, 317, expandedSheetHeight];
        let targetSnap = 90;

        if (gestureState.vy > 0.5) {
          // Flick downwards (expanding) -> next higher snap
          const higherSnaps = allSnaps.filter((s) => s > startH + 15);
          targetSnap = higherSnaps.length > 0 ? higherSnaps[0] : expandedSheetHeight;
        } else if (gestureState.vy < -0.5) {
          // Flick upwards (collapsing) -> next lower snap
          const lowerSnaps = allSnaps.filter((s) => s < startH - 15);
          targetSnap = lowerSnaps.length > 0 ? lowerSnaps[lowerSnaps.length - 1] : 90;
        } else {
          // Drag and release -> nearest snap point
          let minDiff = Infinity;
          for (const snap of allSnaps) {
            const diff = Math.abs(currentH - snap);
            if (diff < minDiff) {
              minDiff = diff;
              targetSnap = snap;
            }
          }
        }

        if (targetSnap >= expandedSheetHeight - 15) {
          openSheet();
        } else {
          snapToCollapsed(targetSnap);
        }
      },
    })
  ).current;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* 1. DASHBOARD SCROLLABLE BODY */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.dashScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* OVERDUE & DUE TODAY RECURRING BILL REMINDER */}
        <OverdueBillReminderBanner
          recurringBills={recurringBills}
          wallets={wallets}
          baseCurrency={curr}
          theme={theme}
          onPayBill={payRecurringBill}
          onNavigateToCalendar={(dateStr) => {
            setSelectedCalendarDate(dateStr);
            onNavigateTab?.('calendar');
          }}
        />

        {/* HERO CARD: AVAILABLE FOR TODAY + DAYS LEFT + CYCLE PULSE (SPENT / INCOME / SAVINGS RATE) */}
        <View
          style={[
            styles.dashHeroCard,
            {
              backgroundColor: theme.surface,
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : theme.divider,
            },
            M3Elevation.level2,
          ]}
        >
          <View style={styles.todayBalanceRow}>
            <TouchableOpacity
              style={{ flex: 1, marginRight: 8 }}
              activeOpacity={0.7}
              onPress={() => setAllowanceDetailVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="View balance breakdown and description"
            >
              <View style={styles.todayBalanceHeaderRow}>
                <Text
                  style={[
                    styles.todayBalanceLabel,
                    {
                      color:
                        dailyAllowanceStats.status === 'budget_over' || dailyAllowanceStats.status === 'wallet_empty'
                          ? theme.error
                          : dailyAllowanceStats.isOverDaily
                            ? (isDarkMode ? '#F87171' : theme.error)
                            : theme.onSurfaceVariant,
                    },
                  ]}
                  maxFontSizeMultiplier={1.2}
                >
                  {dailyAllowanceStats.headlineLabel}
                </Text>

                {dailyAllowanceStats.badgeLabel ? (
                  <View
                    style={[
                      styles.todayStatusBadge,
                      {
                        backgroundColor:
                          dailyAllowanceStats.status === 'budget_over' || dailyAllowanceStats.status === 'wallet_empty'
                            ? (isDarkMode ? 'rgba(239, 68, 68, 0.25)' : '#FEE2E2')
                            : dailyAllowanceStats.isOverDaily
                              ? (isDarkMode ? 'rgba(239, 68, 68, 0.20)' : '#FEE2E2')
                              : (isDarkMode ? 'rgba(99, 102, 241, 0.22)' : 'rgba(99, 102, 241, 0.12)'),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.todayStatusBadgeText,
                        {
                          color:
                            dailyAllowanceStats.status === 'budget_over' || dailyAllowanceStats.status === 'wallet_empty'
                              ? (isDarkMode ? '#FCA5A5' : '#DC2626')
                              : dailyAllowanceStats.isOverDaily
                                ? (isDarkMode ? '#FCA5A5' : '#DC2626')
                                : (isDarkMode ? '#C7D2FE' : theme.primary),
                        },
                      ]}
                    >
                      {dailyAllowanceStats.badgeLabel}
                    </Text>
                  </View>
                ) : null}

                <MaterialCommunityIcons
                  name="information-outline"
                  size={12}
                  color={theme.onSurfaceVariant}
                  style={{ opacity: 0.6 }}
                />
              </View>

              <Text
                style={[
                  styles.todayBalanceAmount,
                  {
                    color:
                      dailyAllowanceStats.status === 'budget_over' ||
                        dailyAllowanceStats.status === 'wallet_empty' ||
                        dailyAllowanceStats.remainingToday < 0
                        ? theme.error
                        : theme.primary,
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                maxFontSizeMultiplier={1.2}
              >
                {wallets.length === 0 && overallBudgetLimit === 0
                  ? formatCurrency(0, curr)
                  : formatCurrency(dailyAllowanceStats.remainingToday, curr)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.walletSumPill,
                { backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.16)' : theme.pillBg },
              ]}
              onPress={() => setCycleModeModalVisible(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Switch Cycle Type"
            >
              <MaterialCommunityIcons
                name={currentCycle ? 'calendar-clock-outline' : 'calendar-plus'}
                size={14}
                color={isDarkMode ? '#A5B4FC' : theme.primary}
              />
              <Text
                style={[
                  styles.walletSumText,
                  { color: isDarkMode ? '#E0E7FF' : theme.onSurface, fontWeight: '700' },
                ]}
              >
                {!currentCycle
                  ? '+ Set Cycle'
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

          {/* AVG DAILY SPEND & SAVINGS RATE / SAVED LEFTOVERS */}
          <View style={[styles.pulseStrip, { borderTopColor: theme.divider, justifyContent: 'space-between', paddingHorizontal: 2 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={[styles.pulseLabel, { color: theme.onSurfaceVariant }]}>AVG / DAY</Text>
              <Text style={[styles.pulseVal, { color: theme.onSurface }]}>
                {formatCurrency(dailyAllowanceStats.dailyAverage, curr)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={[styles.pulseLabel, { color: theme.onSurfaceVariant }]}>
                {dailyAllowanceStats.leftoverMode === 'lock_savings' && (dailyAllowanceStats.savedLeftoverPool || 0) > 0
                  ? 'SAVED'
                  : 'SAVINGS'}
              </Text>
              <Text
                style={[
                  styles.pulseVal,
                  {
                    color:
                      dailyAllowanceStats.leftoverMode === 'lock_savings' && (dailyAllowanceStats.savedLeftoverPool || 0) > 0
                        ? theme.success
                        : !savingsRateStats.hasIncome
                          ? theme.onSurfaceVariant
                          : savingsRateStats.rate >= 0
                            ? theme.success
                            : theme.error,
                  },
                ]}
              >
                {dailyAllowanceStats.leftoverMode === 'lock_savings' && (dailyAllowanceStats.savedLeftoverPool || 0) > 0
                  ? formatCurrency(dailyAllowanceStats.savedLeftoverPool || 0, curr)
                  : savingsRateStats.hasIncome
                    ? `${savingsRateStats.rate}%`
                    : '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* DUAL DISPLAY CARDS: INCOME GOAL & BUDGET CAP */}
        <View style={[styles.dualCardsRow, { marginTop: 0 }]}>
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
              if (!incomeSwitcherProgress.hasGoal) {
                handleOpenQuickTarget('income');
              } else {
                setAnalyticsFocus('income');
                onNavigateTab?.('analytics');
              }
            }}
            onLongPress={() => handleOpenQuickTarget('income')}
            delayLongPress={350}
            activeOpacity={0.8}
          >
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
            <View style={styles.switcherHeaderRow}>
              <View style={styles.switcherIconTextRow}>
                <View style={[styles.tabDot, { backgroundColor: theme.success }]} />
                <Text style={[styles.switcherTabTitle, { color: theme.onSurfaceVariant }]}>INCOME GOAL</Text>
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
            <View style={styles.heroAmountRow}>
              <Text style={[styles.switcherTabAmount, { color: isDarkMode ? '#34D399' : theme.success }]} numberOfLines={1}>
                {incomeSwitcherProgress.hasGoal ? formatCurrency(incomeInCycle, curr) : '+ Set Goal'}
              </Text>
              {incomeSwitcherProgress.hasGoal && (
                <Text style={[styles.heroAmountCaption, { color: theme.onSurfaceVariant }]}>EARNED</Text>
              )}
            </View>
            <Text
              style={[
                styles.switcherProgressSubtext,
                { color: incomeSwitcherProgress.isReached ? (isDarkMode ? '#6EE7B7' : '#059669') : theme.onSurfaceVariant },
              ]}
              numberOfLines={1}
            >
              {incomeSwitcherProgress.subText}
            </Text>
            {incomeSwitcherProgress.hasGoal && (
              <View style={styles.switcherBottomLineTrack}>
                <View
                  style={[
                    styles.switcherBottomLineFill,
                    { width: `${Math.min(100, Math.max(0, incomeSwitcherProgress.percent))}%`, backgroundColor: theme.success },
                  ]}
                />
              </View>
            )}
          </TouchableOpacity>

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
              if (!expenseSwitcherProgress.hasTarget) {
                handleOpenQuickTarget('budget');
              } else {
                setAnalyticsFocus('expense');
                onNavigateTab?.('analytics');
              }
            }}
            onLongPress={() => handleOpenQuickTarget('budget')}
            delayLongPress={350}
            activeOpacity={0.8}
          >
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
            <View style={styles.switcherHeaderRow}>
              <View style={styles.switcherIconTextRow}>
                <View style={[styles.tabDot, { backgroundColor: theme.error }]} />
                <Text style={[styles.switcherTabTitle, { color: theme.onSurfaceVariant }]}>BUDGET CAP</Text>
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
            <View style={styles.heroAmountRow}>
              <Text
                style={[
                  styles.switcherTabAmount,
                  { color: expenseSwitcherProgress.isOver ? (isDarkMode ? '#F87171' : '#DC2626') : (isDarkMode ? '#F87171' : theme.error) },
                ]}
                numberOfLines={1}
              >
                {expenseSwitcherProgress.hasTarget ? formatCurrency(spentInCycle, curr) : '+ Set Cap'}
              </Text>
              {expenseSwitcherProgress.hasTarget && (
                <Text style={[styles.heroAmountCaption, { color: theme.onSurfaceVariant }]}>USED</Text>
              )}
            </View>
            <Text
              style={[
                styles.switcherProgressSubtext,
                { color: expenseSwitcherProgress.isOver ? (isDarkMode ? '#FCA5A5' : '#DC2626') : theme.onSurfaceVariant },
              ]}
              numberOfLines={1}
            >
              {expenseSwitcherProgress.subText}
            </Text>
            {expenseSwitcherProgress.hasTarget && (
              <View style={styles.switcherBottomLineTrack}>
                <View
                  style={[
                    styles.switcherBottomLineFill,
                    {
                      width: `${Math.min(100, Math.max(0, expenseSwitcherProgress.percent))}%`,
                      backgroundColor: expenseSwitcherProgress.isOver ? '#EF4444' : theme.error,
                    },
                  ]}
                />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* AT-A-GLANCE MONEY STRIP: NET WORTH | LOANS | NEXT BILL */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.glanceStrip}
        >
          <TouchableOpacity
            style={[styles.glanceCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}
            onPress={() => onNavigateTab?.('wallets')}
            activeOpacity={0.75}
          >
            <View style={styles.glanceTopRow}>
              <MaterialCommunityIcons name="wallet-outline" size={16} color={theme.primary} />
              <Text style={[styles.glanceLabel, { color: theme.onSurfaceVariant }]}>NET WORTH</Text>
            </View>
            <Text style={[styles.glanceValue, { color: theme.onSurface }]} numberOfLines={1}>
              {formatCurrency(totalConvertedBalance, curr)}
            </Text>
            <Text style={[styles.glanceSub, { color: theme.onSurfaceVariant }]} numberOfLines={1}>
              {wallets.length} {wallets.length === 1 ? 'wallet' : 'wallets'}
            </Text>
          </TouchableOpacity>

          {totalSpendableBalance !== totalConvertedBalance && (
            <TouchableOpacity
              style={[styles.glanceCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}
              onPress={() => onNavigateTab?.('wallets')}
              activeOpacity={0.75}
            >
              <View style={styles.glanceTopRow}>
                <MaterialCommunityIcons name="cash-check" size={16} color={theme.success} />
                <Text style={[styles.glanceLabel, { color: theme.onSurfaceVariant }]}>SPENDABLE</Text>
              </View>
              <Text style={[styles.glanceValue, { color: theme.success }]} numberOfLines={1}>
                {formatCurrency(totalSpendableBalance, curr)}
              </Text>
              <Text style={[styles.glanceSub, { color: theme.onSurfaceVariant }]} numberOfLines={1}>
                {formatCurrency(Math.max(0, totalConvertedBalance - totalSpendableBalance), curr)} in goals
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.glanceCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}
            onPress={() => onNavigateTab?.('wallets')}
            activeOpacity={0.75}
          >
            <View style={styles.glanceTopRow}>
              <MaterialCommunityIcons name="handshake-outline" size={16} color={theme.primary} />
              <Text style={[styles.glanceLabel, { color: theme.onSurfaceVariant }]}>LOANS</Text>
            </View>
            <Text
              style={[
                styles.glanceValue,
                {
                  color:
                    loansSummary.owedToYou - loansSummary.youOwe >= 0
                      ? theme.success
                      : theme.error,
                },
              ]}
              numberOfLines={1}
            >
              {loansSummary.openCount === 0
                ? formatCurrency(0, curr)
                : `${loansSummary.owedToYou >= loansSummary.youOwe ? '+' : '-'}${formatCurrency(
                    Math.abs(loansSummary.owedToYou - loansSummary.youOwe),
                    curr
                  )}`}
            </Text>
            <Text style={[styles.glanceSub, { color: theme.onSurfaceVariant }]} numberOfLines={1}>
              {loansSummary.openCount === 0 ? 'All settled' : `${loansSummary.openCount} open`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.glanceCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}
            onPress={() => onNavigateTab?.('wallets')}
            activeOpacity={0.75}
          >
            <View style={styles.glanceTopRow}>
              <MaterialCommunityIcons name="calendar-clock" size={16} color={theme.primary} />
              <Text style={[styles.glanceLabel, { color: theme.onSurfaceVariant }]}>NEXT BILL</Text>
            </View>
            <Text style={[styles.glanceValue, { color: theme.onSurface }]} numberOfLines={1}>
              {nextBill ? formatCurrency(nextBill.amount, nextBill.currency || curr) : 'None'}
            </Text>
            <Text style={[styles.glanceSub, { color: theme.onSurfaceVariant }]} numberOfLines={1}>
              {nextBill ? `${nextBill.name} â€¢ ${nextBill.next_due_date}` : 'No active bills'}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* SAVINGS & GOALS (GOAL WALLETS + FUNDRAISING CATEGORIES) */}
        {(goalWallets.length > 0 || fundraisingGoals.length > 0) && (
          <View style={{ gap: 8 }}>
            <View style={styles.recentHeaderRow}>
              <Text style={[styles.recentSectionTitle, { color: theme.onSurface }]}>
                Savings & Goals
              </Text>
              <TouchableOpacity onPress={() => onNavigateTab?.('wallets')} activeOpacity={0.7}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.primary }}>
                  Manage →
                </Text>
              </TouchableOpacity>
            </View>

            {goalWallets.map((w) => {
              const goal = w.goal_amount || 0;
              const rem = Math.max(0, goal - w.current_balance);
              const pct = goal > 0 ? Math.min(100, Math.max(0, Math.round((w.current_balance / goal) * 100))) : 0;
              return (
                <TouchableOpacity
                  key={w.id}
                  style={[styles.txItemRow, { backgroundColor: theme.cardBg, borderColor: theme.divider, flexDirection: 'column', alignItems: 'stretch', gap: 6 }]}
                  onPress={() => onNavigateTab?.('wallets')}
                  activeOpacity={0.75}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={[styles.txCatDot, { backgroundColor: w.color, width: 30, height: 30, borderRadius: 15 }]}>
                      <MaterialCommunityIcons name={(w.icon as any) || 'piggy-bank'} size={15} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.txItemTitle, { color: theme.onSurface }]} numberOfLines={1}>
                        {w.name}{w.goal_deadline ? ` • Due ${w.goal_deadline}` : ''}
                      </Text>
                      <Text style={[styles.txItemSub, { color: theme.onSurfaceVariant }]} numberOfLines={1}>
                        {rem <= 0 ? '🎉 Goal reached!' : `${formatCurrency(rem, curr)} left of ${formatCurrency(goal, curr)}`}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12.5, fontWeight: '800', color: rem <= 0 ? theme.success : theme.primary }}>
                      {formatCurrency(w.current_balance, curr)} ({pct}%)
                    </Text>
                  </View>
                  <View style={{ height: 5, borderRadius: 3, backgroundColor: theme.pillBg, overflow: 'hidden' }}>
                    <View style={{ width: `${pct}%`, height: '100%', backgroundColor: rem <= 0 ? theme.success : w.color }} />
                  </View>
                </TouchableOpacity>
              );
            })}

            {fundraisingGoals.map(({ cat, target, raised }) => {
              const rem = target > 0 ? Math.max(0, target - raised) : 0;
              const pct = target > 0 ? Math.min(100, Math.max(0, Math.round((raised / target) * 100))) : 0;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.txItemRow, { backgroundColor: theme.cardBg, borderColor: theme.divider, flexDirection: 'column', alignItems: 'stretch', gap: 6 }]}
                  onPress={() => onNavigateTab?.('wallets')}
                  activeOpacity={0.75}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={[styles.txCatDot, { backgroundColor: cat.color, width: 30, height: 30, borderRadius: 15 }]}>
                      <MaterialCommunityIcons name={(cat.icon as any) || 'hand-heart'} size={15} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.txItemTitle, { color: theme.onSurface }]} numberOfLines={1}>
                        {cat.name}
                      </Text>
                      <Text style={[styles.txItemSub, { color: theme.onSurfaceVariant }]} numberOfLines={1}>
                        {target > 0
                          ? rem <= 0
                            ? '🎉 Fundraising goal reached'
                            : `${formatCurrency(rem, curr)} left of ${formatCurrency(target, curr)}`
                          : 'Untracked fundraising'}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12.5, fontWeight: '800', color: theme.success }}>
                      {formatCurrency(raised, curr)}{target > 0 ? ` (${pct}%)` : ''}
                    </Text>
                  </View>
                  {target > 0 && (
                    <View style={{ height: 5, borderRadius: 3, backgroundColor: theme.pillBg, overflow: 'hidden' }}>
                      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: theme.success }} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* TOP CATEGORIES & BUDGET WATCHLIST */}
        {topCategoryWatchlist.length > 0 && (
          <View style={{ gap: 8 }}>
            <View style={styles.recentHeaderRow}>
              <Text style={[styles.recentSectionTitle, { color: theme.onSurface }]}>
                Top Categories
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setAnalyticsFocus('expense');
                  onNavigateTab?.('analytics');
                }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.primary }}>
                  Analytics →
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.txItemRow, { backgroundColor: theme.cardBg, borderColor: theme.divider, flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
              {topCategoryWatchlist.map((item) => {
                const hasLim = item.limit > 0;
                const pct = hasLim ? Math.min(100, Math.max(0, Math.round(item.percent))) : 0;
                const isOver = hasLim && item.spent > item.limit;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={{ gap: 4 }}
                    onPress={() => {
                      setAnalyticsFocus('expense');
                      onNavigateTab?.('analytics');
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[styles.txCatDot, { backgroundColor: item.color, width: 24, height: 24, borderRadius: 12 }]}>
                        <MaterialCommunityIcons name={(item.icon as any) || 'tag'} size={13} color="#FFFFFF" />
                      </View>
                      <Text style={[styles.txItemTitle, { color: theme.onSurface, flex: 1 }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: isOver ? theme.error : theme.onSurface }}>
                        {formatCurrency(item.spent, curr)}
                        {hasLim ? ` / ${formatCurrency(item.limit, curr)}` : ''}
                      </Text>
                    </View>
                    {hasLim && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: theme.pillBg, overflow: 'hidden' }}>
                          <View style={{ width: `${pct}%`, height: '100%', backgroundColor: isOver ? theme.error : item.color }} />
                        </View>
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: isOver ? theme.error : theme.onSurfaceVariant }}>
                          {isOver ? `Over ${formatCurrency(item.spent - item.limit, curr)}` : `${formatCurrency(item.remaining, curr)} left`}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* TODAY'S TRANSACTIONS */}
        <View style={styles.recentHeaderRow}>
          <Text style={[styles.recentSectionTitle, { color: theme.onSurface }]}>
            {recentTransactions.length > 0 ? "Today's Activity" : 'Recent Activity'}
          </Text>
          <TouchableOpacity onPress={() => onNavigateTab?.('calendar')} activeOpacity={0.7}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.primary }}>
              See History →
            </Text>
          </TouchableOpacity>
        </View>

        {recentTransactions.length === 0 && fallbackRecentTransactions.length === 0 ? (
          <View style={[styles.emptyRecentCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }]}>
            <MaterialCommunityIcons name="receipt-text-outline" size={32} color={theme.outlineVariant} />
            <Text style={[styles.emptyHistoryText, { color: theme.onSurfaceVariant }]}>
              No transactions recorded yet
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {recentTransactions.length === 0 && (
              <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: M3Shape.medium, backgroundColor: theme.pillBg }}>
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: theme.onSurfaceVariant }}>
                  Nothing recorded today yet — showing your latest activity
                </Text>
              </View>
            )}
            {(recentTransactions.length > 0 ? recentTransactions : fallbackRecentTransactions).map((tx) => {
              const cat = categories.find((c) => c.id === tx.category_id);
              const sub = cat?.subcategories?.find((s) => s.id === tx.subcategory_id);
              const wallet = wallets.find((w) => w.id === tx.wallet_id);
              const isExp = tx.type === 'expense';
              const isTransfer = tx.type === 'transfer';
              const mainTitle = isTransfer ? 'Transfer' : sub?.name || cat?.name || 'Activity';
              const subtitle = [
                sub ? cat?.name : null,
                wallet?.name,
                tx.date,
                tx.note || null,
              ]
                .filter(Boolean)
                .join(' â€¢ ');

              const effectiveAmt = isExp ? getEffectiveAmount(tx) : tx.amount;
              const isSplit = isExp && effectiveAmt < tx.amount - 0.01;

              return (
                <TouchableOpacity
                  key={tx.id}
                  style={[styles.txItemRow, { backgroundColor: theme.cardBg, borderColor: theme.divider }]}
                  onPress={() => handlePressHistoryItem(tx)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.txCatDot,
                      { backgroundColor: isTransfer ? theme.tertiary : cat?.color || theme.primary },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={isTransfer ? 'swap-horizontal' : (cat?.icon as any) || 'cash'}
                      size={16}
                      color="#FFFFFF"
                    />
                  </View>

                  <View style={styles.txTextCol}>
                    <Text style={[styles.txItemTitle, { color: theme.onSurface }]} numberOfLines={1}>
                      {mainTitle}
                    </Text>
                    <Text style={[styles.txItemSub, { color: theme.onSurfaceVariant }]} numberOfLines={1}>
                      {subtitle}
                    </Text>
                  </View>

                  <View style={styles.txItemRight}>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text
                        style={[
                          styles.txItemAmount,
                          {
                            color: isExp
                              ? theme.error
                              : isTransfer
                                ? theme.tertiary
                                : theme.success,
                          },
                        ]}
                      >
                        {isExp ? '-' : isTransfer ? '' : '+'}
                        {formatCurrency(isSplit ? effectiveAmt : tx.amount, tx.currency)}
                      </Text>
                      {isSplit && (
                        <Text style={{ fontSize: 10.5, fontWeight: '600', color: theme.onSurfaceVariant }}>
                          Total: {formatCurrency(tx.amount, tx.currency)}
                        </Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* 2. FAB OVERLAY BACKDROP */}
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
          onPress={() => {
            setIsFabOpen(false);
            handleOpenKeypad('expense');
          }}
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
                  : `Total: ${formatCurrency(spentInCycle, curr)}`}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Record Income Button */}
        <TouchableOpacity
          style={[
            styles.fabRecordBtn,
            {
              backgroundColor: theme.successContainer,
              borderColor: theme.success,
            },
            M3Elevation.level3,
          ]}
          onPress={() => {
            setIsFabOpen(false);
            handleOpenKeypad('income');
          }}
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
                    ? 'ðŸŽ‰ Reached'
                    : `Remain: ${formatCurrency(incomeSwitcherProgress.remaining, curr)}`
                  : `Total: ${formatCurrency(incomeInCycle, curr)}`}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Transfer Button */}
        <TouchableOpacity
          style={[
            styles.fabRecordBtn,
            {
              backgroundColor: theme.primaryContainer,
              borderColor: theme.primary,
            },
            M3Elevation.level3,
          ]}
          onPress={() => {
            setIsFabOpen(false);
            setPrefilledCategoryId(undefined);
            setPrefilledSubcategoryId(undefined);
            setActiveTxType('transfer');
            setAmountStr('0');
            setDetailsModalVisible(true);
          }}
          activeOpacity={0.85}
          accessibilityLabel="Record Transfer"
        >
          <View style={styles.fabRecordBtnContent}>
            <View style={styles.fabRecordHeaderRow}>
              <MaterialCommunityIcons name="swap-horizontal" size={16} color={theme.primary} />
              <Text
                style={[styles.fabRecordBtnTitle, { color: theme.onPrimaryContainer }]}
                numberOfLines={1}
              >
                Transfer
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
                  { color: theme.primary },
                ]}
                numberOfLines={1}
              >
                {wallets.length} wallets
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Loan / Split Button (Bottom - Above FAB) */}
        <TouchableOpacity
          style={[
            styles.fabRecordBtn,
            {
              backgroundColor: isDarkMode ? '#312E81' : '#E0E7FF',
              borderColor: isDarkMode ? '#818CF8' : '#4338CA',
            },
            M3Elevation.level3,
          ]}
          onPress={() => {
            setIsFabOpen(false);
            setLoanModalVisible(true);
          }}
          activeOpacity={0.85}
          accessibilityLabel="Loans and Splits"
        >
          <View style={styles.fabRecordBtnContent}>
            <View style={styles.fabRecordHeaderRow}>
              <MaterialCommunityIcons
                name="handshake-outline"
                size={16}
                color={isDarkMode ? '#A5B4FC' : '#4338CA'}
              />
              <Text
                style={[
                  styles.fabRecordBtnTitle,
                  { color: isDarkMode ? '#E0E7FF' : '#312E81' },
                ]}
                numberOfLines={1}
              >
                Loan / Split
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
                  { color: isDarkMode ? '#C7D2FE' : '#4338CA' },
                ]}
                numberOfLines={1}
              >
                {loansSummary.openCount > 0 ? `${loansSummary.openCount} open` : 'Loans & Splits'}
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

      {/* 3. QUICK-ENTRY KEYPAD BOTTOM SHEET */}
      <Modal
        visible={keypadSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setKeypadSheetVisible(false)}
      >
        <View style={styles.keypadBackdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setKeypadSheetVisible(false)} />
          <View
            style={[
              styles.keypadSheetBox,
              { backgroundColor: theme.surface, borderColor: theme.divider },
              M3Elevation.level3,
            ]}
          >
            <View style={styles.keypadSheetHeader}>
              <View style={[styles.keypadTypeToggle, { backgroundColor: theme.pillBg }]}>
                {(
                  [
                    { key: 'expense', label: 'Expense', color: theme.error },
                    { key: 'income', label: 'Income', color: theme.success },
                  ] as const
                ).map((t) => {
                  const active = keypadType === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      style={[styles.keypadTypePill, active && { backgroundColor: t.color }]}
                      onPress={() => setKeypadType(t.key)}
                    >
                      <Text style={{ fontSize: 12.5, fontWeight: '800', color: active ? '#FFFFFF' : theme.onSurfaceVariant }}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.keypadIconBtn, { backgroundColor: showCalcSide ? theme.primaryContainer : theme.pillBg }]}
                  onPress={toggleCalcSide}
                  accessibilityLabel="Toggle calculator operators"
                >
                  <MaterialCommunityIcons
                    name="calculator-variant-outline"
                    size={18}
                    color={showCalcSide ? theme.primary : theme.onSurfaceVariant}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.keypadIconBtn, { backgroundColor: theme.pillBg }]}
                  onPress={() => setKeypadSheetVisible(false)}
                  accessibilityLabel="Close keypad"
                >
                  <MaterialCommunityIcons name="close" size={18} color={theme.onSurface} />
                </TouchableOpacity>
              </View>
            </View>

            <Pressable style={styles.keypadAmountBox} onPress={() => amountInputRef.current?.focus()}>
              <View style={styles.amountDisplayRow}>
                <Text style={[styles.currencySymbol, { color: theme.primary, fontSize: 22 }]}>
                  {curr}{' '}
                </Text>
                <TextInput
                  ref={amountInputRef}
                  style={[styles.amountInputText, { color: theme.onSurface, fontSize: Math.min(dynamicAmountFontSize, 36) }]}
                  value={amountStr}
                  onChangeText={handleAmountChange}
                  onSelectionChange={(e) => setAmountSelection(e.nativeEvent.selection)}
                  showSoftInputOnFocus={false}
                  caretHidden={false}
                  selectionColor={theme.primary}
                  contextMenuHidden={true}
                  selectTextOnFocus={false}
                />
              </View>
              {isEquationReady && (
                <TouchableOpacity
                  style={[styles.calcPreviewPill, { backgroundColor: theme.primaryContainer }]}
                  onPress={() => handleKeyPress('=')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.calcPreviewAmount, { color: theme.onPrimaryContainer }]}>
                    = {formatTypingNumber(evaluatedAmount.toString())}
                  </Text>
                </TouchableOpacity>
              )}
              {isDuplicate && (
                <View style={[styles.duplicateBanner, { backgroundColor: '#FEF3C7', marginTop: 4 }]}>
                  <MaterialCommunityIcons name="alert-circle" size={12} color="#B45309" />
                  <Text style={[styles.duplicateBannerText, { color: '#B45309' }]}>Similar entry recorded today</Text>
                </View>
              )}
            </Pressable>

            <View style={{ marginBottom: 8 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {wallets.map((w) => {
                  const isSelected = w.id === selectedWalletId;
                  return (
                    <TouchableOpacity
                      key={w.id}
                      style={[
                        styles.chipItem,
                        {
                          backgroundColor: isSelected ? theme.primaryContainer : theme.pillBg,
                          borderColor: isSelected ? theme.primary : 'transparent',
                        },
                      ]}
                      onPress={() => setSelectedWalletId(w.id)}
                    >
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: w.color }} />
                      <Text style={[styles.chipText, { color: isSelected ? theme.onPrimaryContainer : theme.onSurface, fontWeight: isSelected ? '800' : '600' }]}>
                        {w.name} â€¢ {formatCurrency(w.current_balance, curr)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[styles.addChipBtn, { backgroundColor: theme.pillBg, borderColor: theme.divider, borderWidth: 1 }]}
                  onPress={() => {
                    setKeypadSheetVisible(false);
                    setQuickWalletModalVisible(true);
                  }}
                >
                  <MaterialCommunityIcons name="plus" size={16} color={theme.primary} />
                </TouchableOpacity>
              </ScrollView>
            </View>

            <View>
              {dialPadRows.map((row, rIdx) => (
                <View key={rIdx} style={[styles.dialRow, { marginBottom: dialRowMargin }]}>
                  {row.map((keyVal) => {
                    const isBackspace = keyVal === 'backspace';
                    const isOperator = ['+', '-', 'Ã—', 'Ã·'].includes(keyVal);
                    const isEquals = keyVal === '=';
                    return (
                      <TouchableOpacity
                        key={keyVal}
                        style={[
                          styles.dialKey,
                          {
                            height: dialKeyHeight,
                            backgroundColor: isEquals ? theme.primary : isOperator ? theme.primaryContainer : isBackspace ? theme.pillBg : theme.surfaceVariant || theme.pillBg,
                          },
                        ]}
                        onPress={() => handleKeyPress(keyVal)}
                        onLongPress={() => { if (isBackspace) handleKeyPress('clear'); }}
                        delayLongPress={350}
                        activeOpacity={0.6}
                      >
                        {isBackspace ? (
                          <MaterialCommunityIcons name="backspace-outline" size={20} color={theme.onSurfaceVariant} />
                        ) : (
                          <Text style={[styles.dialKeyText, { fontSize: dialKeyFontSize, color: isEquals ? theme.onPrimary : isOperator ? theme.primary : theme.onSurface, fontWeight: isOperator || isEquals ? '800' : '600' }]}>
                            {keyVal}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.keypadContinueBtn, { backgroundColor: keypadType === 'expense' ? theme.error : theme.success }, M3Elevation.level1]}
              onPress={() => handleOpenRecordFlow(keypadType)}
              activeOpacity={0.85}
            >
              <Text style={styles.keypadContinueText}>Continue â€¢ {keypadType === 'expense' ? 'Expense' : 'Income'}</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* STEP 1: CATEGORY PICKER BOTTOM SHEET */}
      <CategoryPickerSheet
        visible={categoryPickerVisible}
        txType={activeTxType}
        amount={parsedAmount}
        walletId={selectedWalletId}
        wallets={wallets}
        categories={categories}
        theme={theme}
        baseCurrency={curr}
        onClose={() => setCategoryPickerVisible(false)}
        onSave={handleQuickSaveCategory}
        onOpenMoreOptions={handleOpenMoreOptions}
        onManageCategories={() => setCategoryModalVisible(true)}
        onAddSubcategory={addSubcategory}
      />

      {/* STEP 2: FULL TRANSACTION DETAILS MODAL */}
      <TransactionDetailsModal
        visible={detailsModalVisible}
        txType={activeTxType}
        initialAmount={parsedAmount}
        initialWalletId={selectedWalletId}
        initialCategoryId={prefilledCategoryId}
        initialSubcategoryId={prefilledSubcategoryId}
        wallets={wallets}
        categories={categories}
        theme={theme}
        baseCurrency={curr}
        onClose={() => setDetailsModalVisible(false)}
        onSave={handleSaveTransactionDetails}
        onManageCategories={() => setCategoryModalVisible(true)}
        onAddSubcategory={addSubcategory}
      />

      {/* QUICK TARGET EDIT DIALOGUE (TRIGGERED ON LONG PRESS OF INCOME GOAL OR BUDGET CAP) */}
      <Modal
        visible={quickTargetModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQuickTargetModalVisible(false)}
      >
        <View style={styles.quickTargetOverlay}>
          <View style={[styles.quickTargetBox, { backgroundColor: theme.surface }, M3Elevation.level3]}>
            <View style={styles.quickTargetHeader}>
              <View
                style={[
                  styles.quickTargetIconCircle,
                  {
                    backgroundColor: quickTargetType === 'income' ? theme.successContainer : theme.errorContainer,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={quickTargetType === 'income' ? 'cash-multiple' : 'bullseye-arrow'}
                  size={20}
                  color={quickTargetType === 'income' ? theme.success : theme.error}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.quickTargetTitle, { color: theme.onSurface }]}>
                  {quickTargetType === 'income'
                    ? (incomeSwitcherProgress.hasGoal ? 'Edit Income Goal' : 'Set Income Goal')
                    : (expenseSwitcherProgress.hasTarget ? 'Edit Budget Cap' : 'Set Budget Cap')}
                </Text>
                <Text style={[styles.quickTargetSubtitle, { color: theme.onSurfaceVariant }]}>
                  {currentCycle?.name || 'Active Cycle'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setQuickTargetModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close" size={20} color={theme.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <View style={[styles.quickTargetInputWrap, { backgroundColor: theme.pillBg }]}>
              <Text style={[styles.quickTargetCurrency, { color: quickTargetType === 'income' ? theme.success : theme.error }]}>
                {curr}
              </Text>
              <TextInput
                style={[styles.quickTargetInput, { color: theme.onSurface }]}
                placeholder="0"
                placeholderTextColor={theme.onSurfaceVariant}
                keyboardType="decimal-pad"
                autoFocus
                value={quickTargetInput}
                onChangeText={(text) => setQuickTargetInput(formatTypingNumber(text))}
                selectTextOnFocus
              />
            </View>

            <View style={styles.quickTargetBtnRow}>
              <TouchableOpacity
                style={[styles.quickTargetCancelBtn, { backgroundColor: theme.pillBg }]}
                onPress={() => setQuickTargetModalVisible(false)}
              >
                <Text style={[styles.quickTargetBtnText, { color: theme.onSurface }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.quickTargetSaveBtn,
                  { backgroundColor: quickTargetType === 'income' ? theme.success : theme.primary },
                ]}
                onPress={handleSaveQuickTarget}
              >
                <Text style={[styles.quickTargetBtnText, { color: theme.onPrimary }]}>Save Target</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* TODAY'S ALLOWANCE BREAKDOWN / DESCRIPTION MODAL (TRIGGERED ON TAP OF TODAY'S AMOUNT) */}
      <Modal
        visible={allowanceDetailVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAllowanceDetailVisible(false)}
      >
        <View style={styles.quickTargetOverlay}>
          <View style={[styles.quickTargetBox, { backgroundColor: theme.surface }, M3Elevation.level3]}>
            <View style={styles.quickTargetHeader}>
              <View
                style={[
                  styles.quickTargetIconCircle,
                  {
                    backgroundColor:
                      dailyAllowanceStats.status === 'budget_over' || dailyAllowanceStats.status === 'wallet_empty'
                        ? theme.errorContainer
                        : dailyAllowanceStats.isOverDaily
                          ? (isDarkMode ? 'rgba(239, 68, 68, 0.25)' : '#FEE2E2')
                          : theme.primaryContainer,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={
                    dailyAllowanceStats.status === 'budget_over' || dailyAllowanceStats.status === 'wallet_empty'
                      ? 'alert-circle-outline'
                      : dailyAllowanceStats.isOverDaily
                        ? 'alert-outline'
                        : 'calendar-clock-outline'
                  }
                  size={20}
                  color={
                    dailyAllowanceStats.status === 'budget_over' ||
                      dailyAllowanceStats.status === 'wallet_empty' ||
                      dailyAllowanceStats.isOverDaily
                      ? theme.error
                      : theme.primary
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.quickTargetTitle, { color: theme.onSurface }]}>
                  {dailyAllowanceStats.headlineLabel}
                </Text>
                <Text style={[styles.quickTargetSubtitle, { color: theme.onSurfaceVariant }]}>
                  {currentCycle?.name || 'Active Cycle'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setAllowanceDetailVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="close" size={20} color={theme.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            {/* Big Amount Card with Description */}
            <View
              style={[
                styles.allowanceDescCard,
                {
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.04)' : theme.pillBg,
                  borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : theme.divider,
                },
              ]}
            >
              <Text
                style={[
                  styles.allowanceModalAmount,
                  {
                    color:
                      dailyAllowanceStats.status === 'budget_over' ||
                        dailyAllowanceStats.status === 'wallet_empty' ||
                        dailyAllowanceStats.remainingToday < 0
                        ? theme.error
                        : theme.primary,
                  },
                ]}
              >
                {wallets.length === 0 && overallBudgetLimit === 0
                  ? formatCurrency(0, curr)
                  : formatCurrency(dailyAllowanceStats.remainingToday, curr)}
              </Text>
              {dailyAllowanceStats.subText ? (
                <Text style={[styles.allowanceModalDescText, { color: theme.onSurface }]}>
                  {dailyAllowanceStats.subText}
                </Text>
              ) : null}
            </View>

            {/* Breakdown Stats Rows */}
            <View style={styles.allowanceBreakdownWrap}>
              <View style={styles.allowanceBreakdownRow}>
                <Text style={[styles.allowanceBreakdownLabel, { color: theme.onSurfaceVariant }]}>
                  {dailyAllowanceStats.hasBudget ? "Today's Budget Allowance" : "Today's Wallet Pace"}
                </Text>
                <Text style={[styles.allowanceBreakdownVal, { color: theme.onSurface }]}>
                  {formatCurrency(dailyAllowanceStats.availableForDay, curr)}
                </Text>
              </View>

              <View style={styles.allowanceBreakdownRow}>
                <Text style={[styles.allowanceBreakdownLabel, { color: theme.onSurfaceVariant }]}>
                  Spent Today
                </Text>
                <Text style={[styles.allowanceBreakdownVal, { color: theme.error }]}>
                  {formatCurrency(dailyAllowanceStats.spentToday, curr)}
                </Text>
              </View>

              <View style={styles.allowanceBreakdownRow}>
                <Text style={[styles.allowanceBreakdownLabel, { color: theme.onSurfaceVariant }]}>
                  {dailyAllowanceStats.hasBudget ? 'Remaining in Cycle Budget' : 'Total Wallet Funds'}
                </Text>
                <Text style={[styles.allowanceBreakdownVal, { color: theme.primary }]}>
                  {formatCurrency(
                    dailyAllowanceStats.hasBudget
                      ? Math.max(0, (currentCycle?.target_budget ?? 0) - spentInCycle)
                      : totalConvertedBalance,
                    curr
                  )}
                </Text>
              </View>

              {dailyAllowanceStats.hasBudget && (
                <View style={styles.allowanceBreakdownRow}>
                  <Text style={[styles.allowanceBreakdownLabel, { color: theme.onSurfaceVariant }]}>
                    Actual Wallet Balance
                  </Text>
                  <Text style={[styles.allowanceBreakdownVal, { color: theme.onSurface }]}>
                    {formatCurrency(totalConvertedBalance, curr)}
                  </Text>
                </View>
              )}

              <View style={styles.allowanceBreakdownRow}>
                <Text style={[styles.allowanceBreakdownLabel, { color: theme.onSurfaceVariant }]}>
                  Cycle Timeframe
                </Text>
                <Text style={[styles.allowanceBreakdownVal, { color: theme.onSurfaceVariant }]}>
                  {dailyAllowanceStats.daysRemaining} days remaining
                </Text>
              </View>

              {dailyAllowanceStats.leftoverMode === 'lock_savings' && (
                <View style={styles.allowanceBreakdownRow}>
                  <Text style={[styles.allowanceBreakdownLabel, { color: theme.success }]}>
                    Locked in Savings Reserve
                  </Text>
                  <Text style={[styles.allowanceBreakdownVal, { color: theme.success }]}>
                    {formatCurrency(dailyAllowanceStats.savedLeftoverPool || 0, curr)}
                  </Text>
                </View>
              )}
            </View>

            {/* Daily Leftover Rule Switcher */}
            {dailyAllowanceStats.hasBudget && (
              <View style={{ marginBottom: 14, gap: 6 }}>
                <Text style={[styles.allowanceBreakdownLabel, { color: theme.onSurfaceVariant, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6 }]}>
                  DAILY LEFTOVER RULE
                </Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {(
                    [
                      { key: 'spread', label: 'Spread' },
                      { key: 'next_day', label: 'Next Day' },
                      { key: 'lock_savings', label: 'Lock Savings' },
                    ] as const
                  ).map((m) => {
                    const active = (settings.daily_leftover_mode || 'spread') === m.key;
                    return (
                      <TouchableOpacity
                        key={m.key}
                        style={{
                          flex: 1,
                          paddingVertical: 8,
                          borderRadius: M3Shape.medium,
                          borderWidth: 1,
                          alignItems: 'center',
                          backgroundColor: active ? theme.primaryContainer : theme.pillBg,
                          borderColor: active ? theme.primary : theme.divider,
                        }}
                        onPress={() => updateSettings({ daily_leftover_mode: m.key })}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: active ? '800' : '600',
                            color: active ? theme.onPrimaryContainer : theme.onSurfaceVariant,
                          }}
                        >
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {settings.daily_leftover_mode === 'lock_savings' && (
                  <View style={{ marginTop: 8, gap: 6 }}>
                    <Text style={[styles.allowanceBreakdownLabel, { color: theme.onSurfaceVariant, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6 }]}>
                      {settings.lock_savings_wallet_id
                        ? 'SAVINGS WALLET FOR LOCKED LEFTOVERS'
                        : 'CHOOSE A WALLET TO LOCK SAVINGS INTO'}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {wallets.map((w) => {
                        const isTarget = settings.lock_savings_wallet_id === w.id;
                        const hasGoal = Boolean(w.goal_amount && w.goal_amount > 0);
                        return (
                          <TouchableOpacity
                            key={w.id}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              paddingHorizontal: 10,
                              paddingVertical: 7,
                              borderRadius: M3Shape.medium,
                              borderWidth: 1,
                              backgroundColor: isTarget ? theme.successContainer : theme.pillBg,
                              borderColor: isTarget ? theme.success : theme.divider,
                            }}
                            onPress={() => updateSettings({ lock_savings_wallet_id: w.id })}
                            activeOpacity={0.75}
                          >
                            <MaterialCommunityIcons
                              name={(w.icon as any) || 'wallet'}
                              size={14}
                              color={isTarget ? theme.success : w.color}
                            />
                            <Text
                              style={{
                                fontSize: 11.5,
                                fontWeight: isTarget ? '800' : '600',
                                color: isTarget ? theme.onSuccessContainer : theme.onSurface,
                              }}
                            >
                              {w.name}{hasGoal ? ' ðŸŽ¯' : ''}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    {settings.lock_savings_wallet_id && (dailyAllowanceStats.savedLeftoverPool ?? 0) > 0 && (() => {
                      const moveAmt = dailyAllowanceStats.savedLeftoverPool ?? 0;
                      const targetWallet = wallets.find((w) => w.id === settings.lock_savings_wallet_id);
                      const sourceWallet =
                        wallets.find((w) => w.id === selectedWalletId && w.id !== settings.lock_savings_wallet_id) ||
                        wallets.find((w) => w.is_default && w.id !== settings.lock_savings_wallet_id) ||
                        wallets.find((w) => w.id !== settings.lock_savings_wallet_id);
                      if (!targetWallet || !sourceWallet) return null;
                      return (
                        <TouchableOpacity
                          style={{
                            marginTop: 4,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            paddingVertical: 9,
                            paddingHorizontal: 12,
                            borderRadius: M3Shape.medium,
                            backgroundColor: theme.successContainer,
                            borderWidth: 1,
                            borderColor: theme.success,
                          }}
                          onPress={() => {
                            Alert.alert(
                              'Move Locked Savings',
                              `Transfer ${formatCurrency(moveAmt, curr)} from ${sourceWallet.name} to ${targetWallet.name}?`,
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Move',
                                  onPress: async () => {
                                    await transferBetweenWallets({
                                      from_wallet_id: sourceWallet.id,
                                      to_wallet_id: targetWallet.id,
                                      amount: moveAmt,
                                      date: formatLocalDate(new Date()),
                                      note: 'Locked daily leftovers savings',
                                    });
                                    setAllowanceDetailVisible(false);
                                  },
                                },
                              ]
                            );
                          }}
                          activeOpacity={0.8}
                        >
                          <MaterialCommunityIcons name="bank-transfer-in" size={16} color={theme.success} />
                          <Text style={{ fontSize: 12, fontWeight: '800', color: theme.onSuccessContainer }}>
                            Move {formatCurrency(moveAmt, curr)} to {targetWallet.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })()}
                  </View>
                )}
              </View>
            )}

            <View style={styles.quickTargetBtnRow}>
              <TouchableOpacity
                style={[styles.allowanceCloseBtn, { backgroundColor: theme.primary }]}
                onPress={() => setAllowanceDetailVisible(false)}
              >
                <Text style={[styles.quickTargetBtnText, { color: theme.onPrimary }]}>Got it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* VISUAL DATE RANGE PICKER MODAL */}
      <DateRangePickerModal
        visible={dateRangePickerVisible}
        initialStartDate={currentCycle?.start_date}
        initialEndDate={currentCycle?.end_date}
        onClose={() => setDateRangePickerVisible(false)}
        onSave={handleSaveDateRange}
      />

      {/* QUICK WALLET MODAL */}
      {quickWalletModalVisible && (
        <View style={styles.quickModalBackdrop}>
          <View style={[styles.quickModalBox, { backgroundColor: theme.surface }]}>
            <Text style={[styles.quickModalTitle, { color: theme.onSurface }]}>New Wallet</Text>
            <TextInput
              style={[styles.quickModalInput, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
              placeholder="Wallet Name (e.g. Cash, M-Pesa)"
              placeholderTextColor={theme.onSurfaceVariant}
              value={newWalletName}
              onChangeText={setNewWalletName}
            />
            <TextInput
              style={[styles.quickModalInput, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
              placeholder="Starting Balance"
              placeholderTextColor={theme.onSurfaceVariant}
              keyboardType="numeric"
              value={newWalletBal}
              onChangeText={(text) => setNewWalletBal(formatTypingNumber(text))}
            />
            <View style={styles.quickModalBtnRow}>
              <TouchableOpacity
                style={[styles.quickModalBtn, { backgroundColor: theme.pillBg }]}
                onPress={() => setQuickWalletModalVisible(false)}
              >
                <Text style={{ color: theme.onSurface }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickModalBtn, { backgroundColor: theme.primary }]}
                onPress={handleSaveQuickWallet}
              >
                <Text style={{ color: theme.onPrimary, fontWeight: '700' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* CATEGORY & BUDGET MANAGER MODAL */}
      <CategoryManagerModal visible={categoryModalVisible} onClose={() => setCategoryModalVisible(false)} />

      {/* CYCLE TYPE / MODE SWITCHER MODAL */}
      <CycleModeSwitcherModal
        visible={cycleModeModalVisible}
        onClose={() => setCycleModeModalVisible(false)}
      />

      {/* QUICK LOAN / SPLIT MODAL */}
      <TransactionDetailsModal
        visible={loanModalVisible}
        txType="expense"
        initialIouMode={true}
        initialAmount={0}
        initialWalletId={selectedWalletId || wallets[0]?.id || ''}
        wallets={wallets}
        categories={categories}
        theme={theme}
        baseCurrency={curr}
        onClose={() => setLoanModalVisible(false)}
        onSave={handleSaveTransactionDetails}
        onManageCategories={() => setCategoryModalVisible(true)}
        onAddSubcategory={addSubcategory}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  baseEntryContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  dockedLowerSection: {
    width: '100%',
  },
  inputSpace: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 6,
  },
  amountPressable: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  amountDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencySymbol: {
    fontWeight: '800',
  },
  amountInputText: {
    fontWeight: '800',
    letterSpacing: -1,
    paddingVertical: 0,
    minWidth: 40,
    textAlign: 'center',
  },
  duplicateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: M3Shape.full,
    gap: 4,
  },
  duplicateBannerText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
  },
  chipsWorkspace: {
    width: '100%',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  chipRowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipSectionLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  chipsScroll: {
    flexGrow: 0,
  },
  chipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: M3Shape.full,
    marginRight: 6,
    borderWidth: 1,
    gap: 5,
  },
  chipText: {
    fontSize: 11.5,
  },
  addChipBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockedDialPadArea: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
  },
  dialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 10,
  },
  dialKey: {
    flex: 1,
    borderRadius: M3Shape.large,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialKeyText: {
    fontWeight: '700',
  },
  dotSwitcherKeyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    overflow: 'hidden',
  },
  dotSubKeyTouch: {
    flex: 1.1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotSwitcherDivider: {
    width: StyleSheet.hairlineWidth,
    height: '60%',
  },
  calcSwitchSubKeyTouch: {
    flex: 1,
    height: '75%',
    borderRadius: M3Shape.small,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  calcPreviewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: M3Shape.full,
    borderWidth: 1,
    gap: 6,
    marginTop: 6,
  },
  calcPreviewAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  calcPreviewHint: {
    fontSize: 10,
    fontWeight: '600',
  },
  dualActionBar: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  dualRecordBtn: {
    flex: 1,
    borderRadius: M3Shape.large,
    borderWidth: 1.5,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  dualRecordBtnContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  dualRecordHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dualRecordBtnTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  dualRecordBadge: {
    paddingHorizontal: 8,
    paddingVertical: 1.5,
    borderRadius: M3Shape.full,
  },
  dualRecordBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 90,
  },
  topSheetContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomLeftRadius: M3Shape.extraLarge,
    borderBottomRightRadius: M3Shape.extraLarge,
    overflow: 'hidden',
    zIndex: 100,
  },
  heroSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  todayBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  todayBalanceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  todayBalanceLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  todayStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: M3Shape.full,
  },
  todayStatusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  todayBalanceAmount: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  todaySubText: {
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 2,
  },
  walletSumPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: M3Shape.full,
    gap: 6,
  },
  walletSumText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dualCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
    marginBottom: 6,
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
  activityContentWrapper: {
    flex: 1,
    marginBottom: 36,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  historyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  closeSheetBtn: {
    padding: 6,
  },
  emptyHistoryBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  emptyHistoryText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  historyScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 0,
  },
  dateGroupContainer: {
    marginBottom: 14,
  },
  dateGroupHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 5,
    borderBottomWidth: 1,
    marginBottom: 6,
  },
  dateGroupTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dateGroupTotalsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  daySpentPill: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  dayIncomePill: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  txItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 9,
    borderRadius: M3Shape.medium,
    borderWidth: 1,
    marginBottom: 6,
  },
  txCatDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  txTextCol: {
    flex: 1,
  },
  txItemTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  txItemSub: {
    fontSize: 10.5,
    marginTop: 1,
  },
  txItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  txItemAmount: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  txDeleteTouch: {
    padding: 3,
  },
  dragHandleArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  dragHandleTouch: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  dragHandlePill: {
    width: 32,
    height: 3.5,
    borderRadius: 2,
    marginBottom: 2,
  },
  dragHandleHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  dragHandleHintText: {
    fontSize: 9.5,
    fontWeight: '600',
  },
  quickModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  quickModalBox: {
    width: '100%',
    maxWidth: 340,
    borderRadius: M3Shape.extraLarge,
    padding: 20,
    gap: 12,
  },
  quickModalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  quickModalInput: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: M3Shape.medium,
    fontSize: 14,
  },
  quickModalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  quickModalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: M3Shape.full,
  },
  quickTargetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  quickTargetBox: {
    width: '100%',
    maxWidth: 350,
    borderRadius: M3Shape.extraLarge,
    padding: 20,
    gap: 14,
  },
  quickTargetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quickTargetIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTargetTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  quickTargetSubtitle: {
    fontSize: 11.5,
    marginTop: 1,
  },
  quickTargetInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: M3Shape.large,
    gap: 8,
  },
  quickTargetCurrency: {
    fontSize: 16,
    fontWeight: '800',
  },
  quickTargetInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    paddingVertical: 4,
  },
  quickTargetBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  quickTargetCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: M3Shape.full,
  },
  quickTargetSaveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: M3Shape.full,
  },
  quickTargetBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  allowanceDescCard: {
    padding: 14,
    borderRadius: M3Shape.medium,
    borderWidth: 1,
    alignItems: 'center',
    marginVertical: 12,
  },
  allowanceModalAmount: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  allowanceModalDescText: {
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  allowanceBreakdownWrap: {
    gap: 8,
    marginBottom: 16,
  },
  allowanceBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  allowanceBreakdownLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  allowanceBreakdownVal: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  allowanceCloseBtn: {
    flex: 1,
    height: 44,
    borderRadius: M3Shape.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dashScrollContent: {
    padding: 16,
    paddingBottom: 92,
    gap: 14,
  },
  dashHeroCard: {
    borderRadius: M3Shape.extraLarge,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  pulseStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pulseCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  pulseDivider: {
    width: 1,
    height: 26,
  },
  pulseLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  pulseVal: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  glanceStrip: {
    gap: 10,
    paddingVertical: 2,
  },
  glanceCard: {
    width: 148,
    borderRadius: M3Shape.large,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  glanceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  glanceLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  glanceValue: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  glanceSub: {
    fontSize: 11,
    fontWeight: '600',
  },
  recentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  recentSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  emptyRecentCard: {
    borderRadius: M3Shape.large,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 8,
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
  keypadBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  keypadSheetBox: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
    gap: 8,
  },
  keypadSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  keypadTypeToggle: {
    flexDirection: 'row',
    borderRadius: M3Shape.full,
    padding: 3,
    gap: 4,
  },
  keypadTypePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: M3Shape.full,
  },
  keypadIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadAmountBox: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  keypadContinueBtn: {
    height: 48,
    borderRadius: M3Shape.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  keypadContinueText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
