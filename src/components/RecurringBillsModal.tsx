import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBudget } from '../context/BudgetContext';
import { lightTheme, darkTheme, M3Shape, M3Elevation } from '../theme';
import { formatCurrency } from '../utils/format';
import { RecurringBill, BillFrequency } from '../types';

interface RecurringBillsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const RecurringBillsModal: React.FC<RecurringBillsModalProps> = ({ visible, onClose }) => {
  const {
    recurringBills,
    addRecurringBill,
    updateRecurringBill,
    deleteRecurringBill,
    payRecurringBill,
    categories,
    wallets,
    settings,
  } = useBudget();
  const theme = settings.theme_mode === 'dark' ? darkTheme : lightTheme;

  const [isAdding, setIsAdding] = useState(false);
  const [editingBill, setEditingBill] = useState<RecurringBill | null>(null);

  // Form states
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billFrequency, setBillFrequency] = useState<BillFrequency>('monthly');
  const [billDueDay, setBillDueDay] = useState('1');
  const [billCategoryId, setBillCategoryId] = useState('');
  const [billWalletId, setBillWalletId] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(true);

  // Reset / open add form
  const handleOpenAdd = () => {
    setEditingBill(null);
    setBillName('');
    setBillAmount('');
    setBillFrequency('monthly');
    setBillDueDay('1');
    setReminderEnabled(true);
    if (wallets.length > 0) {
      setBillWalletId(wallets[0].id);
    }
    const expenseCat = categories.find((c) => c.type === 'expense');
    if (expenseCat) {
      setBillCategoryId(expenseCat.id);
    }
    setIsAdding(true);
  };

  const handleOpenEdit = (bill: RecurringBill) => {
    setEditingBill(bill);
    setBillName(bill.name);
    setBillAmount(bill.amount.toString());
    setBillFrequency(bill.frequency);
    setBillDueDay(bill.due_day.toString());
    setBillCategoryId(bill.category_id || '');
    setBillWalletId(bill.wallet_id);
    setReminderEnabled(bill.reminder_enabled);
    setIsAdding(true);
  };

  const handleSaveBill = async () => {
    const amt = parseFloat(billAmount);
    if (!billName.trim() || isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid details', 'Please enter a valid bill name and amount.');
      return;
    }
    const dueDayNum = parseInt(billDueDay, 10) || 1;
    const clampedDay = Math.min(31, Math.max(1, dueDayNum));

    // Calculate next due date
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const dayPadded = String(clampedDay).padStart(2, '0');
    const monthPadded = String(month + 1).padStart(2, '0');
    const nextDue = `${year}-${monthPadded}-${dayPadded}`;

    const chosenWallet = wallets.find((w) => w.id === billWalletId) || wallets[0];

    if (editingBill) {
      await updateRecurringBill({
        ...editingBill,
        name: billName.trim(),
        amount: amt,
        currency: chosenWallet?.currency || settings.base_currency,
        frequency: billFrequency,
        due_day: clampedDay,
        next_due_date: nextDue,
        category_id: billCategoryId || null,
        wallet_id: chosenWallet?.id || 'w-cash',
        reminder_enabled: reminderEnabled,
      });
    } else {
      await addRecurringBill({
        name: billName.trim(),
        amount: amt,
        currency: chosenWallet?.currency || settings.base_currency,
        frequency: billFrequency,
        due_day: clampedDay,
        next_due_date: nextDue,
        category_id: billCategoryId || undefined,
        wallet_id: chosenWallet?.id || 'w-cash',
        reminder_enabled: reminderEnabled,
      });
    }

    setIsAdding(false);
    setEditingBill(null);
  };

  // Pay bill confirmation
  const handlePay = (bill: RecurringBill) => {
    Alert.alert(
      `Pay ${bill.name}?`,
      `This will record an expense of ${formatCurrency(bill.amount, bill.currency)} and advance the next due date.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay & Record',
          style: 'default',
          onPress: async () => {
            await payRecurringBill(bill);
            Alert.alert('Paid', `${bill.name} recorded and next due date updated!`);
          },
        },
      ]
    );
  };

  // Total monthly recurring cost
  const totalMonthlyCost = useMemo(() => {
    return recurringBills.reduce((sum, b) => {
      let monthlyAmt = b.amount;
      if (b.frequency === 'weekly') monthlyAmt = b.amount * 4.33;
      if (b.frequency === 'yearly') monthlyAmt = b.amount / 12;
      return sum + monthlyAmt;
    }, 0);
  }, [recurringBills]);

  // Days until due calculation
  const getDaysUntilDue = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dateStr + 'T00:00:00');
    const diffTime = due.getTime() - today.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.headerTitle, { color: theme.onSurface }]}>Recurring Bills & Reminders</Text>
              <Text style={[styles.headerSubtitle, { color: theme.onSurfaceVariant }]}>
                Track subscriptions, fixed costs & upcoming bills
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.pillBg }]}>
              <MaterialCommunityIcons name="close" size={20} color={theme.onSurface} />
            </TouchableOpacity>
          </View>

          {/* Monthly Summary Hero Card */}
          <View style={[styles.summaryHero, { backgroundColor: theme.heroBg }, M3Elevation.level1]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.summaryHeroLabel, { color: theme.onSurfaceVariant }]}>ESTIMATED RECURRING / MONTH</Text>
              <Text style={[styles.summaryHeroAmount, { color: theme.primary }]}>
                {formatCurrency(totalMonthlyCost, settings.base_currency)}
              </Text>
              <Text style={[styles.summaryHeroSub, { color: theme.onSurfaceVariant }]}>
                {recurringBills.length} active recurring commitments
              </Text>
            </View>
            <View style={[styles.heroIconBadge, { backgroundColor: theme.surface }]}>
              <MaterialCommunityIcons name="calendar-sync" size={24} color={theme.primary} />
            </View>
          </View>

          {/* Add / Edit Form */}
          {isAdding ? (
            <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
              <Text style={[styles.formTitle, { color: theme.onSurface }]}>
                {editingBill ? `Edit "${editingBill.name}"` : 'New Recurring Bill'}
              </Text>

              {/* Bill Name */}
              <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>Bill / Subscription Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                placeholder="e.g. Rent, Netflix, Electricity, Gym"
                placeholderTextColor={theme.onSurfaceVariant}
                value={billName}
                onChangeText={setBillName}
              />

              {/* Amount */}
              <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>
                Amount ({wallets.find((w) => w.id === billWalletId)?.currency || settings.base_currency})
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={theme.onSurfaceVariant}
                value={billAmount}
                onChangeText={setBillAmount}
              />

              {/* Frequency Picker */}
              <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>Billing Cycle</Text>
              <View style={styles.frequencyRow}>
                {(['weekly', 'monthly', 'yearly'] as BillFrequency[]).map((freq) => (
                  <TouchableOpacity
                    key={freq}
                    style={[
                      styles.freqPill,
                      {
                        backgroundColor: billFrequency === freq ? theme.primary : theme.pillBg,
                      },
                    ]}
                    onPress={() => setBillFrequency(freq)}
                  >
                    <Text
                      style={[
                        styles.freqPillText,
                        {
                          color: billFrequency === freq ? theme.onPrimary : theme.onSurface,
                          fontWeight: billFrequency === freq ? '700' : '500',
                        },
                      ]}
                    >
                      {freq.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Due Day */}
              <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>
                Due Day of Month (1 - 31)
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                keyboardType="number-pad"
                placeholder="15"
                placeholderTextColor={theme.onSurfaceVariant}
                value={billDueDay}
                onChangeText={setBillDueDay}
              />

              {/* Payment Wallet */}
              <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>Payment Wallet</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalChips}>
                {wallets.map((w) => (
                  <TouchableOpacity
                    key={w.id}
                    style={[
                      styles.choiceChip,
                      {
                        backgroundColor: billWalletId === w.id ? theme.primaryContainer : theme.pillBg,
                        borderColor: billWalletId === w.id ? theme.primary : 'transparent',
                        borderWidth: 1,
                      },
                    ]}
                    onPress={() => setBillWalletId(w.id)}
                  >
                    <View style={[styles.chipDot, { backgroundColor: w.color }]} />
                    <Text style={{ color: theme.onSurface, fontSize: 12, fontWeight: billWalletId === w.id ? '700' : '500' }}>
                      {w.name} ({w.currency})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Category */}
              <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalChips}>
                {categories.filter((c) => c.type === 'expense').map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.choiceChip,
                      {
                        backgroundColor: billCategoryId === c.id ? c.color : theme.pillBg,
                      },
                    ]}
                    onPress={() => setBillCategoryId(c.id)}
                  >
                    <MaterialCommunityIcons
                      name={c.icon as any}
                      size={16}
                      color={billCategoryId === c.id ? '#FFFFFF' : theme.onSurface}
                    />
                    <Text
                      style={{
                        color: billCategoryId === c.id ? '#FFFFFF' : theme.onSurface,
                        fontSize: 12,
                        fontWeight: billCategoryId === c.id ? '700' : '500',
                      }}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Reminder Switch */}
              <View style={[styles.reminderRow, { backgroundColor: theme.pillBg }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reminderLabel, { color: theme.onSurface }]}>Enable Bill Reminder</Text>
                  <Text style={[styles.reminderSub, { color: theme.onSurfaceVariant }]}>
                    Notify when payment date is approaching
                  </Text>
                </View>
                <Switch
                  value={reminderEnabled}
                  onValueChange={setReminderEnabled}
                  thumbColor={reminderEnabled ? theme.primary : '#FFFFFF'}
                  trackColor={{ false: theme.divider, true: theme.primaryContainer }}
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.formBtnRow}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { backgroundColor: theme.pillBg }]}
                  onPress={() => setIsAdding(false)}
                >
                  <Text style={[styles.btnText, { color: theme.onSurface }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                  onPress={handleSaveBill}
                >
                  <Text style={[styles.btnText, { color: theme.onPrimary }]}>
                    {editingBill ? 'Update Bill' : 'Save Bill'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            /* Active Bills List */
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {recurringBills.length === 0 ? (
                <View style={[styles.emptyBox, { backgroundColor: theme.cardBg, borderColor: theme.divider }]}>
                  <MaterialCommunityIcons name="calendar-clock" size={44} color={theme.outline} />
                  <Text style={[styles.emptyTitle, { color: theme.onSurface }]}>No recurring bills yet</Text>
                  <Text style={[styles.emptySub, { color: theme.onSurfaceVariant }]}>
                    Add subscriptions, rent, utility bills, or gym memberships to keep track of recurring costs.
                  </Text>
                </View>
              ) : (
                recurringBills.map((bill) => {
                  const cat = categories.find((c) => c.id === bill.category_id);
                  const wallet = wallets.find((w) => w.id === bill.wallet_id);
                  const daysLeft = getDaysUntilDue(bill.next_due_date);

                  return (
                    <View
                      key={bill.id}
                      style={[styles.billCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}
                    >
                      <View style={styles.billTopRow}>
                        <View style={[styles.billIconCircle, { backgroundColor: cat?.color || theme.primary }]}>
                          <MaterialCommunityIcons name={(cat?.icon as any) || 'receipt'} size={20} color="#FFFFFF" />
                        </View>

                        <View style={styles.billInfo}>
                          <Text style={[styles.billName, { color: theme.onSurface }]}>{bill.name}</Text>
                          <Text style={[styles.billMeta, { color: theme.onSurfaceVariant }]}>
                            {wallet?.name || 'Wallet'} • Due: Day {bill.due_day} ({bill.frequency})
                          </Text>
                        </View>

                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[styles.billAmount, { color: theme.error }]}>
                            {formatCurrency(bill.amount, bill.currency)}
                          </Text>
                          <View
                            style={[
                              styles.dueBadge,
                              {
                                backgroundColor: daysLeft <= 1 ? theme.errorContainer : theme.primaryContainer,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.dueBadgeText,
                                {
                                  color: daysLeft <= 1 ? theme.onErrorContainer : theme.onPrimaryContainer,
                                },
                              ]}
                            >
                              {daysLeft < 0 ? 'Overdue' : daysLeft === 0 ? 'Due Today' : `In ${daysLeft} days`}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={[styles.divider, { backgroundColor: theme.divider }]} />

                      <View style={styles.billBottomRow}>
                        <View style={styles.reminderStatus}>
                          <MaterialCommunityIcons
                            name={bill.reminder_enabled ? 'bell-ring-outline' : 'bell-off-outline'}
                            size={16}
                            color={bill.reminder_enabled ? theme.primary : theme.outline}
                          />
                          <Text style={[styles.reminderStatusText, { color: theme.onSurfaceVariant }]}>
                            {bill.reminder_enabled ? 'Reminder on' : 'No alert'}
                          </Text>
                        </View>

                        <View style={styles.billActions}>
                          <TouchableOpacity
                            style={[styles.payNowBtn, { backgroundColor: theme.successContainer }]}
                            onPress={() => handlePay(bill)}
                          >
                            <MaterialCommunityIcons name="check" size={16} color={theme.onSuccessContainer} />
                            <Text style={[styles.payNowText, { color: theme.onSuccessContainer }]}>Pay & Record</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.smallIconBtn, { backgroundColor: theme.pillBg }]}
                            onPress={() => handleOpenEdit(bill)}
                          >
                            <MaterialCommunityIcons name="pencil-outline" size={16} color={theme.onSurface} />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.smallIconBtn, { backgroundColor: theme.errorContainer }]}
                            onPress={() => deleteRecurringBill(bill.id)}
                          >
                            <MaterialCommunityIcons name="trash-can-outline" size={16} color={theme.onErrorContainer} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* Add New Bill Button */}
          {!isAdding && (
            <TouchableOpacity
              style={[styles.addNewBtn, { backgroundColor: theme.primary }]}
              onPress={handleOpenAdd}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="plus" size={20} color={theme.onPrimary} />
              <Text style={[styles.addNewBtnText, { color: theme.onPrimary }]}>Add Recurring Bill / Subscription</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '90%',
    borderTopLeftRadius: M3Shape.extraLarge,
    borderTopRightRadius: M3Shape.extraLarge,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: M3Shape.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryHero: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: M3Shape.extraLarge,
    marginBottom: 14,
  },
  summaryHeroLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 2,
  },
  summaryHeroAmount: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  summaryHeroSub: {
    fontSize: 12,
    marginTop: 2,
  },
  heroIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  emptyBox: {
    borderWidth: 1,
    borderRadius: M3Shape.large,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },
  billCard: {
    borderWidth: 1,
    borderRadius: M3Shape.large,
    padding: 14,
    marginBottom: 10,
  },
  billTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  billIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billInfo: {
    flex: 1,
    marginLeft: 12,
  },
  billName: {
    fontSize: 15,
    fontWeight: '700',
  },
  billMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  billAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  dueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: M3Shape.full,
    marginTop: 4,
  },
  dueBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
  billBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reminderStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reminderStatusText: {
    fontSize: 11,
  },
  billActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  payNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: M3Shape.full,
    gap: 4,
  },
  payNowText: {
    fontSize: 11,
    fontWeight: '700',
  },
  smallIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addNewBtn: {
    flexDirection: 'row',
    height: 48,
    borderRadius: M3Shape.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 8,
  },
  addNewBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  formContainer: {
    flex: 1,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    height: 42,
    borderRadius: M3Shape.medium,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  freqPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: M3Shape.full,
    alignItems: 'center',
  },
  freqPillText: {
    fontSize: 12,
  },
  horizontalChips: {
    marginBottom: 4,
  },
  choiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: M3Shape.full,
    marginRight: 8,
    gap: 6,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: M3Shape.large,
    marginTop: 14,
  },
  reminderLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  reminderSub: {
    fontSize: 11,
    marginTop: 2,
  },
  formBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
    marginBottom: 20,
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
