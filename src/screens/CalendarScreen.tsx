import React, { useState, useMemo } from 'react';
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
import { formatCurrency } from '../utils/format';
import { DateRangePickerModal } from '../components/DateRangePickerModal';

export const CalendarScreen: React.FC = () => {
  const {
    settings,
    currentCycle,
    updateBudgetCycle,
    transactions,
    categories,
    wallets,
    remainingCycleBalance,
    spentInCycle,
    totalConvertedBalance,
  } = useBudget();

  const theme = settings.theme_mode === 'dark' ? darkTheme : lightTheme;

  // Selected date on calendar (defaults to today)
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));

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

  // Edit Cycle Modal State
  const [cycleModalVisible, setCycleModalVisible] = useState<boolean>(false);
  const [cycleName, setCycleName] = useState<string>('');
  const [cycleStart, setCycleStart] = useState<string>('');
  const [cycleEnd, setCycleEnd] = useState<string>('');
  const [cycleBudget, setCycleBudget] = useState<string>('');
  const [cycleIncomeGoal, setCycleIncomeGoal] = useState<string>('');

  const handleOpenCycleModal = () => {
    if (currentCycle) {
      setCycleName(currentCycle.name);
      setCycleStart(currentCycle.start_date);
      setCycleEnd(currentCycle.end_date);
      setCycleBudget(currentCycle.target_budget ? currentCycle.target_budget.toString() : '');
      setCycleIncomeGoal(currentCycle.target_income ? currentCycle.target_income.toString() : '');
    }
    setCycleModalVisible(true);
  };

  const handleSaveCycle = async () => {
    if (!cycleName || !cycleStart || !cycleEnd) return;
    const numBudget = parseFloat(cycleBudget);
    const numIncome = parseFloat(cycleIncomeGoal);
    await updateBudgetCycle({
      id: currentCycle?.id,
      name: cycleName,
      start_date: cycleStart,
      end_date: cycleEnd,
      target_budget: !isNaN(numBudget) ? numBudget : undefined,
      target_income: !isNaN(numIncome) ? numIncome : undefined,
    });
    setCycleModalVisible(false);
  };

  // Generate days in the active month or cycle
  const currentMonthDate = useMemo(() => {
    return new Date(selectedDate);
  }, [selectedDate]);

  const calendarDays = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: { dateStr: string; dayNumber: number; inCurrentMonth: boolean }[] = [];

    // Pad beginning with empty / previous month
    for (let i = 0; i < firstDay; i++) {
      days.push({ dateStr: '', dayNumber: 0, inCurrentMonth: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const monthPadded = String(month + 1).padStart(2, '0');
      const dayPadded = String(d).padStart(2, '0');
      const dateStr = `${year}-${monthPadded}-${dayPadded}`;
      days.push({ dateStr, dayNumber: d, inCurrentMonth: true });
    }

    return days;
  }, [currentMonthDate]);

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

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* CYCLE BANNER & START / END DATES */}
        <View style={[styles.cycleCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}>
          <View style={styles.cycleTopRow}>
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={handleOpenCycleModal}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.cycleTitle, { color: theme.onSurface }]}>
                  {currentCycle ? currentCycle.name : 'Budget Cycle'}
                </Text>
                <MaterialCommunityIcons name="pencil-outline" size={14} color={theme.onSurfaceVariant} />
              </View>
              <Text style={[styles.cycleRange, { color: theme.onSurfaceVariant }]}>
                {currentCycle?.start_date} ➔ {currentCycle?.end_date}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.editCycleBtn, { backgroundColor: theme.primaryContainer }]}
              onPress={() => setDateRangePickerVisible(true)}
            >
              <MaterialCommunityIcons name="calendar-range" size={18} color={theme.onPrimaryContainer} />
              <Text style={[styles.editCycleText, { color: theme.onPrimaryContainer }]}>Edit Dates</Text>
            </TouchableOpacity>
          </View>

          {/* Balance breakdown on calendar */}
          <View style={styles.cycleBalanceRow}>
            <View style={styles.balanceCol}>
              <Text style={[styles.balanceColLabel, { color: theme.onSurfaceVariant }]}>STARTING TARGET</Text>
              <Text style={[styles.balanceColVal, { color: theme.onSurface }]}>
                {formatCurrency(currentCycle?.target_budget || totalConvertedBalance, settings.base_currency)}
              </Text>
            </View>

            <View style={[styles.balanceDivider, { backgroundColor: theme.divider }]} />

            <View style={styles.balanceCol}>
              <Text style={[styles.balanceColLabel, { color: theme.error }]}>TOTAL SPENT</Text>
              <Text style={[styles.balanceColVal, { color: theme.error }]}>
                {formatCurrency(spentInCycle, settings.base_currency)}
              </Text>
            </View>

            <View style={[styles.balanceDivider, { backgroundColor: theme.divider }]} />

            <View style={styles.balanceCol}>
              <Text style={[styles.balanceColLabel, { color: theme.success }]}>REMAINING</Text>
              <Text style={[styles.balanceColVal, { color: theme.success }]}>
                {formatCurrency(remainingCycleBalance, settings.base_currency)}
              </Text>
            </View>
          </View>
        </View>

        {/* CALENDAR MONTH HEADER */}
        <View style={styles.monthHeaderRow}>
          <Text style={[styles.monthTitle, { color: theme.onSurface }]}>
            {monthNames[currentMonthDate.getMonth()]} {currentMonthDate.getFullYear()}
          </Text>
          <TouchableOpacity
            style={[styles.todayBtn, { backgroundColor: theme.pillBg }]}
            onPress={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
          >
            <Text style={[styles.todayBtnText, { color: theme.primary }]}>Today</Text>
          </TouchableOpacity>
        </View>

        {/* WEEKDAYS ROW */}
        <View style={styles.weekdaysRow}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <Text key={d} style={[styles.weekdayText, { color: theme.onSurfaceVariant }]}>
              {d}
            </Text>
          ))}
        </View>

        {/* CALENDAR GRID */}
        <View style={styles.gridContainer}>
          {calendarDays.map((cell, idx) => {
            if (!cell.inCurrentMonth) {
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
                ]}
                onPress={() => setSelectedDate(cell.dateStr)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.cellDayNum,
                    {
                      color: isSelected ? theme.onPrimaryContainer : theme.onSurface,
                      fontWeight: isSelected || isToday ? '700' : '500',
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

        {/* SELECTED DAY DETAILS */}
        <View style={styles.dayDetailsCard}>
          <View style={styles.dayDetailsHeader}>
            <View>
              <Text style={[styles.dayDetailsTitle, { color: theme.onSurface }]}>
                {selectedDate === new Date().toISOString().slice(0, 10) ? 'Today, ' : ''}
                {selectedDate}
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
                <View
                  key={tx.id}
                  style={[styles.dayTxItem, { backgroundColor: theme.cardBg, borderColor: theme.divider }]}
                >
                  <View style={[styles.catDot, { backgroundColor: cat?.color || theme.primary }]} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.dayTxTitle, { color: theme.onSurface }]}>{mainTitle}</Text>
                    <Text style={[styles.dayTxMeta, { color: theme.onSurfaceVariant }]}>{subMeta}</Text>
                  </View>
                  <Text
                    style={[
                      styles.dayTxAmount,
                      { color: isExpense ? theme.error : theme.success },
                    ]}
                  >
                    {isExpense ? '-' : '+'}
                    {formatCurrency(tx.amount, settings.base_currency)}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* EDIT BUDGET CYCLE MODAL */}
      <Modal visible={cycleModalVisible} transparent animationType="slide" onRequestClose={() => setCycleModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.onSurface }]}>Custom Budget Cycle</Text>
              <TouchableOpacity onPress={() => setCycleModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={theme.onSurface} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>Cycle Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
              placeholder="e.g. November 2026 or Pay Period 1"
              placeholderTextColor={theme.onSurfaceVariant}
              value={cycleName}
              onChangeText={setCycleName}
            />

            <View style={styles.dateRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>Start Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                  placeholder="2026-11-01"
                  placeholderTextColor={theme.onSurfaceVariant}
                  value={cycleStart}
                  onChangeText={setCycleStart}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>End Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                  placeholder="2026-11-30"
                  placeholderTextColor={theme.onSurfaceVariant}
                  value={cycleEnd}
                  onChangeText={setCycleEnd}
                />
              </View>
            </View>

            <View style={styles.dateRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>
                  Target Budget ({settings.base_currency})
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                  placeholder="e.g. 2000"
                  placeholderTextColor={theme.onSurfaceVariant}
                  keyboardType="decimal-pad"
                  value={cycleBudget}
                  onChangeText={setCycleBudget}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>
                  Income Goal ({settings.base_currency})
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                  placeholder="e.g. 3000"
                  placeholderTextColor={theme.onSurfaceVariant}
                  keyboardType="decimal-pad"
                  value={cycleIncomeGoal}
                  onChangeText={setCycleIncomeGoal}
                />
              </View>
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: theme.pillBg }]}
                onPress={() => setCycleModalVisible(false)}
              >
                <Text style={[styles.btnText, { color: theme.onSurface }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                onPress={handleSaveCycle}
              >
                <Text style={[styles.btnText, { color: theme.onPrimary }]}>Save Cycle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* VISUAL DATE RANGE PICKER (CONNECTING POLYLINE / BAND RANGE PICKER) */}
      <DateRangePickerModal
        visible={dateRangePickerVisible}
        initialStartDate={currentCycle?.start_date}
        initialEndDate={currentCycle?.end_date}
        onClose={() => setDateRangePickerVisible(false)}
        onSave={handleSaveDateRange}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  cycleCard: {
    borderWidth: 1,
    borderRadius: M3Shape.extraLarge,
    padding: 16,
    marginBottom: 16,
  },
  cycleTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cycleTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  cycleRange: {
    fontSize: 12,
    marginTop: 2,
  },
  editCycleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: M3Shape.full,
    gap: 4,
  },
  editCycleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cycleBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#E5E7EB20',
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
  todayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: M3Shape.full,
  },
  todayBtnText: {
    fontSize: 12,
    fontWeight: '700',
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
    marginBottom: 16,
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    borderRadius: M3Shape.extraLarge,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    height: 44,
    borderRadius: M3Shape.medium,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: M3Shape.full,
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: M3Shape.full,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
