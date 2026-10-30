import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BudgetCycle, CycleMode, CycleBalanceMode, CycleTargetMode } from '../types';
import { useBudget } from '../context/BudgetContext';
import { M3Shape, M3Elevation } from '../theme';
import { getRegularCycleDates, formatCycleDateRange } from '../utils/format';

interface BudgetCycleModalProps {
  visible: boolean;
  baseCurrency?: string;
  theme: any;
  onClose: () => void;
  onOpenDateRangePicker?: () => void;
}

export const BudgetCycleModal: React.FC<BudgetCycleModalProps> = ({
  visible,
  theme,
  onClose,
  onOpenDateRangePicker,
}) => {
  const {
    currentCycle,
    allCycles,
    settings,
    updateBudgetCycle,
    updateSettings,
    deleteBudgetCycle,
    setActiveBudgetCycle,
  } = useBudget();

  const isDarkMode = settings.theme_mode === 'dark';
  const curr = settings.base_currency;

  // Active Tab: 'regular' | 'custom'
  const [activeTab, setActiveTab] = useState<CycleMode>('regular');

  // REGULAR CALENDAR STATE
  const [balanceMode, setBalanceMode] = useState<CycleBalanceMode>('monthly');
  const [targetMode, setTargetMode] = useState<CycleTargetMode>('monthly');
  const [startDay, setStartDay] = useState<string>('1');
  const [regBudget, setRegBudget] = useState<string>('');
  const [regIncome, setRegIncome] = useState<string>('');
  const [defaultBudget, setDefaultBudget] = useState<string>('');
  const [defaultIncome, setDefaultIncome] = useState<string>('');

  // CUSTOM PERIODS STATE
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [customName, setCustomName] = useState<string>('');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [customTargetMode, setCustomTargetMode] = useState<'inherit' | 'custom'>('custom');
  const [customBudget, setCustomBudget] = useState<string>('');
  const [customIncome, setCustomIncome] = useState<string>('');

  // Synchronize state when modal opens
  useEffect(() => {
    if (visible) {
      setActiveTab(settings.cycle_mode || 'regular');
      setBalanceMode(settings.cycle_balance_mode || 'monthly');
      setTargetMode(settings.cycle_target_mode || 'monthly');
      setStartDay(settings.cycle_month_start_day ? settings.cycle_month_start_day.toString() : '1');
      setDefaultBudget(settings.cycle_default_budget ? settings.cycle_default_budget.toString() : '2000');
      setDefaultIncome(settings.cycle_default_income ? settings.cycle_default_income.toString() : '2500');

      if (currentCycle) {
        setRegBudget(currentCycle.target_budget ? currentCycle.target_budget.toString() : '');
        setRegIncome(currentCycle.target_income ? currentCycle.target_income.toString() : '');
        setSelectedCycleId(currentCycle.id);
        setCustomName(currentCycle.name);
        setCustomStart(currentCycle.start_date);
        setCustomEnd(currentCycle.end_date);
        setCustomBudget(currentCycle.target_budget ? currentCycle.target_budget.toString() : '');
        setCustomIncome(currentCycle.target_income ? currentCycle.target_income.toString() : '');
      }
    }
  }, [visible, settings, currentCycle]);

  // Preview dates for regular calendar
  const regularPreview = useMemo(() => {
    const dayNum = parseInt(startDay, 10);
    const validDay = isNaN(dayNum) ? 1 : Math.min(31, Math.max(1, dayNum));
    return getRegularCycleDates(validDay);
  }, [startDay]);

  // Save Regular Calendar Settings
  const handleSaveRegular = async () => {
    const dayNum = parseInt(startDay, 10);
    const validDay = isNaN(dayNum) ? 1 : Math.min(31, Math.max(1, dayNum));

    const defBudgetNum = parseFloat(defaultBudget);
    const defIncomeNum = parseFloat(defaultIncome);
    const thisBudgetNum = parseFloat(regBudget);
    const thisIncomeNum = parseFloat(regIncome);

    const targetB = targetMode === 'inherit'
      ? (!isNaN(defBudgetNum) ? defBudgetNum : undefined)
      : (!isNaN(thisBudgetNum) ? thisBudgetNum : undefined);

    const targetI = targetMode === 'inherit'
      ? (!isNaN(defIncomeNum) ? defIncomeNum : undefined)
      : (!isNaN(thisIncomeNum) ? thisIncomeNum : undefined);

    // Save app settings
    await updateSettings({
      cycle_mode: 'regular',
      cycle_balance_mode: balanceMode,
      cycle_target_mode: targetMode,
      cycle_month_start_day: validDay,
      cycle_default_budget: !isNaN(defBudgetNum) ? defBudgetNum : undefined,
      cycle_default_income: !isNaN(defIncomeNum) ? defIncomeNum : undefined,
    });

    // Update active cycle to match regular calculated dates
    const regDates = getRegularCycleDates(validDay);
    await updateBudgetCycle({
      id: currentCycle?.id,
      name: regDates.name,
      start_date: regDates.startDate,
      end_date: regDates.endDate,
      target_budget: targetB,
      target_income: targetI,
    });

    onClose();
  };

  // Select a custom period to view/edit
  const handleSelectCustomCycle = (cycle: BudgetCycle) => {
    setSelectedCycleId(cycle.id);
    setCustomName(cycle.name);
    setCustomStart(cycle.start_date);
    setCustomEnd(cycle.end_date);
    setCustomBudget(cycle.target_budget ? cycle.target_budget.toString() : '');
    setCustomIncome(cycle.target_income ? cycle.target_income.toString() : '');
  };

  // Start creating a new custom period
  const handleStartNewCustomPeriod = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    setSelectedCycleId(null);
    setCustomName('New Custom Period');
    setCustomStart(todayStr);
    setCustomEnd(todayStr);
    setCustomBudget(settings.cycle_default_budget ? settings.cycle_default_budget.toString() : '2000');
    setCustomIncome(settings.cycle_default_income ? settings.cycle_default_income.toString() : '2500');
  };

  // Save Custom Period
  const handleSaveCustom = async (setAsActive = true) => {
    if (!customName.trim() || !customStart.trim() || !customEnd.trim()) {
      Alert.alert('Incomplete Fields', 'Please specify a name and valid start & end dates.');
      return;
    }

    const bNum = customTargetMode === 'inherit' && settings.cycle_default_budget
      ? settings.cycle_default_budget
      : parseFloat(customBudget);

    const iNum = customTargetMode === 'inherit' && settings.cycle_default_income
      ? settings.cycle_default_income
      : parseFloat(customIncome);

    await updateSettings({
      cycle_mode: 'custom',
    });

    await updateBudgetCycle({
      id: selectedCycleId || undefined,
      name: customName.trim(),
      start_date: customStart.trim(),
      end_date: customEnd.trim(),
      target_budget: !isNaN(bNum) ? bNum : undefined,
      target_income: !isNaN(iNum) ? iNum : undefined,
    });

    if (setAsActive && selectedCycleId) {
      await setActiveBudgetCycle(selectedCycleId);
    }

    onClose();
  };

  // Delete Custom Period
  const handleDeleteCustom = async () => {
    if (!selectedCycleId) return;
    if (allCycles.length <= 1) {
      Alert.alert('Cannot Delete', 'You must have at least one active budget cycle.');
      return;
    }
    Alert.alert(
      'Delete Period',
      `Are you sure you want to delete "${customName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteBudgetCycle(selectedCycleId);
            onClose();
          },
        },
      ]
    );
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBox, { backgroundColor: theme.surface }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialCommunityIcons name="calendar-sync" size={22} color={theme.primary} />
              <Text style={[styles.modalTitle, { color: theme.onSurface }]}>Cycle & Budget Manager</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="close" size={22} color={theme.onSurface} />
            </TouchableOpacity>
          </View>

          {/* MAIN SEGMENTED MODE SELECTOR */}
          <View style={[styles.tabBar, { backgroundColor: theme.surfaceVariant }]}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'regular' && { backgroundColor: theme.primaryContainer }]}
              onPress={() => setActiveTab('regular')}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="calendar-month"
                size={16}
                color={activeTab === 'regular' ? theme.onPrimaryContainer : theme.onSurfaceVariant}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'regular' ? theme.onPrimaryContainer : theme.onSurfaceVariant },
                  activeTab === 'regular' && { fontWeight: '700' },
                ]}
              >
                Regular Calendar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'custom' && { backgroundColor: theme.primaryContainer }]}
              onPress={() => setActiveTab('custom')}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="calendar-range"
                size={16}
                color={activeTab === 'custom' ? theme.onPrimaryContainer : theme.onSurfaceVariant}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'custom' ? theme.onPrimaryContainer : theme.onSurfaceVariant },
                  activeTab === 'custom' && { fontWeight: '700' },
                ]}
              >
                Custom Periods
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollBody}
          >
            {/* OPTION 1: REGULAR CALENDAR FORM */}
            {activeTab === 'regular' && (
              <View style={styles.sectionContainer}>
                {/* 1A. Balance Mode: Monthly vs Accumulated */}
                <View style={styles.groupCard}>
                  <Text style={[styles.groupTitle, { color: theme.onSurface }]}>Balance Mode</Text>
                  <View style={[styles.toggleRow, { backgroundColor: theme.pillBg }]}>
                    <TouchableOpacity
                      style={[styles.toggleBtn, balanceMode === 'monthly' && { backgroundColor: theme.primary }]}
                      onPress={() => setBalanceMode('monthly')}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.toggleBtnText,
                          { color: balanceMode === 'monthly' ? theme.onPrimary : theme.onSurfaceVariant },
                        ]}
                      >
                        Monthly (Fresh)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.toggleBtn, balanceMode === 'accumulated' && { backgroundColor: theme.primary }]}
                      onPress={() => setBalanceMode('accumulated')}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.toggleBtnText,
                          { color: balanceMode === 'accumulated' ? theme.onPrimary : theme.onSurfaceVariant },
                        ]}
                      >
                        Accumulated (Rollover)
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.subHint, { color: theme.onSurfaceVariant }]}>
                    {balanceMode === 'monthly'
                      ? 'Calculates available daily funds strictly within this month’s cycle budget.'
                      : 'Carries forward unspent savings or overspending deficit into this cycle.'}
                  </Text>
                </View>

                {/* 1B. Budget & Target: Inherit vs Monthly */}
                <View style={styles.groupCard}>
                  <Text style={[styles.groupTitle, { color: theme.onSurface }]}>Budget & Income Targets</Text>
                  <View style={[styles.toggleRow, { backgroundColor: theme.pillBg }]}>
                    <TouchableOpacity
                      style={[styles.toggleBtn, targetMode === 'inherit' && { backgroundColor: theme.primary }]}
                      onPress={() => setTargetMode('inherit')}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.toggleBtnText,
                          { color: targetMode === 'inherit' ? theme.onPrimary : theme.onSurfaceVariant },
                        ]}
                      >
                        Inherit Recurring
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.toggleBtn, targetMode === 'monthly' && { backgroundColor: theme.primary }]}
                      onPress={() => setTargetMode('monthly')}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.toggleBtnText,
                          { color: targetMode === 'monthly' ? theme.onPrimary : theme.onSurfaceVariant },
                        ]}
                      >
                        Monthly Custom
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {targetMode === 'inherit' ? (
                    <View style={styles.inputsRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>
                          Default Budget Cap ({curr})
                        </Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                          placeholder="e.g. 2000"
                          placeholderTextColor={theme.onSurfaceVariant}
                          keyboardType="decimal-pad"
                          value={defaultBudget}
                          onChangeText={setDefaultBudget}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>
                          Default Income Goal ({curr})
                        </Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                          placeholder="e.g. 2500"
                          placeholderTextColor={theme.onSurfaceVariant}
                          keyboardType="decimal-pad"
                          value={defaultIncome}
                          onChangeText={setDefaultIncome}
                        />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.inputsRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>
                          This Month Cap ({curr})
                        </Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                          placeholder="e.g. 2000"
                          placeholderTextColor={theme.onSurfaceVariant}
                          keyboardType="decimal-pad"
                          value={regBudget}
                          onChangeText={setRegBudget}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>
                          This Month Goal ({curr})
                        </Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                          placeholder="e.g. 2500"
                          placeholderTextColor={theme.onSurfaceVariant}
                          keyboardType="decimal-pad"
                          value={regIncome}
                          onChangeText={setRegIncome}
                        />
                      </View>
                    </View>
                  )}
                  <Text style={[styles.subHint, { color: theme.onSurfaceVariant }]}>
                    {targetMode === 'inherit'
                      ? 'Every regular month automatically inherits these baseline numbers.'
                      : 'Set custom targets specifically for this month.'}
                  </Text>
                </View>

                {/* 1C. Calendar Settings: Month Start Date */}
                <View style={styles.groupCard}>
                  <Text style={[styles.groupTitle, { color: theme.onSurface }]}>Calendar Settings</Text>
                  <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>
                    Month Start Day (1 - 31)
                  </Text>
                  <View style={styles.startDayRow}>
                    <TextInput
                      style={[styles.startDayInput, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                      placeholder="1"
                      placeholderTextColor={theme.onSurfaceVariant}
                      keyboardType="number-pad"
                      maxLength={2}
                      value={startDay}
                      onChangeText={setStartDay}
                    />
                    <View style={styles.previewContainer}>
                      <Text style={[styles.previewLabel, { color: theme.onSurfaceVariant }]}>
                        Active Cycle Preview:
                      </Text>
                      <Text style={[styles.previewValue, { color: theme.primary }]}>
                        {regularPreview.name}
                      </Text>
                      <Text style={[styles.previewSub, { color: theme.onSurfaceVariant }]}>
                        ({regularPreview.startDate} to {regularPreview.endDate})
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* OPTION 2: CUSTOM ARBITRARY PERIODS */}
            {activeTab === 'custom' && (
              <View style={styles.sectionContainer}>
                {/* List of Periods */}
                <View style={styles.groupCard}>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.groupTitle, { color: theme.onSurface }]}>Existing Periods</Text>
                    <TouchableOpacity
                      style={[styles.addPeriodBtn, { backgroundColor: theme.primaryContainer }]}
                      onPress={handleStartNewCustomPeriod}
                    >
                      <MaterialCommunityIcons name="plus" size={16} color={theme.onPrimaryContainer} />
                      <Text style={[styles.addPeriodBtnText, { color: theme.onPrimaryContainer }]}>
                        Add Period
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.periodPillList}>
                    {allCycles.map((c) => {
                      const isSelected = selectedCycleId === c.id;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={[
                            styles.periodPill,
                            {
                              backgroundColor: isSelected ? theme.primary : theme.pillBg,
                              borderColor: c.is_active ? theme.primary : 'transparent',
                            },
                          ]}
                          onPress={() => handleSelectCustomCycle(c)}
                        >
                          <Text
                            style={[
                              styles.periodPillText,
                              { color: isSelected ? theme.onPrimary : theme.onSurface },
                              c.is_active && { fontWeight: '800' },
                            ]}
                            numberOfLines={1}
                          >
                            {c.name} {c.is_active ? '★' : ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Edit Selected / New Custom Period */}
                <View style={styles.groupCard}>
                  <Text style={[styles.groupTitle, { color: theme.onSurface }]}>
                    {selectedCycleId ? 'Edit Selected Period' : 'New Custom Period'}
                  </Text>

                  <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>Period Name</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                    placeholder="e.g. 27 Oct – 28 Nov 26"
                    placeholderTextColor={theme.onSurfaceVariant}
                    value={customName}
                    onChangeText={setCustomName}
                  />

                  <View style={styles.inputsRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>Start Date</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={theme.onSurfaceVariant}
                        value={customStart}
                        onChangeText={setCustomStart}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>End Date</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={theme.onSurfaceVariant}
                        value={customEnd}
                        onChangeText={setCustomEnd}
                      />
                    </View>
                  </View>

                  {onOpenDateRangePicker && (
                    <TouchableOpacity
                      style={[styles.rangePickerBtn, { backgroundColor: theme.primaryContainer }]}
                      onPress={() => {
                        onClose();
                        onOpenDateRangePicker();
                      }}
                    >
                      <MaterialCommunityIcons name="calendar-range" size={16} color={theme.primary} />
                      <Text style={[styles.rangePickerBtnText, { color: theme.onPrimaryContainer }]}>
                        Pick Dates On Range Calendar
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Budget & Target: Inherit vs Custom */}
                  <Text style={[styles.groupTitle, { color: theme.onSurface, marginTop: 10 }]}>
                    Budget & Target
                  </Text>
                  <View style={[styles.toggleRow, { backgroundColor: theme.pillBg }]}>
                    <TouchableOpacity
                      style={[styles.toggleBtn, customTargetMode === 'inherit' && { backgroundColor: theme.primary }]}
                      onPress={() => setCustomTargetMode('inherit')}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.toggleBtnText,
                          { color: customTargetMode === 'inherit' ? theme.onPrimary : theme.onSurfaceVariant },
                        ]}
                      >
                        Inherit Defaults
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.toggleBtn, customTargetMode === 'custom' && { backgroundColor: theme.primary }]}
                      onPress={() => setCustomTargetMode('custom')}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.toggleBtnText,
                          { color: customTargetMode === 'custom' ? theme.onPrimary : theme.onSurfaceVariant },
                        ]}
                      >
                        Custom Targets
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {customTargetMode === 'custom' && (
                    <View style={styles.inputsRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>
                          Budget Cap ({curr})
                        </Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                          placeholder="e.g. 2000"
                          placeholderTextColor={theme.onSurfaceVariant}
                          keyboardType="decimal-pad"
                          value={customBudget}
                          onChangeText={setCustomBudget}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>
                          Income Goal ({curr})
                        </Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                          placeholder="e.g. 2500"
                          placeholderTextColor={theme.onSurfaceVariant}
                          keyboardType="decimal-pad"
                          value={customIncome}
                          onChangeText={setCustomIncome}
                        />
                      </View>
                    </View>
                  )}

                  {selectedCycleId && allCycles.length > 1 && (
                    <TouchableOpacity
                      style={[styles.deleteBtn, { backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2' }]}
                      onPress={handleDeleteCustom}
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={16} color={theme.error} />
                      <Text style={[styles.deleteBtnText, { color: theme.error }]}>Delete This Period</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer Action Buttons */}
          <View style={styles.modalBtnRow}>
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: theme.pillBg }]} onPress={onClose}>
              <Text style={[styles.btnText, { color: theme.onSurface }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: theme.primary }]}
              onPress={activeTab === 'regular' ? handleSaveRegular : () => handleSaveCustom(true)}
            >
              <Text style={[styles.btnText, { color: theme.onPrimary }]}>
                {activeTab === 'regular' ? 'Apply Regular Calendar' : 'Save & Set Active'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    borderRadius: M3Shape.extraLarge,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: M3Shape.full,
    padding: 3,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: M3Shape.full,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scrollBody: {
    paddingBottom: 8,
  },
  sectionContainer: {
    gap: 12,
  },
  groupCard: {
    gap: 6,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    borderRadius: M3Shape.full,
    padding: 2,
    marginTop: 2,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: M3Shape.full,
    alignItems: 'center',
  },
  toggleBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  subHint: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
    paddingHorizontal: 4,
  },
  inputsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: M3Shape.medium,
    fontSize: 13,
    marginTop: 2,
  },
  startDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  startDayInput: {
    width: 60,
    textAlign: 'center',
    paddingVertical: 8,
    borderRadius: M3Shape.medium,
    fontSize: 16,
    fontWeight: '800',
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  previewLabel: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  previewValue: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 1,
  },
  previewSub: {
    fontSize: 10,
    marginTop: 1,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addPeriodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: M3Shape.full,
  },
  addPeriodBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  periodPillList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  periodPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: M3Shape.full,
    borderWidth: 1.5,
  },
  periodPillText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  rangePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: M3Shape.medium,
    marginTop: 4,
  },
  rangePickerBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: M3Shape.medium,
    marginTop: 6,
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
    paddingTop: 8,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: M3Shape.full,
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: M3Shape.full,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
