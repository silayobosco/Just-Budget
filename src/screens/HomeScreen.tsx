import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  PanResponder,
  Dimensions,
  TextInput,
  Alert,
  Keyboard,
  Pressable,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBudget } from '../context/BudgetContext';
import { lightTheme, darkTheme, M3Shape, M3Elevation } from '../theme';
import { TransactionType } from '../types';
import { formatCurrency } from '../utils/format';
import { CategoryManagerModal } from '../components/CategoryManagerModal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Top Sheet Heights:
// In collapsed state: shows today's balance + expense|income switcher + preview of the latest transaction + drag handle (~205px)
const COLLAPSED_SHEET_HEIGHT = 238;

export const HomeScreen: React.FC = () => {
  const {
    settings,
    dailyAllowanceStats,
    totalConvertedBalance,
    spentInCycle,
    incomeInCycle,
    transactions,
    categories,
    wallets,
    addTransaction,
    addWallet,
    addSubcategory,
    deleteTransaction,
  } = useBudget();

  const theme = settings.theme_mode === 'dark' ? darkTheme : lightTheme;
  const curr = settings.base_currency;

  // Active Transaction Form State
  const [txType, setTxType] = useState<TransactionType>('expense');
  const [amountStr, setAmountStr] = useState<string>('0');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>('');
  const [note, setNote] = useState<string>('');
  
  // Date & Time states (default to current local date and time)
  const [dateStr, setDateStr] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [timeStr, setTimeStr] = useState<string>(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  // Calendar & Time picker modal visibility
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const [calendarViewMonth, setCalendarViewMonth] = useState(() => new Date());
  const [tempHours, setTempHours] = useState(() => String(new Date().getHours()).padStart(2, '0'));
  const [tempMinutes, setTempMinutes] = useState(() => String(new Date().getMinutes()).padStart(2, '0'));

  // Paid / Not Paid Toggle State (default to not paid if date/time is in the future)
  const isFuture = useMemo(() => {
    const now = new Date();
    const [y, m, d] = dateStr.split('-').map(Number);
    const [hh, mm] = timeStr.split(':').map(Number);
    const selectedDt = new Date(y, m - 1, d, hh || 0, mm || 0, 0);
    return selectedDt.getTime() > now.getTime();
  }, [dateStr, timeStr]);

  const [isPaidUserOverride, setIsPaidUserOverride] = useState<boolean | null>(null);
  const isPaid = isPaidUserOverride !== null ? isPaidUserOverride : !isFuture;

  // Whenever date or time changes, update default isPaid if user hasn't explicitly locked it
  useEffect(() => {
    setIsPaidUserOverride(null);
  }, [dateStr, timeStr]);

  // Date helper formatting
  const formattedDateLabel = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    if (dateStr === today) return 'Today';
    if (dateStr === yesterdayStr) return 'Yesterday';
    if (dateStr === tomorrowStr) return 'Tomorrow';
    return dateStr;
  }, [dateStr]);

  // Calendar modal grid generator
  const calendarModalGrid = useMemo(() => {
    const year = calendarViewMonth.getFullYear();
    const month = calendarViewMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { dayNum: number; dateString: string }[] = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push({ dayNum: 0, dateString: '' });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ dayNum: d, dateString });
    }
    return cells;
  }, [calendarViewMonth]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const handleOpenTimeModal = () => {
    const [hh, mm] = timeStr.split(':');
    setTempHours(hh || '12');
    setTempMinutes(mm || '00');
    setTimeModalVisible(true);
  };

  const handleSaveTime = () => {
    const h = Math.min(23, Math.max(0, parseInt(tempHours) || 0));
    const m = Math.min(59, Math.max(0, parseInt(tempMinutes) || 0));
    setTimeStr(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    setTimeModalVisible(false);
  };

  // Quick Action / Manager modals
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [quickWalletModalVisible, setQuickWalletModalVisible] = useState(false);
  const [quickSubModalVisible, setQuickSubModalVisible] = useState(false);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletBal, setNewWalletBal] = useState('0');
  const [newSubName, setNewSubName] = useState('');

  // Auto-select initial wallet & categories
  useEffect(() => {
    if (wallets.length > 0 && !selectedWalletId) {
      const preferred = wallets.find((w) => w.is_default) || wallets[0];
      setSelectedWalletId(preferred.id);
    }
  }, [wallets, selectedWalletId]);

  // When transaction type or categories list change, clear category if current one is no longer applicable.
  // Category is NOT auto-initialized; it only becomes active when explicitly selected by the user.
  useEffect(() => {
    if (selectedCategoryId) {
      const activeCats = categories.filter((c) => c.type === (txType === 'income' ? 'income' : 'expense'));
      const found = activeCats.find((c) => c.id === selectedCategoryId);
      if (!found) {
        setSelectedCategoryId('');
        setSelectedSubcategoryId('');
      }
    }
  }, [txType, categories, selectedCategoryId]);

  // Handle category switch (tap selected category to deselect)
  const handleSelectCategory = (catId: string) => {
    if (noteInputRef.current?.isFocused?.()) {
      noteInputRef.current.blur();
    }
    Keyboard.dismiss();
    if (selectedCategoryId === catId) {
      setSelectedCategoryId('');
      setSelectedSubcategoryId('');
      return;
    }
    setSelectedCategoryId(catId);
    const cat = categories.find((c) => c.id === catId);
    if (cat?.subcategories && cat.subcategories.length > 0) {
      setSelectedSubcategoryId(cat.subcategories[0].id);
    } else {
      setSelectedSubcategoryId('');
    }
  };

  // Selection state for cursor tracking inside amount input
  const [amountSelection, setAmountSelection] = useState<{ start: number; end: number }>({
    start: 1,
    end: 1,
  });
  const amountInputRef = useRef<any>(null);
  const noteInputRef = useRef<any>(null);

  // Tracks whether user is currently editing the note (with system keyboard visible)
  const [isNoteEditing, setIsNoteEditing] = useState(false);

  useEffect(() => {
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setIsNoteEditing(false);
    });
    return () => {
      hideSub.remove();
    };
  }, []);

  // Keep amount input focused so cursor is ALWAYS visible and blinking on the amount,
  // both on screen load and whenever returning from note editing.
  useEffect(() => {
    if (!isNoteEditing) {
      const timer = setTimeout(() => {
        amountInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isNoteEditing]);

  // Handle direct text changes (typing from soft keyboard or pasting from native context menu / Gboard)
  const handleAmountChange = (text: string) => {
    if (!text || text === '') {
      setAmountStr('0');
      setAmountSelection({ start: 1, end: 1 });
      return;
    }
    const cleaned = text.replace(/,/g, '').replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    let valid = parts[0] || '0';
    if (parts.length > 1) {
      valid += '.' + parts.slice(1).join('').slice(0, 2);
    }
    if (valid.length > 1 && valid.startsWith('0') && !valid.startsWith('0.')) {
      valid = valid.replace(/^0+/, '') || '0';
    }
    if (valid.length > 14) valid = valid.slice(0, 14);
    const finalVal = valid || '0';
    setAmountStr(finalVal);
  };

  // Dial Pad Keypress (inserts or deletes at the current cursor selection position)
  const handleKeyPress = (val: string) => {
    if (isNoteEditing || noteInputRef.current?.isFocused?.()) {
      noteInputRef.current?.blur();
      Keyboard.dismiss();
      setIsNoteEditing(false);
    }
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
        // Selection range active: delete selected range
        const before = amountStr.slice(0, curStart);
        const after = amountStr.slice(curEnd);
        const next = (before + after) || '0';
        setAmountStr(next);
        setAmountSelection({ start: curStart, end: curStart });
        setTimeout(() => amountInputRef.current?.setSelection?.(curStart, curStart), 10);
      } else if (curStart > 0) {
        // Delete single char before cursor
        const before = amountStr.slice(0, curStart - 1);
        const after = amountStr.slice(curStart);
        const next = (before + after) || '0';
        setAmountStr(next);
        const newPos = Math.max(0, curStart - 1);
        setAmountSelection({ start: newPos, end: newPos });
        setTimeout(() => amountInputRef.current?.setSelection?.(newPos, newPos), 10);
      }
      return;
    }

    if (val === '.') {
      if (amountStr.includes('.')) {
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
    const nextCandidate = before + val + after;
    const parts = nextCandidate.split('.');
    if (parts.length === 2 && parts[1].length > 2) return;
    if (nextCandidate.replace(/[^0-9]/g, '').length >= 12) return;

    setAmountStr(nextCandidate);
    const nextPos = curStart + 1;
    setAmountSelection({ start: nextPos, end: nextPos });
    setTimeout(() => amountInputRef.current?.setSelection?.(nextPos, nextPos), 10);
  };

  // Record Transaction
  const parsedAmount = parseFloat(amountStr) || 0;
  const activeCategories = categories.filter((c) => c.type === (txType === 'income' ? 'income' : 'expense'));
  const currentCategory = categories.find((c) => c.id === selectedCategoryId);

  // Duplicate warning detection
  const isDuplicate = useMemo(() => {
    if (parsedAmount <= 0 || !selectedWalletId) return false;
    return transactions.some((t) => {
      return (
        t.date === dateStr &&
        t.wallet_id === selectedWalletId &&
        t.type === txType &&
        Math.abs(t.amount - parsedAmount) < 0.001 &&
        (t.category_id || '') === (selectedCategoryId || '') &&
        (t.subcategory_id || '') === (selectedSubcategoryId || '')
      );
    });
  }, [transactions, dateStr, selectedWalletId, txType, parsedAmount, selectedCategoryId, selectedSubcategoryId]);

  const handleSaveTransaction = async () => {
    if (parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter an amount greater than 0');
      return;
    }
    if (!selectedWalletId && wallets.length === 0) {
      Alert.alert('No Wallet', 'Please create a wallet first');
      return;
    }

    const doSave = async () => {
      await addTransaction({
        wallet_id: selectedWalletId || wallets[0].id,
        category_id: selectedCategoryId || undefined,
        subcategory_id: selectedSubcategoryId || undefined,
        type: txType,
        amount: parsedAmount,
        currency: curr,
        date: dateStr,
        note: note.trim() || undefined,
      });

      // Reset entry state
      setAmountStr('0');
      setNote('');
      setSelectedCategoryId('');
      setSelectedSubcategoryId('');
    };

    if (isDuplicate) {
      Alert.alert(
        'Duplicate Entry Detected',
        `An identical ${txType} entry of ${formatCurrency(parsedAmount, curr)} already exists today for this wallet and category. Do you want to record it again?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Anyway', style: 'destructive', onPress: doSave },
        ]
      );
    } else {
      await doSave();
    }
  };

  // Quick Add Wallet
  const handleSaveQuickWallet = async () => {
    if (!newWalletName.trim()) return;
    const initialBal = parseFloat(newWalletBal) || 0;
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

  // Quick Add Subcategory
  const handleSaveQuickSub = async () => {
    if (!newSubName.trim() || !selectedCategoryId) return;
    const newId = await addSubcategory(selectedCategoryId, newSubName.trim());
    setSelectedSubcategoryId(newId);
    setNewSubName('');
    setQuickSubModalVisible(false);
  };

  // Group transactions by date with total spent/income that day
  // INVERTED: chronological order where newest date is at the bottom,
  // and inside each day, transactions are ordered so newest is at the bottom.
  const groupedTransactions = useMemo(() => {
    const groups: {
      date: string;
      displayDate: string;
      totalSpent: number;
      totalIncome: number;
      items: typeof transactions;
    }[] = [];

    const map = new Map<string, typeof transactions>();
    transactions.forEach((tx) => {
      const arr = map.get(tx.date) || [];
      arr.push(tx);
      map.set(tx.date, arr);
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    Array.from(map.entries())
      // Ascending sort by date (oldest at top, newest at bottom)
      .sort((a, b) => a[0].localeCompare(b[0]))
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

        // Sort items inside this day ascending by created_at/id so newest is at the bottom
        const sortedItems = [...items].sort((a, b) => {
          const timeA = a.created_at || a.id;
          const timeB = b.created_at || b.id;
          return timeA.localeCompare(timeB);
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

  // Measured layout heights for pixel-perfect dynamic sizing
  const [screenContainerHeight, setScreenContainerHeight] = useState(0);

  // Maximum allowed expanded height: rigorously bounded by the actual container height,
  // leaving 6px clearance so it NEVER passes, touches, or overlaps the bottom navigation tabs.
  const maxExpandedSheetHeight = useMemo(() => {
    if (screenContainerHeight > 0) {
      return Math.max(COLLAPSED_SHEET_HEIGHT, screenContainerHeight - 6);
    }
    // Safe initial fallback before onLayout: window height minus status bar, header, and bottom tabs (~210px)
    return Math.max(COLLAPSED_SHEET_HEIGHT, SCREEN_HEIGHT - 210);
  }, [screenContainerHeight]);

  // Content height computed accurately from items and groups
  const historyContentHeight = useMemo(() => {
    if (transactions.length === 0) return 75;
    // Each date group header is ~30px, plus 14px spacing between different dates
    const groupsHeight = groupedTransactions.length * 30 + Math.max(0, groupedTransactions.length - 1) * 14;
    // Each transaction card is ~54px + 6px marginBottom = 60px
    const itemsHeight = transactions.length * 60;
    return groupsHeight + itemsHeight;
  }, [groupedTransactions, transactions]);

  // Dynamic Expanded Height: accurately fits all available items with full visibility,
  // clamped at maxExpandedSheetHeight (strictly bounded above the bottom bar tab).
  const expandedSheetHeight = useMemo(() => {
    // Base overhead: hero (~96) + history header (41) + drag handle (36) + scroll padding (12) + buffer = 192px
    const totalTarget = 192 + historyContentHeight;
    return Math.min(maxExpandedSheetHeight, Math.max(COLLAPSED_SHEET_HEIGHT, totalTarget));
  }, [historyContentHeight, maxExpandedSheetHeight]);

  // Ref to hold the scrollview to auto-scroll to the end (newest transactions at bottom)
  const historyScrollRef = useRef<any>(null);
  const scrollOffsetRef = useRef(0);
  const contentHeightRef = useRef(0);
  const layoutHeightRef = useRef(0);

  // ==============================================================
  // TOP SHEET PULL-DOWN GESTURE & ANIMATION
  // ==============================================================
  const animatedHeight = useRef(new Animated.Value(COLLAPSED_SHEET_HEIGHT)).current;
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const isExpandedRef = useRef(false);
  const currentHeightRef = useRef(COLLAPSED_SHEET_HEIGHT);

  // Smoothly glide sheet height if content count changes (e.g. items added or deleted) while expanded
  useEffect(() => {
    if (isExpandedRef.current) {
      Animated.timing(animatedHeight, {
        toValue: expandedSheetHeight,
        duration: 180,
        useNativeDriver: false,
      }).start();
    }
  }, [expandedSheetHeight]);

  // Interpolate opacity/height of the sticky History header:
  // Visible ONLY when expanded; smoothly fades out to 0 when collapsed so the last item is directly seen.
  const historyHeaderOpacity = animatedHeight.interpolate({
    inputRange: [COLLAPSED_SHEET_HEIGHT, COLLAPSED_SHEET_HEIGHT + 35],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const historyHeaderHeight = animatedHeight.interpolate({
    inputRange: [COLLAPSED_SHEET_HEIGHT, COLLAPSED_SHEET_HEIGHT + 35],
    outputRange: [0, 40],
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
    }).start(() => {
      setTimeout(() => {
        historyScrollRef.current?.scrollToEnd?.({ animated: true });
      }, 50);
    });
    setIsSheetExpanded(true);
    isExpandedRef.current = true;
  };

  const closeSheet = () => {
    Animated.spring(animatedHeight, {
      toValue: COLLAPSED_SHEET_HEIGHT,
      useNativeDriver: false,
      bounciness: 3,
      speed: 14,
    }).start(() => {
      historyScrollRef.current?.scrollToEnd?.({ animated: false });
    });
    setIsSheetExpanded(false);
    isExpandedRef.current = false;
  };

  const toggleSheet = () => {
    if (isExpandedRef.current) {
      closeSheet();
    } else {
      openSheet();
    }
  };

  // Top Sheet Pull-Down PanResponder (for expanding when collapsed; no gesture for collapsing)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only pull down to expand when collapsed; no gesture for collapsing
        if (!isExpandedRef.current && gestureState.dy > 5) {
          return true;
        }
        return false;
      },
      onPanResponderGrant: () => {},
      onPanResponderMove: (_, gestureState) => {
        let nextH = COLLAPSED_SHEET_HEIGHT + gestureState.dy;
        if (nextH < COLLAPSED_SHEET_HEIGHT) {
          nextH = COLLAPSED_SHEET_HEIGHT;
        } else if (nextH > expandedSheetHeight) {
          nextH = expandedSheetHeight + (nextH - expandedSheetHeight) * 0.2;
        }
        animatedHeight.setValue(nextH);
      },
      onPanResponderRelease: (_, gestureState) => {
        const currentH = currentHeightRef.current;
        const threshold = (COLLAPSED_SHEET_HEIGHT + expandedSheetHeight) / 2;
        const isFlickDown = gestureState.vy > 0.4;
        const isDragDown = gestureState.dy > 35;
        if (isFlickDown || isDragDown || currentH > threshold) {
          openSheet();
        } else {
          closeSheet();
        }
      },
      onPanResponderTerminate: () => {
        const currentH = currentHeightRef.current;
        const threshold = (COLLAPSED_SHEET_HEIGHT + expandedSheetHeight) / 2;
        if (currentH > threshold) {
          openSheet();
        } else {
          closeSheet();
        }
      },
    })
  ).current;

  // Today's balance calculation
  const todaySpent = dailyAllowanceStats.spentToday;
  const todayIncome = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return transactions
      .filter((t) => t.type === 'income' && t.date === today)
      .reduce((sum, t) => sum + (t.amount || t.base_amount || 0), 0);
  }, [transactions]);
  const todayNetBalance = todayIncome - todaySpent;

  return (
    <View
      onLayout={(e) => setScreenContainerHeight(e.nativeEvent.layout.height)}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {/* ============================================================== */}
      {/* 1. BASE SCREEN: ENTRY WORKSPACE WITH CHIPS DOCKED ON KEYPAD     */}
      {/* ============================================================== */}
      <View style={[styles.baseEntryContainer, { paddingTop: COLLAPSED_SHEET_HEIGHT }]}>
        {/* Dismiss overlay when keyboard is open for note editing:
            Tapping anywhere outside note card cleanly closes the keyboard BEFORE number entry is touched */}
        {isNoteEditing && (
          <Pressable
            style={[StyleSheet.absoluteFill, { zIndex: 90 }]}
            onPress={() => {
              noteInputRef.current?.blur();
              Keyboard.dismiss();
              setIsNoteEditing(false);
              setTimeout(() => {
                amountInputRef.current?.focus();
              }, 120);
            }}
          />
        )}

        {/* UPPER WORKSPACE: Amount Display with currency on left, native cursor, and paste ability */}
        <View style={styles.inputSpace}>
          <View style={styles.amountDisplayRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => amountInputRef.current?.focus()}
            >
              <Text style={[styles.currencyPrefixLeft, { color: theme.onSurfaceVariant }]}>{curr}</Text>
            </TouchableOpacity>
            <TextInput
              ref={amountInputRef}
              style={[
                styles.displayAmountInput,
                { color: txType === 'expense' ? theme.error : theme.success },
              ]}
              value={amountStr}
              onChangeText={handleAmountChange}
              onSelectionChange={(e) => setAmountSelection(e.nativeEvent.selection)}
              showSoftInputOnFocus={false}
              caretHidden={false}
              cursorColor={txType === 'expense' ? theme.error : theme.success}
              selectionColor={txType === 'expense' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}
              selectTextOnFocus={false}
              autoCapitalize="none"
              autoCorrect={false}
              contextMenuHidden={false}
              scrollEnabled={false}
            />
          </View>

          {isDuplicate && (
            <View style={[styles.duplicateBanner, { backgroundColor: '#FEF3C7' }]}>
              <MaterialCommunityIcons name="alert-outline" size={14} color="#D97706" />
              <Text style={styles.duplicateBannerText}>Possible duplicate</Text>
            </View>
          )}
        </View>

        {/* LOWER SECTION: CHIPS DIRECTLY DOCKED ON TOP OF KEYPAD */}
        <View style={styles.dockedLowerSection}>
          {/* TOP ENTRY BAR: DATE CHIP, TIME CHIP, PAID/NOT PAID TOGGLE */}
          <View style={[styles.dateTimeToggleBar, { backgroundColor: theme.surface, borderBottomColor: theme.divider }]}>
            {/* Calendar Date Chip */}
            <TouchableOpacity
              style={[styles.dateTimeChip, { backgroundColor: theme.pillBg }]}
              onPress={() => {
                const [y, m] = dateStr.split('-').map(Number);
                setCalendarViewMonth(new Date(y, m - 1, 1));
                setCalendarModalVisible(true);
              }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="calendar-month-outline" size={15} color={theme.primary} />
              <Text style={[styles.dateTimeChipText, { color: theme.onSurface }]}>
                {formattedDateLabel}
              </Text>
              <MaterialCommunityIcons name="menu-down" size={14} color={theme.onSurfaceVariant} />
            </TouchableOpacity>

            {/* Time Chip */}
            <TouchableOpacity
              style={[styles.dateTimeChip, { backgroundColor: theme.pillBg }]}
              onPress={handleOpenTimeModal}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="clock-time-four-outline" size={15} color={theme.primary} />
              <Text style={[styles.dateTimeChipText, { color: theme.onSurface }]}>
                {timeStr}
              </Text>
              <MaterialCommunityIcons name="menu-down" size={14} color={theme.onSurfaceVariant} />
            </TouchableOpacity>

            {/* Paid / Not Paid Switcher Chip */}
            <TouchableOpacity
              style={[
                styles.paidStatusChip,
                {
                  backgroundColor: isPaid ? theme.successContainer : theme.errorContainer,
                },
              ]}
              onPress={() => setIsPaidUserOverride(!isPaid)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name={isPaid ? 'check-circle' : 'clock-alert-outline'}
                size={15}
                color={isPaid ? theme.success : theme.error}
              />
              <Text
                style={[
                  styles.paidStatusText,
                  { color: isPaid ? theme.onSuccessContainer : theme.onErrorContainer },
                ]}
              >
                {isPaid ? 'Paid' : 'Not Paid'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* CHIP SELECTION STRIPS: Note, Wallet, Category, Subcategory */}
          <View style={[styles.chipsWorkspace, { backgroundColor: theme.surface }]}>
            {/* NOTE INPUT CARD (Positioned above Wallets with enhanced card size) */}
            <View style={[styles.noteRow, { backgroundColor: theme.pillBg, borderColor: theme.divider, zIndex: 100 }]}>
              <MaterialCommunityIcons name="pencil-outline" size={18} color={theme.primary} />
              <TextInput
                ref={noteInputRef}
                style={[styles.noteInput, { color: theme.onSurface }]}
                placeholder="Add optional note or tag..."
                placeholderTextColor={theme.onSurfaceVariant}
                value={note}
                onChangeText={setNote}
                maxLength={80}
                onFocus={() => setIsNoteEditing(true)}
                onBlur={() => {
                  setIsNoteEditing(false);
                  Keyboard.dismiss();
                  setTimeout(() => {
                    amountInputRef.current?.focus();
                  }, 120);
                }}
                returnKeyType="done"
                blurOnSubmit={true}
                onSubmitEditing={() => {
                  noteInputRef.current?.blur();
                  Keyboard.dismiss();
                  setIsNoteEditing(false);
                  setTimeout(() => {
                    amountInputRef.current?.focus();
                  }, 120);
                }}
              />
              {note.length > 0 && (
                <TouchableOpacity onPress={() => setNote('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <MaterialCommunityIcons name="close-circle" size={18} color={theme.outline} />
                </TouchableOpacity>
              )}
            </View>

            {/* WALLETS ROW */}
            <View style={styles.chipRowWrap}>
              <Text style={[styles.chipSectionLabel, { color: theme.onSurfaceVariant }]}>WALLET</Text>
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
                      onPress={() => {
                        if (noteInputRef.current?.isFocused?.()) {
                          noteInputRef.current.blur();
                        }
                        Keyboard.dismiss();
                        setSelectedWalletId(w.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons
                        name={(w.icon as any) || 'wallet'}
                        size={14}
                        color={isSelected ? theme.onPrimaryContainer : theme.onSurface}
                      />
                      <Text
                        style={[
                          styles.chipText,
                          {
                            color: isSelected ? theme.onPrimaryContainer : theme.onSurface,
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {w.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[styles.addChipBtn, { backgroundColor: theme.primaryContainer }]}
                  onPress={() => {
                    setNewWalletName('');
                    setNewWalletBal('0');
                    setQuickWalletModalVisible(true);
                  }}
                >
                  <MaterialCommunityIcons name="plus" size={15} color={theme.onPrimaryContainer} />
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* CATEGORIES ROW */}
            <View style={styles.chipRowWrap}>
              <Text style={[styles.chipSectionLabel, { color: theme.onSurfaceVariant }]}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {activeCategories.map((c) => {
                  const isSelected = c.id === selectedCategoryId;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.chipItem,
                        {
                          backgroundColor: isSelected ? c.color : theme.pillBg,
                          borderColor: isSelected ? c.color : 'transparent',
                        },
                      ]}
                      onPress={() => handleSelectCategory(c.id)}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons
                        name={(c.icon as any) || 'tag-outline'}
                        size={14}
                        color={isSelected ? '#FFFFFF' : theme.onSurface}
                      />
                      <Text
                        style={[
                          styles.chipText,
                          {
                            color: isSelected ? '#FFFFFF' : theme.onSurface,
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[styles.addChipBtn, { backgroundColor: theme.secondaryContainer }]}
                  onPress={() => setCategoryModalVisible(true)}
                >
                  <MaterialCommunityIcons name="plus" size={15} color={theme.onSecondaryContainer} />
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* SUBCATEGORIES ROW (if any) */}
            {currentCategory?.subcategories && currentCategory.subcategories.length > 0 && (
              <View style={styles.chipRowWrap}>
                <Text style={[styles.chipSectionLabel, { color: theme.onSurfaceVariant }]}>SUB</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  {currentCategory.subcategories.map((s) => {
                    const isSelected = s.id === selectedSubcategoryId;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[
                          styles.chipItemSmall,
                          {
                            backgroundColor: isSelected ? theme.secondaryContainer : theme.pillBg,
                          },
                        ]}
                        onPress={() => {
                          if (noteInputRef.current?.isFocused?.()) {
                            noteInputRef.current.blur();
                          }
                          Keyboard.dismiss();
                          setSelectedSubcategoryId(isSelected ? '' : s.id);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.chipTextSmall,
                            {
                              color: isSelected ? theme.onSecondaryContainer : theme.onSurfaceVariant,
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          {s.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={[styles.addChipBtn, { backgroundColor: theme.pillBg }]}
                    onPress={() => {
                      setNewSubName('');
                      setQuickSubModalVisible(true);
                    }}
                  >
                    <MaterialCommunityIcons name="plus" size={14} color={theme.onSurface} />
                  </TouchableOpacity>
                </ScrollView>
              </View>
            )}
          </View>

          {/* 1B. DOCKED DIAL PAD (PINNED TO BOTTOM) */}
          <View style={[styles.dockedDialPadArea, { borderTopColor: theme.divider, backgroundColor: theme.surface }]}>
            {[
              ['1', '2', '3'],
              ['4', '5', '6'],
              ['7', '8', '9'],
              ['.', '0', 'backspace'],
            ].map((row, rIdx) => (
              <View key={rIdx} style={styles.dialRow}>
                {row.map((k) => (
                  <TouchableOpacity
                    key={k}
                    style={[styles.dialKey, { backgroundColor: theme.pillBg }]}
                    onPress={() => handleKeyPress(k)}
                    activeOpacity={0.65}
                  >
                    {k === 'backspace' ? (
                      <MaterialCommunityIcons name="backspace-outline" size={24} color={theme.onSurface} />
                    ) : (
                      <Text style={[styles.dialKeyText, { color: theme.onSurface }]}>{k}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            {/* Record Action Bar */}
            <View style={styles.actionBar}>
              <TouchableOpacity
                style={[
                  styles.recordButton,
                  {
                    backgroundColor:
                      parsedAmount > 0
                        ? txType === 'expense'
                          ? theme.primary
                          : theme.success
                        : theme.divider,
                  },
                  M3Elevation.level2,
                ]}
                onPress={handleSaveTransaction}
                disabled={parsedAmount <= 0}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="check" size={22} color={theme.onPrimary} />
                <Text style={[styles.recordButtonText, { color: theme.onPrimary }]}>
                  Record {txType === 'expense' ? 'Expense' : 'Income'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* ============================================================== */}
      {/* BACKDROP DIMMER WHEN SHEET IS EXPANDED                        */}
      {/* ============================================================== */}
      {isSheetExpanded && (
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={closeSheet}
        />
      )}

      {/* ============================================================== */}
      {/* 2. TOP SHEET: EXPENSE|INCOME & TODAY BALANCE (PULLS DOWN)     */}
      {/* ============================================================== */}
      <Animated.View
        style={[
          styles.topSheetContainer,
          {
            backgroundColor: theme.surface,
            height: animatedHeight,
          },
          M3Elevation.level3,
        ]}
      >
        {/* 2A. HERO HEADER: TODAY'S BALANCE + EXPENSE|INCOME SWITCHER */}
        <View {...panResponder.panHandlers} style={styles.heroSection}>
          {/* Today's Net Balance Row */}
          <View style={styles.todayBalanceRow}>
            <View>
              <Text style={[styles.todayBalanceLabel, { color: theme.onSurfaceVariant }]}>
                TODAY'S NET BALANCE
              </Text>
              <Text
                style={[
                  styles.todayBalanceAmount,
                  { color: todayNetBalance >= 0 ? theme.primary : theme.error },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {todayNetBalance >= 0 ? '+' : ''}
                {formatCurrency(todayNetBalance, curr)}
              </Text>
            </View>

            {/* Wallet summary pill */}
            <View style={[styles.walletSumPill, { backgroundColor: theme.pillBg }]}>
              <MaterialCommunityIcons name="wallet-outline" size={14} color={theme.primary} />
              <Text style={[styles.walletSumText, { color: theme.onSurface }]}>
                {formatCurrency(totalConvertedBalance, curr)}
              </Text>
            </View>
          </View>

          {/* Dual Switcher & Totals: EXPENSES & INCOME */}
          <View style={[styles.switcherContainer, { backgroundColor: theme.surfaceVariant }]}>
            {/* Expense Tab / Switcher */}
            <TouchableOpacity
              style={[
                styles.switcherTab,
                txType === 'expense' && [
                  styles.switcherTabActive,
                  { backgroundColor: theme.errorContainer },
                  M3Elevation.level1,
                ],
              ]}
              onPress={() => setTxType('expense')}
              activeOpacity={0.8}
            >
              <View style={styles.switcherIconTextRow}>
                <View
                  style={[
                    styles.tabDot,
                    { backgroundColor: txType === 'expense' ? theme.error : theme.outline },
                  ]}
                />
                <Text
                  style={[
                    styles.switcherTabTitle,
                    {
                      color:
                        txType === 'expense' ? theme.onErrorContainer : theme.onSurfaceVariant,
                    },
                  ]}
                >
                  EXPENSES
                </Text>
              </View>
              <Text
                style={[
                  styles.switcherTabAmount,
                  { color: txType === 'expense' ? theme.error : theme.onSurfaceVariant },
                ]}
                numberOfLines={1}
              >
                {formatCurrency(spentInCycle, curr)}
              </Text>
            </TouchableOpacity>

            {/* Income Tab / Switcher */}
            <TouchableOpacity
              style={[
                styles.switcherTab,
                txType === 'income' && [
                  styles.switcherTabActive,
                  { backgroundColor: theme.successContainer },
                  M3Elevation.level1,
                ],
              ]}
              onPress={() => setTxType('income')}
              activeOpacity={0.8}
            >
              <View style={styles.switcherIconTextRow}>
                <View
                  style={[
                    styles.tabDot,
                    { backgroundColor: txType === 'income' ? theme.success : theme.outline },
                  ]}
                />
                <Text
                  style={[
                    styles.switcherTabTitle,
                    {
                      color:
                        txType === 'income' ? theme.onSuccessContainer : theme.onSurfaceVariant,
                    },
                  ]}
                >
                  INCOME
                </Text>
              </View>
              <Text
                style={[
                  styles.switcherTabAmount,
                  { color: txType === 'income' ? theme.success : theme.onSurfaceVariant },
                ]}
                numberOfLines={1}
              >
                {formatCurrency(incomeInCycle, curr)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2B. HISTORY LIST (REVEALED WHEN SHEET PULLS DOWN) */}
        <View style={styles.activityContentWrapper}>
          {/* STICKY TOP HISTORY HEADER (Fades in when expanded, hides when collapsed) */}
          <Animated.View
            style={[
              styles.historyHeader,
              {
                borderBottomColor: theme.divider,
                backgroundColor: theme.surface,
                opacity: historyHeaderOpacity,
                height: historyHeaderHeight,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.historyTitleRow}
              onPress={toggleSheet}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="history" size={17} color={theme.primary} />
              <Text style={[styles.historyTitle, { color: theme.onSurface }]}>History</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleSheet} style={styles.closeSheetBtn}>
              <MaterialCommunityIcons
                name="chevron-up"
                size={19}
                color={theme.onSurfaceVariant}
              />
            </TouchableOpacity>
          </Animated.View>

          {groupedTransactions.length === 0 ? (
            <View style={[styles.emptyHistoryBox, { flexGrow: 1, justifyContent: 'flex-end' }]}>
              <MaterialCommunityIcons
                name="receipt-text-outline"
                size={42}
                color={theme.outlineVariant}
              />
              <Text style={[styles.emptyHistoryText, { color: theme.onSurfaceVariant }]}>
                No history recorded yet
              </Text>
            </View>
          ) : (
            <ScrollView
              ref={historyScrollRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.historyScrollContent}
              nestedScrollEnabled={true}
              scrollEnabled={true}
              bounces={false}
              overScrollMode="never"
              onScroll={(e) => {
                const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
                scrollOffsetRef.current = contentOffset.y;
                contentHeightRef.current = contentSize.height;
                layoutHeightRef.current = layoutMeasurement.height;
              }}
              scrollEventThrottle={16}
            >
              {groupedTransactions.map((group, groupIdx) => {
                const isLastGroup = groupIdx === groupedTransactions.length - 1;
                return (
                  <View
                    key={group.date}
                    style={[
                      styles.dateGroupContainer,
                      isLastGroup && { marginBottom: 0 },
                    ]}
                  >
                    {/* Date Group Header with Totals (returned to top, without the word "Total") */}
                    <View style={[styles.dateGroupHeaderRow, { borderBottomColor: theme.divider }]}>
                      <Text style={[styles.dateGroupTitle, { color: theme.onSurface }]}>
                        {group.displayDate}
                      </Text>
                      <View style={styles.dateGroupTotalsRow}>
                        {group.totalSpent > 0 && (
                          <Text style={[styles.daySpentPill, { color: theme.error }]}>
                            -{formatCurrency(group.totalSpent, curr)}
                          </Text>
                        )}
                        {group.totalIncome > 0 && (
                          <Text style={[styles.dayIncomePill, { color: theme.success }]}>
                            +{formatCurrency(group.totalIncome, curr)}
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Individual transaction items for this date */}
                    {group.items.map((tx, txIdx) => {
                      const cat = categories.find((c) => c.id === tx.category_id);
                      const sub = cat?.subcategories?.find((s) => s.id === tx.subcategory_id);
                      const wallet = wallets.find((w) => w.id === tx.wallet_id);
                      const isExp = tx.type === 'expense';
                      const isTransfer = tx.type === 'transfer';

                      const mainTitle = isTransfer
                        ? 'Transfer'
                        : sub?.name || cat?.name || 'Uncategorized';
                      const subtitle = [
                        sub ? cat?.name : null,
                        wallet?.name,
                        tx.note || null,
                      ]
                        .filter(Boolean)
                        .join(' • ');

                      return (
                        <View
                          key={tx.id}
                          style={[
                            styles.txItemRow,
                            { backgroundColor: theme.cardBg, borderColor: theme.divider },
                          ]}
                        >
                          <View
                            style={[
                              styles.txCatDot,
                              {
                                backgroundColor: isTransfer
                                  ? theme.tertiary
                                  : cat?.color || theme.primary,
                              },
                            ]}
                          >
                            <MaterialCommunityIcons
                              name={isTransfer ? 'swap-horizontal' : (cat?.icon as any) || 'cash'}
                              size={16}
                              color="#FFFFFF"
                            />
                          </View>

                          <View style={styles.txTextCol}>
                            <Text style={[styles.txItemTitle, { color: theme.onSurface }]}>
                              {mainTitle}
                            </Text>
                            <Text
                              style={[styles.txItemSub, { color: theme.onSurfaceVariant }]}
                              numberOfLines={1}
                            >
                              {subtitle}
                            </Text>
                          </View>

                          <View style={styles.txItemRight}>
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
                              {formatCurrency(tx.amount, tx.currency)}
                            </Text>
                            <TouchableOpacity
                              onPress={() => deleteTransaction(tx.id)}
                              style={styles.txDeleteTouch}
                            >
                              <MaterialCommunityIcons
                                name="close-circle-outline"
                                size={16}
                                color={theme.outline}
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* 2C. DRAG HANDLE BAR AT BOTTOM OF TOP SHEET */}
        <View {...panResponder.panHandlers} style={[styles.dragHandleArea, { borderTopColor: theme.divider, backgroundColor: theme.surface }]}>
          <TouchableOpacity onPress={toggleSheet} activeOpacity={0.8} style={styles.dragHandleTouch}>
            <View style={[styles.dragHandlePill, { backgroundColor: theme.outlineVariant }]} />
            <View style={styles.dragHandleHintRow}>
              <MaterialCommunityIcons
                name={isSheetExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={theme.onSurfaceVariant}
              />
              <Text style={[styles.dragHandleHintText, { color: theme.onSurfaceVariant }]}>
                {isSheetExpanded ? 'Tap to close history' : 'Pull down to see more history'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </Animated.View>

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
              onChangeText={setNewWalletBal}
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

      {/* QUICK SUBCATEGORY MODAL */}
      {quickSubModalVisible && (
        <View style={styles.quickModalBackdrop}>
          <View style={[styles.quickModalBox, { backgroundColor: theme.surface }]}>
            <Text style={[styles.quickModalTitle, { color: theme.onSurface }]}>New Subcategory</Text>
            <Text style={[styles.quickModalSubtitle, { color: theme.onSurfaceVariant }]}>
              For {currentCategory?.name}
            </Text>
            <TextInput
              style={[styles.quickModalInput, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
              placeholder="Subcategory Name (e.g. Eating out)"
              placeholderTextColor={theme.onSurfaceVariant}
              value={newSubName}
              onChangeText={setNewSubName}
            />
            <View style={styles.quickModalBtnRow}>
              <TouchableOpacity
                style={[styles.quickModalBtn, { backgroundColor: theme.pillBg }]}
                onPress={() => setQuickSubModalVisible(false)}
              >
                <Text style={{ color: theme.onSurface }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickModalBtn, { backgroundColor: theme.primary }]}
                onPress={handleSaveQuickSub}
              >
                <Text style={{ color: theme.onPrimary, fontWeight: '700' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* CALENDAR PICKER MODAL */}
      {calendarModalVisible && (
        <View style={styles.quickModalBackdrop}>
          <View style={[styles.quickModalBox, { backgroundColor: theme.surface }]}>
            <View style={styles.calendarModalHeader}>
              <Text style={[styles.quickModalTitle, { color: theme.onSurface }]}>
                {monthNames[calendarViewMonth.getMonth()]} {calendarViewMonth.getFullYear()}
              </Text>
              <View style={styles.calNavRow}>
                <TouchableOpacity
                  onPress={() => {
                    const prev = new Date(calendarViewMonth);
                    prev.setMonth(prev.getMonth() - 1);
                    setCalendarViewMonth(prev);
                  }}
                  style={[styles.calNavBtn, { backgroundColor: theme.pillBg }]}
                >
                  <MaterialCommunityIcons name="chevron-left" size={20} color={theme.onSurface} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    const next = new Date(calendarViewMonth);
                    next.setMonth(next.getMonth() + 1);
                    setCalendarViewMonth(next);
                  }}
                  style={[styles.calNavBtn, { backgroundColor: theme.pillBg }]}
                >
                  <MaterialCommunityIcons name="chevron-right" size={20} color={theme.onSurface} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Weekday indicators */}
            <View style={styles.calWeekdayRow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, idx) => (
                <Text key={idx} style={[styles.calWeekdayText, { color: theme.onSurfaceVariant }]}>
                  {w}
                </Text>
              ))}
            </View>

            {/* Month Days Grid */}
            <View style={styles.calDaysGrid}>
              {calendarModalGrid.map((cell, idx) => {
                if (cell.dayNum === 0) {
                  return <View key={idx} style={styles.calEmptyCell} />;
                }
                const isSelected = cell.dateString === dateStr;
                const isToday = cell.dateString === new Date().toISOString().slice(0, 10);

                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.calDayCell,
                      {
                        backgroundColor: isSelected ? theme.primaryContainer : 'transparent',
                        borderColor: isSelected ? theme.primary : isToday ? theme.secondary : 'transparent',
                      },
                    ]}
                    onPress={() => {
                      setDateStr(cell.dateString);
                      setCalendarModalVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.calDayNum,
                        {
                          color: isSelected
                            ? theme.onPrimaryContainer
                            : isToday
                            ? theme.primary
                            : theme.onSurface,
                          fontWeight: isSelected || isToday ? '700' : '500',
                        },
                      ]}
                    >
                      {cell.dayNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Actions: Today shortcut & Cancel */}
            <View style={styles.quickModalBtnRow}>
              <TouchableOpacity
                style={[styles.quickModalBtn, { backgroundColor: theme.pillBg }]}
                onPress={() => {
                  setDateStr(new Date().toISOString().slice(0, 10));
                  setCalendarModalVisible(false);
                }}
              >
                <Text style={{ color: theme.primary, fontWeight: '700' }}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickModalBtn, { backgroundColor: theme.pillBg }]}
                onPress={() => setCalendarModalVisible(false)}
              >
                <Text style={{ color: theme.onSurface }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* TIME PICKER MODAL */}
      {timeModalVisible && (
        <View style={styles.quickModalBackdrop}>
          <View style={[styles.quickModalBox, { backgroundColor: theme.surface }]}>
            <Text style={[styles.quickModalTitle, { color: theme.onSurface }]}>Set Time</Text>
            <View style={styles.timeInputRow}>
              <View style={styles.timeUnitCol}>
                <Text style={[styles.timeUnitLabel, { color: theme.onSurfaceVariant }]}>HOURS (00-23)</Text>
                <TextInput
                  style={[styles.timeTextInput, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                  keyboardType="numeric"
                  maxLength={2}
                  value={tempHours}
                  onChangeText={setTempHours}
                />
              </View>
              <Text style={[styles.timeColon, { color: theme.onSurface }]}>:</Text>
              <View style={styles.timeUnitCol}>
                <Text style={[styles.timeUnitLabel, { color: theme.onSurfaceVariant }]}>MINUTES (00-59)</Text>
                <TextInput
                  style={[styles.timeTextInput, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                  keyboardType="numeric"
                  maxLength={2}
                  value={tempMinutes}
                  onChangeText={setTempMinutes}
                />
              </View>
            </View>

            {/* Quick Presets */}
            <View style={styles.timePresetsRow}>
              <TouchableOpacity
                style={[styles.timePresetChip, { backgroundColor: theme.pillBg }]}
                onPress={() => {
                  const now = new Date();
                  setTempHours(String(now.getHours()).padStart(2, '0'));
                  setTempMinutes(String(now.getMinutes()).padStart(2, '0'));
                }}
              >
                <Text style={[styles.timePresetText, { color: theme.primary }]}>Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.timePresetChip, { backgroundColor: theme.pillBg }]}
                onPress={() => {
                  setTempHours('09');
                  setTempMinutes('00');
                }}
              >
                <Text style={[styles.timePresetText, { color: theme.onSurface }]}>09:00 AM</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.timePresetChip, { backgroundColor: theme.pillBg }]}
                onPress={() => {
                  setTempHours('13');
                  setTempMinutes('00');
                }}
              >
                <Text style={[styles.timePresetText, { color: theme.onSurface }]}>01:00 PM</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.timePresetChip, { backgroundColor: theme.pillBg }]}
                onPress={() => {
                  setTempHours('20');
                  setTempMinutes('00');
                }}
              >
                <Text style={[styles.timePresetText, { color: theme.onSurface }]}>08:00 PM</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.quickModalBtnRow}>
              <TouchableOpacity
                style={[styles.quickModalBtn, { backgroundColor: theme.pillBg }]}
                onPress={() => setTimeModalVisible(false)}
              >
                <Text style={{ color: theme.onSurface }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickModalBtn, { backgroundColor: theme.primary }]}
                onPress={handleSaveTime}
              >
                <Text style={{ color: theme.onPrimary, fontWeight: '700' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* CATEGORY & BUDGET MANAGER MODAL */}
      <CategoryManagerModal visible={categoryModalVisible} onClose={() => setCategoryModalVisible(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },

  // 1. BASE SCREEN: ENTRY WORKSPACE & DOCKED DIAL PAD
  baseEntryContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  dockedLowerSection: {
    width: '100%',
  },

  // TOP ENTRY BAR (DATE CHIP, TIME CHIP, PAID TOGGLE)
  dateTimeToggleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderBottomWidth: 0.5,
    gap: 8,
  },
  dateTimeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: M3Shape.full,
    gap: 5,
  },
  dateTimeChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  paidStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: M3Shape.full,
    gap: 5,
  },
  paidStatusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // INPUT SPACE
  inputSpace: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 6,
  },
  amountDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    maxWidth: '100%',
  },
  currencyPrefixLeft: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  displayAmountInput: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
    paddingVertical: 4,
    paddingHorizontal: 6,
    minWidth: 50,
    textAlign: 'left',
  },
  duplicateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: M3Shape.full,
    gap: 4,
  },
  duplicateBannerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },

  // CHIPS WORKSPACE
  chipsWorkspace: {
    paddingHorizontal: 14,
    paddingVertical: 2,
    gap: 4,
  },
  chipRowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipSectionLabel: {
    width: 48,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  chipsScroll: {
    flexGrow: 0,
  },
  chipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: M3Shape.full,
    borderWidth: 1,
    marginRight: 6,
    gap: 5,
  },
  chipText: {
    fontSize: 11,
  },
  chipItemSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: M3Shape.full,
    marginRight: 6,
  },
  chipTextSmall: {
    fontSize: 10,
  },
  addChipBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 44,
    borderRadius: M3Shape.medium,
    borderWidth: 1,
    gap: 10,
    marginVertical: 4,
  },
  noteInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 0,
  },

  // 1B. DOCKED DIAL PAD
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
    height: 44,
    borderRadius: M3Shape.large,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialKeyText: {
    fontSize: 22,
    fontWeight: '700',
  },
  actionBar: {
    marginTop: 6,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: M3Shape.full,
    gap: 8,
  },
  recordButtonText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // BACKDROP
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 90,
  },

  // ==============================================================
  // 2. TOP SHEET CONTAINER
  // ==============================================================
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

  // 2A. HERO SECTION: TODAY'S BALANCE & EXPENSE|INCOME SWITCHER
  heroSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  todayBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  todayBalanceLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 2,
  },
  todayBalanceAmount: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
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
  switcherContainer: {
    flexDirection: 'row',
    borderRadius: M3Shape.large,
    padding: 3,
    gap: 4,
  },
  switcherTab: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: M3Shape.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switcherTabActive: {},
  switcherIconTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 1,
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
  switcherTabAmount: {
    fontSize: 13,
    fontWeight: '700',
  },

  // 2B. RECENT ACTIVITY LIST (Revealed when sheet pulls down)
  activityContentWrapper: {
    flex: 1,
    marginBottom: 36, // flush against 36px drag handle area (zero dead space)
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
    paddingBottom: 0, // 6px space between last item and drag handle
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
  daySummaryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: M3Shape.medium,
    marginTop: 4,
    marginBottom: 8,
  },
  daySummaryLabel: {
    fontSize: 11,
    fontWeight: '700',
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

  // 2C. DRAG HANDLE BAR AT BOTTOM OF TOP SHEET
  dragHandleArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 0.5,
  },
  dragHandleTouch: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 2,
  },
  dragHandlePill: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 2,
  },
  dragHandleHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dragHandleHintText: {
    fontSize: 9.5,
    fontWeight: '600',
  },

  // QUICK MODALS BACKDROP
  quickModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 999,
  },
  quickModalBox: {
    width: '100%',
    borderRadius: M3Shape.extraLarge,
    padding: 20,
    gap: 12,
  },
  quickModalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  quickModalSubtitle: {
    fontSize: 12,
    marginTop: -8,
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

  // CALENDAR MODAL STYLES
  calendarModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  calNavRow: {
    flexDirection: 'row',
    gap: 6,
  },
  calNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calWeekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 6,
  },
  calWeekdayText: {
    fontSize: 11,
    fontWeight: '700',
    width: 36,
    textAlign: 'center',
  },
  calDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  calEmptyCell: {
    width: 38,
    height: 38,
    marginVertical: 2,
  },
  calDayCell: {
    width: 38,
    height: 38,
    marginVertical: 2,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  calDayNum: {
    fontSize: 13,
  },

  // TIME MODAL STYLES
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  timeUnitCol: {
    alignItems: 'center',
    width: 100,
  },
  timeUnitLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  timeTextInput: {
    width: '100%',
    height: 52,
    borderRadius: M3Shape.large,
    textAlign: 'center',
    fontSize: 26,
    fontWeight: '800',
  },
  timeColon: {
    fontSize: 32,
    fontWeight: '800',
    marginTop: 14,
  },
  timePresetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    gap: 6,
  },
  timePresetChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: M3Shape.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePresetText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
