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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBudget } from '../context/BudgetContext';
import { lightTheme, darkTheme, M3Shape, M3Elevation } from '../theme';
import { TransactionType } from '../types';
import { formatCurrency, formatTypingNumber } from '../utils/format';
import { CategoryManagerModal } from '../components/CategoryManagerModal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Top Sheet Heights:
// In collapsed state: shows today's balance + expense|income switcher + preview of the latest transaction + drag handle (~215px)
// Maximum allowed expanded height: covers the workspace down to the top of the bottom navigation tabs
const COLLAPSED_SHEET_HEIGHT = 215;
const MAX_EXPANDED_SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.94);

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

  useEffect(() => {
    const activeCats = categories.filter((c) => c.type === (txType === 'income' ? 'income' : 'expense'));
    if (activeCats.length > 0) {
      const found = activeCats.find((c) => c.id === selectedCategoryId);
      if (!found) {
        setSelectedCategoryId(activeCats[0].id);
        if (activeCats[0].subcategories && activeCats[0].subcategories.length > 0) {
          setSelectedSubcategoryId(activeCats[0].subcategories[0].id);
        } else {
          setSelectedSubcategoryId('');
        }
      }
    } else {
      setSelectedCategoryId('');
      setSelectedSubcategoryId('');
    }
  }, [txType, categories, selectedCategoryId]);

  // Handle category switch
  const handleSelectCategory = (catId: string) => {
    setSelectedCategoryId(catId);
    const cat = categories.find((c) => c.id === catId);
    if (cat?.subcategories && cat.subcategories.length > 0) {
      setSelectedSubcategoryId(cat.subcategories[0].id);
    } else {
      setSelectedSubcategoryId('');
    }
  };

  // Dial Pad Keypress
  const handleKeyPress = (val: string) => {
    if (val === 'backspace') {
      if (amountStr.length <= 1) {
        setAmountStr('0');
      } else {
        setAmountStr(amountStr.slice(0, -1));
      }
      return;
    }

    if (val === '.') {
      if (!amountStr.includes('.')) {
        setAmountStr(amountStr + '.');
      }
      return;
    }

    if (val === 'clear') {
      setAmountStr('0');
      return;
    }

    if (amountStr === '0') {
      setAmountStr(val);
    } else {
      const parts = amountStr.split('.');
      if (parts.length === 2 && parts[1].length >= 2) return;
      if (amountStr.replace(/[^0-9]/g, '').length >= 12) return;
      setAmountStr(amountStr + val);
    }
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
  const [measuredContentHeight, setMeasuredContentHeight] = useState(0);
  const [heroHeight, setHeroHeight] = useState(110);

  // Fallback calculation in case layout hasn't measured yet
  const computedFallbackContentHeight = useMemo(() => {
    if (transactions.length === 0) return 70;
    const groupsHeight = groupedTransactions.length * 29;
    const itemsHeight = Math.max(0, transactions.length - 1) * 56 + 50;
    return groupsHeight + itemsHeight + 4;
  }, [groupedTransactions, transactions]);

  // Determine whether the items exceed the maximum available expanded viewport.
  // When there are few items (not scrollable), the sheet expands only to display available items with NO GAP,
  // scrolling is disabled so the last item never scrolls up away from the handle, and items are bottom-docked.
  const isScrollable = useMemo(() => {
    const contentH = measuredContentHeight > 0 ? measuredContentHeight : computedFallbackContentHeight;
    const maxAvailableViewport = MAX_EXPANDED_SHEET_HEIGHT - (heroHeight + 80);
    return contentH > maxAvailableViewport;
  }, [measuredContentHeight, computedFallbackContentHeight, heroHeight]);

  // Dynamic Expanded Height: expands ONLY to display available items if few,
  // clamped at MAX_EXPANDED_SHEET_HEIGHT (never goes below bottom navigation tabs).
  const expandedSheetHeight = useMemo(() => {
    const contentH = measuredContentHeight > 0 ? measuredContentHeight : computedFallbackContentHeight;
    // Base overhead: hero + history header (40) + drag handle (36) + scroll padding (4)
    const overhead = heroHeight + 80;
    const totalTarget = overhead + contentH;
    return Math.min(MAX_EXPANDED_SHEET_HEIGHT, Math.max(COLLAPSED_SHEET_HEIGHT, totalTarget));
  }, [measuredContentHeight, computedFallbackContentHeight, heroHeight]);

  // Ref to hold the scrollview to auto-scroll to the end (newest transactions at bottom)
  const historyScrollRef = useRef<any>(null);
  const scrollOffsetRef = useRef(0);
  const contentHeightRef = useRef(0);
  const layoutHeightRef = useRef(0);
  const isAtBottomRef = useRef(true);

  // ==============================================================
  // TOP SHEET PULL-DOWN GESTURE & ANIMATION
  // ==============================================================
  const animatedHeight = useRef(new Animated.Value(COLLAPSED_SHEET_HEIGHT)).current;
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const isExpandedRef = useRef(false);
  const currentHeightRef = useRef(COLLAPSED_SHEET_HEIGHT);

  // Auto-adapt sheet height if content changes (e.g. items added or deleted) while expanded
  useEffect(() => {
    if (isExpandedRef.current) {
      Animated.spring(animatedHeight, {
        toValue: expandedSheetHeight,
        useNativeDriver: false,
        bounciness: 2,
        speed: 16,
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
      // When sheet is collapsing (height shrinking), scroll items up in lockstep
      // so the bottom items stay docked to the handle and visible in the collapsed sheet
      if (isScrollable && contentHeightRef.current > 0 && value < expandedSheetHeight - 5) {
        const visibleH = Math.max(40, value - (heroHeight + 40));
        const maxScroll = Math.max(0, contentHeightRef.current - visibleH);
        historyScrollRef.current?.scrollTo?.({ y: maxScroll, animated: false });
      }
    });
    return () => {
      animatedHeight.removeListener(id);
    };
  }, [animatedHeight, expandedSheetHeight, isScrollable, heroHeight]);

  const openSheet = () => {
    Animated.spring(animatedHeight, {
      toValue: expandedSheetHeight,
      useNativeDriver: false,
      bounciness: 3,
      speed: 14,
    }).start(() => {
      // Auto-scroll to the bottom so the latest transactions are directly in view if scrollable
      if (isScrollable) {
        setTimeout(() => {
          historyScrollRef.current?.scrollToEnd?.({ animated: true });
          isAtBottomRef.current = true;
        }, 50);
      }
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
      // Ensure bottom transaction remains perfectly aligned when collapsed
      if (isScrollable) {
        historyScrollRef.current?.scrollToEnd?.({ animated: false });
        isAtBottomRef.current = true;
      }
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

  // Main Handle & Hero Section PanResponder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderGrant: () => {},
      onPanResponderMove: (_, gestureState) => {
        const baseH = isExpandedRef.current ? expandedSheetHeight : COLLAPSED_SHEET_HEIGHT;
        let nextH = baseH + gestureState.dy;
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

        if (isExpandedRef.current) {
          // In expanded mode: collapsing upwards
          const isFlickUp = gestureState.vy < -0.45;
          const isDragUp = gestureState.dy < -60;
          if (isFlickUp || isDragUp || currentH < threshold) {
            closeSheet();
          } else {
            // Less contact -> spring back open
            openSheet();
          }
        } else {
          // In collapsed mode: expanding downwards
          const isFlickDown = gestureState.vy > 0.4;
          const isDragDown = gestureState.dy > 35;
          if (isFlickDown || isDragDown || currentH > threshold) {
            openSheet();
          } else {
            closeSheet();
          }
        }
      },
      onPanResponderTerminate: () => {
        const currentH = currentHeightRef.current;
        const threshold = (COLLAPSED_SHEET_HEIGHT + expandedSheetHeight) / 2;
        if (currentH < threshold) {
          closeSheet();
        } else {
          openSheet();
        }
      },
    })
  ).current;

  // History List PanResponder:
  // When at the bottom (latest item reached) and user drags/overscrolls upward,
  // it dynamically drives the sheet height interactively (acting like the drag handle).
  // If released with high velocity or distance -> collapses.
  // If finger had less contact/low travel -> springs back open (like universal home gesture).
  const historyPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (!isExpandedRef.current) return false;
        // If not scrollable (few items), ANY upward pull collapses the sheet
        // If scrollable, only capture when at the bottom (latest item reached)
        if (gestureState.dy < -6 && (!isScrollable || isAtBottomRef.current)) {
          return true;
        }
        return false;
      },
      onPanResponderGrant: () => {},
      onPanResponderMove: (_, gestureState) => {
        // Interactively collapse the top sheet as the finger moves up
        const baseH = expandedSheetHeight;
        let nextH = baseH + gestureState.dy;
        if (nextH < COLLAPSED_SHEET_HEIGHT) {
          nextH = COLLAPSED_SHEET_HEIGHT;
        } else if (nextH > expandedSheetHeight) {
          nextH = expandedSheetHeight + (nextH - expandedSheetHeight) * 0.2;
        }
        animatedHeight.setValue(nextH);
      },
      onPanResponderRelease: (_, gestureState) => {
        const dragUpDistance = -gestureState.dy; // positive when dragged up
        const isFlickUp = gestureState.vy < -0.45;
        const currentH = currentHeightRef.current;
        const threshold = (COLLAPSED_SHEET_HEIGHT + expandedSheetHeight) * 0.65;

        // Universal bottom nav / home gesture behavior:
        // If released with fast upward velocity or dragged past threshold -> collapse
        // If finger had less contact (small drag / low speed) -> spring back open
        if (isFlickUp || dragUpDistance > 65 || currentH < threshold) {
          closeSheet();
        } else {
          openSheet();
        }
      },
      onPanResponderTerminate: () => {
        const currentH = currentHeightRef.current;
        const threshold = (COLLAPSED_SHEET_HEIGHT + expandedSheetHeight) / 2;
        if (currentH < threshold) {
          closeSheet();
        } else {
          openSheet();
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
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* ============================================================== */}
      {/* 1. BASE SCREEN: ENTRY WORKSPACE WITH CHIPS DOCKED ON KEYPAD     */}
      {/* ============================================================== */}
      <View style={[styles.baseEntryContainer, { paddingTop: COLLAPSED_SHEET_HEIGHT }]}>
        {/* UPPER WORKSPACE: Amount Display (centered in remaining upper space) */}
        <View style={styles.inputSpace}>
          <Text style={[styles.currencyPrefix, { color: theme.onSurfaceVariant }]}>{curr}</Text>
          <Text
            style={[
              styles.displayAmountText,
              { color: txType === 'expense' ? theme.error : theme.success },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {formatTypingNumber(amountStr)}
          </Text>
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

          {/* CHIP SELECTION STRIPS: Wallet, Category, Subcategory, Notes */}
          <View style={[styles.chipsWorkspace, { backgroundColor: theme.surface }]}>
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
                      onPress={() => setSelectedWalletId(w.id)}
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
                        onPress={() => setSelectedSubcategoryId(s.id)}
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

            {/* NOTE INPUT ROW */}
            <View style={[styles.noteRow, { backgroundColor: theme.pillBg }]}>
              <MaterialCommunityIcons name="pencil-outline" size={15} color={theme.onSurfaceVariant} />
              <TextInput
                style={[styles.noteInput, { color: theme.onSurface }]}
                placeholder="Add optional note or tag..."
                placeholderTextColor={theme.onSurfaceVariant}
                value={note}
                onChangeText={setNote}
                maxLength={80}
              />
              {note.length > 0 && (
                <TouchableOpacity onPress={() => setNote('')}>
                  <MaterialCommunityIcons name="close-circle" size={15} color={theme.outline} />
                </TouchableOpacity>
              )}
            </View>
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
        <View
          {...panResponder.panHandlers}
          onLayout={(e) => setHeroHeight(e.nativeEvent.layout.height)}
          style={styles.heroSection}
        >
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
        <View {...historyPanResponder.panHandlers} style={styles.activityContentWrapper}>
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
              contentContainerStyle={[
                styles.historyScrollContent,
                !isScrollable && styles.historyScrollContentFewItems,
              ]}
              nestedScrollEnabled={true}
              scrollEnabled={isScrollable}
              bounces={false}
              overScrollMode="never"
              onScroll={(e) => {
                const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
                scrollOffsetRef.current = contentOffset.y;
                contentHeightRef.current = contentSize.height;
                layoutHeightRef.current = layoutMeasurement.height;
                isAtBottomRef.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 12;
              }}
              onContentSizeChange={(_, h) => {
                contentHeightRef.current = h;
                setMeasuredContentHeight(h);
              }}
              onLayout={(e) => {
                layoutHeightRef.current = e.nativeEvent.layout.height;
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
                      const isLastItem = isLastGroup && txIdx === group.items.length - 1;
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
                            isLastItem && { marginBottom: 0 },
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
                {isSheetExpanded ? 'Slide up for dial pad' : 'Pull down to see more history'}
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
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  currencyPrefix: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  displayAmountText: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  duplicateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: M3Shape.full,
    gap: 4,
    marginTop: 2,
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
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: M3Shape.medium,
    gap: 8,
    marginTop: 2,
  },
  noteInput: {
    flex: 1,
    fontSize: 12,
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
    paddingBottom: 14,
  },
  todayBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
    paddingBottom: 0, // flush against bottom
  },
  historyScrollContentFewItems: {
    flexGrow: 1,
    justifyContent: 'flex-end',
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
