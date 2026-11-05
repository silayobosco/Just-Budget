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
  Modal,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import Svg, {
  Path,
  Circle,
  G,
  Defs,
  LinearGradient,
  Stop,
  Rect,
} from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBudget } from '../context/BudgetContext';
import { lightTheme, darkTheme, M3Shape, M3Elevation } from '../theme';
import { formatCurrency } from '../utils/format';
import { TransactionType } from '../types';
import { CategoryPickerSheet } from '../components/CategoryPickerSheet';
import { TransactionDetailsModal } from '../components/TransactionDetailsModal';
import {
  exportAnalyticsSummaryReport,
  exportTransactionsCSV,
  buildAnalyticsSummaryText,
} from '../services/exportReport';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const GradientProgressBar: React.FC<{
  percent: number;
  color: string;
  height?: number;
  borderRadius?: number;
  trackColor?: string;
}> = ({
  percent,
  color,
  height = 6,
  borderRadius = 3,
  trackColor = 'rgba(0,0,0,0.06)',
}) => {
  const widthPct = Math.min(100, Math.max(2, percent));
  const gradId = `grad-${color.replace(/[^a-zA-Z0-9]/g, '')}-${height}`;

  return (
    <View
      style={{
        height,
        borderRadius,
        overflow: 'hidden',
        backgroundColor: trackColor,
        width: '100%',
      }}
    >
      <View style={{ width: `${widthPct}%`, height: '100%', borderRadius, overflow: 'hidden' }}>
        <Svg width="100%" height={height}>
          <Defs>
            <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor={color} stopOpacity={0.65} />
              <Stop offset="100%" stopColor={color} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height={height} fill={`url(#${gradId})`} />
        </Svg>
      </View>
    </View>
  );
};

export interface DonutSlice {
  name: string;
  amount: number;
  color: string;
  percent: number;
}

export const DonutPieChart: React.FC<{
  slices: DonutSlice[];
  total: number;
  centerTitle: string;
  centerSubtitle: string;
  size?: number;
  strokeWidth?: number;
  theme: any;
}> = ({
  slices,
  total,
  centerTitle,
  centerSubtitle,
  size = 155,
  strokeWidth = 20,
  theme,
}) => {
  const radius = size / 2;
  const innerRadius = radius - strokeWidth;
  const center = radius;

  if (total <= 0 || slices.length === 0) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius - strokeWidth / 2}
            stroke={theme.divider}
            strokeWidth={strokeWidth}
            fill="none"
          />
        </Svg>
        <View pointerEvents="none" style={[styles.pieCenterLabel, { width: innerRadius * 1.8, height: innerRadius * 1.8 }]}>
          <Text style={[styles.pieCenterSub, { color: theme.onSurfaceVariant }]}>No Data</Text>
        </View>
      </View>
    );
  }

  if (slices.length === 1 || slices[0].percent >= 99) {
    const s = slices[0];
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius - strokeWidth / 2}
            stroke={s.color}
            strokeWidth={strokeWidth}
            fill="none"
          />
        </Svg>
        <View pointerEvents="none" style={[styles.pieCenterLabel, { width: innerRadius * 1.8, height: innerRadius * 1.8 }]}>
          <Text style={[styles.pieCenterSub, { color: theme.onSurfaceVariant }]}>{centerSubtitle}</Text>
          <Text style={[styles.pieCenterMain, { color: theme.onSurface }]} numberOfLines={1}>
            {centerTitle}
          </Text>
        </View>
      </View>
    );
  }

  let cumulativeAngle = -Math.PI / 2;

  const paths = slices.map((slice, idx) => {
    const sliceAngle = (slice.amount / total) * (2 * Math.PI);
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + sliceAngle;
    cumulativeAngle = endAngle;

    const x1 = center + radius * Math.cos(startAngle);
    const y1 = center + radius * Math.sin(startAngle);
    const x2 = center + radius * Math.cos(endAngle);
    const y2 = center + radius * Math.sin(endAngle);

    const x3 = center + innerRadius * Math.cos(endAngle);
    const y3 = center + innerRadius * Math.sin(endAngle);
    const x4 = center + innerRadius * Math.cos(startAngle);
    const y4 = center + innerRadius * Math.sin(startAngle);

    const largeArc = sliceAngle > Math.PI ? 1 : 0;
    const pathData = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;

    return (
      <Path
        key={idx}
        d={pathData}
        fill={slice.color}
        stroke={theme.cardBg}
        strokeWidth={1.5}
      />
    );
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <Svg width={size} height={size}>
        <G>{paths}</G>
      </Svg>
      <View pointerEvents="none" style={[styles.pieCenterLabel, { width: innerRadius * 1.8, height: innerRadius * 1.8 }]}>
        <Text style={[styles.pieCenterSub, { color: theme.onSurfaceVariant }]}>{centerSubtitle}</Text>
        <Text style={[styles.pieCenterMain, { color: theme.onSurface }]} numberOfLines={1}>
          {centerTitle}
        </Text>
      </View>
    </View>
  );
};

export interface SubcategorySpendingItem {
  id: string;
  name: string;
  amount: number;
  count: number;
  percentOfCategory: number;
  percentOfTotal: number;
  budgetLimit?: number;
  budgetRemaining?: number;
  isOverBudget?: boolean;
}

