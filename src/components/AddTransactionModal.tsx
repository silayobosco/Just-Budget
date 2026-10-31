import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Dimensions,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBudget } from '../context/BudgetContext';
import { lightTheme, darkTheme, M3Shape, M3Elevation } from '../theme';
import { TransactionType } from '../types';
import { formatTypingNumber, formatCurrency } from '../utils/format';
import { CategoryManagerModal } from './CategoryManagerModal';

interface AddTransactionModalProps {
  visible: boolean;
  onClose: () => void;
  initialType?: TransactionType;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  visible,
  onClose,
  initialType = 'expense',
}) => {
  const {
    wallets,
    categories,
    transactions,
    addTransaction,
    addWallet,
    addSubcategory,
    settings,
    categoryBudgetProgressList,
    overallBudgetLimit,
    overallBudgetSpent,
  } = useBudget();
  const theme = settings.theme_mode === 'dark' ? darkTheme : lightTheme;

  const [type, setType] = useState<TransactionType>(initialType);
  const [amountStr, setAmountStr] = useState<string>('0');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState<string>('');

  // Quick Action Modals for the "+" buttons
  const [quickWalletModalVisible, setQuickWalletModalVisible] = useState(false);
  const [quickCategoryModalVisible, setQuickCategoryModalVisible] = useState(false);
  const [quickSubModalVisible, setQuickSubModalVisible] = useState(false);

  // Form states for quick actions
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletBal, setNewWalletBal] = useState('0');
  const [newSubName, setNewSubName] = useState('');

  useEffect(() => {
    if (visible) {
      setType(initialType);
      setAmountStr('0');
      setNote('');
      setDate(new Date().toISOString().slice(0, 10));
      if (wallets.length > 0) {
        const preferred =
          wallets.find((w) => w.currency === settings.base_currency) ||
          wallets.find((w) => w.is_default) ||
          wallets[0];
        setSelectedWalletId(preferred.id);
      }
      // Do not autoselect category or subcategory
      setSelectedCategoryId('');
      setSelectedSubcategoryId('');
    }
  }, [visible, initialType, wallets, categories]);

  // When type changes, clear category selection
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    setSelectedCategoryId('');
    setSelectedSubcategoryId('');
  };

  const handleCategorySelect = (catId: string) => {
    if (selectedCategoryId === catId) {
      setSelectedCategoryId('');
      setSelectedSubcategoryId('');
    } else {
      setSelectedCategoryId(catId);
      setSelectedSubcategoryId('');
    }
  };

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

    if (amountStr === '0') {
      setAmountStr(val);
    } else {
      // Limit to 2 decimal places if dot present
      const parts = amountStr.split('.');
      if (parts.length === 2 && parts[1].length >= 2) {
        return;
      }
      setAmountStr(amountStr + val);
    }
  };

  const selectedWallet = wallets.find((w) => w.id === selectedWalletId) || wallets[0];
  const activeCategories = categories.filter((c) => c.type === (type === 'income' ? 'income' : 'expense'));
  const currentCategory = categories.find((c) => c.id === selectedCategoryId);

  const parsedAmount = parseFloat(amountStr) || 0;
  const amountInBase = parsedAmount;

  // Warning 1: Insufficient Wallet Balance
  const isInsufficientWallet = React.useMemo(() => {
    if (type !== 'expense' || parsedAmount <= 0 || !selectedWallet) return false;
    return parsedAmount > selectedWallet.current_balance;
  }, [type, parsedAmount, selectedWallet]);

  // Warning 2: Possible Duplicate Entry
  const isDuplicate = React.useMemo(() => {
    if (parsedAmount <= 0 || !selectedWalletId) return false;
    return transactions.some((t) => {
      const matchDate = t.date === date;
      const matchWallet = t.wallet_id === selectedWalletId;
      const matchType = t.type === type;
      const matchAmount = Math.abs(t.amount - parsedAmount) < 0.001;
      const matchCat = (t.category_id || '') === (selectedCategoryId || '');
      const matchSub = (t.subcategory_id || '') === (selectedSubcategoryId || '');
      return matchDate && matchWallet && matchType && matchAmount && matchCat && matchSub;
    });
  }, [
    transactions,
    date,
    selectedWalletId,
    type,
    parsedAmount,
    selectedCategoryId,
    selectedSubcategoryId,
  ]);

  // Warning 3: Budget Impact (Overall, Category, Subcategory)
  const budgetAlerts = React.useMemo(() => {
    if (type !== 'expense' || amountInBase <= 0) return null;

    const overMessages: string[] = [];
    const nearMessages: string[] = [];

    // Find category progress
    const catProgress = categoryBudgetProgressList.find((c) => c.id === selectedCategoryId);

    // 1. Subcategory check
    if (selectedSubcategoryId && catProgress?.subBudgets) {
      const sub = catProgress.subBudgets.find((s) => s.id === selectedSubcategoryId);
      if (sub && sub.limit > 0) {
        const nextSpent = sub.spent + amountInBase;
        const pct = Math.round((nextSpent / sub.limit) * 100);
        if (nextSpent > sub.limit) {
          const excess = nextSpent - sub.limit;
          overMessages.push(
            `Subcategory "${sub.name}" exceeds limit by ${formatCurrency(excess, settings.base_currency)} (${pct}%)`
          );
        } else if (pct >= 80) {
          nearMessages.push(
            `Subcategory "${sub.name}" reaches ${pct}% of limit (${formatCurrency(nextSpent, settings.base_currency)} / ${formatCurrency(sub.limit, settings.base_currency)})`
          );
        }
      }
    }

    // 2. Category check
    if (catProgress && catProgress.limit > 0) {
      const nextSpent = catProgress.spent + amountInBase;
      const pct = Math.round((nextSpent / catProgress.limit) * 100);
      if (nextSpent > catProgress.limit) {
        const excess = nextSpent - catProgress.limit;
        overMessages.push(
          `Category "${catProgress.name}" exceeds budget by ${formatCurrency(excess, settings.base_currency)} (${pct}%)`
        );
      } else if (pct >= 80) {
        nearMessages.push(
          `Category "${catProgress.name}" reaches ${pct}% of budget (${formatCurrency(nextSpent, settings.base_currency)} / ${formatCurrency(catProgress.limit, settings.base_currency)})`
        );
      }
    }

    // 3. Overall budget check
    if (overallBudgetLimit > 0) {
      const nextSpent = overallBudgetSpent + amountInBase;
      const pct = Math.round((nextSpent / overallBudgetLimit) * 100);
      if (nextSpent > overallBudgetLimit) {
        const excess = nextSpent - overallBudgetLimit;
        overMessages.push(
          `Overall cycle budget exceeded by ${formatCurrency(excess, settings.base_currency)} (${pct}%)`
        );
      } else if (pct >= 80) {
        nearMessages.push(
          `Overall cycle budget reaches ${pct}% (${formatCurrency(nextSpent, settings.base_currency)} / ${formatCurrency(overallBudgetLimit, settings.base_currency)})`
        );
      }
    }

    if (overMessages.length === 0 && nearMessages.length === 0) return null;

    return {
      isOver: overMessages.length > 0,
      messages: overMessages.length > 0 ? overMessages : nearMessages,
    };
  }, [
    type,
    amountInBase,
    selectedCategoryId,
    selectedSubcategoryId,
    categoryBudgetProgressList,
    overallBudgetLimit,
    overallBudgetSpent,
    settings.base_currency,
  ]);

  const submitTransaction = async (numAmount: number) => {
    if (!selectedWallet) return;

    await addTransaction({
      wallet_id: selectedWallet.id,
      category_id: selectedCategoryId || undefined,
      subcategory_id: selectedSubcategoryId || undefined,
      type,
      amount: numAmount,
      currency: settings.base_currency,
      date,
      note: note.trim() || undefined,
    });

    onClose();
  };

  const handleSave = async () => {
    const numAmount = parseFloat(amountStr);
    if (isNaN(numAmount) || numAmount <= 0) return;
    if (!selectedWallet) return;

    if (isDuplicate) {
      Alert.alert(
        'Possible Duplicate Entry',
        `An identical ${type} of ${formatCurrency(numAmount, settings.base_currency)} in ${selectedWallet.name} was already recorded for today. Do you want to add it anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Anyway', onPress: () => submitTransaction(numAmount) },
        ]
      );
      return;
    }

    await submitTransaction(numAmount);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.pillBg }]}>
              <MaterialCommunityIcons name="close" size={20} color={theme.onSurface} />
            </TouchableOpacity>

            {/* Type Selector (Expense / Income) */}
            <View style={[styles.typePillContainer, { backgroundColor: theme.pillBg }]}>
              <TouchableOpacity
                style={[
                  styles.typePill,
                  type === 'expense' && { backgroundColor: theme.errorContainer },
                ]}
                onPress={() => handleTypeChange('expense')}
              >
                <Text
                  style={[
                    styles.typeText,
                    {
                      color: type === 'expense' ? theme.onErrorContainer : theme.onSurfaceVariant,
                      fontWeight: type === 'expense' ? '700' : '500',
                    },
                  ]}
                >
                  Expense
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typePill,
                  type === 'income' && { backgroundColor: theme.successContainer },
                ]}
                onPress={() => handleTypeChange('income')}
              >
                <Text
                  style={[
                    styles.typeText,
                    {
                      color: type === 'income' ? theme.onSuccessContainer : theme.onSurfaceVariant,
                      fontWeight: type === 'income' ? '700' : '500',
                    },
                  ]}
                >
                  Income
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ width: 36 }} />
          </View>

          {/* Amount Display */}
          <View style={styles.amountContainer}>
            <Text style={[styles.currencySymbol, { color: theme.onSurfaceVariant }]}>
              {selectedWallet?.currency || settings.base_currency}
            </Text>
            <Text
              style={[
                styles.amountText,
                { color: type === 'expense' ? theme.error : theme.success },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatTypingNumber(amountStr)}
            </Text>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Warning: Possible Duplicate Entry */}
            {isDuplicate && (
              <View style={[styles.warningBanner, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
                <View style={styles.warningHeader}>
                  <MaterialCommunityIcons name="content-copy" size={18} color="#D97706" />
                  <Text style={[styles.warningTitle, { color: '#92400E' }]}>
                    Possible Duplicate Entry
                  </Text>
                </View>
                <Text style={[styles.warningText, { color: '#B45309' }]}>
                  An identical {type} of {formatCurrency(parsedAmount, settings.base_currency)} in {selectedWallet?.name} was already recorded today.
                </Text>
              </View>
            )}

            {/* Warning 1: Insufficient Wallet Balance */}
            {isInsufficientWallet && selectedWallet && (
              <View style={[styles.warningBanner, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]}>
                <View style={styles.warningHeader}>
                  <MaterialCommunityIcons name="wallet-outline" size={18} color="#DC2626" />
                  <Text style={[styles.warningTitle, { color: '#991B1B' }]}>
                    Insufficient Wallet Balance
                  </Text>
                </View>
                <Text style={[styles.warningText, { color: '#B91C1C' }]}>
                  {selectedWallet.name} has only {formatCurrency(selectedWallet.current_balance, selectedWallet.currency)}, which is less than {formatCurrency(parsedAmount, selectedWallet.currency)}.
                </Text>
              </View>
            )}

            {/* Warning 2: Budget Impact (Over Budget or 80%+ Warning) */}
            {budgetAlerts && (
              <View
                style={[
                  styles.warningBanner,
                  budgetAlerts.isOver
                    ? { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }
                    : { backgroundColor: '#FFFBEB', borderColor: '#FCD34D' },
                ]}
              >
                <View style={styles.warningHeader}>
                  <MaterialCommunityIcons
                    name={budgetAlerts.isOver ? 'alert-octagon' : 'alert-circle-outline'}
                    size={18}
                    color={budgetAlerts.isOver ? '#DC2626' : '#D97706'}
                  />
                  <Text
                    style={[
                      styles.warningTitle,
                      { color: budgetAlerts.isOver ? '#991B1B' : '#92400E' },
                    ]}
                  >
                    {budgetAlerts.isOver ? 'Over Budget Warning' : 'Budget Warning (80%+ Limit)'}
                  </Text>
                </View>
                {budgetAlerts.messages.map((msg, idx) => (
                  <Text
                    key={idx}
                    style={[
                      styles.warningText,
                      { color: budgetAlerts.isOver ? '#B91C1C' : '#B45309' },
                    ]}
                  >
                    • {msg}
                  </Text>
                ))}
              </View>
            )}

            {/* Wallet Selection */}
            <Text style={[styles.sectionTitle, { color: theme.onSurfaceVariant }]}>WALLET</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              {wallets.map((w) => {
                const isSelected = w.id === selectedWalletId;
                return (
                  <TouchableOpacity
                    key={w.id}
                    style={[
                      styles.walletChip,
                      {
                        backgroundColor: isSelected ? theme.primaryContainer : theme.pillBg,
                        borderColor: isSelected ? theme.primary : 'transparent',
                      },
                    ]}
                    onPress={() => setSelectedWalletId(w.id)}
                  >
                    <View style={[styles.walletDot, { backgroundColor: w.color }]} />
                    <Text
                      style={[
                        styles.walletChipText,
                        {
                          color: isSelected ? theme.onPrimaryContainer : theme.onSurface,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {w.name} ({w.currency})
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {/* + Quick Add Wallet */}
              <TouchableOpacity
                style={[styles.addInlineChip, { backgroundColor: theme.primaryContainer }]}
                onPress={() => {
                  setNewWalletName('');
                  setNewWalletBal('0');
                  setQuickWalletModalVisible(true);
                }}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="plus" size={16} color={theme.onPrimaryContainer} />
                <Text style={[styles.addInlineChipText, { color: theme.onPrimaryContainer }]}>Wallet</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Category Selection */}
            <Text style={[styles.sectionTitle, { color: theme.onSurfaceVariant }]}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              {activeCategories.map((c) => {
                const isSelected = c.id === selectedCategoryId;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: isSelected ? c.color : theme.pillBg,
                      },
                    ]}
                    onPress={() => handleCategorySelect(c.id)}
                  >
                    <MaterialCommunityIcons
                      name={c.icon as any}
                      size={18}
                      color={isSelected ? '#FFFFFF' : theme.onSurface}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
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

              {/* + Quick Manage / Add Category */}
              <TouchableOpacity
                style={[styles.addInlineChip, { backgroundColor: theme.primaryContainer }]}
                onPress={() => setQuickCategoryModalVisible(true)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="plus" size={16} color={theme.onPrimaryContainer} />
                <Text style={[styles.addInlineChipText, { color: theme.onPrimaryContainer }]}>Category</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Subcategory Selection */}
            {selectedCategoryId ? (
              <>
                <Text style={[styles.sectionTitle, { color: theme.onSurfaceVariant }]}>SUBCATEGORY</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                  {currentCategory?.subcategories?.map((s) => {
                    const isSelected = s.id === selectedSubcategoryId;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[
                          styles.subChip,
                          {
                            backgroundColor: isSelected ? theme.secondaryContainer : theme.pillBg,
                          },
                        ]}
                        onPress={() => setSelectedSubcategoryId(s.id)}
                      >
                        <Text
                          style={[
                            styles.subChipText,
                            {
                              color: isSelected ? theme.onSecondaryContainer : theme.onSurfaceVariant,
                              fontWeight: isSelected ? '700' : '400',
                            },
                          ]}
                        >
                          {s.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  {/* + Quick Add Subcategory */}
                  <TouchableOpacity
                    style={[styles.addInlineChip, { backgroundColor: theme.secondaryContainer }]}
                    onPress={() => {
                      setNewSubName('');
                      setQuickSubModalVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="plus" size={16} color={theme.onSecondaryContainer} />
                    <Text style={[styles.addInlineChipText, { color: theme.onSecondaryContainer }]}>Sub</Text>
                  </TouchableOpacity>
                </ScrollView>
              </>
            ) : null}

            {/* Note Input */}
            <View style={[styles.inputRow, { backgroundColor: theme.pillBg }]}>
              <MaterialCommunityIcons name="note-text-outline" size={18} color={theme.onSurfaceVariant} />
              <TextInput
                style={[styles.textInput, { color: theme.onSurface }]}
                placeholder="Add a note (optional)..."
                placeholderTextColor={theme.onSurfaceVariant}
                value={note}
                onChangeText={setNote}
              />
            </View>
          </ScrollView>

          {/* Expressive Numeric Keypad */}
          <View style={[styles.keypad, { borderTopColor: theme.divider }]}>
            {[
              ['1', '2', '3'],
              ['4', '5', '6'],
              ['7', '8', '9'],
              ['.', '0', 'backspace'],
            ].map((row, rIdx) => (
              <View key={rIdx} style={styles.keypadRow}>
                {row.map((k) => (
                  <TouchableOpacity
                    key={k}
                    style={[styles.keyButton, { backgroundColor: theme.pillBg }]}
                    onPress={() => handleKeyPress(k)}
                    activeOpacity={0.6}
                  >
                    {k === 'backspace' ? (
                      <MaterialCommunityIcons name="backspace-outline" size={24} color={theme.onSurface} />
                    ) : (
                      <Text style={[styles.keyText, { color: theme.onSurface }]}>{k}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            {/* Confirm Button */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                {
                  backgroundColor: parseFloat(amountStr) > 0 ? theme.primary : theme.divider,
                },
              ]}
              onPress={handleSave}
              disabled={parseFloat(amountStr) <= 0}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="check" size={24} color={theme.onPrimary} />
              <Text style={[styles.saveText, { color: theme.onPrimary }]}>
                Record {type === 'expense' ? 'Expense' : 'Income'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* QUICK ADD WALLET MODAL */}
      <Modal visible={quickWalletModalVisible} transparent animationType="fade" onRequestClose={() => setQuickWalletModalVisible(false)}>
        <View style={styles.inlineModalOverlay}>
          <View style={[styles.inlineModalBox, { backgroundColor: theme.surface }]}>
            <View style={styles.inlineModalHeader}>
              <Text style={[styles.inlineModalTitle, { color: theme.onSurface }]}>New Wallet</Text>
              <TouchableOpacity onPress={() => setQuickWalletModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={20} color={theme.onSurface} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inlineModalLabel, { color: theme.onSurfaceVariant }]}>Wallet Name</Text>
            <TextInput
              style={[styles.inlineModalInput, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
              placeholder="e.g. M-Pesa, Cash, Bank"
              placeholderTextColor={theme.onSurfaceVariant}
              value={newWalletName}
              onChangeText={setNewWalletName}
              autoFocus
            />

            <Text style={[styles.inlineModalLabel, { color: theme.onSurfaceVariant }]}>
              Starting Balance ({settings.base_currency})
            </Text>
            <TextInput
              style={[styles.inlineModalInput, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={theme.onSurfaceVariant}
              value={newWalletBal}
              onChangeText={setNewWalletBal}
            />

            <View style={styles.inlineModalActions}>
              <TouchableOpacity
                style={[styles.inlineCancelBtn, { backgroundColor: theme.pillBg }]}
                onPress={() => setQuickWalletModalVisible(false)}
              >
                <Text style={{ color: theme.onSurface, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.inlineSaveBtn, { backgroundColor: theme.primary }]}
                onPress={async () => {
                  if (!newWalletName.trim()) return;
                  const startBal = parseFloat(newWalletBal) || 0;
                  await addWallet({
                    name: newWalletName.trim(),
                    currency: settings.base_currency,
                    starting_balance: startBal,
                    color: '#10B981',
                    icon: 'wallet',
                  });
                  setQuickWalletModalVisible(false);
                }}
              >
                <Text style={{ color: theme.onPrimary, fontWeight: '700' }}>Create Wallet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* QUICK ADD SUBCATEGORY MODAL */}
      <Modal visible={quickSubModalVisible} transparent animationType="fade" onRequestClose={() => setQuickSubModalVisible(false)}>
        <View style={styles.inlineModalOverlay}>
          <View style={[styles.inlineModalBox, { backgroundColor: theme.surface }]}>
            <View style={styles.inlineModalHeader}>
              <Text style={[styles.inlineModalTitle, { color: theme.onSurface }]}>
                Add Subcategory to {currentCategory?.name || 'Category'}
              </Text>
              <TouchableOpacity onPress={() => setQuickSubModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={20} color={theme.onSurface} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.inlineModalInput, { backgroundColor: theme.pillBg, color: theme.onSurface, marginTop: 12 }]}
              placeholder="e.g. Snacks, Coffee, Fruits"
              placeholderTextColor={theme.onSurfaceVariant}
              value={newSubName}
              onChangeText={setNewSubName}
              autoFocus
            />

            <View style={styles.inlineModalActions}>
              <TouchableOpacity
                style={[styles.inlineCancelBtn, { backgroundColor: theme.pillBg }]}
                onPress={() => setQuickSubModalVisible(false)}
              >
                <Text style={{ color: theme.onSurface, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.inlineSaveBtn, { backgroundColor: theme.primary }]}
                onPress={async () => {
                  if (!newSubName.trim() || !selectedCategoryId) return;
                  await addSubcategory(selectedCategoryId, newSubName.trim());
                  setQuickSubModalVisible(false);
                }}
              >
                <Text style={{ color: theme.onPrimary, fontWeight: '700' }}>Add Subcategory</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* CATEGORY MANAGER MODAL JUMP */}
      <CategoryManagerModal
        visible={quickCategoryModalVisible}
        onClose={() => setQuickCategoryModalVisible(false)}
      />
    </Modal>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: M3Shape.extraLarge,
    borderTopRightRadius: M3Shape.extraLarge,
    maxHeight: '92%',
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: M3Shape.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typePillContainer: {
    flexDirection: 'row',
    borderRadius: M3Shape.full,
    padding: 3,
  },
  typePill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: M3Shape.full,
  },
  typeText: {
    fontSize: 13,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '700',
  },
  amountText: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1,
  },
  scrollContent: {
    maxHeight: 180,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 6,
  },
  horizontalScroll: {
    marginBottom: 8,
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: M3Shape.full,
    marginRight: 8,
    borderWidth: 1.5,
    gap: 6,
  },
  walletDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  walletChipText: {
    fontSize: 13,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: M3Shape.full,
    marginRight: 8,
    gap: 6,
  },
  categoryChipText: {
    fontSize: 13,
  },
  subChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: M3Shape.full,
    marginRight: 6,
  },
  subChipText: {
    fontSize: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: M3Shape.large,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginVertical: 8,
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  keypad: {
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 10,
  },
  keyButton: {
    flex: 1,
    height: 48,
    borderRadius: M3Shape.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 22,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    height: 52,
    borderRadius: M3Shape.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    gap: 8,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '700',
  },
  addInlineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: M3Shape.full,
    marginRight: 8,
    gap: 4,
  },
  addInlineChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  inlineModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  inlineModalBox: {
    borderRadius: M3Shape.extraLarge,
    padding: 20,
  },
  inlineModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  inlineModalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  inlineModalLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
  },
  inlineModalInput: {
    height: 42,
    borderRadius: M3Shape.medium,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  inlineModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  inlineCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: M3Shape.full,
  },
  inlineSaveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: M3Shape.full,
  },
  warningBanner: {
    padding: 12,
    borderRadius: M3Shape.medium,
    borderWidth: 1,
    marginBottom: 12,
    gap: 4,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  warningText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
});
