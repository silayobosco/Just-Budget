import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBudget } from '../context/BudgetContext';
import { DebtItem, DebtType } from '../types';
import { formatCurrency, formatTypingNumber, parseCleanNumber } from '../utils/format';
import { M3Elevation, M3Shape, lightTheme, darkTheme } from '../theme';
import { CalendarPickerModal } from './CalendarPickerModal';

interface DebtsModalProps {
  visible: boolean;
  onClose: () => void;
}

type FilterTab = 'open' | 'lent' | 'borrowed' | 'settled';
type ViewMode = 'by_person' | 'all_items';

export const DebtsModal: React.FC<DebtsModalProps> = ({ visible, onClose }) => {
  const {
    settings,
    wallets,
    debts,
    addDebt,
    updateDebt,
    recordDebtPayment,
    deleteDebt,
    addTransaction,
  } = useBudget();
  const theme = settings.theme_mode === 'dark' ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? Math.max(StatusBar.currentHeight || 0, 28) : 0
  );
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 16);

  const [filter, setFilter] = useState<FilterTab>('open');
  const [viewMode, setViewMode] = useState<ViewMode>('by_person');
  const [expandedPersonKey, setExpandedPersonKey] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [editingDebt, setEditingDebt] = useState<DebtItem | null>(null);

  // Form state
  const [debtType, setDebtType] = useState<DebtType>('lent');
  const [personName, setPersonName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [dateStr, setDateStr] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDateStr, setDueDateStr] = useState<string>('');
  const [walletId, setWalletId] = useState<string>('');
  const [note, setNote] = useState('');

  // Date picker state
  const [pickerTarget, setPickerTarget] = useState<'date' | 'due_date' | null>(null);

  // Payment modal state
  const [payingDebt, setPayingDebt] = useState<DebtItem | null>(null);
  const [paymentStr, setPaymentStr] = useState('');
  const [logToWallet, setLogToWallet] = useState(true);
  const [paymentWalletId, setPaymentWalletId] = useState('');

  const baseCurr = settings.base_currency;

  const { totalOwedToYou, totalYouOwe } = useMemo(() => {
    let lent = 0;
    let borrowed = 0;
    debts.forEach((d) => {
      if (d.status !== 'open') return;
      const rem = Math.max(0, d.amount - (d.paid_amount || 0));
      if (d.type === 'lent') lent += rem;
      else borrowed += rem;
    });
    return { totalOwedToYou: lent, totalYouOwe: borrowed };
  }, [debts]);

  const filteredDebts = useMemo(() => {
    return debts.filter((d) => {
      if (filter === 'settled') return d.status === 'settled';
      if (filter === 'lent') return d.status === 'open' && d.type === 'lent';
      if (filter === 'borrowed') return d.status === 'open' && d.type === 'borrowed';
      return d.status === 'open';
    });
  }, [debts, filter]);

  const personGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        displayName: string;
        items: DebtItem[];
        lentOpen: number;
        borrowedOpen: number;
        netBalance: number;
        openCount: number;
        settledCount: number;
      }
    >();

    filteredDebts.forEach((d) => {
      const cleanName = d.person_name.trim() || 'Unknown';
      const key = cleanName.toLowerCase();
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          displayName: cleanName,
          items: [],
          lentOpen: 0,
          borrowedOpen: 0,
          netBalance: 0,
          openCount: 0,
          settledCount: 0,
        });
      }
      const g = groups.get(key)!;
      g.items.push(d);
      if (d.status === 'open') {
        const rem = Math.max(0, d.amount - (d.paid_amount || 0));
        if (d.type === 'lent') g.lentOpen += rem;
        else g.borrowedOpen += rem;
        g.openCount += 1;
      } else {
        g.settledCount += 1;
      }
      g.netBalance = g.lentOpen - g.borrowedOpen;
    });

    return Array.from(groups.values()).sort(
      (a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance)
    );
  }, [filteredDebts]);

  const resetForm = (defaultType: DebtType = 'lent') => {
    setEditingDebt(null);
    setDebtType(defaultType);
    setPersonName('');
    setAmountStr('');
    setDateStr(new Date().toISOString().slice(0, 10));
    setDueDateStr('');
    setWalletId(wallets[0]?.id || '');
    setNote('');
  };

  const openAddForm = (type: DebtType = 'lent', prefillPerson?: string) => {
    resetForm(type);
    if (prefillPerson) setPersonName(prefillPerson);
    setFormVisible(true);
  };

  const handleSettleAllForPerson = (displayName: string, items: DebtItem[]) => {
    const openItems = items.filter((d) => d.status === 'open');
    if (openItems.length === 0) return;
    Alert.alert(
      `Settle All with ${displayName}?`,
      `Mark all ${openItems.length} open IOU(s) with ${displayName} as settled?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Settle All',
          onPress: async () => {
            for (const item of openItems) {
              const rem = Math.max(0, item.amount - (item.paid_amount || 0));
              if (rem > 0) await recordDebtPayment(item.id, rem);
            }
          },
        },
      ]
    );
  };

  const openEditForm = (item: DebtItem) => {
    setEditingDebt(item);
    setDebtType(item.type);
    setPersonName(item.person_name);
    setAmountStr(formatTypingNumber(item.amount.toString()));
    setDateStr(item.date);
    setDueDateStr(item.due_date || '');
    setWalletId(item.wallet_id || '');
    setNote(item.note || '');
    setFormVisible(true);
  };

  const applySplitHelper = (divisor: number) => {
    const current = parseCleanNumber(amountStr);
    if (isNaN(current) || current <= 0) {
      Alert.alert('Enter Total Bill First', 'Type the total bill amount, then tap a split button.');
      return;
    }
    const share = Math.round((current / divisor) * 100) / 100;
    setAmountStr(formatTypingNumber(share.toString()));
    if (!note.trim()) {
      setNote(`Split ÷ ${divisor}`);
    }
  };

  const handleSaveDebt = async () => {
    const trimmedName = personName.trim();
    if (!trimmedName) {
      Alert.alert('Missing Person', 'Please enter who this IOU or split is with.');
      return;
    }
    const parsed = parseCleanNumber(amountStr);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid Amount', 'Please enter an amount greater than 0.');
      return;
    }

    if (editingDebt) {
      const paid = editingDebt.paid_amount || 0;
      await updateDebt({
        ...editingDebt,
        type: debtType,
        person_name: trimmedName,
        amount: parsed,
        date: dateStr,
        due_date: dueDateStr || null,
        wallet_id: walletId || null,
        note: note.trim() || null,
        status: paid >= parsed ? 'settled' : 'open',
      });
    } else {
      await addDebt({
        type: debtType,
        person_name: trimmedName,
        amount: parsed,
        currency: baseCurr,
        date: dateStr,
        due_date: dueDateStr || undefined,
        wallet_id: walletId || undefined,
        note: note.trim() || undefined,
      });
    }
    setFormVisible(false);
    resetForm();
  };

  const handleOpenPayment = (item: DebtItem) => {
    const remaining = Math.max(0, item.amount - (item.paid_amount || 0));
    setPayingDebt(item);
    setPaymentStr(formatTypingNumber(remaining.toString()));
    setLogToWallet(wallets.length > 0);
    setPaymentWalletId(item.wallet_id || wallets[0]?.id || '');
  };

  const logPaymentToWallet = async (debt: DebtItem, paidAmt: number, targetWalletId: string) => {
    if (!targetWalletId || paidAmt <= 0) return;
    await addTransaction({
      wallet_id: targetWalletId,
      type: debt.type === 'lent' ? 'income' : 'expense',
      amount: paidAmt,
      currency: debt.currency || baseCurr,
      date: new Date().toISOString().slice(0, 10),
      is_paid: true,
      note:
        debt.type === 'lent'
          ? `IOU Repaid: ${debt.person_name}${debt.note ? ` (${debt.note})` : ''}`
          : `IOU Paid: ${debt.person_name}${debt.note ? ` (${debt.note})` : ''}`,
    });
  };

  const handleConfirmPayment = async () => {
    if (!payingDebt) return;
    const parsed = parseCleanNumber(paymentStr);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount.');
      return;
    }

    const remaining = Math.max(0, payingDebt.amount - (payingDebt.paid_amount || 0));
    const normalizedPerson = payingDebt.person_name.trim().toLowerCase();
    const otherOpenTotal = debts
      .filter(
        (d) =>
          d.id !== payingDebt.id &&
          d.status === 'open' &&
          d.type === payingDebt.type &&
          d.person_name.trim().toLowerCase() === normalizedPerson
      )
      .reduce((sum, d) => sum + Math.max(0, d.amount - (d.paid_amount || 0)), 0);

    const unabsorbedExcess = Math.round((parsed - remaining - otherOpenTotal) * 100) / 100;
    const curr = payingDebt.currency || baseCurr;
    const activeDebt = payingDebt;
    const shouldLog = logToWallet && Boolean(paymentWalletId);
    const chosenWallet = paymentWalletId;

    if (unabsorbedExcess > 0.009) {
      const creditMsg =
        payingDebt.type === 'lent'
          ? `${payingDebt.person_name} overpaid by ${formatCurrency(unabsorbedExcess, curr)}. Record this change as an amount you owe them?`
          : `You overpaid ${payingDebt.person_name} by ${formatCurrency(unabsorbedExcess, curr)}. Record this change as an amount they owe you?`;

      Alert.alert('Overpayment Detected', creditMsg, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Settle Only',
          onPress: async () => {
            await recordDebtPayment(activeDebt.id, parsed, { recordExcessAsCredit: false });
            if (shouldLog) await logPaymentToWallet(activeDebt, parsed, chosenWallet);
            setPayingDebt(null);
            setPaymentStr('');
          },
        },
        {
          text: 'Record as Credit',
          onPress: async () => {
            await recordDebtPayment(activeDebt.id, parsed, { recordExcessAsCredit: true });
            if (shouldLog) await logPaymentToWallet(activeDebt, parsed, chosenWallet);
            setPayingDebt(null);
            setPaymentStr('');
          },
        },
      ]);
      return;
    }

    await recordDebtPayment(activeDebt.id, parsed);
    if (shouldLog) await logPaymentToWallet(activeDebt, parsed, chosenWallet);
    setPayingDebt(null);
    setPaymentStr('');
  };

  const handleSettleFull = (item: DebtItem) => {
    const remaining = Math.max(0, item.amount - (item.paid_amount || 0));
    const defaultWalletId = item.wallet_id || wallets[0]?.id || '';
    const defaultWallet = wallets.find((w) => w.id === defaultWalletId);
    if (defaultWallet) {
      Alert.alert(
        'Settle in Full?',
        `Mark remaining ${formatCurrency(remaining, item.currency || baseCurr)} with ${item.person_name} as settled?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Settle Only',
            onPress: () => recordDebtPayment(item.id, remaining),
          },
          {
            text: `Settle & Log (${defaultWallet.name})`,
            onPress: async () => {
              await recordDebtPayment(item.id, remaining);
              await logPaymentToWallet(item, remaining, defaultWallet.id);
            },
          },
        ]
      );
      return;
    }
    Alert.alert(
      'Settle in Full?',
      `Mark remaining ${formatCurrency(remaining, item.currency || baseCurr)} with ${item.person_name} as settled?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Settle',
          onPress: () => recordDebtPayment(item.id, remaining),
        },
      ]
    );
  };

  const handleDelete = (item: DebtItem) => {
    Alert.alert(
      'Delete Record',
      `Remove this ${item.type === 'lent' ? 'lent' : 'borrowed'} record with ${item.person_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteDebt(item.id) },
      ]
    );
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.background, paddingTop: topInset }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.divider }]}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.onSurface} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: theme.onSurface }]}>Debts, IOUs & Splits</Text>
            <Text style={[styles.headerSubtitle, { color: theme.onSurfaceVariant }]}>
              Track money lent, borrowed, or split bills
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: theme.primary }]}
            onPress={() => openAddForm('lent')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="plus" size={18} color={theme.onPrimary} />
            <Text style={[styles.addBtnText, { color: theme.onPrimary }]}>New</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary Cards */}
          <View style={styles.summaryRow}>
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: theme.successContainer, borderColor: theme.divider },
              ]}
            >
              <View style={styles.summaryIconRow}>
                <MaterialCommunityIcons name="arrow-bottom-left" size={18} color={theme.success} />
                <Text style={[styles.summaryLabel, { color: theme.onSuccessContainer }]}>
                  Owed to You
                </Text>
              </View>
              <Text style={[styles.summaryAmount, { color: theme.onSuccessContainer }]}>
                {formatCurrency(totalOwedToYou, baseCurr)}
              </Text>
            </View>

            <View
              style={[
                styles.summaryCard,
                { backgroundColor: theme.errorContainer, borderColor: theme.divider },
              ]}
            >
              <View style={styles.summaryIconRow}>
                <MaterialCommunityIcons name="arrow-top-right" size={18} color={theme.error} />
                <Text style={[styles.summaryLabel, { color: theme.onErrorContainer }]}>
                  You Owe
                </Text>
              </View>
              <Text style={[styles.summaryAmount, { color: theme.onErrorContainer }]}>
                {formatCurrency(totalYouOwe, baseCurr)}
              </Text>
            </View>
          </View>

          {/* View Mode Toggle (By Person vs All Items) */}
          <View style={[styles.typeToggleRow, { backgroundColor: theme.pillBg, marginBottom: 12 }]}>
            {(
              [
                { key: 'by_person', label: 'By Person' },
                { key: 'all_items', label: 'All Items' },
              ] as { key: ViewMode; label: string }[]
            ).map((mode) => {
              const active = viewMode === mode.key;
              return (
                <TouchableOpacity
                  key={mode.key}
                  style={[
                    styles.typeToggleBtn,
                    active && { backgroundColor: theme.primaryContainer },
                  ]}
                  onPress={() => setViewMode(mode.key)}
                >
                  <Text
                    style={[
                      styles.typeToggleText,
                      {
                        color: active ? theme.onPrimaryContainer : theme.onSurfaceVariant,
                      },
                    ]}
                  >
                    {mode.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Filter Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {(
              [
                { key: 'open', label: 'All Open' },
                { key: 'lent', label: 'Lent / Splits' },
                { key: 'borrowed', label: 'Borrowed' },
                { key: 'settled', label: 'Settled' },
              ] as { key: FilterTab; label: string }[]
            ).map((tab) => {
              const active = filter === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? theme.primaryContainer : theme.surface,
                      borderColor: active ? theme.primary : theme.divider,
                    },
                  ]}
                  onPress={() => setFilter(tab.key)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: active ? theme.onPrimaryContainer : theme.onSurfaceVariant },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Empty State */}
          {filteredDebts.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
              <MaterialCommunityIcons
                name="handshake-outline"
                size={42}
                color={theme.onSurfaceVariant}
              />
              <Text style={[styles.emptyTitle, { color: theme.onSurface }]}>
                {filter === 'settled' ? 'No settled IOUs yet' : 'No open IOUs or splits'}
              </Text>
              <Text style={[styles.emptySub, { color: theme.onSurfaceVariant }]}>
                Keep track of shared dinners, loans to friends, or money you owe without cluttering your expense totals.
              </Text>
              <TouchableOpacity
                style={[styles.emptyActionBtn, { backgroundColor: theme.primary }]}
                onPress={() => openAddForm(filter === 'borrowed' ? 'borrowed' : 'lent')}
              >
                <Text style={[styles.emptyActionText, { color: theme.onPrimary }]}>
                  Add IOU or Split
                </Text>
              </TouchableOpacity>
            </View>
          ) : viewMode === 'by_person' ? (
            personGroups.map((group) => {
              const isExpanded = expandedPersonKey === group.key;
              const isNetPositive = group.netBalance > 0.009;
              const isNetNegative = group.netBalance < -0.009;
              return (
                <View
                  key={group.key}
                  style={[
                    styles.debtCard,
                    { backgroundColor: theme.surface, borderColor: theme.divider },
                    M3Elevation.level1,
                  ]}
                >
                  <TouchableOpacity
                    style={styles.debtTopRow}
                    onPress={() =>
                      setExpandedPersonKey((prev) => (prev === group.key ? null : group.key))
                    }
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.avatarCircle,
                        {
                          backgroundColor: isNetNegative
                            ? theme.errorContainer
                            : isNetPositive
                            ? theme.successContainer
                            : theme.pillBg,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.avatarText,
                          {
                            color: isNetNegative
                              ? theme.onErrorContainer
                              : isNetPositive
                              ? theme.onSuccessContainer
                              : theme.onSurfaceVariant,
                          },
                        ]}
                      >
                        {group.displayName.charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.personName, { color: theme.onSurface }]}>
                        {group.displayName}
                      </Text>
                      <Text style={[styles.metaText, { color: theme.onSurfaceVariant }]}>
                        {group.openCount > 0 ? `${group.openCount} open` : ''}
                        {group.openCount > 0 && group.settledCount > 0 ? ' • ' : ''}
                        {group.settledCount > 0 ? `${group.settledCount} settled` : ''}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end', marginRight: 4 }}>
                      <Text
                        style={[
                          styles.remainingAmount,
                          {
                            color: isNetNegative
                              ? theme.error
                              : isNetPositive
                              ? theme.success
                              : theme.onSurfaceVariant,
                          },
                        ]}
                      >
                        {isNetPositive
                          ? `Owes ${formatCurrency(group.netBalance, baseCurr)}`
                          : isNetNegative
                          ? `You owe ${formatCurrency(Math.abs(group.netBalance), baseCurr)}`
                          : 'Settled'}
                      </Text>
                      {group.lentOpen > 0 && group.borrowedOpen > 0 && (
                        <Text style={[styles.totalSmall, { color: theme.onSurfaceVariant }]}>
                          +{formatCurrency(group.lentOpen, baseCurr)} / -{formatCurrency(group.borrowedOpen, baseCurr)}
                        </Text>
                      )}
                    </View>

                    <MaterialCommunityIcons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={theme.onSurfaceVariant}
                    />
                  </TouchableOpacity>

                  {isExpanded && (
                    <View
                      style={{
                        marginTop: 12,
                        paddingTop: 10,
                        borderTopWidth: 1,
                        borderTopColor: theme.divider,
                        gap: 10,
                      }}
                    >
                      {group.items.map((item) => {
                        const isLent = item.type === 'lent';
                        const paid = item.paid_amount || 0;
                        const remaining = Math.max(0, item.amount - paid);
                        const curr = item.currency || baseCurr;
                        return (
                          <View
                            key={item.id}
                            style={{
                              backgroundColor: theme.pillBg,
                              borderRadius: M3Shape.medium,
                              padding: 10,
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 12.5, fontWeight: '800', color: theme.onSurface }}>
                                  {isLent ? 'Lent' : 'Borrowed'} • {item.date}
                                </Text>
                                {Boolean(item.note) && (
                                  <Text style={{ fontSize: 11.5, color: theme.onSurfaceVariant, marginTop: 2 }}>
                                    {item.note}
                                  </Text>
                                )}
                              </View>
                              <Text
                                style={{
                                  fontSize: 13.5,
                                  fontWeight: '800',
                                  color:
                                    item.status === 'settled'
                                      ? theme.onSurfaceVariant
                                      : isLent
                                      ? theme.success
                                      : theme.error,
                                }}
                              >
                                {formatCurrency(item.status === 'settled' ? item.amount : remaining, curr)}
                              </Text>
                            </View>

                            <View style={[styles.cardActionsRow, { marginTop: 8 }]}>
                              {item.status === 'open' ? (
                                <>
                                  <TouchableOpacity
                                    style={[styles.cardActionBtn, { backgroundColor: theme.primaryContainer }]}
                                    onPress={() => handleOpenPayment(item)}
                                  >
                                    <MaterialCommunityIcons name="cash-plus" size={14} color={theme.onPrimaryContainer} />
                                    <Text style={[styles.cardActionText, { color: theme.onPrimaryContainer }]}>Pay</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={[styles.cardActionBtn, { backgroundColor: theme.successContainer }]}
                                    onPress={() => handleSettleFull(item)}
                                  >
                                    <MaterialCommunityIcons name="check-circle-outline" size={14} color={theme.onSuccessContainer} />
                                    <Text style={[styles.cardActionText, { color: theme.onSuccessContainer }]}>Settle</Text>
                                  </TouchableOpacity>
                                </>
                              ) : (
                                <View style={[styles.settledBadge, { backgroundColor: theme.successContainer }]}>
                                  <MaterialCommunityIcons name="check" size={13} color={theme.success} />
                                  <Text style={[styles.settledBadgeText, { color: theme.onSuccessContainer }]}>Settled</Text>
                                </View>
                              )}
                              <View style={{ flex: 1 }} />
                              <TouchableOpacity onPress={() => openEditForm(item)} style={styles.iconAction}>
                                <MaterialCommunityIcons name="pencil-outline" size={16} color={theme.onSurfaceVariant} />
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconAction}>
                                <MaterialCommunityIcons name="trash-can-outline" size={16} color={theme.error} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}

                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                        <TouchableOpacity
                          style={[styles.cardActionBtn, { backgroundColor: theme.primaryContainer, flex: 1, justifyContent: 'center', paddingVertical: 8 }]}
                          onPress={() => openAddForm('lent', group.displayName)}
                        >
                          <MaterialCommunityIcons name="plus" size={15} color={theme.onPrimaryContainer} />
                          <Text style={[styles.cardActionText, { color: theme.onPrimaryContainer }]}>
                            Add IOU
                          </Text>
                        </TouchableOpacity>
                        {group.openCount > 1 && (
                          <TouchableOpacity
                            style={[styles.cardActionBtn, { backgroundColor: theme.successContainer, flex: 1, justifyContent: 'center', paddingVertical: 8 }]}
                            onPress={() => handleSettleAllForPerson(group.displayName, group.items)}
                          >
                            <MaterialCommunityIcons name="check-all" size={15} color={theme.onSuccessContainer} />
                            <Text style={[styles.cardActionText, { color: theme.onSuccessContainer }]}>
                              Settle All ({group.openCount})
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            filteredDebts.map((item) => {
              const isLent = item.type === 'lent';
              const paid = item.paid_amount || 0;
              const remaining = Math.max(0, item.amount - paid);
              const progress = item.amount > 0 ? Math.min(1, paid / item.amount) : 1;
              const curr = item.currency || baseCurr;
              const linkedWallet = wallets.find((w) => w.id === item.wallet_id);

              return (
                <View
                  key={item.id}
                  style={[
                    styles.debtCard,
                    { backgroundColor: theme.surface, borderColor: theme.divider },
                    M3Elevation.level1,
                  ]}
                >
                  <View style={styles.debtTopRow}>
                    <View
                      style={[
                        styles.avatarCircle,
                        {
                          backgroundColor: isLent ? theme.successContainer : theme.errorContainer,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.avatarText,
                          { color: isLent ? theme.onSuccessContainer : theme.onErrorContainer },
                        ]}
                      >
                        {item.person_name.charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.personName, { color: theme.onSurface }]}>
                          {item.person_name}
                        </Text>
                        <View
                          style={[
                            styles.typePill,
                            {
                              backgroundColor: isLent
                                ? theme.successContainer
                                : theme.errorContainer,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.typePillText,
                              {
                                color: isLent ? theme.onSuccessContainer : theme.onErrorContainer,
                              },
                            ]}
                          >
                            {isLent ? 'Lent' : 'Borrowed'}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.metaText, { color: theme.onSurfaceVariant }]}>
                        {item.date}
                        {item.due_date ? ` • Due ${item.due_date}` : ''}
                        {linkedWallet ? ` • ${linkedWallet.name}` : ''}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text
                        style={[
                          styles.remainingAmount,
                          {
                            color:
                              item.status === 'settled'
                                ? theme.onSurfaceVariant
                                : isLent
                                ? theme.success
                                : theme.error,
                          },
                        ]}
                      >
                        {formatCurrency(item.status === 'settled' ? item.amount : remaining, curr)}
                      </Text>
                      {paid > 0 && item.status === 'open' && (
                        <Text style={[styles.totalSmall, { color: theme.onSurfaceVariant }]}>
                          of {formatCurrency(item.amount, curr)}
                        </Text>
                      )}
                    </View>
                  </View>

                  {Boolean(item.note) && (
                    <Text style={[styles.noteText, { color: theme.onSurfaceVariant }]}>
                      {item.note}
                    </Text>
                  )}

                  {/* Progress bar */}
                  <View style={[styles.progressTrack, { backgroundColor: theme.pillBg }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.round(progress * 100)}%`,
                          backgroundColor:
                            item.status === 'settled'
                              ? theme.success
                              : isLent
                              ? theme.primary
                              : theme.error,
                        },
                      ]}
                    />
                  </View>

                  {/* Actions */}
                  <View style={styles.cardActionsRow}>
                    {item.status === 'open' ? (
                      <>
                        <TouchableOpacity
                          style={[styles.cardActionBtn, { backgroundColor: theme.primaryContainer }]}
                          onPress={() => handleOpenPayment(item)}
                        >
                          <MaterialCommunityIcons
                            name="cash-plus"
                            size={15}
                            color={theme.onPrimaryContainer}
                          />
                          <Text style={[styles.cardActionText, { color: theme.onPrimaryContainer }]}>
                            Pay
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.cardActionBtn, { backgroundColor: theme.successContainer }]}
                          onPress={() => handleSettleFull(item)}
                        >
                          <MaterialCommunityIcons
                            name="check-circle-outline"
                            size={15}
                            color={theme.onSuccessContainer}
                          />
                          <Text style={[styles.cardActionText, { color: theme.onSuccessContainer }]}>
                            Settle
                          </Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <View style={[styles.settledBadge, { backgroundColor: theme.successContainer }]}>
                        <MaterialCommunityIcons name="check" size={14} color={theme.success} />
                        <Text style={[styles.settledBadgeText, { color: theme.onSuccessContainer }]}>
                          Settled
                        </Text>
                      </View>
                    )}

                    <View style={{ flex: 1 }} />

                    <TouchableOpacity onPress={() => openEditForm(item)} style={styles.iconAction}>
                      <MaterialCommunityIcons
                        name="pencil-outline"
                        size={18}
                        color={theme.onSurfaceVariant}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconAction}>
                      <MaterialCommunityIcons
                        name="trash-can-outline"
                        size={18}
                        color={theme.error}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Add / Edit Debt Modal */}
        <Modal
          visible={formVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setFormVisible(false)}
        >
          <View style={styles.sheetOverlay}>
            <View
              style={[
                styles.sheetContainer,
                { backgroundColor: theme.surface, paddingBottom: bottomInset + 16 },
              ]}
            >
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: theme.onSurface }]}>
                  {editingDebt ? 'Edit IOU / Split' : 'New IOU or Split'}
                </Text>
                <TouchableOpacity onPress={() => setFormVisible(false)} hitSlop={8}>
                  <MaterialCommunityIcons name="close" size={22} color={theme.onSurfaceVariant} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Type Toggle */}
                <View style={[styles.typeToggleRow, { backgroundColor: theme.pillBg }]}>
                  {(['lent', 'borrowed'] as DebtType[]).map((t) => {
                    const active = debtType === t;
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[
                          styles.typeToggleBtn,
                          active && {
                            backgroundColor:
                              t === 'lent' ? theme.successContainer : theme.errorContainer,
                          },
                        ]}
                        onPress={() => setDebtType(t)}
                      >
                        <Text
                          style={[
                            styles.typeToggleText,
                            {
                              color: active
                                ? t === 'lent'
                                  ? theme.onSuccessContainer
                                  : theme.onErrorContainer
                                : theme.onSurfaceVariant,
                            },
                          ]}
                        >
                          {t === 'lent' ? 'I Lent / Split Bill' : 'I Borrowed'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>PERSON</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    { color: theme.onSurface, backgroundColor: theme.pillBg, borderColor: theme.divider },
                  ]}
                  placeholder="e.g. Alex, Sarah"
                  placeholderTextColor={theme.onSurfaceVariant}
                  value={personName}
                  onChangeText={setPersonName}
                />

                <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>
                  AMOUNT ({baseCurr})
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    styles.amountField,
                    { color: theme.onSurface, backgroundColor: theme.pillBg, borderColor: theme.divider },
                  ]}
                  placeholder="0.00"
                  placeholderTextColor={theme.onSurfaceVariant}
                  keyboardType={Platform.OS === 'android' ? 'numeric' : 'decimal-pad'}
                  value={amountStr}
                  onChangeText={(txt) => setAmountStr(formatTypingNumber(txt))}
                />

                {/* Split Helper Chips */}
                <View style={styles.splitRow}>
                  <Text style={[styles.splitHint, { color: theme.onSurfaceVariant }]}>
                    Split total:
                  </Text>
                  {[2, 3, 4].map((div) => (
                    <TouchableOpacity
                      key={div}
                      style={[
                        styles.splitChip,
                        { backgroundColor: theme.primaryContainer, borderColor: theme.primary },
                      ]}
                      onPress={() => applySplitHelper(div)}
                    >
                      <Text style={[styles.splitChipText, { color: theme.onPrimaryContainer }]}>
                        ÷ {div}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Date & Due Date */}
                <View style={styles.datesRow}>
                  <TouchableOpacity
                    style={[
                      styles.dateChip,
                      { backgroundColor: theme.pillBg, borderColor: theme.divider },
                    ]}
                    onPress={() => setPickerTarget('date')}
                  >
                    <MaterialCommunityIcons
                      name="calendar-outline"
                      size={16}
                      color={theme.primary}
                    />
                    <Text style={[styles.dateChipText, { color: theme.onSurface }]}>
                      Date: {dateStr}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.dateChip,
                      { backgroundColor: theme.pillBg, borderColor: theme.divider },
                    ]}
                    onPress={() => setPickerTarget('due_date')}
                  >
                    <MaterialCommunityIcons
                      name="calendar-clock"
                      size={16}
                      color={theme.onSurfaceVariant}
                    />
                    <Text style={[styles.dateChipText, { color: theme.onSurface }]}>
                      {dueDateStr ? `Due: ${dueDateStr}` : 'Due date (opt)'}
                    </Text>
                    {Boolean(dueDateStr) && (
                      <TouchableOpacity onPress={() => setDueDateStr('')} hitSlop={6}>
                        <MaterialCommunityIcons
                          name="close-circle"
                          size={15}
                          color={theme.onSurfaceVariant}
                        />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Wallet (Optional) */}
                {wallets.length > 0 && (
                  <>
                    <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>
                      WALLET (OPTIONAL)
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8, marginBottom: 12 }}
                    >
                      {wallets.map((w) => {
                        const selected = walletId === w.id;
                        return (
                          <TouchableOpacity
                            key={w.id}
                            style={[
                              styles.walletChip,
                              {
                                backgroundColor: selected ? theme.primaryContainer : theme.pillBg,
                                borderColor: selected ? theme.primary : theme.divider,
                              },
                            ]}
                            onPress={() => setWalletId(selected ? '' : w.id)}
                          >
                            <MaterialCommunityIcons
                              name={(w.icon as any) || 'wallet'}
                              size={15}
                              color={selected ? theme.primary : theme.onSurfaceVariant}
                            />
                            <Text
                              style={{
                                fontSize: 12.5,
                                fontWeight: '700',
                                color: selected ? theme.onPrimaryContainer : theme.onSurface,
                              }}
                            >
                              {w.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </>
                )}

                <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>
                  NOTE (OPTIONAL)
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    { color: theme.onSurface, backgroundColor: theme.pillBg, borderColor: theme.divider },
                  ]}
                  placeholder="e.g. Dinner at Cape Town Fish Market"
                  placeholderTextColor={theme.onSurfaceVariant}
                  value={note}
                  onChangeText={setNote}
                />

                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                  onPress={handleSaveDebt}
                >
                  <Text style={[styles.saveBtnText, { color: theme.onPrimary }]}>
                    {editingDebt ? 'Save Changes' : 'Save IOU'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Record Payment Modal */}
        <Modal
          visible={Boolean(payingDebt)}
          animationType="fade"
          transparent
          onRequestClose={() => setPayingDebt(null)}
        >
          <View style={styles.centerOverlay}>
            <View style={[styles.paymentDialog, { backgroundColor: theme.surface }]}>
              <Text style={[styles.dialogTitle, { color: theme.onSurface }]}>
                Record Payment
              </Text>
              <Text style={[styles.dialogSub, { color: theme.onSurfaceVariant }]}>
                {payingDebt?.type === 'lent'
                  ? `Received from ${payingDebt?.person_name}`
                  : `Paid to ${payingDebt?.person_name}`}
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  styles.amountField,
                  { color: theme.onSurface, backgroundColor: theme.pillBg, borderColor: theme.divider },
                ]}
                keyboardType={Platform.OS === 'android' ? 'numeric' : 'decimal-pad'}
                value={paymentStr}
                onChangeText={(txt) => setPaymentStr(formatTypingNumber(txt))}
                autoFocus
              />

              {wallets.length > 0 && (
                <View style={{ marginBottom: 14 }}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}
                    onPress={() => setLogToWallet((prev) => !prev)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.onSurface }}>
                      {payingDebt?.type === 'lent' ? 'Log as Income to Wallet' : 'Log as Expense from Wallet'}
                    </Text>
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 12,
                        backgroundColor: logToWallet ? theme.primaryContainer : theme.pillBg,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11.5,
                          fontWeight: '700',
                          color: logToWallet ? theme.onPrimaryContainer : theme.onSurfaceVariant,
                        }}
                      >
                        {logToWallet ? 'On' : 'Off'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {logToWallet && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8 }}
                    >
                      {wallets.map((w) => {
                        const selected = paymentWalletId === w.id;
                        return (
                          <TouchableOpacity
                            key={w.id}
                            style={[
                              styles.walletChip,
                              {
                                backgroundColor: selected ? theme.primaryContainer : theme.pillBg,
                                borderColor: selected ? theme.primary : theme.divider,
                              },
                            ]}
                            onPress={() => setPaymentWalletId(w.id)}
                          >
                            <MaterialCommunityIcons
                              name={(w.icon as any) || 'wallet'}
                              size={14}
                              color={selected ? theme.primary : theme.onSurfaceVariant}
                            />
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: '700',
                                color: selected ? theme.onPrimaryContainer : theme.onSurface,
                              }}
                            >
                              {w.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              )}

              <View style={styles.dialogBtns}>
                <TouchableOpacity
                  style={[styles.dialogBtn, { backgroundColor: theme.pillBg }]}
                  onPress={() => setPayingDebt(null)}
                >
                  <Text style={{ color: theme.onSurface, fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dialogBtn, { backgroundColor: theme.primary }]}
                  onPress={handleConfirmPayment}
                >
                  <Text style={{ color: theme.onPrimary, fontWeight: '700' }}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Calendar Picker for Date / Due Date */}
        <CalendarPickerModal
          visible={pickerTarget !== null}
          selectedDate={pickerTarget === 'due_date' ? dueDateStr || dateStr : dateStr}
          theme={theme}
          onClose={() => setPickerTarget(null)}
          onSelectDate={(selected) => {
            if (pickerTarget === 'due_date') setDueDateStr(selected);
            else setDateStr(selected);
            setPickerTarget(null);
          }}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  iconBtn: { padding: 4 },
  headerTitle: { fontSize: 19, fontWeight: '800' },
  headerSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: M3Shape.full,
    gap: 4,
  },
  addBtnText: { fontSize: 13, fontWeight: '800' },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  summaryCard: {
    flex: 1,
    padding: 14,
    borderRadius: M3Shape.large,
    borderWidth: 1,
  },
  summaryIconRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  summaryLabel: { fontSize: 12.5, fontWeight: '700' },
  summaryAmount: { fontSize: 18, fontWeight: '800' },
  filterRow: { gap: 8, paddingBottom: 14 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: M3Shape.full,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 12.5, fontWeight: '700' },
  emptyCard: {
    alignItems: 'center',
    padding: 28,
    borderRadius: M3Shape.extraLarge,
    borderWidth: 1,
    marginTop: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginTop: 12 },
  emptySub: { fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  emptyActionBtn: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: M3Shape.full,
  },
  emptyActionText: { fontSize: 13.5, fontWeight: '800' },
  debtCard: {
    borderRadius: M3Shape.large,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  debtTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '800' },
  personName: { fontSize: 15.5, fontWeight: '800' },
  typePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: M3Shape.full },
  typePillText: { fontSize: 10.5, fontWeight: '800' },
  metaText: { fontSize: 11.5, fontWeight: '500', marginTop: 2 },
  remainingAmount: { fontSize: 15.5, fontWeight: '800' },
  totalSmall: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  noteText: { fontSize: 12.5, marginTop: 8 },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 10,
  },
  progressFill: { height: '100%', borderRadius: 3 },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: M3Shape.small,
    gap: 4,
  },
  cardActionText: { fontSize: 12, fontWeight: '700' },
  settledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: M3Shape.full,
    gap: 4,
  },
  settledBadgeText: { fontSize: 12, fontWeight: '700' },
  iconAction: { padding: 6 },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: M3Shape.extraLarge,
    borderTopRightRadius: M3Shape.extraLarge,
    padding: 20,
    maxHeight: '88%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800' },
  typeToggleRow: {
    flexDirection: 'row',
    borderRadius: M3Shape.medium,
    padding: 4,
    marginBottom: 14,
    gap: 4,
  },
  typeToggleBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: M3Shape.small,
  },
  typeToggleText: { fontSize: 13, fontWeight: '800' },
  inputLabel: { fontSize: 11, fontWeight: '800', marginBottom: 6, letterSpacing: 0.4 },
  textInput: {
    borderRadius: M3Shape.medium,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14.5,
    fontWeight: '600',
    marginBottom: 12,
  },
  amountField: { fontSize: 20, fontWeight: '800' },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  splitHint: { fontSize: 12, fontWeight: '600' },
  splitChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: M3Shape.full,
    borderWidth: 1,
  },
  splitChipText: { fontSize: 12.5, fontWeight: '800' },
  datesRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  dateChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: M3Shape.medium,
    borderWidth: 1,
    gap: 6,
  },
  dateChipText: { fontSize: 12, fontWeight: '700', flex: 1 },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: M3Shape.full,
    borderWidth: 1,
    gap: 6,
  },
  saveBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: M3Shape.full,
    marginTop: 6,
  },
  saveBtnText: { fontSize: 15, fontWeight: '800' },
  centerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  paymentDialog: {
    borderRadius: M3Shape.extraLarge,
    padding: 20,
  },
  dialogTitle: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  dialogSub: { fontSize: 13, marginBottom: 14 },
  dialogBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  dialogBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: M3Shape.full,
  },
});
