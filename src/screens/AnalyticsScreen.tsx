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
    dailyAllowanceStats,
  } = useBudget();

  const theme = settings.theme_mode === 'dark' ? darkTheme : lightTheme;
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

  // Category breakdown
  const categorySpending = useMemo(() => {
    const map: Record<string, { categoryName: string; color: string; icon: string; amount: number }> = {};

    activeTransactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const cat = categories.find((c) => c.id === t.category_id);
        const catId = cat ? cat.id : 'other';
        const name = cat ? cat.name : 'Uncategorized';
        const color = cat ? cat.color : '#9E9E9E';
        const icon = cat ? cat.icon : 'help-circle-outline';

        if (!map[catId]) {
          map[catId] = { categoryName: name, color, icon, amount: 0 };
        }
        map[catId].amount += (t.amount || t.base_amount || 0);
      });

    return Object.values(map).sort((a, b) => b.amount - a.amount);
  }, [activeTransactions, categories]);

  // Daily average spending calculation
  const dailyAverageSpend = useMemo(() => {
    const expenseDays = new Set(activeTransactions.filter((t) => t.type === 'expense').map((t) => t.date));
    const count = Math.max(1, expenseDays.size);
    return totalExpense / count;
  }, [activeTransactions, totalExpense]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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

        {/* CATEGORY BREAKDOWN SECTION */}
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
              No expense activity in this period.
            </Text>
          </View>
        ) : (
          categorySpending.map((cat, idx) => {
            const percent = totalExpense > 0 ? Math.round((cat.amount / totalExpense) * 100) : 0;

            return (
              <View
                key={idx}
                style={[styles.categoryRowCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }]}
              >
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

                {/* Progress bar per category */}
                <View style={[styles.catBarBg, { backgroundColor: theme.pillBg }]}>
                  <View
                    style={[
                      styles.catBarFill,
                      {
                        width: `${percent}%`,
                        backgroundColor: cat.color,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })
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
