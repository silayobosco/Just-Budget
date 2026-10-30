import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBudget } from '../context/BudgetContext';
import { lightTheme, darkTheme, M3Shape, M3Elevation } from '../theme';
import { formatCurrency } from '../utils/format';

export const AnalyticsScreen: React.FC = () => {
  const {
    settings,
    transactions,
    categories,
    currentCycle,
    spentInCycle,
    incomeInCycle,
    overallBudgetLimit,
    incomeGoal,
    dailyAllowanceStats,
    analyticsFocus,
    setAnalyticsFocus,
  } = useBudget();

  const isDarkMode = settings.theme_mode === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;
  const [scope, setScope] = useState<'cycle' | 'all'>('cycle');

  // Filtered transactions by scope
  const activeTransactions = useMemo(() => {
    if (scope === 'cycle' && currentCycle) {
      return transactions.filter(
        (t) => t.date >= currentCycle.start_date && t.date <= currentCycle.end_date
      );
    }
    return transactions;
  }, [scope, currentCycle, transactions]);

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
  const effectiveBudget = overallBudgetLimit > 0 ? overallBudgetLimit : (currentCycle?.target_budget || 0);
  const budgetSpent = scope === 'cycle' ? spentInCycle : totalExpense;
  const budgetRemaining = effectiveBudget - budgetSpent;
  const budgetPercent = effectiveBudget > 0 ? Math.round((budgetSpent / effectiveBudget) * 100) : 0;
  const isBudgetOver = effectiveBudget > 0 && budgetSpent > effectiveBudget;

  const effectiveIncomeGoal = incomeGoal > 0 ? incomeGoal : (currentCycle?.target_income || 0);
  const incomeEarned = scope === 'cycle' ? incomeInCycle : totalIncome;
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
              Current Cycle ({currentCycle?.name || 'Cycle'})
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
            {/* Target Budget Progress Card */}
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
            {/* Target Income Progress Card */}
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
});
