import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BudgetCycle } from '../types';
import { M3Shape } from '../theme';

interface BudgetCycleModalProps {
  visible: boolean;
  currentCycle: BudgetCycle | null;
  baseCurrency: string;
  theme: any;
  onClose: () => void;
  onSave: (params: {
    id?: string;
    name: string;
    start_date: string;
    end_date: string;
    target_budget?: number;
    target_income?: number;
  }) => Promise<void>;
  onOpenDateRangePicker?: () => void;
}

export const BudgetCycleModal: React.FC<BudgetCycleModalProps> = ({
  visible,
  currentCycle,
  baseCurrency,
  theme,
  onClose,
  onSave,
  onOpenDateRangePicker,
}) => {
  const [cycleName, setCycleName] = useState<string>('');
  const [cycleStart, setCycleStart] = useState<string>('');
  const [cycleEnd, setCycleEnd] = useState<string>('');
  const [cycleBudget, setCycleBudget] = useState<string>('');
  const [cycleIncomeGoal, setCycleIncomeGoal] = useState<string>('');

  useEffect(() => {
    if (visible && currentCycle) {
      setCycleName(currentCycle.name);
      setCycleStart(currentCycle.start_date);
      setCycleEnd(currentCycle.end_date);
      setCycleBudget(currentCycle.target_budget ? currentCycle.target_budget.toString() : '');
      setCycleIncomeGoal(currentCycle.target_income ? currentCycle.target_income.toString() : '');
    } else if (visible) {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      const firstDay = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const lastDayNum = new Date(y, m + 1, 0).getDate();
      const lastDay = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;
      setCycleName('Budget Cycle');
      setCycleStart(firstDay);
      setCycleEnd(lastDay);
      setCycleBudget('');
      setCycleIncomeGoal('');
    }
  }, [visible, currentCycle]);

  const handleSave = async () => {
    if (!cycleName.trim() || !cycleStart.trim() || !cycleEnd.trim()) return;
    const numBudget = parseFloat(cycleBudget);
    const numIncome = parseFloat(cycleIncomeGoal);
    await onSave({
      id: currentCycle?.id,
      name: cycleName.trim(),
      start_date: cycleStart.trim(),
      end_date: cycleEnd.trim(),
      target_budget: !isNaN(numBudget) ? numBudget : undefined,
      target_income: !isNaN(numIncome) ? numIncome : undefined,
    });
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBox, { backgroundColor: theme.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.onSurface }]}>Budget Cycle & Targets</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
              <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>Start Date</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.onSurfaceVariant}
                value={cycleStart}
                onChangeText={setCycleStart}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>End Date</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.onSurfaceVariant}
                value={cycleEnd}
                onChangeText={setCycleEnd}
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
                Pick Dates On Visual Range Calendar
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>
                Budget Cap ({baseCurrency})
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
                Income Goal ({baseCurrency})
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
              onPress={onClose}
            >
              <Text style={[styles.btnText, { color: theme.onSurface }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: theme.primary }]}
              onPress={handleSave}
            >
              <Text style={[styles.btnText, { color: theme.onPrimary }]}>Save Cycle</Text>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 380,
    borderRadius: M3Shape.extraLarge,
    padding: 20,
    gap: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: M3Shape.medium,
    fontSize: 13,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rangePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: M3Shape.medium,
    marginTop: 2,
  },
  rangePickerBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
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
