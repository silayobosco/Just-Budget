import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBudget } from '../context/BudgetContext';
import { lightTheme, darkTheme, M3Shape, M3Elevation } from '../theme';
import { formatCurrency, formatCycleDateRange, getRegularCycleDates } from '../utils/format';
import { DateRangePickerModal } from '../components/DateRangePickerModal';
import { TransactionDetailModal } from '../components/TransactionDetailModal';
import { TransactionDetailsModal } from '../components/TransactionDetailsModal';
import { Transaction, BudgetCycle } from '../types';

export const CalendarScreen: React.FC = () => {
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
    updateTransaction,
    deleteTransaction,
    addSubcategory,
  } = useBudget();

  const isDarkMode = settings.theme_mode === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  // Selected date on calendar (bound to global calendar date)
  const selectedDate = selectedCalendarDate;
  const setSelectedDate = setSelectedCalendarDate;

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

        // Active cycle matches currentCycle start_date or today's cycle
        const isActive = currentCycle
          ? currentCycle.start_date === reg.startDate
          : (now >= new Date(reg.startDate) && now <= new Date(reg.endDate));

        list.push({
          id: existing?.id || regId,
          name: existing?.name || reg.name,
          start_date: reg.startDate,
          end_date: reg.endDate,
          target_budget: existing?.target_budget ?? (settings.cycle_default_budget !== undefined ? Number(settings.cycle_default_budget) : undefined),
          target_income: existing?.target_income ?? (settings.cycle_default_income !== undefined ? Number(settings.cycle_default_income) : undefined),
          is_active: isActive,
        });
      }

      return list;
    } else {
      // CUSTOM PERIODS: ONLY show custom-created periods (exclude regular cycle records)
      const customOnly = (allCycles || []).filter((c) => !c.id.startsWith('cycle-reg-'));
      return customOnly.sort((a, b) => b.start_date.localeCompare(a.start_date));
    }
  }, [
    isRegularMode,
    startDay,
    allCycles,
    currentCycle,
    settings.cycle_default_budget,
    settings.cycle_default_income,
  ]);

  const cycleScrollRef = useRef<any>(null);

  useEffect(() => {
    if (cycleList.length > 0) {
      const activeIdx = cycleList.findIndex(
        (c) => c.is_active || (currentCycle && c.start_date === currentCycle.start_date)
      );
      if (activeIdx >= 0) {
        // Center the active chip horizontally
        const chipEstimatedWidth = 145;
        const targetX = Math.max(0, activeIdx * chipEstimatedWidth - 110);
        setTimeout(() => {
          cycleScrollRef.current?.scrollTo({ x: targetX, animated: true });
        }, 150);
      }
    }
  }, [cycleList, currentCycle, isRegularMode]);

  const handlePressCycleChip = async (c: BudgetCycle, isActive: boolean) => {
    if (isActive) {
      // Tapping the active chip opens the Shift Mode Switcher (only shift btn regular and custom, no editing)
      setModeSwitcherVisible(true);
      return;
    }

    if (isRegularMode) {
      // Regular mode: Activate this month's regular cycle
      const existing = allCycles.find((item) => item.id === c.id || item.start_date === c.start_date);
      if (existing) {
        await setActiveBudgetCycle(existing.id);
      } else {
        await updateBudgetCycle({
          id: c.id,
          name: c.name,
          start_date: c.start_date,
          end_date: c.end_date,
          target_budget: c.target_budget,
          target_income: c.target_income,
        });
        await setActiveBudgetCycle(c.id);
      }
      setSelectedDate(c.start_date);
    } else {
      // Custom mode: Activate selected custom cycle
      await setActiveBudgetCycle(c.id);
      setSelectedDate(c.start_date);
    }
  };

  // Collapsible Calendar View state (Collapse to 1-week row to give more room for transactions)
  const [isCalendarCollapsed, setIsCalendarCollapsed] = useState<boolean>(false);

  // Active cycle date boundaries (for showing the WHOLE active cycle in the calendar)
  const activeCycleRange = useMemo(() => {
    if (currentCycle?.start_date && currentCycle?.end_date) {
      return {
        startDate: currentCycle.start_date,
        endDate: currentCycle.end_date,
        name: currentCycle.name || formatCycleDateRange(currentCycle.start_date, currentCycle.end_date),
      };
    }
    const reg = getRegularCycleDates(settings.cycle_month_start_day || 1);
    return {
      startDate: reg.startDate,
      endDate: reg.endDate,
      name: reg.name,
    };
  }, [currentCycle, settings.cycle_month_start_day]);

  // Keep selectedDate within cycle if cycle changes
  useEffect(() => {
    if (activeCycleRange.startDate && activeCycleRange.endDate) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const isTodayInCycle = todayStr >= activeCycleRange.startDate && todayStr <= activeCycleRange.endDate;
      const isSelectedInCycle = selectedDate >= activeCycleRange.startDate && selectedDate <= activeCycleRange.endDate;

      if (!isSelectedInCycle) {
        setSelectedDate(isTodayInCycle ? todayStr : activeCycleRange.startDate);
      }
    }
  }, [activeCycleRange, selectedDate, setSelectedDate]);

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

  // Selected date transactions
  const selectedDayTransactions = useMemo(() => {
    return transactions.filter((t) => t.date === selectedDate);
  }, [transactions, selectedDate]);

  const selectedDayTotalSpend = dailySpendMap[selectedDate] || 0;

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
        {/* Horizontal List of Cycles with Current Centered on a Chip */}
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
                const isActive = Boolean(c.is_active || (currentCycle && c.start_date === currentCycle.start_date));
                const displayName = c.name || formatCycleDateRange(c.start_date, c.end_date);
                const dateSub = formatCycleDateRange(c.start_date, c.end_date);

                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.cycleChip,
                      {
                        backgroundColor: isActive
                          ? (isDarkMode ? 'rgba(99, 102, 241, 0.25)' : theme.primaryContainer)
                          : theme.pillBg,
                        borderColor: isActive ? theme.primary : 'transparent',
                      },
                      isActive && M3Elevation.level1,
                    ]}
                    onPress={() => handlePressCycleChip(c, isActive)}
                    onLongPress={() => openCycleModal()}
                    delayLongPress={350}
                    activeOpacity={0.75}
                  >
                    <MaterialCommunityIcons
                      name={isActive ? 'calendar-check' : 'calendar-outline'}
                      size={15}
                      color={isActive ? (isDarkMode ? '#A5B4FC' : theme.primary) : theme.onSurfaceVariant}
                    />
                    <View style={styles.chipTextCol}>
                      <Text
                        style={[
                          styles.cycleChipText,
                          {
                            color: isActive ? (isDarkMode ? '#E0E7FF' : theme.onPrimaryContainer) : theme.onSurface,
                            fontWeight: isActive ? '800' : '600',
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
                              color: isActive ? (isDarkMode ? '#C7D2FE' : theme.primary) : theme.onSurfaceVariant,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {dateSub}
                        </Text>
                      )}
                    </View>
                    {isActive && (
                      <View
                        style={[
                          styles.activeBadgePill,
                          { backgroundColor: isDarkMode ? '#818CF8' : theme.primary },
                        ]}
                      >
                        <Text style={[styles.activeBadgeText, { color: isDarkMode ? '#0F172A' : theme.onPrimary }]}>
                          Active
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

        {/* Docked Balance Breakdown */}
        <View style={[styles.dockedBalanceRow, { borderTopColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : theme.divider }]}>
          <View style={styles.balanceCol}>
            <Text style={[styles.balanceColLabel, { color: theme.onSurfaceVariant }]}>STARTING TARGET</Text>
            <Text style={[styles.balanceColVal, { color: theme.onSurface }]}>
              {formatCurrency(currentCycle?.target_budget || totalConvertedBalance, settings.base_currency)}
            </Text>
          </View>

          <View style={[styles.balanceDivider, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : theme.divider }]} />

          <View style={styles.balanceCol}>
            <Text style={[styles.balanceColLabel, { color: theme.error }]}>TOTAL SPENT</Text>
            <Text style={[styles.balanceColVal, { color: theme.error }]}>
              {formatCurrency(spentInCycle, settings.base_currency)}
            </Text>
          </View>

          <View style={[styles.balanceDivider, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : theme.divider }]} />

          <View style={styles.balanceCol}>
            <Text style={[styles.balanceColLabel, { color: theme.success }]}>REMAINING</Text>
            <Text style={[styles.balanceColVal, { color: theme.success }]}>
              {formatCurrency(remainingCycleBalance, settings.base_currency)}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* CALENDAR CYCLE HEADER */}
        <View style={styles.monthHeaderRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={[styles.monthTitle, { color: theme.onSurface }]} numberOfLines={1}>
              {activeCycleRange.name}
            </Text>
            <Text style={[styles.cycleViewModeSub, { color: theme.onSurfaceVariant }]}>
              {isCalendarCollapsed ? 'Week View • Tap to expand' : 'Full Cycle View • Tap to collapse'}
            </Text>
          </View>

          <View style={styles.calendarHeaderRightActions}>
            <TouchableOpacity
              style={[styles.todayBtn, { backgroundColor: theme.pillBg }]}
              onPress={() => {
                const todayStr = new Date().toISOString().slice(0, 10);
                setSelectedDate(todayStr);
              }}
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
                onPress={() => setSelectedDate(cell.dateStr)}
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

        {/* SELECTED DAY DETAILS */}
        <View style={styles.dayDetailsCard}>
          <View style={styles.dayDetailsHeader}>
            <View>
              <Text style={[styles.dayDetailsTitle, { color: theme.onSurface }]}>
                {formatSelectedDateHeader(selectedDate)}
              </Text>
              <Text style={[styles.dayDetailsSub, { color: theme.onSurfaceVariant }]}>
                Total Spent:{' '}
                <Text style={{ color: theme.error, fontWeight: '700' }}>
                  {formatCurrency(selectedDayTotalSpend, settings.base_currency)}
                </Text>
              </Text>
            </View>
          </View>

          {selectedDayTransactions.length === 0 ? (
            <View style={[styles.emptyDayBox, { backgroundColor: theme.pillBg }]}>
              <Text style={[styles.emptyDayText, { color: theme.onSurfaceVariant }]}>
                No expenses or income logged on this date.
              </Text>
            </View>
          ) : (
            selectedDayTransactions.map((tx) => {
              const cat = categories.find((c) => c.id === tx.category_id);
              const sub = cat?.subcategories?.find((s) => s.id === tx.subcategory_id);
              const wallet = wallets.find((w) => w.id === tx.wallet_id);
              const isExpense = tx.type === 'expense';
              const isTransfer = tx.type === 'transfer';

              const mainTitle = isTransfer
                ? 'Transfer'
                : sub?.name || cat?.name || 'Activity';

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
                  style={[styles.dayTxItem, { backgroundColor: theme.cardBg, borderColor: theme.divider }]}
                  onPress={() => setViewingTransaction(tx)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.catDot, { backgroundColor: isTransfer ? theme.tertiary : cat?.color || theme.primary }]} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.dayTxTitle, { color: theme.onSurface }]}>{mainTitle}</Text>
                    <Text style={[styles.dayTxMeta, { color: theme.onSurfaceVariant }]}>{subMeta}</Text>
                  </View>
                  <Text
                    style={[
                      styles.dayTxAmount,
                      { color: isExpense ? theme.error : isTransfer ? theme.tertiary : theme.success },
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
      </ScrollView>

      {/* SHIFT CYCLE MODE MODAL (TAP ACTIVE CHIP: SHIFT BETWEEN REGULAR & CUSTOM, NO EDITING) */}
      <Modal
        visible={modeSwitcherVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModeSwitcherVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModeSwitcherVisible(false)}
        >
          <View
            style={[styles.modeSwitcherBox, { backgroundColor: theme.surface }]}
            onStartShouldSetResponder={() => true}
          >
            {/* Header */}
            <View style={styles.modeSwitcherHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialCommunityIcons name="calendar-sync" size={22} color={theme.primary} />
                <Text style={[styles.modeSwitcherTitle, { color: theme.onSurface }]}>Cycle Mode</Text>
              </View>
              <TouchableOpacity
                onPress={() => setModeSwitcherVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="close" size={20} color={theme.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modeSwitcherSub, { color: theme.onSurfaceVariant }]}>
              Shift between regular recurring calendar months and custom arbitrary periods.
            </Text>

            {/* Mode Option 1: Regular Calendar */}
            <TouchableOpacity
              style={[
                styles.modeCard,
                {
                  backgroundColor: settings.cycle_mode === 'regular'
                    ? (isDarkMode ? 'rgba(99, 102, 241, 0.22)' : theme.primaryContainer)
                    : theme.pillBg,
                  borderColor: settings.cycle_mode === 'regular' ? theme.primary : 'transparent',
                },
              ]}
              onPress={async () => {
                await updateSettings({ cycle_mode: 'regular' });
                const regCycle = allCycles.find((c) => c.id.startsWith('cycle-reg-')) || allCycles[0];
                if (regCycle) {
                  await setActiveBudgetCycle(regCycle.id);
                }
                setModeSwitcherVisible(false);
              }}
              activeOpacity={0.75}
            >
              <View style={[styles.modeCardIconWrap, { backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.2)' : theme.primaryContainer }]}>
                <MaterialCommunityIcons
                  name="calendar-month"
                  size={22}
                  color={isDarkMode ? '#A5B4FC' : theme.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.modeCardTitle, { color: theme.onSurface }]}>Regular Calendar</Text>
                  {settings.cycle_mode === 'regular' && (
                    <View style={[styles.modeActivePill, { backgroundColor: theme.primary }]}>
                      <Text style={[styles.modeActivePillText, { color: theme.onPrimary }]}>Active</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.modeCardDesc, { color: theme.onSurfaceVariant }]}>
                  Monthly cycle repeating on the {settings.cycle_month_start_day || 1}st of each month.
                </Text>
              </View>
              <MaterialCommunityIcons
                name={settings.cycle_mode === 'regular' ? 'radiobox-marked' : 'radiobox-blank'}
                size={22}
                color={settings.cycle_mode === 'regular' ? theme.primary : theme.outlineVariant}
              />
            </TouchableOpacity>

            {/* Mode Option 2: Custom Periods */}
            <TouchableOpacity
              style={[
                styles.modeCard,
                {
                  backgroundColor: settings.cycle_mode === 'custom'
                    ? (isDarkMode ? 'rgba(99, 102, 241, 0.22)' : theme.primaryContainer)
                    : theme.pillBg,
                  borderColor: settings.cycle_mode === 'custom' ? theme.primary : 'transparent',
                },
              ]}
              onPress={async () => {
                await updateSettings({ cycle_mode: 'custom' });
                const customCycle = allCycles.find((c) => !c.id.startsWith('cycle-reg-')) || allCycles[0];
                if (customCycle) {
                  await setActiveBudgetCycle(customCycle.id);
                }
                setModeSwitcherVisible(false);
              }}
              activeOpacity={0.75}
            >
              <View style={[styles.modeCardIconWrap, { backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.2)' : theme.primaryContainer }]}>
                <MaterialCommunityIcons
                  name="calendar-range"
                  size={22}
                  color={isDarkMode ? '#A5B4FC' : theme.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.modeCardTitle, { color: theme.onSurface }]}>Custom Periods</Text>
                  {settings.cycle_mode === 'custom' && (
                    <View style={[styles.modeActivePill, { backgroundColor: theme.primary }]}>
                      <Text style={[styles.modeActivePillText, { color: theme.onPrimary }]}>Active</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.modeCardDesc, { color: theme.onSurfaceVariant }]}>
                  Arbitrary date ranges, pay periods, or custom multi-week intervals.
                </Text>
              </View>
              <MaterialCommunityIcons
                name={settings.cycle_mode === 'custom' ? 'radiobox-marked' : 'radiobox-blank'}
                size={22}
                color={settings.cycle_mode === 'custom' ? theme.primary : theme.outlineVariant}
              />
            </TouchableOpacity>

            {/* Hint for editing */}
            <View style={[styles.modeHintRow, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : theme.pillBg }]}>
              <MaterialCommunityIcons name="gesture-tap-hold" size={16} color={theme.primary} />
              <Text style={[styles.modeHintText, { color: theme.onSurfaceVariant }]}>
                Hold any cycle chip on the calendar header to edit dates and budget targets.
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

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
  dockedBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  balanceCol: {
    flex: 1,
    alignItems: 'center',
  },
  balanceDivider: {
    width: 1,
    height: '80%',
    alignSelf: 'center',
  },
  balanceColLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  balanceColVal: {
    fontSize: 13,
    fontWeight: '700',
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
});
