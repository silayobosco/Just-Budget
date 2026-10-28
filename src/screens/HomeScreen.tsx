import React, { useState } from 'react';
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
import { AddTransactionModal } from '../components/AddTransactionModal';
import { CategoryManagerModal } from '../components/CategoryManagerModal';
import { formatCurrency, formatNumberOnly } from '../utils/format';

export const HomeScreen: React.FC = () => {
  const {
    settings,
    dailyAllowanceStats,
    totalConvertedBalance,
    spentInCycle,
    remainingCycleBalance,
    transactions,
    categories,
    wallets,
    currentCycle,
    overallBudgetLimit,
    overallBudgetSpent,
    overallBudgetRemaining,
    overallBudgetPercent,
    allocatedCategoriesBudget,
    unallocatedBudgetRemainder,
    categoryBudgetProgressList,
    deleteTransaction,
  } = useBudget();

  const theme = settings.theme_mode === 'dark' ? darkTheme : lightTheme;
  const [modalVisible, setModalVisible] = useState(false);
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);

  // Format currency
  const formatMoney = (val: number, curr?: string) => {
    return formatCurrency(val, curr || settings.base_currency);
  };

  // Daily spend progress percentage
  const dailyProgress =
    dailyAllowanceStats.availableForDay > 0
      ? Math.min(100, Math.round((dailyAllowanceStats.spentToday / dailyAllowanceStats.availableForDay) * 100))
      : 0;

  // Recent transactions (last 6)
  const recentTransactions = transactions.slice(0, 8);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* HERO CARD: "AVAILABLE FOR DAY" (Signature Budge Feature) */}
        <View style={[styles.heroCard, { backgroundColor: theme.heroBg }, M3Elevation.level2]}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={[styles.heroLabel, { color: theme.onSurfaceVariant }]}>AVAILABLE FOR TODAY</Text>
              <Text
                style={[
                  styles.heroAmount,
                  {
                    color: dailyAllowanceStats.isOverDaily ? theme.error : theme.primary,
                  },
                ]}
              >
                {formatMoney(Math.max(0, dailyAllowanceStats.remainingToday))}
              </Text>
            </View>

            <View style={[styles.cycleDayBadge, { backgroundColor: theme.surface }]}>
              <MaterialCommunityIcons name="calendar-clock" size={16} color={theme.primary} />
              <Text style={[styles.cycleDayText, { color: theme.onSurface }]}>
                {dailyAllowanceStats.daysRemaining} days left
              </Text>
            </View>
          </View>

          {/* Daily Allowance Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressBarBg, { backgroundColor: theme.surfaceVariant }]}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${dailyProgress}%`,
                    backgroundColor: dailyAllowanceStats.isOverDaily ? theme.error : theme.primary,
                  },
                ]}
              />
            </View>
            <View style={styles.progressMeta}>
              <Text style={[styles.progressMetaText, { color: theme.onSurfaceVariant }]}>
                Spent today: {formatMoney(dailyAllowanceStats.spentToday)}
              </Text>
              <Text style={[styles.progressMetaText, { color: theme.onSurfaceVariant }]}>
                Daily target: {formatMoney(dailyAllowanceStats.availableForDay)}
              </Text>
            </View>
          </View>

          {/* Daily Status Warning / Praise */}
          {dailyAllowanceStats.isOverDaily ? (
            <View style={[styles.statusBanner, { backgroundColor: theme.errorContainer }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color={theme.onErrorContainer} />
              <Text style={[styles.statusBannerText, { color: theme.onErrorContainer }]}>
                Exceeded daily budget by {formatMoney(dailyAllowanceStats.spentToday - dailyAllowanceStats.availableForDay)}
              </Text>
            </View>
          ) : (
            <View style={[styles.statusBanner, { backgroundColor: theme.successContainer }]}>
              <MaterialCommunityIcons name="check-circle-outline" size={16} color={theme.onSuccessContainer} />
              <Text style={[styles.statusBannerText, { color: theme.onSuccessContainer }]}>
                You are well within your daily budget today!
              </Text>
            </View>
          )}
        </View>

        {/* 3 METRIC PILLS ROW */}
        <View style={styles.metricsRow}>
          {/* Cycle Target */}
          <View style={[styles.metricCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }]}>
            <Text style={[styles.metricLabel, { color: theme.onSurfaceVariant }]} numberOfLines={1}>
              TARGET ({settings.base_currency})
            </Text>
            <Text
              style={[styles.metricVal, { color: theme.onSurface }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
            >
              {formatNumberOnly(currentCycle?.target_budget || totalConvertedBalance)}
            </Text>
          </View>

          {/* Spent */}
          <View style={[styles.metricCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }]}>
            <Text style={[styles.metricLabel, { color: theme.error }]} numberOfLines={1}>
              SPENT ({settings.base_currency})
            </Text>
            <Text
              style={[styles.metricVal, { color: theme.error }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
            >
              {formatNumberOnly(spentInCycle)}
            </Text>
          </View>

          {/* Remaining */}
          <View style={[styles.metricCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }]}>
            <Text style={[styles.metricLabel, { color: theme.success }]} numberOfLines={1}>
              REMAINING ({settings.base_currency})
            </Text>
            <Text
              style={[styles.metricVal, { color: theme.success }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
            >
              {formatNumberOnly(remainingCycleBalance)}
            </Text>
          </View>
        </View>

        {/* BUDGET ENVELOPES & ALLOCATION CARD */}
        <View style={[styles.budgetCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}>
          <View style={styles.budgetCardHeader}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[styles.budgetCardLabel, { color: theme.onSurfaceVariant }]}>BUDGET ENVELOPES</Text>
              <Text style={[styles.budgetCardTitle, { color: theme.onSurface }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                Allocated {formatMoney(allocatedCategoriesBudget)} of {overallBudgetLimit > 0 ? formatMoney(overallBudgetLimit) : 'No limit'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.budgetManageBtn, { backgroundColor: theme.primaryContainer }]}
              onPress={() => setBudgetModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.budgetManageBtnText, { color: theme.onPrimaryContainer }]}>Manage</Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color={theme.onPrimaryContainer} />
            </TouchableOpacity>
          </View>

          {/* Envelope Allocation progress bar */}
          {overallBudgetLimit > 0 && (
            <View style={[styles.budgetProgressBarBg, { backgroundColor: theme.surfaceVariant }]}>
              <View
                style={[
                  styles.budgetProgressBarFill,
                  {
                    width: `${Math.min(100, Math.round((allocatedCategoriesBudget / overallBudgetLimit) * 100))}%`,
                    backgroundColor:
                      allocatedCategoriesBudget > overallBudgetLimit
                        ? theme.error
                        : theme.primary,
                  },
                ]}
              />
            </View>
          )}

          {/* Unallocated and Category envelopes carousel */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.budgetChipsScroll}>
            {overallBudgetLimit > 0 && (
              <View style={[styles.unallocatedChip, { backgroundColor: theme.heroBg, borderColor: theme.divider }]}>
                <MaterialCommunityIcons name="creation" size={14} color={theme.primary} />
                <Text style={[styles.unallocatedChipText, { color: theme.onSurface }]}>
                  Unallocated: {formatMoney(unallocatedBudgetRemainder)}
                </Text>
              </View>
            )}

            {categoryBudgetProgressList.slice(0, 6).map((cat) => {
              const hasLimit = cat.limit > 0;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.budgetCatChip, { backgroundColor: theme.surfaceVariant }]}
                  onPress={() => setBudgetModalVisible(true)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.budgetCatDot, { backgroundColor: cat.color }]} />
                  <Text style={[styles.budgetCatName, { color: theme.onSurface }]}>{cat.name}</Text>
                  <Text style={[styles.budgetCatSpent, { color: cat.isOverBudget ? theme.error : theme.onSurfaceVariant }]}>
                    {formatMoney(cat.spent)}{hasLimit ? ` / ${formatMoney(cat.limit)}` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* RECENT TRANSACTIONS */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>Recent Activity</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.onSurfaceVariant }]}>
            {transactions.length} total entries
          </Text>
        </View>

        {recentTransactions.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.cardBg, borderColor: theme.divider }]}>
            <MaterialCommunityIcons name="wallet-bifold-outline" size={48} color={theme.outline} />
            <Text style={[styles.emptyTitle, { color: theme.onSurface }]}>No transactions yet</Text>
            <Text style={[styles.emptyDesc, { color: theme.onSurfaceVariant }]}>
              Tap the (+) button below to log your first expense or income.
            </Text>
          </View>
        ) : (
          recentTransactions.map((tx) => {
            const cat = categories.find((c) => c.id === tx.category_id);
            const sub = cat?.subcategories?.find((s) => s.id === tx.subcategory_id);
            const wallet = wallets.find((w) => w.id === tx.wallet_id);
            const isExpense = tx.type === 'expense';
            const isTransfer = tx.type === 'transfer';

            // Main title: Subcategory if present, else category, else Transfer / Uncategorized
            const mainTitle = isTransfer
              ? 'Transfer'
              : sub?.name || cat?.name || 'Uncategorized';

            // Subtitle: Category (if sub exists) + Wallet + Note
            const subMeta = [
              sub ? cat?.name : null,
              wallet?.name,
              tx.date,
              tx.note || null,
            ]
              .filter(Boolean)
              .join(' • ');

            return (
              <View
                key={tx.id}
                style={[styles.txCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }]}
              >
                <View
                  style={[
                    styles.txIconWrap,
                    {
                      backgroundColor: isTransfer ? theme.tertiaryContainer : cat?.color || theme.primaryContainer,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={isTransfer ? 'swap-horizontal' : (cat?.icon as any) || 'cash'}
                    size={22}
                    color="#FFFFFF"
                  />
                </View>

                <View style={styles.txInfo}>
                  <Text style={[styles.txTitle, { color: theme.onSurface }]}>
                    {mainTitle}
                  </Text>
                  <View style={styles.txMetaRow}>
                    <Text style={[styles.txWallet, { color: theme.onSurfaceVariant }]} numberOfLines={1}>
                      {subMeta}
                    </Text>
                  </View>
                </View>

                <View style={styles.txAmountWrap}>
                  <Text
                    style={[
                      styles.txAmount,
                      {
                        color: isExpense ? theme.error : isTransfer ? theme.tertiary : theme.success,
                      },
                    ]}
                  >
                    {isExpense ? '-' : isTransfer ? '' : '+'}
                    {formatCurrency(tx.amount, tx.currency)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => deleteTransaction(tx.id)}
                    style={styles.txDeleteBtn}
                  >
                    <MaterialCommunityIcons name="close-circle-outline" size={18} color={theme.outline} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Expressive Floating Action Button (FAB) */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }, M3Elevation.level3]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="plus" size={28} color={theme.onPrimary} />
        <Text style={[styles.fabText, { color: theme.onPrimary }]}>Add Transaction</Text>
      </TouchableOpacity>

      <AddTransactionModal visible={modalVisible} onClose={() => setModalVisible(false)} />
      <CategoryManagerModal visible={budgetModalVisible} onClose={() => setBudgetModalVisible(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 90,
  },
  heroCard: {
    borderRadius: M3Shape.extraLarge,
    padding: 22,
    marginBottom: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  cycleDayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: M3Shape.full,
    gap: 6,
  },
  cycleDayText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBarBg: {
    height: 10,
    borderRadius: M3Shape.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: M3Shape.full,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressMetaText: {
    fontSize: 11,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: M3Shape.medium,
    gap: 6,
  },
  statusBannerText: {
    fontSize: 11,
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: M3Shape.large,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  metricVal: {
    fontSize: 15,
    fontWeight: '700',
  },
  budgetCard: {
    borderWidth: 1,
    borderRadius: M3Shape.extraLarge,
    padding: 16,
    marginBottom: 20,
  },
  budgetCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  budgetCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  budgetManageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: M3Shape.full,
    gap: 4,
  },
  budgetManageBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  budgetProgressBarBg: {
    height: 8,
    borderRadius: M3Shape.full,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 10,
  },
  budgetProgressBarFill: {
    height: '100%',
    borderRadius: M3Shape.full,
  },
  budgetChipsScroll: {
    marginTop: 4,
  },
  unallocatedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: M3Shape.full,
    borderWidth: 1,
    marginRight: 8,
    gap: 4,
  },
  unallocatedChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  budgetCatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: M3Shape.full,
    marginRight: 8,
    gap: 6,
  },
  budgetCatDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  budgetCatName: {
    fontSize: 11,
    fontWeight: '700',
  },
  budgetCatSpent: {
    fontSize: 11,
    fontWeight: '600',
  },
  sectionHeaderRow: {
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
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: M3Shape.large,
    padding: 12,
    marginBottom: 8,
  },
  txIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: {
    flex: 1,
    marginLeft: 12,
  },
  txTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  txMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  txWallet: {
    fontSize: 12,
  },
  txNote: {
    fontSize: 12,
    marginLeft: 4,
    flex: 1,
  },
  txAmountWrap: {
    alignItems: 'flex-end',
    gap: 4,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  txDeleteBtn: {
    padding: 2,
  },
  fab: {
    position: 'absolute',
    bottom: 16,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    paddingHorizontal: 22,
    borderRadius: M3Shape.full,
    gap: 8,
  },
  fabText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
