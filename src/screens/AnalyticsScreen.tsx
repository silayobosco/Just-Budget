import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  Pressable,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBudget } from '../context/BudgetContext';
import { lightTheme, darkTheme, M3Shape, M3Elevation } from '../theme';
import { formatCurrency } from '../utils/format';
import { TransactionType } from '../types';
import { CategoryPickerSheet } from '../components/CategoryPickerSheet';
import { TransactionDetailsModal } from '../components/TransactionDetailsModal';

export const AnalyticsScreen: React.FC = () => {
  const {
    settings,
    transactions,
    categories,
    wallets,
    addTransaction,
    addSubcategory,
    currentCycle,
    selectedAnalyticsCycle,
    setSelectedAnalyticsCycle,
    spentInCycle,
    incomeInCycle,
    overallBudgetLimit,
    incomeGoal,
    dailyAllowanceStats,
    analyticsFocus,
    setAnalyticsFocus,
    openCycleModal,
  } = useBudget();

  const isDarkMode = settings.theme_mode === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;
  const [scope, setScope] = useState<'cycle' | 'all'>('cycle');
  const curr = settings.base_currency;
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Floating Action Button (FAB) Speed-Dial & Add Transaction Modal states
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [addCategorySheetVisible, setAddCategorySheetVisible] = useState(false);
  const [addPrefilledCategoryId, setAddPrefilledCategoryId] = useState<string | undefined>(undefined);
  const [addPrefilledSubcategoryId, setAddPrefilledSubcategoryId] = useState<string | undefined>(undefined);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addModalType, setAddModalType] = useState<TransactionType>('expense');
  const fabAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(fabAnim, {
      toValue: isFabOpen ? 1 : 0,
      useNativeDriver: true,
      tension: 65,
      friction: 10,
    }).start();
  }, [isFabOpen]);

  const fabRotate = fabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const speedDialTranslateY = fabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  const speedDialScale = fabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });

  const speedDialOpacity = fabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const handleOpenAddFlow = (type: TransactionType) => {
    setIsFabOpen(false);
    setAddModalType(type);
    setAddPrefilledCategoryId(undefined);
    setAddPrefilledSubcategoryId(undefined);
    setAddCategorySheetVisible(true);
  };

  const handleCategorySelectedForAdd = ({
    categoryId,
    subcategoryId,
  }: {
    categoryId?: string;
    subcategoryId?: string;
  }) => {
    setAddPrefilledCategoryId(categoryId);
    setAddPrefilledSubcategoryId(subcategoryId);
    setAddCategorySheetVisible(false);
    setTimeout(() => {
      setAddModalVisible(true);
    }, 280);
  };

  const handleSaveNewTransaction = async (txData: {
    amount: number;
    wallet_id: string;
    category_id?: string;
    subcategory_id?: string;
    type: TransactionType;
    currency: string;
    date: string;
    time?: string;
    is_paid: boolean;
    note?: string;
    media_uri?: string;
  }) => {
    await addTransaction({
      wallet_id: txData.wallet_id || wallets[0]?.id || '',
      category_id: txData.category_id,
      subcategory_id: txData.subcategory_id,
      type: txData.type,
      amount: txData.amount,
      currency: txData.currency,
      date: txData.date,
      time: txData.time,
      is_paid: txData.is_paid,
      note: txData.note,
      media_uri: txData.media_uri,
    });
    setAddModalVisible(false);
  };

  // Budget Cap Progress for Record Expense Badge
  const expenseSwitcherProgress = useMemo(() => {
    const hasTarget = overallBudgetLimit > 0;
    const percent = hasTarget ? Math.round((spentInCycle / overallBudgetLimit) * 100) : 0;
    const isOver = hasTarget && spentInCycle > overallBudgetLimit;
    const remaining = Math.max(0, overallBudgetLimit - spentInCycle);
    const overBy = Math.max(0, spentInCycle - overallBudgetLimit);

    return {
      hasTarget,
      percent,
      isOver,
      remaining,
      overBy,
    };
  }, [overallBudgetLimit, spentInCycle]);

  // Income Goal Progress for Record Income Badge
  const incomeSwitcherProgress = useMemo(() => {
    const goal = currentCycle?.target_income && currentCycle.target_income > 0 ? currentCycle.target_income : 0;
    const hasGoal = goal > 0;
    const percent = hasGoal ? Math.round((incomeInCycle / goal) * 100) : 0;
    const isReached = hasGoal && incomeInCycle >= goal;
    const remaining = Math.max(0, goal - incomeInCycle);

    return {
      hasGoal,
      percent,
      isReached,
      remaining,
    };
  }, [currentCycle, incomeInCycle]);

  // Effective cycle being analyzed
  const effectiveCycle = selectedAnalyticsCycle || currentCycle;

  // Filtered transactions by scope
  const activeTransactions = useMemo(() => {
    if (scope === 'cycle' && effectiveCycle?.start_date && effectiveCycle?.end_date) {
      return transactions.filter(
        (t) => t.date >= effectiveCycle.start_date && t.date <= effectiveCycle.end_date
      );
    }
    return transactions;
  }, [scope, effectiveCycle, transactions]);

  // Expenses and Incomes
  const totalExpense = useMemo(() => {
    return activeTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount || t.base_amount || 0), 0);
  }, [activeTransactions]);

  const totalIncome = useMemo(() => {
    return activeTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + (t.amount || t.base_amount || 0), 0);
  }, [activeTransactions]);

  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((netSavings / totalIncome) * 100)) : 0;

  // Category spending breakdown (Expense)
  const categorySpending = useMemo(() => {
    const map: Record<string, { categoryName: string; color: string; icon: string; amount: number; count: number }> = {};

    activeTransactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const cat = categories.find((c) => c.id === t.category_id);
        const catId = cat ? cat.id : 'other';
        const name = cat ? cat.name : 'Uncategorized';
        const color = cat ? cat.color : '#9E9E9E';
        const icon = cat ? cat.icon : 'help-circle-outline';

        if (!map[catId]) {
          map[catId] = { categoryName: name, color, icon, amount: 0, count: 0 };
        }
        map[catId].amount += (t.amount || t.base_amount || 0);
        map[catId].count += 1;
      });

    return Object.values(map).sort((a, b) => b.amount - a.amount);
  }, [activeTransactions, categories]);

  // Category income breakdown (Income)
  const categoryIncome = useMemo(() => {
    const map: Record<string, { categoryName: string; color: string; icon: string; amount: number; count: number }> = {};

    activeTransactions
      .filter((t) => t.type === 'income')
      .forEach((t) => {
        const cat = categories.find((c) => c.id === t.category_id);
        const catId = cat ? cat.id : 'other-inc';
        const name = cat ? cat.name : 'Other Inflow';
        const color = cat ? cat.color : '#10B981';
        const icon = cat ? cat.icon : 'cash-plus';

        if (!map[catId]) {
          map[catId] = { categoryName: name, color, icon, amount: 0, count: 0 };
        }
        map[catId].amount += (t.amount || t.base_amount || 0);
        map[catId].count += 1;
      });

    return Object.values(map).sort((a, b) => b.amount - a.amount);
  }, [activeTransactions, categories]);

  // Daily average spending calculation
  const dailyAverageSpend = useMemo(() => {
    const expenseDays = new Set(activeTransactions.filter((t) => t.type === 'expense').map((t) => t.date));
    const count = Math.max(1, expenseDays.size);
    return totalExpense / count;
  }, [activeTransactions, totalExpense]);

  // Target metrics for analyzer
  const effectiveBudget = effectiveCycle?.target_budget ?? overallBudgetLimit;
  const budgetSpent = scope === 'cycle' ? totalExpense : totalExpense;
  const budgetRemaining = effectiveBudget - budgetSpent;
  const budgetPercent = effectiveBudget > 0 ? Math.round((budgetSpent / effectiveBudget) * 100) : 0;
  const isBudgetOver = effectiveBudget > 0 && budgetSpent > effectiveBudget;

  const effectiveIncomeGoal = effectiveCycle?.target_income ?? incomeGoal;
  const incomeEarned = scope === 'cycle' ? totalIncome : totalIncome;
  const incomeRemainingToGo = Math.max(0, effectiveIncomeGoal - incomeEarned);
  const incomePercent = effectiveIncomeGoal > 0 ? Math.round((incomeEarned / effectiveIncomeGoal) * 100) : 0;
  const isIncomeGoalReached = effectiveIncomeGoal > 0 && incomeEarned >= effectiveIncomeGoal;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* TOP ANALYZER SWITCHER BAR */}
        <View style={[styles.focusTabBar, { backgroundColor: theme.surfaceVariant }]}>
          <TouchableOpacity
            style={[styles.focusTabBtn, analyticsFocus === 'overview' && { backgroundColor: theme.primaryContainer }]}
            onPress={() => setAnalyticsFocus('overview')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="chart-timeline-variant-shimmer"
              size={15}
              color={analyticsFocus === 'overview' ? theme.onPrimaryContainer : theme.onSurfaceVariant}
            />
            <Text
              style={[
                styles.focusTabBtnText,
                { color: analyticsFocus === 'overview' ? theme.onPrimaryContainer : theme.onSurfaceVariant },
                analyticsFocus === 'overview' && { fontWeight: '700' },
              ]}
            >
              Cash Flow
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.focusTabBtn, analyticsFocus === 'expense' && { backgroundColor: theme.errorContainer }]}
            onPress={() => setAnalyticsFocus('expense')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="arrow-top-right"
              size={15}
              color={analyticsFocus === 'expense' ? theme.error : theme.onSurfaceVariant}
            />
            <Text
              style={[
                styles.focusTabBtnText,
                { color: analyticsFocus === 'expense' ? theme.error : theme.onSurfaceVariant },
                analyticsFocus === 'expense' && { fontWeight: '700' },
              ]}
            >
              Expense Analyzer
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.focusTabBtn, analyticsFocus === 'income' && { backgroundColor: theme.successContainer }]}
            onPress={() => setAnalyticsFocus('income')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="arrow-bottom-left"
              size={15}
              color={analyticsFocus === 'income' ? theme.success : theme.onSurfaceVariant}
            />
            <Text
              style={[
                styles.focusTabBtnText,
                { color: analyticsFocus === 'income' ? theme.success : theme.onSurfaceVariant },
                analyticsFocus === 'income' && { fontWeight: '700' },
              ]}
            >
              Income Analyzer
            </Text>
          </TouchableOpacity>
        </View>

        {/* SELECTED ANALYTICS CYCLE BANNER */}
        {selectedAnalyticsCycle && (
          <View
            style={[
              styles.selectedCycleAlert,
              { backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.2)' : theme.primaryContainer },
            ]}
          >
            <MaterialCommunityIcons name="chart-box-outline" size={16} color={theme.primary} />
            <Text
              style={[
                styles.selectedCycleAlertText,
                { color: isDarkMode ? '#C7D2FE' : theme.onPrimaryContainer },
              ]}
              numberOfLines={1}
            >
              Viewing: {effectiveCycle?.name || 'Cycle'}
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedAnalyticsCycle(null)}
              style={styles.selectedCycleAlertClearBtn}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 11, fontWeight: '800', color: theme.primary }}>✕ Reset</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* SCOPE TOGGLE PILL BAR */}
        <View style={[styles.scopeBar, { backgroundColor: theme.pillBg }]}>
          <TouchableOpacity
            style={[styles.scopePill, scope === 'cycle' && { backgroundColor: theme.primaryContainer }]}
            onPress={() => setScope('cycle')}
          >
            <Text
              style={[
                styles.scopePillText,
                {
                  color: scope === 'cycle' ? theme.onPrimaryContainer : theme.onSurfaceVariant,
                  fontWeight: scope === 'cycle' ? '700' : '500',
                },
              ]}
            >
              Cycle ({effectiveCycle?.name || 'Cycle'})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.scopePill, scope === 'all' && { backgroundColor: theme.primaryContainer }]}
            onPress={() => setScope('all')}
          >
            <Text
              style={[
                styles.scopePillText,
                {
                  color: scope === 'all' ? theme.onPrimaryContainer : theme.onSurfaceVariant,
                  fontWeight: scope === 'all' ? '700' : '500',
                },
              ]}
            >
              All Time
            </Text>
          </TouchableOpacity>
        </View>

        {/* 1. EXPENSE ANALYZER FOCUS VIEW */}
        {analyticsFocus === 'expense' && (
          <View style={styles.focusContainer}>
            {/* Target Budget Progress Card OR Prompt to Set */}
            {effectiveBudget <= 0 ? (
              <View style={[styles.analyzerCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}>
                <View style={styles.analyzerCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialCommunityIcons name="bullseye-arrow" size={20} color={theme.error} />
                    <Text style={[styles.cardHeading, { color: theme.onSurface, marginBottom: 0 }]}>
                      Budget Cap Analysis
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 13, color: theme.onSurfaceVariant, marginVertical: 6, lineHeight: 18 }}>
                  No budget cap set for this period. Set a budget cap to analyze your spending pace and remaining daily allowance.
                </Text>
                <TouchableOpacity
                  style={[styles.setGoalPromptBtn, { backgroundColor: theme.primaryContainer }]}
                  onPress={openCycleModal}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="plus" size={16} color={theme.onPrimaryContainer} />
                  <Text style={[styles.setGoalPromptText, { color: theme.onPrimaryContainer }]}>
                    Set Budget Cap
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.analyzerCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}>
                <View style={styles.analyzerCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialCommunityIcons name="bullseye-arrow" size={20} color={theme.error} />
                    <Text style={[styles.cardHeading, { color: theme.onSurface, marginBottom: 0 }]}>
                      Budget Cap Analysis
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.tagBadge,
                      { backgroundColor: isBudgetOver ? (isDarkMode ? 'rgba(239, 68, 68, 0.3)' : '#FEE2E2') : (isDarkMode ? 'rgba(16, 185, 129, 0.2)' : '#D1FAE5') },
                    ]}
                  >
                    <Text style={[styles.tagBadgeText, { color: isBudgetOver ? theme.error : theme.success }]}>
                      {budgetPercent}% Spent
                    </Text>
                  </View>
                </View>

                <View style={styles.metricGrid}>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: theme.onSurfaceVariant }]}>Total Spent</Text>
                    <Text style={[styles.metricValue, { color: isBudgetOver ? theme.error : theme.onSurface }]}>
                      {formatCurrency(budgetSpent, settings.base_currency)}
                    </Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: theme.onSurfaceVariant }]}>
                      {isBudgetOver ? 'Over Budget' : 'Remaining Left'}
                    </Text>
                    <Text style={[styles.metricValue, { color: isBudgetOver ? theme.error : theme.primary }]}>
                      {formatCurrency(Math.abs(budgetRemaining), settings.base_currency)}
                    </Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: theme.onSurfaceVariant }]}>Target Cap</Text>
                    <Text style={[styles.metricValue, { color: theme.onSurfaceVariant }]}>
                      {effectiveBudget > 0 ? formatCurrency(effectiveBudget, settings.base_currency) : 'None'}
                    </Text>
                  </View>
                </View>

                {/* Progress Bar */}
                {effectiveBudget > 0 && (
                  <View style={[styles.analyzerBarTrack, { backgroundColor: theme.pillBg }]}>
                    <View
                      style={[
                        styles.analyzerBarFill,
                        {
                          width: `${Math.min(100, Math.max(0, budgetPercent))}%`,
                          backgroundColor: isBudgetOver ? theme.error : theme.primary,
                        },
                      ]}
                    />
                  </View>
                )}
              </View>
            )}

            {/* Daily Spending Stats */}
            <View style={styles.statsCardsRow}>
              <View style={[styles.miniStatCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }]}>
                <MaterialCommunityIcons name="speedometer" size={20} color={theme.primary} />
                <Text style={[styles.miniStatLabel, { color: theme.onSurfaceVariant }]}>Daily Average Spend</Text>
                <Text style={[styles.miniStatVal, { color: theme.onSurface }]}>
                  {formatCurrency(dailyAverageSpend, settings.base_currency)}
                </Text>
              </View>

              <View style={[styles.miniStatCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }]}>
                <MaterialCommunityIcons name="bullseye-arrow" size={20} color={theme.tertiary} />
                <Text style={[styles.miniStatLabel, { color: theme.onSurfaceVariant }]}>Daily Allowance</Text>
                <Text style={[styles.miniStatVal, { color: theme.onSurface }]}>
                  {formatCurrency(dailyAllowanceStats.availableForDay, settings.base_currency)}
                </Text>
              </View>
            </View>

            {/* Category Breakdown */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>Expenses by Category</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.onSurfaceVariant }]}>
                {categorySpending.length} categories
              </Text>
            </View>

            {categorySpending.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: theme.cardBg, borderColor: theme.divider }]}>
                <MaterialCommunityIcons name="chart-pie" size={40} color={theme.outline} />
                <Text style={[styles.emptyText, { color: theme.onSurfaceVariant }]}>
                  No expense transactions recorded in this period.
                </Text>
              </View>
            ) : (
              categorySpending.map((cat, idx) => {
                const percent = totalExpense > 0 ? Math.round((cat.amount / totalExpense) * 100) : 0;
                return (
                  <View key={idx} style={[styles.categoryRowCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }]}>
                    <View style={styles.catRowHeader}>
                      <View style={[styles.catIconCircle, { backgroundColor: cat.color }]}>
                        <MaterialCommunityIcons name={cat.icon as any} size={18} color="#FFFFFF" />
                      </View>
                      <View style={styles.catNameWrap}>
                        <Text style={[styles.catNameText, { color: theme.onSurface }]}>{cat.categoryName}</Text>
                        <Text style={[styles.catPercentText, { color: theme.onSurfaceVariant }]}>
                          {percent}% of expenses ({cat.count} tx)
                        </Text>
                      </View>
                      <Text style={[styles.catAmountText, { color: theme.error, fontWeight: '700' }]}>
                        {formatCurrency(cat.amount, settings.base_currency)}
                      </Text>
                    </View>
                    <View style={[styles.catBarBg, { backgroundColor: theme.pillBg }]}>
                      <View style={[styles.catBarFill, { width: `${percent}%`, backgroundColor: cat.color }]} />
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* 2. INCOME ANALYZER FOCUS VIEW */}
        {analyticsFocus === 'income' && (
          <View style={styles.focusContainer}>
            {/* Target Income Progress Card OR Prompt to Set */}
            {effectiveIncomeGoal <= 0 ? (
              <View style={[styles.analyzerCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}>
                <View style={styles.analyzerCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialCommunityIcons name="cash-check" size={20} color={theme.success} />
                    <Text style={[styles.cardHeading, { color: theme.onSurface, marginBottom: 0 }]}>
                      Income Target Analysis
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 13, color: theme.onSurfaceVariant, marginVertical: 6, lineHeight: 18 }}>
                  No income goal set for this period. Set an income target to track your earnings, income sources, and goal achievement.
                </Text>
                <TouchableOpacity
                  style={[styles.setGoalPromptBtn, { backgroundColor: theme.successContainer }]}
                  onPress={openCycleModal}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="plus" size={16} color={theme.success} />
                  <Text style={[styles.setGoalPromptText, { color: theme.success }]}>
                    Set Income Goal
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.analyzerCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}>
                <View style={styles.analyzerCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialCommunityIcons name="cash-check" size={20} color={theme.success} />
                    <Text style={[styles.cardHeading, { color: theme.onSurface, marginBottom: 0 }]}>
                      Income Target Analysis
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.tagBadge,
                      { backgroundColor: isIncomeGoalReached ? (isDarkMode ? 'rgba(16, 185, 129, 0.3)' : '#D1FAE5') : (isDarkMode ? 'rgba(99, 102, 241, 0.2)' : '#EDE9FE') },
                    ]}
                  >
                    <Text style={[styles.tagBadgeText, { color: isIncomeGoalReached ? theme.success : theme.primary }]}>
                      {incomePercent}% Achieved
                    </Text>
                  </View>
                </View>

                <View style={styles.metricGrid}>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: theme.onSurfaceVariant }]}>Income Earned</Text>
                    <Text style={[styles.metricValue, { color: theme.success }]}>
                      {formatCurrency(incomeEarned, settings.base_currency)}
                    </Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: theme.onSurfaceVariant }]}>
                      {isIncomeGoalReached ? '🎉 Surplus' : 'To Reach Goal'}
                    </Text>
                    <Text style={[styles.metricValue, { color: isIncomeGoalReached ? theme.success : theme.onSurface }]}>
                      {formatCurrency(incomeRemainingToGo, settings.base_currency)}
                    </Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: theme.onSurfaceVariant }]}>Target Goal</Text>
                    <Text style={[styles.metricValue, { color: theme.onSurfaceVariant }]}>
                      {effectiveIncomeGoal > 0 ? formatCurrency(effectiveIncomeGoal, settings.base_currency) : 'None'}
                    </Text>
                  </View>
                </View>

                {/* Progress Bar */}
                {effectiveIncomeGoal > 0 && (
                  <View style={[styles.analyzerBarTrack, { backgroundColor: theme.pillBg }]}>
                    <View
                      style={[
                        styles.analyzerBarFill,
                        {
                          width: `${Math.min(100, Math.max(0, incomePercent))}%`,
                          backgroundColor: theme.success,
                        },
                      ]}
                    />
                  </View>
                )}
              </View>
            )}

            {/* Income Sources / Categories Breakdown */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>Income by Source / Category</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.onSurfaceVariant }]}>
                {categoryIncome.length} sources
              </Text>
            </View>

            {categoryIncome.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: theme.cardBg, borderColor: theme.divider }]}>
                <MaterialCommunityIcons name="cash-multiple" size={40} color={theme.outline} />
                <Text style={[styles.emptyText, { color: theme.onSurfaceVariant }]}>
                  No income transactions recorded in this period.
                </Text>
              </View>
            ) : (
              categoryIncome.map((cat, idx) => {
                const percent = totalIncome > 0 ? Math.round((cat.amount / totalIncome) * 100) : 0;
                return (
                  <View key={idx} style={[styles.categoryRowCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }]}>
                    <View style={styles.catRowHeader}>
                      <View style={[styles.catIconCircle, { backgroundColor: cat.color }]}>
                        <MaterialCommunityIcons name={cat.icon as any} size={18} color="#FFFFFF" />
                      </View>
                      <View style={styles.catNameWrap}>
                        <Text style={[styles.catNameText, { color: theme.onSurface }]}>{cat.categoryName}</Text>
                        <Text style={[styles.catPercentText, { color: theme.onSurfaceVariant }]}>
                          {percent}% of total income ({cat.count} tx)
                        </Text>
                      </View>
                      <Text style={[styles.catAmountText, { color: theme.success, fontWeight: '700' }]}>
                        {formatCurrency(cat.amount, settings.base_currency)}
                      </Text>
                    </View>
                    <View style={[styles.catBarBg, { backgroundColor: theme.pillBg }]}>
                      <View style={[styles.catBarFill, { width: `${percent}%`, backgroundColor: cat.color }]} />
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* 3. CASH FLOW OVERVIEW VIEW */}
        {analyticsFocus === 'overview' && (
          <View style={styles.focusContainer}>
            {/* CASH FLOW COMPARISON HERO (INCOME VS EXPENSE) */}
            <View style={[styles.cashflowCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}>
              <Text style={[styles.cardHeading, { color: theme.onSurface }]}>Income & Expenses Dashboard</Text>

              <View style={styles.cashflowRow}>
                {/* Income Col */}
                <View style={styles.cashflowCol}>
                  <View style={[styles.flowIcon, { backgroundColor: theme.successContainer }]}>
                    <MaterialCommunityIcons name="arrow-bottom-left" size={20} color={theme.success} />
                  </View>
                  <Text style={[styles.flowLabel, { color: theme.onSurfaceVariant }]}>Total Income</Text>
                  <Text style={[styles.flowAmount, { color: theme.success }]}>
                    {formatCurrency(totalIncome, settings.base_currency)}
                  </Text>
                </View>

                <View style={[styles.flowDivider, { backgroundColor: theme.divider }]} />

                {/* Expense Col */}
                <View style={styles.cashflowCol}>
                  <View style={[styles.flowIcon, { backgroundColor: theme.errorContainer }]}>
                    <MaterialCommunityIcons name="arrow-top-right" size={20} color={theme.error} />
                  </View>
                  <Text style={[styles.flowLabel, { color: theme.onSurfaceVariant }]}>Total Expenses</Text>
                  <Text style={[styles.flowAmount, { color: theme.error }]}>
                    {formatCurrency(totalExpense, settings.base_currency)}
                  </Text>
                </View>
              </View>

              {/* Net Balance / Savings Ratio Bar */}
              <View style={styles.ratioBarContainer}>
                <View style={[styles.ratioBarBg, { backgroundColor: theme.surfaceVariant }]}>
                  <View
                    style={[
                      styles.ratioBarFill,
                      {
                        width: `${Math.min(100, (totalExpense / Math.max(1, totalIncome)) * 100)}%`,
                        backgroundColor: theme.error,
                      },
                    ]}
                  />
                </View>
                <View style={styles.ratioLabels}>
                  <Text style={[styles.ratioMeta, { color: theme.onSurfaceVariant }]}>
                    Net Cash Flow:{' '}
                    <Text style={{ color: netSavings >= 0 ? theme.success : theme.error, fontWeight: '700' }}>
                      {formatCurrency(netSavings, settings.base_currency)}
                    </Text>
                  </Text>
                  <Text style={[styles.ratioMeta, { color: theme.primary, fontWeight: '700' }]}>
                    {savingsRate}% Saved
                  </Text>
                </View>
              </View>
            </View>

            {/* DAILY SPENDING STATS */}
            <View style={styles.statsCardsRow}>
              <View style={[styles.miniStatCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }]}>
                <MaterialCommunityIcons name="speedometer" size={20} color={theme.primary} />
                <Text style={[styles.miniStatLabel, { color: theme.onSurfaceVariant }]}>Daily Average Spend</Text>
                <Text style={[styles.miniStatVal, { color: theme.onSurface }]}>
                  {formatCurrency(dailyAverageSpend, settings.base_currency)}
                </Text>
              </View>

              <View style={[styles.miniStatCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }]}>
                <MaterialCommunityIcons name="bullseye-arrow" size={20} color={theme.tertiary} />
                <Text style={[styles.miniStatLabel, { color: theme.onSurfaceVariant }]}>Daily Target Cap</Text>
                <Text style={[styles.miniStatVal, { color: theme.onSurface }]}>
                  {formatCurrency(dailyAllowanceStats.availableForDay, settings.base_currency)}
                </Text>
              </View>
            </View>

            {/* Top Categories Summary */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>Top Expense Categories</Text>
            </View>
            {categorySpending.slice(0, 4).map((cat, idx) => {
              const percent = totalExpense > 0 ? Math.round((cat.amount / totalExpense) * 100) : 0;
              return (
                <View key={idx} style={[styles.categoryRowCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }]}>
                  <View style={styles.catRowHeader}>
                    <View style={[styles.catIconCircle, { backgroundColor: cat.color }]}>
                      <MaterialCommunityIcons name={cat.icon as any} size={18} color="#FFFFFF" />
                    </View>
                    <View style={styles.catNameWrap}>
                      <Text style={[styles.catNameText, { color: theme.onSurface }]}>{cat.categoryName}</Text>
                      <Text style={[styles.catPercentText, { color: theme.onSurfaceVariant }]}>{percent}% of total</Text>
                    </View>
                    <Text style={[styles.catAmountText, { color: theme.onSurface }]}>
                      {formatCurrency(cat.amount, settings.base_currency)}
                    </Text>
                  </View>
                  <View style={[styles.catBarBg, { backgroundColor: theme.pillBg }]}>
                    <View style={[styles.catBarFill, { width: `${percent}%`, backgroundColor: cat.color }]} />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* FAB OVERLAY BACKDROP */}
      {isFabOpen && (
        <Pressable
          style={styles.fabBackdrop}
          onPress={() => setIsFabOpen(false)}
        />
      )}

      {/* FLOATING SPEED DIAL ACTION BUTTONS (FLOATING VERTICAL, EXPENSE ON TOP) */}
      <Animated.View
        pointerEvents={isFabOpen ? 'auto' : 'none'}
        style={[
          styles.fabSpeedDialContainer,
          {
            opacity: speedDialOpacity,
            transform: [{ translateY: speedDialTranslateY }, { scale: speedDialScale }],
          },
        ]}
      >
        {/* Record Expense Button (Top) */}
        <TouchableOpacity
          style={[
            styles.fabRecordBtn,
            {
              backgroundColor: theme.errorContainer,
              borderColor: theme.error,
            },
            M3Elevation.level3,
          ]}
          onPress={() => handleOpenAddFlow('expense')}
          activeOpacity={0.85}
          accessibilityLabel="Record Expense"
        >
          <View style={styles.fabRecordBtnContent}>
            <View style={styles.fabRecordHeaderRow}>
              <MaterialCommunityIcons name="minus-circle" size={16} color={theme.error} />
              <Text
                style={[styles.fabRecordBtnTitle, { color: theme.onErrorContainer }]}
                numberOfLines={1}
              >
                Record Expense
              </Text>
            </View>
            <View
              style={[
                styles.fabRecordBadge,
                {
                  backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.85)',
                  borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
                },
              ]}
            >
              <Text
                style={[
                  styles.fabRecordBadgeText,
                  { color: isDarkMode ? '#FCA5A5' : '#B91C1C' },
                ]}
                numberOfLines={1}
              >
                {expenseSwitcherProgress.hasTarget
                  ? expenseSwitcherProgress.isOver
                    ? `Over: ${formatCurrency(expenseSwitcherProgress.overBy, curr)}`
                    : `Remain: ${formatCurrency(expenseSwitcherProgress.remaining, curr)}`
                  : `Total: ${formatCurrency(spentInCycle, curr)}`}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Record Income Button (Bottom - Below Expense, Above FAB) */}
        <TouchableOpacity
          style={[
            styles.fabRecordBtn,
            {
              backgroundColor: theme.successContainer,
              borderColor: theme.success,
            },
            M3Elevation.level3,
          ]}
          onPress={() => handleOpenAddFlow('income')}
          activeOpacity={0.85}
          accessibilityLabel="Record Income"
        >
          <View style={styles.fabRecordBtnContent}>
            <View style={styles.fabRecordHeaderRow}>
              <MaterialCommunityIcons name="plus-circle" size={16} color={theme.success} />
              <Text
                style={[styles.fabRecordBtnTitle, { color: theme.onSuccessContainer }]}
                numberOfLines={1}
              >
                Record Income
              </Text>
            </View>
            <View
              style={[
                styles.fabRecordBadge,
                {
                  backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.85)',
                  borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
                },
              ]}
            >
              <Text
                style={[
                  styles.fabRecordBadgeText,
                  { color: isDarkMode ? '#6EE7B7' : '#047857' },
                ]}
                numberOfLines={1}
              >
                {incomeSwitcherProgress.hasGoal
                  ? incomeSwitcherProgress.isReached
                    ? '🎉 Reached'
                    : `Remain: ${formatCurrency(incomeSwitcherProgress.remaining, curr)}`
                  : `Total: ${formatCurrency(incomeInCycle, curr)}`}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* FLOATING ACTION BUTTON (BOTTOM RIGHT) */}
      <TouchableOpacity
        style={[
          styles.fabMainBtn,
          {
            backgroundColor: theme.primary,
          },
          M3Elevation.level3,
        ]}
        onPress={() => setIsFabOpen(!isFabOpen)}
        activeOpacity={0.85}
        accessibilityLabel={isFabOpen ? 'Close record menu' : 'Add transaction'}
      >
        <Animated.View style={{ transform: [{ rotate: fabRotate }] }}>
          <MaterialCommunityIcons name="plus" size={28} color={theme.onPrimary} />
        </Animated.View>
      </TouchableOpacity>

      {/* CATEGORY PICKER SHEET (STEP 1: OPENS FIRST ON RECORD) */}
      <CategoryPickerSheet
        visible={addCategorySheetVisible}
        txType={addModalType}
        amount={0}
        walletId={wallets[0]?.id || ''}
        wallets={wallets}
        categories={categories}
        theme={theme}
        baseCurrency={settings.base_currency}
        selectOnly={true}
        confirmButtonText="Next"
        onClose={() => setAddCategorySheetVisible(false)}
        onSave={handleCategorySelectedForAdd}
        onOpenMoreOptions={handleCategorySelectedForAdd}
        onAddSubcategory={addSubcategory}
      />

      {/* ADD TRANSACTION MODAL (STEP 2: FOCUSED AMOUNT FIELD) */}
      <TransactionDetailsModal
        visible={addModalVisible}
        txType={addModalType}
        initialAmount={0}
        initialWalletId={wallets[0]?.id || ''}
        initialCategoryId={addPrefilledCategoryId}
        initialSubcategoryId={addPrefilledSubcategoryId}
        initialDate={todayStr}
        isEditing={false}
        wallets={wallets}
        categories={categories}
        theme={theme}
        baseCurrency={settings.base_currency}
        onClose={() => setAddModalVisible(false)}
        onSave={handleSaveNewTransaction}
        onAddSubcategory={addSubcategory}
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
    paddingBottom: 85,
  },
  focusTabBar: {
    flexDirection: 'row',
    borderRadius: M3Shape.full,
    padding: 3,
    marginBottom: 12,
  },
  focusTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: M3Shape.full,
  },
  focusTabBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  focusContainer: {
    gap: 4,
  },
  analyzerCard: {
    borderWidth: 1,
    borderRadius: M3Shape.extraLarge,
    padding: 18,
    marginBottom: 14,
  },
  analyzerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  tagBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: M3Shape.full,
  },
  tagBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  metricGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  analyzerBarTrack: {
    height: 8,
    borderRadius: M3Shape.full,
    overflow: 'hidden',
  },
  analyzerBarFill: {
    height: '100%',
    borderRadius: M3Shape.full,
  },
  setGoalPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: M3Shape.full,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  setGoalPromptText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  scopeBar: {
    flexDirection: 'row',
    borderRadius: M3Shape.full,
    padding: 3,
    marginBottom: 16,
  },
  scopePill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: M3Shape.full,
    alignItems: 'center',
  },
  scopePillText: {
    fontSize: 12,
  },
  cashflowCard: {
    borderWidth: 1,
    borderRadius: M3Shape.extraLarge,
    padding: 20,
    marginBottom: 14,
  },
  cardHeading: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 16,
  },
  cashflowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cashflowCol: {
    flex: 1,
    alignItems: 'center',
  },
  flowDivider: {
    width: 1,
    height: '80%',
    alignSelf: 'center',
  },
  flowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  flowLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  flowAmount: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  ratioBarContainer: {
    marginTop: 6,
  },
  ratioBarBg: {
    height: 8,
    borderRadius: M3Shape.full,
    overflow: 'hidden',
  },
  ratioBarFill: {
    height: '100%',
    borderRadius: M3Shape.full,
  },
  ratioLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  ratioMeta: {
    fontSize: 11,
  },
  statsCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  miniStatCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: M3Shape.large,
    padding: 14,
  },
  miniStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
  },
  miniStatVal: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 12,
  },
  emptyBox: {
    borderWidth: 1,
    borderRadius: M3Shape.large,
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    marginTop: 8,
  },
  categoryRowCard: {
    borderWidth: 1,
    borderRadius: M3Shape.large,
    padding: 14,
    marginBottom: 10,
  },
  catRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  catIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catNameWrap: {
    flex: 1,
    marginLeft: 12,
  },
  catNameText: {
    fontSize: 14,
    fontWeight: '700',
  },
  catPercentText: {
    fontSize: 11,
    marginTop: 2,
  },
  catAmountText: {
    fontSize: 15,
    fontWeight: '700',
  },
  catBarBg: {
    height: 6,
    borderRadius: M3Shape.full,
    overflow: 'hidden',
  },
  catBarFill: {
    height: '100%',
    borderRadius: M3Shape.full,
  },
  selectedCycleAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: M3Shape.medium,
    marginBottom: 10,
  },
  selectedCycleAlertText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  selectedCycleAlertClearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  fabBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    zIndex: 90,
  },
  fabSpeedDialContainer: {
    position: 'absolute',
    right: 18,
    bottom: 84,
    zIndex: 95,
    gap: 10,
    alignItems: 'flex-end',
  },
  fabRecordBtn: {
    borderRadius: M3Shape.large,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 165,
    justifyContent: 'center',
  },
  fabRecordBtnContent: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
  },
  fabRecordHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fabRecordBtnTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  fabRecordBadge: {
    paddingHorizontal: 8,
    paddingVertical: 1.5,
    borderRadius: M3Shape.full,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 1,
  },
  fabRecordBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  fabMainBtn: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
});
