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
// In collapsed state: ONLY today's balance + expense|income switcher + drag handle are visible (~152px)
// In expanded state: pulls down to reveal Recent Activity list (~76% of screen height)
const COLLAPSED_SHEET_HEIGHT = 152;
const EXPANDED_SHEET_HEIGHT = Math.min(580, Math.round(SCREEN_HEIGHT * 0.76));

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
  const [dateStr] = useState<string>(new Date().toISOString().slice(0, 10));

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

  // ==============================================================
  // TOP SHEET PULL-DOWN GESTURE & ANIMATION
  // ==============================================================
  const animatedHeight = useRef(new Animated.Value(COLLAPSED_SHEET_HEIGHT)).current;
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const isExpandedRef = useRef(false);
  const currentHeightRef = useRef(COLLAPSED_SHEET_HEIGHT);

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
      toValue: EXPANDED_SHEET_HEIGHT,
      useNativeDriver: false,
      bounciness: 3,
      speed: 14,
    }).start();
    setIsSheetExpanded(true);
    isExpandedRef.current = true;
  };

  const closeSheet = () => {
    Animated.spring(animatedHeight, {
      toValue: COLLAPSED_SHEET_HEIGHT,
      useNativeDriver: false,
      bounciness: 3,
      speed: 14,
    }).start();
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

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderGrant: () => {},
      onPanResponderMove: (_, gestureState) => {
        const baseH = isExpandedRef.current ? EXPANDED_SHEET_HEIGHT : COLLAPSED_SHEET_HEIGHT;
        let nextH = baseH + gestureState.dy;
        if (nextH < COLLAPSED_SHEET_HEIGHT) {
          nextH = COLLAPSED_SHEET_HEIGHT;
        } else if (nextH > EXPANDED_SHEET_HEIGHT) {
          nextH = EXPANDED_SHEET_HEIGHT + (nextH - EXPANDED_SHEET_HEIGHT) * 0.2;
        }
        animatedHeight.setValue(nextH);
      },
      onPanResponderRelease: (_, gestureState) => {
        const currentH = currentHeightRef.current;
        const threshold = (COLLAPSED_SHEET_HEIGHT + EXPANDED_SHEET_HEIGHT) / 2;

        if (
          gestureState.vy > 0.4 ||
          (!isExpandedRef.current && gestureState.dy > 35) ||
          currentH > threshold
        ) {
          openSheet();
        } else {
          closeSheet();
        }
      },
    })
  ).current;

  // Group transactions by date with total spent/income that day
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

        groups.push({
          date: d,
          displayDate,
          totalSpent: daySpent,
          totalIncome: dayIncome,
          items,
        });
      });

    return groups;
  }, [transactions]);

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

        {/* 2B. RECENT ACTIVITY LIST (REVEALED WHEN SHEET PULLS DOWN) */}
        <View style={styles.activityContentWrapper}>
          <View style={[styles.historyHeader, { borderBottomColor: theme.divider }]}>
            <View>
              <Text style={[styles.historyTitle, { color: theme.onSurface }]}>Recent Activity</Text>
              <Text style={[styles.historySubtitle, { color: theme.onSurfaceVariant }]}>
                Grouped by date • swipe up or tap handle to close
              </Text>
            </View>
            <TouchableOpacity onPress={closeSheet} style={styles.closeSheetBtn}>
              <MaterialCommunityIcons name="chevron-up" size={20} color={theme.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          {groupedTransactions.length === 0 ? (
            <View style={styles.emptyHistoryBox}>
              <MaterialCommunityIcons
                name="receipt-text-outline"
                size={42}
                color={theme.outlineVariant}
              />
              <Text style={[styles.emptyHistoryText, { color: theme.onSurfaceVariant }]}>
                No transactions recorded yet
              </Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.historyScrollContent}
              nestedScrollEnabled={true}
            >
              {groupedTransactions.map((group) => (
                <View key={group.date} style={styles.dateGroupContainer}>
                  {/* Date Group Header with Day's Total */}
                  <View style={[styles.dateGroupHeaderRow, { borderBottomColor: theme.divider }]}>
                    <Text style={[styles.dateGroupTitle, { color: theme.onSurface }]}>
                      {group.displayDate}
                    </Text>
                    <View style={styles.dateGroupTotalsRow}>
                      {group.totalSpent > 0 && (
                        <Text style={[styles.daySpentPill, { color: theme.error }]}>
                          Spent: {formatCurrency(group.totalSpent, curr)}
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
                  {group.items.map((tx) => {
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
              ))}
            </ScrollView>
          )}
        </View>

        {/* 2C. DRAG HANDLE BAR AT BOTTOM OF TOP SHEET */}
        <View {...panResponder.panHandlers} style={[styles.dragHandleArea, { borderTopColor: theme.divider }]}>
          <TouchableOpacity onPress={toggleSheet} activeOpacity={0.8} style={styles.dragHandleTouch}>
            <View style={[styles.dragHandlePill, { backgroundColor: theme.outlineVariant }]} />
            <View style={styles.dragHandleHintRow}>
              <MaterialCommunityIcons
                name={isSheetExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={theme.onSurfaceVariant}
              />
              <Text style={[styles.dragHandleHintText, { color: theme.onSurfaceVariant }]}>
                {isSheetExpanded ? 'Slide up for dial pad' : 'Pull down for recent activity'}
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
    paddingBottom: 4,
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
    marginBottom: 36, // leaves room for absolute drag handle at bottom
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  historyTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  historySubtitle: {
    fontSize: 10.5,
    fontWeight: '500',
    marginTop: 2,
  },
  closeSheetBtn: {
    padding: 6,
  },
  emptyHistoryBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyHistoryText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  historyScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
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
});