export interface CategorySpendingItem {
  categoryId: string;
  categoryName: string;
  color: string;
  icon: string;
  amount: number;
  count: number;
  percentOfTotal: number;
  subcategories: SubcategorySpendingItem[];
  budgetLimit?: number;
  budgetRemaining?: number;
  isOverBudget?: boolean;
  savingsInsight?: string;
}

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
    categoryBudgetProgressList,
  } = useBudget();

  const isDarkMode = settings.theme_mode === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;
  const [scope, setScope] = useState<'cycle' | 'all'>('cycle');
  const curr = settings.base_currency;
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Accordion state for expandable categories
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Record<string, boolean>>({});

  // Cash Flow Donut Pie flow selector ('expense' | 'income')
  const [cashFlowPieType, setCashFlowPieType] = useState<'expense' | 'income'>('expense');

  const toggleCategoryExpand = (catId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCategoryIds((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  // Floating Action Button (FAB) Speed-Dial & Add Transaction Modal states
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
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

  // Category spending breakdown (Expense) with itemized Subcategories & Savings Insights
  const categorySpending = useMemo<CategorySpendingItem[]>(() => {
    const map: Record<
      string,
      {
        categoryId: string;
        categoryName: string;
        color: string;
        icon: string;
        amount: number;
        count: number;
        subMap: Record<string, { id: string; name: string; amount: number; count: number }>;
      }
    > = {};

    activeTransactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const cat = categories.find((c) => c.id === t.category_id);
        const catId = cat ? cat.id : 'other';
        const name = cat ? cat.name : 'Uncategorized';
        const color = cat ? cat.color : '#9E9E9E';
        const icon = cat ? cat.icon : 'help-circle-outline';

        if (!map[catId]) {
          map[catId] = {
            categoryId: catId,
            categoryName: name,
            color,
            icon,
            amount: 0,
            count: 0,
            subMap: {},
          };
        }

        const amt = t.amount || t.base_amount || 0;
        map[catId].amount += amt;
        map[catId].count += 1;

        // Subcategory resolution
        const sub = cat?.subcategories?.find((s) => s.id === t.subcategory_id);
        const subId = sub ? sub.id : (t.subcategory_id || 'direct');
        const subName = sub ? sub.name : (t.subcategory_id ? 'Other' : 'General');

        if (!map[catId].subMap[subId]) {
          map[catId].subMap[subId] = {
            id: subId,
            name: subName,
            amount: 0,
            count: 0,
          };
        }
        map[catId].subMap[subId].amount += amt;
        map[catId].subMap[subId].count += 1;
      });

    return Object.values(map)
      .map((cat) => {
        const percentOfTotal = totalExpense > 0 ? Math.round((cat.amount / totalExpense) * 100) : 0;
        const budgetItem = categoryBudgetProgressList?.find((b) => b.id === cat.categoryId);

        const subcategories: SubcategorySpendingItem[] = Object.values(cat.subMap)
          .map((sub) => {
            const percentOfCategory = cat.amount > 0 ? Math.round((sub.amount / cat.amount) * 100) : 0;
            const percentOfTotalSub = totalExpense > 0 ? Math.round((sub.amount / totalExpense) * 100) : 0;
            const subBudget = budgetItem?.subBudgets?.find((sb) => sb.id === sub.id);

            return {
              id: sub.id,
              name: sub.name,
              amount: sub.amount,
              count: sub.count,
              percentOfCategory,
              percentOfTotal: percentOfTotalSub,
              budgetLimit: subBudget?.limit,
              budgetRemaining: subBudget?.remaining,
              isOverBudget: subBudget?.isOverBudget,
            };
          })
          .sort((a, b) => b.amount - a.amount);

        // Smart category-level savings insight
        let savingsInsight: string | undefined;

        // Food & Dining: Groceries vs Restaurant comparison
        if (cat.categoryName.toLowerCase().includes('food')) {
          const grocerySpend = subcategories
            .filter((s) => s.name.toLowerCase().includes('grocer') || s.name.toLowerCase().includes('market'))
            .reduce((sum, s) => sum + s.amount, 0);
          const dineSpend = subcategories
            .filter((s) =>
              s.name.toLowerCase().includes('restaur') ||
              s.name.toLowerCase().includes('deliver') ||
              s.name.toLowerCase().includes('bar') ||
              s.name.toLowerCase().includes('drink')
            )
            .reduce((sum, s) => sum + s.amount, 0);

          if (grocerySpend > 0 && dineSpend > 0) {
            const groceryPct = Math.round((grocerySpend / (grocerySpend + dineSpend)) * 100);
            if (groceryPct >= 50) {
              savingsInsight = `Groceries account for ${groceryPct}% of food expenses. Home cooking saved substantial dining-out markups this cycle!`;
            } else {
              savingsInsight = `Dining out & delivery took ${100 - groceryPct}% of food spending. Preparing 2 more meals at home could save ~${formatCurrency(dineSpend * 0.3, curr)}!`;
            }
          }
        }

        // Budget envelope insight
        if (!savingsInsight && budgetItem && budgetItem.limit > 0) {
          if (budgetItem.remaining > 0) {
            savingsInsight = `Saved ${formatCurrency(budgetItem.remaining, curr)} under your ${formatCurrency(budgetItem.limit, curr)} budget cap (${Math.round((budgetItem.remaining / budgetItem.limit) * 100)}% preserved).`;
          } else if (budgetItem.isOverBudget) {
            savingsInsight = `Exceeded target budget by ${formatCurrency(Math.abs(budgetItem.remaining), curr)}.`;
          }
        }

        return {
          categoryId: cat.categoryId,
          categoryName: cat.categoryName,
          color: cat.color,
          icon: cat.icon,
          amount: cat.amount,
          count: cat.count,
          percentOfTotal,
          subcategories,
          budgetLimit: budgetItem?.limit,
          budgetRemaining: budgetItem?.remaining,
          isOverBudget: budgetItem?.isOverBudget,
          savingsInsight,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [activeTransactions, categories, totalExpense, categoryBudgetProgressList, curr]);

  // Daily Spending Velocity Sparkline data
  const dailySpendingVelocity = useMemo(() => {
    const dailyMap: Record<string, number> = {};
    activeTransactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        dailyMap[t.date] = (dailyMap[t.date] || 0) + (t.amount || t.base_amount || 0);
      });

    const allDates = Object.keys(dailyMap).sort();
    const daysToShow = allDates.slice(-7); // Last 7 active days

    const allowance = dailyAllowanceStats.availableForDay > 0 ? dailyAllowanceStats.availableForDay : 0;
    const maxDaySpend = Math.max(allowance, ...Object.values(dailyMap), 1);

    const daysList = daysToShow.map((d) => {
      const amount = dailyMap[d] || 0;
      const isOver = allowance > 0 && amount > allowance;
      const dateObj = new Date(d + 'T00:00:00');
      const dayLabel = !isNaN(dateObj.getTime())
        ? dateObj.toLocaleDateString(undefined, { weekday: 'narrow' })
        : d.slice(-2);
      const dayNum = d.slice(8, 10);

      return {
        date: d,
        dayLabel,
        dayNum,
        amount,
        isOver,
        heightRatio: Math.min(1, Math.max(0.12, amount / maxDaySpend)),
      };
    });

    const daysUnderAllowance = daysList.filter((d) => !d.isOver && d.amount > 0).length;

    return {
      daysList,
      daysUnderAllowance,
      totalTrackedDays: daysList.filter((d) => d.amount > 0).length,
      allowance,
    };
  }, [activeTransactions, dailyAllowanceStats.availableForDay]);

  // Behavioral Financial Insights (Peak Day, Essentials vs. Discretionary, Top Savings)
  const behavioralInsights = useMemo(() => {
    if (activeTransactions.length === 0 || totalExpense === 0) return null;

    // Peak spend day
    const dayTotals: Record<string, { amount: number; categories: Record<string, number> }> = {};
    activeTransactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        if (!dayTotals[t.date]) {
          dayTotals[t.date] = { amount: 0, categories: {} };
        }
        const amt = t.amount || t.base_amount || 0;
        dayTotals[t.date].amount += amt;
        const cat = categories.find((c) => c.id === t.category_id)?.name || 'Other';
        dayTotals[t.date].categories[cat] = (dayTotals[t.date].categories[cat] || 0) + amt;
      });

    const sortedDays = Object.entries(dayTotals).sort((a, b) => b[1].amount - a[1].amount);
    const peakDay = sortedDays[0];
    let peakDayText: string | undefined;
    if (peakDay) {
      const dObj = new Date(peakDay[0] + 'T00:00:00');
      const dayStr = !isNaN(dObj.getTime())
        ? dObj.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
        : peakDay[0];
      const topCat = Object.entries(peakDay[1].categories).sort((a, b) => b[1] - a[1])[0];
      peakDayText = `${dayStr} (${formatCurrency(peakDay[1].amount, curr)})${topCat ? ` — mostly ${topCat[0]}` : ''}`;
    }

    // Essentials vs. Discretionary ratio
    let essentialsSpend = 0;
    let lifestyleSpend = 0;
    activeTransactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const catName = categories.find((c) => c.id === t.category_id)?.name.toLowerCase() || '';
        const amt = t.amount || t.base_amount || 0;
        if (
          catName.includes('food') ||
          catName.includes('hous') ||
          catName.includes('bill') ||
          catName.includes('transport') ||
          catName.includes('health') ||
          catName.includes('util')
        ) {
          essentialsSpend += amt;
        } else {
          lifestyleSpend += amt;
        }
      });

    const essentialsPercent = totalExpense > 0 ? Math.round((essentialsSpend / totalExpense) * 100) : 0;
    const lifestylePercent = 100 - essentialsPercent;

    // Top Savings Area
    const savingsCandidates = categorySpending
      .filter((c) => (c.budgetRemaining || 0) > 0)
      .sort((a, b) => (b.budgetRemaining || 0) - (a.budgetRemaining || 0));
    const topSavingsItem = savingsCandidates[0];

    return {
      peakDayText,
      essentialsPercent,
      lifestylePercent,
      topSavingsItem,
    };
  }, [activeTransactions, totalExpense, categories, categorySpending, curr]);

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

  // Donut Pie chart slices for cash flow
  const expensePieSlices = useMemo<DonutSlice[]>(() => {
    return categorySpending.map((c) => ({
      name: c.categoryName,
      amount: c.amount,
      color: c.color,
      percent: c.percentOfTotal,
    }));
  }, [categorySpending]);

  const incomePieSlices = useMemo<DonutSlice[]>(() => {
    return categoryIncome.map((c) => ({
      name: c.categoryName,
      amount: c.amount,
      color: c.color,
      percent: totalIncome > 0 ? Math.round((c.amount / totalIncome) * 100) : 0,
    }));
  }, [categoryIncome, totalIncome]);

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

  const exportPayload = useMemo(() => {
    const timeframeLabel = scope === 'cycle'
      ? `${effectiveCycle?.name || 'Cycle'} (${effectiveCycle?.start_date || ''} to ${effectiveCycle?.end_date || ''})`
      : 'All Time (Complete History)';

    return {
      timeframe: timeframeLabel,
      totalExpense,
      totalIncome,
      netSavings,
      savingsRate,
      dailyAverageSpend,
      budgetCap: effectiveBudget > 0 ? effectiveBudget : undefined,
      incomeGoal: effectiveIncomeGoal > 0 ? effectiveIncomeGoal : undefined,
      baseCurrency: curr,
      categorySpending: categorySpending.map((c) => ({
        categoryName: c.categoryName,
        amount: c.amount,
        count: c.count,
      })),
      categoryIncome: categoryIncome.map((c) => ({
        categoryName: c.categoryName,
        amount: c.amount,
        count: c.count,
      })),
      transactions: activeTransactions,
      categories,
      wallets,
    };
  }, [
    scope,
    effectiveCycle,
    totalExpense,
    totalIncome,
    netSavings,
    savingsRate,
    dailyAverageSpend,
    effectiveBudget,
    effectiveIncomeGoal,
    curr,
    categorySpending,
    categoryIncome,
    activeTransactions,
    categories,
    wallets,
  ]);

  const handleExportReportTxt = async () => {
    setExportModalVisible(false);
    try {
      const success = await exportAnalyticsSummaryReport(exportPayload);
      if (!success) {
        Alert.alert('Sharing Unavailable', 'Unable to open share sheet on this platform.');
      }
    } catch (err: any) {
      Alert.alert('Export Failed', err.message || 'An error occurred during report export.');
    }
  };

  const handleExportCSV = async () => {
    setExportModalVisible(false);
    try {
      const success = await exportTransactionsCSV(exportPayload);
      if (!success) {
        Alert.alert('Sharing Unavailable', 'Unable to open share sheet on this platform.');
      }
    } catch (err: any) {
      Alert.alert('Export Failed', err.message || 'An error occurred during CSV export.');
    }
  };

  const handleCopySummary = async () => {
    setExportModalVisible(false);
    try {
      const text = buildAnalyticsSummaryText(exportPayload);
      await Clipboard.setStringAsync(text);
      Alert.alert('Copied to Clipboard', 'Financial analytics report has been copied to your clipboard!');
    } catch (err: any) {
      Alert.alert('Error', 'Failed to copy summary to clipboard.');
    }
  };

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

        {/* SCOPE TOGGLE PILL BAR & EXPORT BUTTON */}
        <View style={styles.scopeRow}>
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

          <TouchableOpacity
            style={[styles.exportBtn, { backgroundColor: theme.primaryContainer }]}
            onPress={() => setExportModalVisible(true)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="export-variant" size={16} color={theme.onPrimaryContainer} />
            <Text style={[styles.exportBtnText, { color: theme.onPrimaryContainer }]}>Export</Text>
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

            {/* 1B. DAILY SPENDING VELOCITY SPARKLINE CARD */}
            {dailySpendingVelocity.daysList.length > 0 && (
              <View style={[styles.velocityCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}>
                <View style={styles.velocityHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialCommunityIcons name="lightning-bolt" size={18} color="#F59E0B" />
                    <Text style={[styles.cardHeading, { color: theme.onSurface, marginBottom: 0 }]}>
                      Daily Spending Velocity
                    </Text>
                  </View>
                  <View style={[styles.velocityBadge, { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : '#D1FAE5' }]}>
                    <Text style={[styles.velocityBadgeText, { color: '#059669' }]}>
                      {dailySpendingVelocity.daysUnderAllowance}/{dailySpendingVelocity.totalTrackedDays} days within cap
                    </Text>
                  </View>
                </View>

                {/* Velocity Bars Row */}
                <View style={styles.velocityChartArea}>
                  {dailySpendingVelocity.allowance > 0 && (
                    <View style={[styles.velocityGuideline, { borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }]}>
                      <Text style={[styles.velocityGuideText, { color: theme.onSurfaceVariant }]}>
                        Cap: {formatCurrency(dailySpendingVelocity.allowance, curr)}
                      </Text>
                    </View>
                  )}

                  <View style={styles.velocityBarsRow}>
                    {dailySpendingVelocity.daysList.map((d, dIdx) => (
                      <View key={dIdx} style={styles.velocityBarCol}>
                        <View style={styles.velocityBarTrack}>
                          <View
                            style={[
                              styles.velocityBarFill,
                              {
                                height: `${Math.round(d.heightRatio * 100)}%`,
                                backgroundColor: d.amount === 0 ? (isDarkMode ? '#374151' : '#E2E8F0') : (d.isOver ? theme.error : '#10B981'),
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.velocityDayLabel, { color: theme.onSurfaceVariant }]}>{d.dayLabel}</Text>
                        <Text style={[styles.velocityDayNum, { color: d.isOver ? theme.error : theme.onSurface }]}>{d.dayNum}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* 1C. FINANCIAL CLARITY & INSIGHTS CARD */}
            {behavioralInsights && (
              <View style={[styles.insightsCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}>
                <View style={styles.insightsHeader}>
                  <MaterialCommunityIcons name="lightbulb-on-outline" size={18} color="#EAB308" />
                  <Text style={[styles.insightsTitle, { color: theme.onSurface }]}>Financial Clarity & Insights</Text>
                </View>

                {/* Ratio: Essentials vs. Lifestyle */}
                <View style={styles.insightItem}>
                  <View style={styles.insightItemTop}>
                    <Text style={[styles.insightItemLabel, { color: theme.onSurfaceVariant }]}>
                      Essentials vs. Discretionary Spending
                    </Text>
                    <Text style={[styles.insightItemValues, { color: theme.onSurface }]}>
                      {behavioralInsights.essentialsPercent}% Essentials • {behavioralInsights.lifestylePercent}% Lifestyle
                    </Text>
                  </View>
                  <View style={[styles.splitBarTrack, { backgroundColor: isDarkMode ? '#374151' : '#E2E8F0' }]}>
                    <View
                      style={[
                        styles.splitBarFill,
                        {
                          width: `${behavioralInsights.essentialsPercent}%`,
                          backgroundColor: theme.primary,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.splitBarFill,
                        {
                          width: `${behavioralInsights.lifestylePercent}%`,
                          backgroundColor: theme.tertiary || '#A855F7',
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Highlights Row */}
                <View style={styles.insightHighlightsRow}>
                  {behavioralInsights.peakDayText && (
                    <View style={[styles.insightChip, { backgroundColor: theme.pillBg }]}>
                      <MaterialCommunityIcons name="fire" size={16} color="#EF4444" />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.insightChipSub, { color: theme.onSurfaceVariant }]}>Highest Spend Day</Text>
                        <Text style={[styles.insightChipMain, { color: theme.onSurface }]} numberOfLines={1}>
                          {behavioralInsights.peakDayText}
                        </Text>
                      </View>
                    </View>
                  )}

                  {behavioralInsights.topSavingsItem && (
                    <View style={[styles.insightChip, { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7' }]}>
                      <MaterialCommunityIcons name="shield-check" size={16} color="#16A34A" />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.insightChipSub, { color: '#15803D' }]}>Top Savings Under Budget</Text>
                        <Text style={[styles.insightChipMain, { color: '#15803D' }]} numberOfLines={1}>
                          {behavioralInsights.topSavingsItem.categoryName}: {formatCurrency(behavioralInsights.topSavingsItem.budgetRemaining || 0, curr)} saved
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* 1D. CATEGORY BREAKDOWN WITH STACKED DISTRIBUTION BAR */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>Expenses by Category</Text>
                <Text style={[styles.sectionSubtitle, { color: theme.onSurfaceVariant }]}>
                  Tap any category to inspect subcategories & savings
                </Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '800', color: theme.error }}>
                {formatCurrency(totalExpense, curr)}
              </Text>
            </View>

            {/* Multi-Color Continuous Stacked Distribution Bar */}
            {totalExpense > 0 && categorySpending.length > 0 && (
              <View style={styles.distributionSection}>
                <View style={[styles.distributionBarContainer, { backgroundColor: theme.pillBg }]}>
                  {categorySpending.map((cat) => {
                    const pct = totalExpense > 0 ? cat.amount / totalExpense : 0;
                    return (
                      <TouchableOpacity
                        key={cat.categoryId}
                        style={[
                          styles.distributionSegment,
                          {
                            backgroundColor: cat.color,
                            flex: Math.max(0.01, pct),
                          },
                        ]}
                        onPress={() => toggleCategoryExpand(cat.categoryId)}
                        activeOpacity={0.8}
                      />
                    );
                  })}
                </View>

                {/* Category Pills Legend */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.legendScroll}
                  contentContainerStyle={styles.legendScrollContent}
                >
                  {categorySpending.map((cat) => {
                    const isExpanded = Boolean(expandedCategoryIds[cat.categoryId]);
                    return (
                      <TouchableOpacity
                        key={cat.categoryId}
                        style={[
                          styles.legendPill,
                          {
                            backgroundColor: isExpanded
                              ? isDarkMode
                                ? 'rgba(255,255,255,0.1)'
                                : theme.pillBg
                              : theme.cardBg,
                            borderColor: theme.divider,
                            borderWidth: 1,
                          },
                        ]}
                        onPress={() => toggleCategoryExpand(cat.categoryId)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.legendDot, { backgroundColor: cat.color }]} />
                        <Text style={[styles.legendName, { color: theme.onSurface }]}>
                          {cat.categoryName}
                        </Text>
                        <Text style={[styles.legendPercent, { color: theme.onSurfaceVariant }]}>
                          {cat.percentOfTotal}%
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {categorySpending.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: theme.cardBg, borderColor: theme.divider }]}>
                <MaterialCommunityIcons name="chart-pie" size={40} color={theme.outline} />
                <Text style={[styles.emptyText, { color: theme.onSurfaceVariant }]}>
                  No expense transactions recorded in this period.
                </Text>
              </View>
            ) : (
              categorySpending.map((cat) => {
                const isExpanded = Boolean(expandedCategoryIds[cat.categoryId]);
                const hasSubcategories = cat.subcategories.length > 0;

                return (
                  <View
                    key={cat.categoryId}
                    style={[
                      styles.categoryRowCard,
                      {
                        backgroundColor: theme.cardBg,
                        borderColor: theme.divider,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.catRowHeader}
                      onPress={() => toggleCategoryExpand(cat.categoryId)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.catIconCircle, { backgroundColor: cat.color }]}>
                        <MaterialCommunityIcons name={cat.icon as any} size={18} color="#FFFFFF" />
                      </View>
                      <View style={styles.catNameWrap}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.catNameText, { color: theme.onSurface }]}>{cat.categoryName}</Text>
                          {hasSubcategories && (
                            <View style={[styles.subCountBadge, { backgroundColor: theme.pillBg }]}>
                              <Text style={[styles.subCountBadgeText, { color: theme.onSurfaceVariant }]}>
                                {cat.subcategories.length} subs
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.catPercentText, { color: theme.onSurfaceVariant }]}>
                          {cat.percentOfTotal}% of total • {cat.count} tx
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', marginRight: 4 }}>
                        <Text style={[styles.catAmountText, { color: theme.error, fontWeight: '700' }]}>
                          {formatCurrency(cat.amount, curr)}
                        </Text>
                        {cat.budgetLimit !== undefined && cat.budgetLimit > 0 && (
                          <Text style={{ fontSize: 10, color: cat.isOverBudget ? theme.error : theme.success, fontWeight: '700' }}>
                            {cat.isOverBudget ? 'Over Cap' : `Cap: ${formatCurrency(cat.budgetLimit, curr)}`}
                          </Text>
                        )}
                      </View>
                      <MaterialCommunityIcons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={theme.onSurfaceVariant}
                      />
                    </TouchableOpacity>

                    {/* Main Category Gradient Bar */}
                    <View style={styles.catBarWrap}>
                      <GradientProgressBar
                        percent={cat.percentOfTotal}
                        color={cat.color}
                        height={7}
                        borderRadius={3.5}
                        trackColor={theme.pillBg}
                      />
                    </View>

                    {/* EXPANDED ACCORDION CONTENT: SUBCATEGORIES BREAKDOWN & HABIT INSIGHTS */}
                    {isExpanded && (
                      <View style={[styles.expandedAccordionContent, { borderTopColor: theme.divider }]}>
                        <Text style={[styles.subSectionHeaderTitle, { color: theme.onSurfaceVariant }]}>
                          SUBCATEGORY BREAKDOWN
                        </Text>

                        {cat.subcategories.map((sub) => (
                          <View key={sub.id} style={styles.subItemRow}>
                            <View style={styles.subItemHeader}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                <View style={[styles.subDot, { backgroundColor: cat.color }]} />
                                <Text style={[styles.subNameText, { color: theme.onSurface }]} numberOfLines={1}>
                                  {sub.name}
                                </Text>
                                <Text style={[styles.subTxCount, { color: theme.onSurfaceVariant }]}>
                                  ({sub.count} tx)
                                </Text>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                                <Text style={[styles.subAmountText, { color: theme.onSurface }]}>
                                  {formatCurrency(sub.amount, curr)}
                                </Text>
                                <Text style={[styles.subPercentText, { color: theme.onSurfaceVariant }]}>
                                  {sub.percentOfCategory}%
                                </Text>
                              </View>
                            </View>

                            {/* Subcategory micro progress bar with Gradient */}
                            <View style={styles.subBarWrap}>
                              <GradientProgressBar
                                percent={sub.percentOfCategory}
                                color={cat.color}
                                height={5}
                                borderRadius={2.5}
                                trackColor={theme.pillBg}
                              />
                            </View>

                            {/* Subcategory Budget / Savings Envelope tag */}
                            {sub.budgetLimit !== undefined && sub.budgetLimit > 0 && (
                              <View style={styles.subEnvelopeTag}>
                                <MaterialCommunityIcons
                                  name={sub.isOverBudget ? 'alert-circle-outline' : 'check-circle-outline'}
                                  size={12}
                                  color={sub.isOverBudget ? theme.error : theme.success}
                                />
                                <Text
                                  style={[
                                    styles.subEnvelopeText,
                                    { color: sub.isOverBudget ? theme.error : theme.success },
                                  ]}
                                >
                                  {sub.isOverBudget
                                    ? `${formatCurrency(Math.abs(sub.budgetRemaining || 0), curr)} over envelope`
                                    : `Saved ${formatCurrency(sub.budgetRemaining || 0, curr)} under envelope`}
                                </Text>
                              </View>
                            )}
                          </View>
                        ))}

                        {/* Smart Category Savings & Habit Advice Box */}
                        {cat.savingsInsight && (
                          <View
                            style={[
                              styles.categoryInsightBox,
                              {
                                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : theme.pillBg,
                                borderColor: cat.color + '55',
                              },
                            ]}
                          >
                            <MaterialCommunityIcons name="lightbulb-outline" size={16} color={cat.color} />
                            <Text style={[styles.categoryInsightText, { color: theme.onSurface }]}>
                              {cat.savingsInsight}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
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
                    <View style={styles.catBarWrap}>
                      <GradientProgressBar
                        percent={percent}
                        color={cat.color}
                        height={7}
                        borderRadius={3.5}
                        trackColor={theme.pillBg}
                      />
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
            {/* CASH FLOW COMPARISON HERO WITH INTERACTIVE DONUT PIE CHART */}
            <View style={[styles.cashflowCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}>
              <View style={styles.cashflowRow}>
                {/* Income Col (Touchable to switch Pie to Income) */}
                <TouchableOpacity
                  style={[
                    styles.cashflowCol,
                    styles.cashflowTouchableCol,
                    cashFlowPieType === 'income' && {
                      backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.08)',
                      borderColor: theme.success,
                    },
                  ]}
                  onPress={() => setCashFlowPieType('income')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.flowIcon, { backgroundColor: theme.successContainer }]}>
                    <MaterialCommunityIcons name="arrow-bottom-left" size={20} color={theme.success} />
                  </View>
                  <View style={styles.flowLabelRow}>
                    <Text style={[styles.flowLabel, { color: theme.onSurfaceVariant }]}>Total Income</Text>
                    {cashFlowPieType === 'income' && (
                      <View style={[styles.activePiePill, { backgroundColor: theme.success }]}>
                        <Text style={styles.activePiePillText}>Pie</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.flowAmount, { color: theme.success }]}>
                    {formatCurrency(totalIncome, settings.base_currency)}
                  </Text>
                </TouchableOpacity>

                <View style={[styles.flowDivider, { backgroundColor: theme.divider }]} />

                {/* Expense Col (Touchable to switch Pie to Expense) */}
                <TouchableOpacity
                  style={[
                    styles.cashflowCol,
                    styles.cashflowTouchableCol,
                    cashFlowPieType === 'expense' && {
                      backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.14)' : 'rgba(239, 68, 68, 0.08)',
                      borderColor: theme.error,
                    },
                  ]}
                  onPress={() => setCashFlowPieType('expense')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.flowIcon, { backgroundColor: theme.errorContainer }]}>
                    <MaterialCommunityIcons name="arrow-top-right" size={20} color={theme.error} />
                  </View>
                  <View style={styles.flowLabelRow}>
                    <Text style={[styles.flowLabel, { color: theme.onSurfaceVariant }]}>Total Expenses</Text>
                    {cashFlowPieType === 'expense' && (
                      <View style={[styles.activePiePill, { backgroundColor: theme.error }]}>
                        <Text style={styles.activePiePillText}>Pie</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.flowAmount, { color: theme.error }]}>
                    {formatCurrency(totalExpense, settings.base_currency)}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Dynamic Donut Pie Chart */}
              <View style={styles.pieContainer}>
                <DonutPieChart
                  slices={cashFlowPieType === 'expense' ? expensePieSlices : incomePieSlices}
                  total={cashFlowPieType === 'expense' ? totalExpense : totalIncome}
                  centerTitle={formatCurrency(
                    cashFlowPieType === 'expense' ? totalExpense : totalIncome,
                    settings.base_currency
                  )}
                  centerSubtitle={cashFlowPieType === 'expense' ? 'Expenses' : 'Income'}
                  size={155}
                  strokeWidth={20}
                  theme={theme}
                />

                {/* Pie Chart Legend Dots */}
                {(cashFlowPieType === 'expense' ? expensePieSlices : incomePieSlices).length > 0 && (
                  <View style={styles.pieLegendRow}>
                    {(cashFlowPieType === 'expense' ? expensePieSlices : incomePieSlices)
                      .slice(0, 4)
                      .map((slice, i) => (
                        <View key={i} style={styles.pieLegendItem}>
                          <View style={[styles.pieLegendDot, { backgroundColor: slice.color }]} />
                          <Text style={[styles.pieLegendText, { color: theme.onSurface }]} numberOfLines={1}>
                            {slice.name} <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700' }}>{slice.percent}%</Text>
                          </Text>
                        </View>
                      ))}
                  </View>
                )}
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

            {/* Top Categories Summary with Distribution Bar */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>Top Expense Categories</Text>
              <TouchableOpacity onPress={() => setAnalyticsFocus('expense')} activeOpacity={0.7}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.primary }}>See All & Subcategories →</Text>
              </TouchableOpacity>
            </View>

            {/* Continuous Distribution Bar */}
            {totalExpense > 0 && categorySpending.length > 0 && (
              <View style={[styles.distributionBarContainer, { backgroundColor: theme.pillBg, marginBottom: 12 }]}>
                {categorySpending.map((cat) => {
                  const pct = totalExpense > 0 ? cat.amount / totalExpense : 0;
                  return (
                    <View
                      key={cat.categoryId}
                      style={[
                        styles.distributionSegment,
                        {
                          backgroundColor: cat.color,
                          flex: Math.max(0.01, pct),
                        },
                      ]}
                    />
                  );
                })}
              </View>
            )}

            {/* Expandable Top Expense Categories with Subcategories & Gradient Bars */}
            {categorySpending.slice(0, 4).map((cat) => {
              const isExpanded = Boolean(expandedCategoryIds[cat.categoryId]);
              const hasSubcategories = cat.subcategories.length > 0;

              return (
                <View
                  key={cat.categoryId}
                  style={[
                    styles.categoryRowCard,
                    {
                      backgroundColor: theme.cardBg,
                      borderColor: theme.divider,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.catRowHeader}
                    onPress={() => toggleCategoryExpand(cat.categoryId)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.catIconCircle, { backgroundColor: cat.color }]}>
                      <MaterialCommunityIcons name={cat.icon as any} size={18} color="#FFFFFF" />
                    </View>
                    <View style={styles.catNameWrap}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.catNameText, { color: theme.onSurface }]}>{cat.categoryName}</Text>
                        {hasSubcategories && (
                          <View style={[styles.subCountBadge, { backgroundColor: theme.pillBg }]}>
                            <Text style={[styles.subCountBadgeText, { color: theme.onSurfaceVariant }]}>
                              {cat.subcategories.length} subs
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.catPercentText, { color: theme.onSurfaceVariant }]}>
                        {cat.percentOfTotal}% of total • {cat.count} tx
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', marginRight: 4 }}>
                      <Text style={[styles.catAmountText, { color: theme.onSurface, fontWeight: '700' }]}>
                        {formatCurrency(cat.amount, curr)}
                      </Text>
                      {cat.budgetLimit !== undefined && cat.budgetLimit > 0 && (
                        <Text
                          style={{
                            fontSize: 10,
                            color: cat.isOverBudget ? theme.error : theme.success,
                            fontWeight: '700',
                          }}
                        >
                          {cat.isOverBudget ? 'Over Cap' : `Cap: ${formatCurrency(cat.budgetLimit, curr)}`}
                        </Text>
                      )}
                    </View>
                    <MaterialCommunityIcons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={theme.onSurfaceVariant}
                    />
                  </TouchableOpacity>

                  {/* Main Category Gradient Bar */}
                  <View style={styles.catBarWrap}>
                    <GradientProgressBar
                      percent={cat.percentOfTotal}
                      color={cat.color}
                      height={6}
                      borderRadius={3}
                      trackColor={theme.pillBg}
                    />
                  </View>

                  {/* EXPANDED ACCORDION: SUBCATEGORIES BREAKDOWN */}
                  {isExpanded && (
                    <View style={[styles.expandedAccordionContent, { borderTopColor: theme.divider }]}>
                      <Text style={[styles.subSectionHeaderTitle, { color: theme.onSurfaceVariant }]}>
                        SUBCATEGORY BREAKDOWN
                      </Text>

                      {cat.subcategories.map((sub) => (
                        <View key={sub.id} style={styles.subItemRow}>
                          <View style={styles.subItemHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                              <View style={[styles.subDot, { backgroundColor: cat.color }]} />
                              <Text style={[styles.subNameText, { color: theme.onSurface }]} numberOfLines={1}>
                                {sub.name}
                              </Text>
                              <Text style={[styles.subTxCount, { color: theme.onSurfaceVariant }]}>
                                ({sub.count} tx)
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                              <Text style={[styles.subAmountText, { color: theme.onSurface }]}>
                                {formatCurrency(sub.amount, curr)}
                              </Text>
                              <Text style={[styles.subPercentText, { color: theme.onSurfaceVariant }]}>
                                {sub.percentOfCategory}%
                              </Text>
                            </View>
                          </View>

                          {/* Subcategory micro gradient progress bar */}
                          <View style={styles.subBarWrap}>
                            <GradientProgressBar
                              percent={sub.percentOfCategory}
                              color={cat.color}
                              height={4}
                              borderRadius={2}
                              trackColor={theme.pillBg}
                            />
                          </View>

                          {/* Subcategory Budget Envelope tag */}
                          {sub.budgetLimit !== undefined && sub.budgetLimit > 0 && (
                            <View style={styles.subEnvelopeTag}>
                              <MaterialCommunityIcons
                                name={sub.isOverBudget ? 'alert-circle-outline' : 'check-circle-outline'}
                                size={12}
                                color={sub.isOverBudget ? theme.error : theme.success}
                              />
                              <Text
                                style={[
                                  styles.subEnvelopeText,
                                  { color: sub.isOverBudget ? theme.error : theme.success },
                                ]}
                              >
                                {sub.isOverBudget
                                  ? `Over cap by ${formatCurrency(Math.abs(sub.budgetRemaining || 0), curr)}`
                                  : `Under cap: ${formatCurrency(sub.budgetRemaining || 0, curr)} left`}
                              </Text>
                            </View>
                          )}
                        </View>
                      ))}

                      {/* Category Savings / Habit Insight if any */}
                      {cat.savingsInsight && (
                        <View
                          style={[
                            styles.categoryInsightBox,
                            {
                              backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.1)' : 'rgba(14, 165, 233, 0.08)',
                              borderColor: isDarkMode ? 'rgba(56, 189, 248, 0.25)' : 'rgba(14, 165, 233, 0.2)',
                            },
                          ]}
                        >
                          <MaterialCommunityIcons name="lightbulb-on-outline" size={16} color={theme.tertiary} />
                          <Text style={[styles.categoryInsightText, { color: theme.onSurface }]}>
                            {cat.savingsInsight}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
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

      {/* EXPORT ANALYTICS MODAL */}
      <Modal
        visible={exportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setExportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.exportModalBox, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialCommunityIcons name="export-variant" size={22} color={theme.primary} />
                <Text style={[styles.modalTitle, { color: theme.onSurface }]}>Export Analytics</Text>
              </View>
              <TouchableOpacity
                onPress={() => setExportModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="close" size={22} color={theme.onSurface} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.exportModalSubtitle, { color: theme.onSurfaceVariant }]}>
              {exportPayload.timeframe} • {exportPayload.transactions.length} transactions
            </Text>

            <View style={styles.exportOptionsList}>
              {/* Option 1: Financial Summary (.txt) */}
              <TouchableOpacity
                style={[styles.exportOptionCard, { backgroundColor: theme.pillBg, borderColor: theme.divider }]}
                onPress={handleExportReportTxt}
                activeOpacity={0.7}
              >
                <View style={[styles.exportOptionIconCircle, { backgroundColor: theme.primaryContainer }]}>
                  <MaterialCommunityIcons name="file-document-outline" size={22} color={theme.primary} />
                </View>
                <View style={styles.exportOptionTextWrap}>
                  <Text style={[styles.exportOptionTitle, { color: theme.onSurface }]}>
                    Financial Summary Report (.txt)
                  </Text>
                  <Text style={[styles.exportOptionDesc, { color: theme.onSurfaceVariant }]}>
                    Cash flow, savings rate, budget targets & category breakdown
                  </Text>
                </View>
                <MaterialCommunityIcons name="share-variant-outline" size={18} color={theme.primary} />
              </TouchableOpacity>

              {/* Option 2: Transactions CSV */}
              <TouchableOpacity
                style={[styles.exportOptionCard, { backgroundColor: theme.pillBg, borderColor: theme.divider }]}
                onPress={handleExportCSV}
                activeOpacity={0.7}
              >
                <View style={[styles.exportOptionIconCircle, { backgroundColor: '#DCFCE7' }]}>
                  <MaterialCommunityIcons name="file-delimited-outline" size={22} color="#15803D" />
                </View>
                <View style={styles.exportOptionTextWrap}>
                  <Text style={[styles.exportOptionTitle, { color: theme.onSurface }]}>
                    Transactions Spreadsheet (.csv)
                  </Text>
                  <Text style={[styles.exportOptionDesc, { color: theme.onSurfaceVariant }]}>
                    Full transactions list ready for Excel, Google Sheets, or Numbers
                  </Text>
                </View>
                <MaterialCommunityIcons name="share-variant-outline" size={18} color="#15803D" />
              </TouchableOpacity>

              {/* Option 3: Copy to Clipboard */}
              <TouchableOpacity
                style={[styles.exportOptionCard, { backgroundColor: theme.pillBg, borderColor: theme.divider }]}
                onPress={handleCopySummary}
                activeOpacity={0.7}
              >
                <View style={[styles.exportOptionIconCircle, { backgroundColor: '#EDE9FE' }]}>
                  <MaterialCommunityIcons name="content-copy" size={22} color="#7C3AED" />
                </View>
                <View style={styles.exportOptionTextWrap}>
                  <Text style={[styles.exportOptionTitle, { color: theme.onSurface }]}>
                    Copy Summary to Clipboard
                  </Text>
                  <Text style={[styles.exportOptionDesc, { color: theme.onSurfaceVariant }]}>
                    Fast copy to paste into personal notes, messages, or emails
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color="#7C3AED" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.exportCancelBtn, { borderColor: theme.divider }]}
              onPress={() => setExportModalVisible(false)}
            >
              <Text style={[styles.exportCancelBtnText, { color: theme.onSurfaceVariant }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  scopeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  scopeBar: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: M3Shape.full,
    padding: 3,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: M3Shape.full,
  },
  exportBtnText: {
    fontSize: 12,
    fontWeight: '700',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    padding: 16,
  },
  exportModalBox: {
    borderRadius: M3Shape.extraLarge,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  exportModalSubtitle: {
    fontSize: 12.5,
    marginBottom: 16,
  },
  exportOptionsList: {
    gap: 10,
    marginBottom: 16,
  },
  exportOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: M3Shape.large,
    borderWidth: 1,
    gap: 12,
  },
  exportOptionIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportOptionTextWrap: {
    flex: 1,
  },
  exportOptionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  exportOptionDesc: {
    fontSize: 11.5,
    lineHeight: 15,
  },
  exportCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: M3Shape.full,
    borderWidth: 1,
    alignSelf: 'center',
  },
  exportCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Velocity Sparkline
  velocityCard: {
    borderWidth: 1,
    borderRadius: M3Shape.extraLarge,
    padding: 16,
    marginBottom: 14,
  },
  velocityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  velocityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: M3Shape.full,
  },
  velocityBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  velocityChartArea: {
    position: 'relative',
    height: 90,
    justifyContent: 'flex-end',
  },
  velocityGuideline: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    zIndex: 1,
  },
  velocityGuideText: {
    fontSize: 9.5,
    fontWeight: '700',
    alignSelf: 'flex-end',
    marginBottom: 2,
  },
  velocityBarsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 75,
  },
  velocityBarCol: {
    alignItems: 'center',
    flex: 1,
  },
  velocityBarTrack: {
    width: 14,
    height: 52,
    justifyContent: 'flex-end',
    borderRadius: 7,
    overflow: 'hidden',
    marginBottom: 4,
  },
  velocityBarFill: {
    width: '100%',
    borderRadius: 7,
  },
  velocityDayLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  velocityDayNum: {
    fontSize: 9.5,
    fontWeight: '700',
  },

  // Financial Clarity Insights Card
  insightsCard: {
    borderWidth: 1,
    borderRadius: M3Shape.extraLarge,
    padding: 16,
    marginBottom: 14,
  },
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  insightsTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  insightItem: {
    marginBottom: 12,
  },
  insightItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  insightItemLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  insightItemValues: {
    fontSize: 11,
    fontWeight: '700',
  },
  splitBarTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  splitBarFill: {
    height: '100%',
  },
  insightHighlightsRow: {
    gap: 8,
  },
  insightChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: M3Shape.medium,
  },
  insightChipSub: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  insightChipMain: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },

  // Multi-Color Continuous Distribution Bar & Legend
  distributionSection: {
    marginBottom: 14,
  },
  distributionBarContainer: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    gap: 1.5,
  },
  distributionSegment: {
    height: '100%',
  },
  legendScroll: {
    marginTop: 10,
  },
  legendScrollContent: {
    gap: 8,
    paddingVertical: 2,
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: M3Shape.full,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendName: {
    fontSize: 11,
    fontWeight: '700',
  },
  legendPercent: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Accordion & Subcategories Breakdown
  subCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: M3Shape.full,
  },
  subCountBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  expandedAccordionContent: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  subSectionHeaderTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  subListWrap: {
    gap: 10,
  },
  subItemRow: {
    gap: 4,
  },
  subItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  subNameText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  subTxCount: {
    fontSize: 10.5,
  },
  subAmountText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  subPercentText: {
    fontSize: 11,
  },
  subBarTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  subBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  subEnvelopeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  subEnvelopeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  categoryInsightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: M3Shape.medium,
    borderWidth: 1,
    marginTop: 12,
  },
  categoryInsightText: {
    fontSize: 11.5,
    flex: 1,
    lineHeight: 16,
    fontWeight: '600',
  },
  cashflowTouchableCol: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: M3Shape.medium,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  flowLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginVertical: 2,
  },
  activePiePill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
  },
  activePiePillText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  pieContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  pieCenterLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieCenterSub: {
    fontSize: 9.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  pieCenterMain: {
    fontSize: 14.5,
    fontWeight: '800',
    textAlign: 'center',
  },
  pieLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    paddingHorizontal: 10,
  },
  pieLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pieLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pieLegendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  catBarWrap: {
    marginTop: 8,
    width: '100%',
  },
  subBarWrap: {
    marginTop: 4,
    marginBottom: 4,
    width: '100%',
  },
});
