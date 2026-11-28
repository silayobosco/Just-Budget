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
  Line,
  Text as SvgText,
} from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBudget } from '../context/BudgetContext';
import { lightTheme, darkTheme, M3Shape, M3Elevation } from '../theme';
import { formatCurrency } from '../utils/format';
import { Transaction, TransactionType, BillFrequency, RecurrenceEndType } from '../types';
import { CategoryManagerModal } from '../components/CategoryManagerModal';
import { TransactionDetailModal } from '../components/TransactionDetailModal';
import { TransactionDetailsModal } from '../components/TransactionDetailsModal';
import { TabType } from '../components/BottomTabs';
import { CalendarPickerModal } from '../components/CalendarPickerModal';
import { DebtsModal } from '../components/DebtsModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  id?: string;
  color: string;
  percent: number;
  isPopped?: boolean;
}

export const AdvancedDonutChart: React.FC<{
  slices: DonutSlice[];
  total: number;
  centerTitle: string;
  centerSubtitle: string;
  onSlicePress?: (sliceId: string) => void;
  onResetPress?: () => void;
  isZoomed?: boolean;
  theme: any;
}> = ({
  slices,
  total,
  centerTitle,
  centerSubtitle,
  onSlicePress,
  onResetPress,
  isZoomed = false,
  theme,
}) => {
    const chartWidth = Math.min(350, Dimensions.get('window').width - 32);
    const chartHeight = 270;
    const cx = chartWidth / 2;
    const cy = chartHeight / 2;
    const outerRadius = 76;
    const innerRadius = 46;

    if (total <= 0 || slices.length === 0) {
      return (
        <View style={{ width: chartWidth, height: chartHeight, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <Svg width={chartWidth} height={chartHeight}>
            <Circle
              cx={cx}
              cy={cy}
              r={outerRadius - 15}
              stroke={theme.divider}
              strokeWidth={30}
              fill="none"
            />
          </Svg>
          <View pointerEvents="none" style={[styles.pieCenterLabel, { width: innerRadius * 1.8, height: innerRadius * 1.8 }]}>
            <Text style={[styles.pieCenterSub, { color: theme.onSurfaceVariant }]}>No Data</Text>
          </View>
        </View>
      );
    }

    // Pre-calculate angles for each slice
    let cumulativeAngle = -Math.PI / 2;
    const sliceAngles = slices.map((slice) => {
      const angle = (slice.amount / total) * (2 * Math.PI);
      const start = cumulativeAngle;
      const end = cumulativeAngle + angle;
      const mid = (start + end) / 2;
      cumulativeAngle = end;
      return { slice, angle, start, end, mid };
    });

    return (
      <View style={{ width: chartWidth, height: chartHeight, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <Svg width={chartWidth} height={chartHeight}>
          {/* Slices Paths */}
          <G>
            {sliceAngles.map((item, idx) => {
              const { slice, angle, start, end, mid } = item;
              const isPopped = Boolean(slice.isPopped);
              const popDistance = isPopped ? 8 : 0;
              const curOuterR = isPopped ? outerRadius + 8 : outerRadius;
              const curInnerR = innerRadius;

              const sliceCx = cx + popDistance * Math.cos(mid);
              const sliceCy = cy + popDistance * Math.sin(mid);

              if (slices.length === 1 || slice.percent >= 99) {
                return (
                  <Circle
                    key={idx}
                    cx={sliceCx}
                    cy={sliceCy}
                    r={(curOuterR + curInnerR) / 2}
                    stroke={slice.color}
                    strokeWidth={curOuterR - curInnerR}
                    fill="none"
                    onPress={() => slice.id && onSlicePress?.(slice.id)}
                  />
                );
              }

              const x1 = sliceCx + curOuterR * Math.cos(start);
              const y1 = sliceCy + curOuterR * Math.sin(start);
              const x2 = sliceCx + curOuterR * Math.cos(end);
              const y2 = sliceCy + curOuterR * Math.sin(end);

              const x3 = sliceCx + curInnerR * Math.cos(end);
              const y3 = sliceCy + curInnerR * Math.sin(end);
              const x4 = sliceCx + curInnerR * Math.cos(start);
              const y4 = sliceCy + curInnerR * Math.sin(start);

              const largeArc = angle > Math.PI ? 1 : 0;
              const pathData = `M ${x1} ${y1} A ${curOuterR} ${curOuterR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${curInnerR} ${curInnerR} 0 ${largeArc} 0 ${x4} ${y4} Z`;

              return (
                <Path
                  key={idx}
                  d={pathData}
                  fill={slice.color}
                  stroke={theme.cardBg}
                  strokeWidth={1.5}
                  onPress={() => slice.id && onSlicePress?.(slice.id)}
                />
              );
            })}
          </G>

          {/* Slice Inside Percentages */}
          <G pointerEvents="none">
            {sliceAngles.map((item, idx) => {
              const { slice, angle, mid } = item;
              if (slice.percent < 3 || angle < 0.2) return null;

              const isPopped = Boolean(slice.isPopped);
              const popDistance = isPopped ? 8 : 0;
              const curOuterR = isPopped ? outerRadius + 8 : outerRadius;
              const rMid = (innerRadius + curOuterR) / 2;

              const tx = cx + popDistance * Math.cos(mid) + rMid * Math.cos(mid);
              const ty = cy + popDistance * Math.sin(mid) + rMid * Math.sin(mid);

              return (
                <SvgText
                  key={`pct-${idx}`}
                  x={tx}
                  y={ty + 3}
                  fill="#FFFFFF"
                  fontSize={slice.percent >= 10 ? 9.5 : 8.5}
                  fontWeight="800"
                  textAnchor="middle"
                >
                  {`${slice.percent}%`}
                </SvgText>
              );
            })}
          </G>

          {/* Leader Lines & Callout Labels */}
          <G pointerEvents="none">
            {sliceAngles.slice(0, 8).map((item, idx) => {
              const { slice, mid } = item;
              if (slice.percent < 1.5) return null;

              const isPopped = Boolean(slice.isPopped);
              const popDistance = isPopped ? 8 : 0;
              const curOuterR = isPopped ? outerRadius + 8 : outerRadius;

              const sliceCx = cx + popDistance * Math.cos(mid);
              const sliceCy = cy + popDistance * Math.sin(mid);

              const startR = curOuterR + 3;
              const elbowR = startR + 13;

              const pStartX = sliceCx + startR * Math.cos(mid);
              const pStartY = sliceCy + startR * Math.sin(mid);
              const pElbowX = sliceCx + elbowR * Math.cos(mid);
              const pElbowY = sliceCy + elbowR * Math.sin(mid);

              const isRight = Math.cos(mid) >= 0;
              const horizontalLen = 14;
              const pEndX = pElbowX + (isRight ? horizontalLen : -horizontalLen);
              const pEndY = pElbowY;

              const labelX = pEndX + (isRight ? 4 : -4);
              const labelY = pEndY + 3.5;
              const cleanName = slice.name.length > 12 ? slice.name.slice(0, 11) + '…' : slice.name;

              return (
                <G key={`leader-${idx}`}>
                  <Path
                    d={`M ${pStartX} ${pStartY} L ${pElbowX} ${pElbowY} L ${pEndX} ${pEndY}`}
                    stroke={slice.color}
                    strokeWidth={1.2}
                    fill="none"
                    opacity={0.85}
                  />
                  <SvgText
                    x={labelX}
                    y={labelY}
                    fill={theme.onSurface}
                    fontSize={10.5}
                    fontWeight="700"
                    textAnchor={isRight ? 'start' : 'end'}
                  >
                    {cleanName}
                  </SvgText>
                </G>
              );
            })}
          </G>
        </Svg>

        {/* Center Circle Content */}
        <View
          pointerEvents="box-none"
          style={[
            styles.pieCenterLabel,
            {
              width: innerRadius * 1.8,
              height: innerRadius * 1.8,
              borderRadius: (innerRadius * 1.8) / 2,
              backgroundColor: theme.cardBg,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: 2,
            },
          ]}
        >
          <Text style={[styles.pieCenterSub, { color: theme.onSurfaceVariant }]} numberOfLines={1}>
            {centerSubtitle}
          </Text>
          <Text style={[styles.pieCenterMain, { color: theme.onSurface }]} numberOfLines={1}>
            {centerTitle}
          </Text>
          {isZoomed && onResetPress && (
            <TouchableOpacity
              style={[styles.unzoomPill, { backgroundColor: theme.primaryContainer }]}
              onPress={onResetPress}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="arrow-left" size={11} color={theme.onPrimaryContainer} />
              <Text style={[styles.unzoomPillText, { color: theme.onPrimaryContainer }]}>All</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

export const DonutPieChart = AdvancedDonutChart;

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

export interface AnalyticsFilterModalProps {
  visible: boolean;
  filterMode: 'cycle' | 'week' | 'all' | 'day';
  weekPreset: 'this_week' | 'last_week';
  selectedCycleId: string | null;
  selectedDay: string;
  paymentStatus: 'all' | 'paid' | 'unpaid';
  allCycles: any[];
  activeCycle: any;
  theme: any;
  isDarkMode: boolean;
  insets: any;
  onClose: () => void;
  onApply: (params: {
    filterMode: 'cycle' | 'week' | 'all' | 'day';
    weekPreset: 'this_week' | 'last_week';
    selectedCycleId: string | null;
    selectedDay: string;
    paymentStatus: 'all' | 'paid' | 'unpaid';
  }) => void;
  onOpenCalendar: () => void;
}

export const AnalyticsFilterModal: React.FC<AnalyticsFilterModalProps> = ({
  visible,
  filterMode,
  weekPreset,
  selectedCycleId,
  selectedDay,
  paymentStatus,
  allCycles,
  activeCycle,
  theme,
  isDarkMode,
  insets,
  onClose,
  onApply,
  onOpenCalendar,
}) => {
  const [tempMode, setTempMode] = useState<'cycle' | 'week' | 'all' | 'day'>(filterMode);
  const [tempWeekPreset, setTempWeekPreset] = useState<'this_week' | 'last_week'>(weekPreset);
  const [tempCycleId, setTempCycleId] = useState<string | null>(selectedCycleId);
  const [tempDay, setTempDay] = useState<string>(selectedDay);
  const [tempPaymentStatus, setTempPaymentStatus] = useState<'all' | 'paid' | 'unpaid'>(paymentStatus);

  useEffect(() => {
    if (visible) {
      setTempMode(filterMode);
      setTempWeekPreset(weekPreset);
      setTempCycleId(selectedCycleId);
      setTempDay(selectedDay);
      setTempPaymentStatus(paymentStatus);
    }
  }, [visible, filterMode, weekPreset, selectedCycleId, selectedDay, paymentStatus]);

  const handleApply = () => {
    onApply({
      filterMode: tempMode,
      weekPreset: tempWeekPreset,
      selectedCycleId: tempCycleId,
      selectedDay: tempDay,
      paymentStatus: tempPaymentStatus,
    });
    onClose();
  };

  const handleReset = () => {
    setTempMode('cycle');
    setTempWeekPreset('this_week');
    setTempCycleId(null);
    setTempDay(new Date().toISOString().slice(0, 10));
    setTempPaymentStatus('all');
  };

  const formattedDayStr = useMemo(() => {
    const d = new Date(tempDay + 'T00:00:00');
    return !isNaN(d.getTime())
      ? d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
      : tempDay;
  }, [tempDay]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.filterModalBackdrop}>
        <TouchableOpacity style={styles.filterModalDismissArea} activeOpacity={1} onPress={onClose} />
        <View
          style={[
            styles.filterModalSheet,
            {
              backgroundColor: theme.surface,
              paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 36 : 16) + 12,
            },
            M3Elevation.level3,
          ]}
        >
          {/* Drag Handle */}
          <View style={styles.dragHandleRow}>
            <View style={[styles.dragHandlePill, { backgroundColor: theme.outlineVariant }]} />
          </View>

          {/* Header */}
          <View style={styles.filterModalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.filterIconCircle, { backgroundColor: theme.primaryContainer }]}>
                <MaterialCommunityIcons name="filter-variant" size={18} color={theme.onPrimaryContainer} />
              </View>
              <Text style={[styles.filterModalTitle, { color: theme.onSurface }]}>Filter Analytics</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.filterCloseBtn, { backgroundColor: theme.pillBg }]}>
              <MaterialCommunityIcons name="close" size={18} color={theme.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {/* Section 1: Timeframe Mode */}
            <Text style={[styles.filterSectionLabel, { color: theme.onSurfaceVariant }]}>TIMEFRAME</Text>
            <View style={[styles.filterModeTabRow, { backgroundColor: theme.pillBg }]}>
              <TouchableOpacity
                style={[styles.filterModeTab, tempMode === 'cycle' && { backgroundColor: theme.primaryContainer }]}
                onPress={() => setTempMode('cycle')}
              >
                <MaterialCommunityIcons
                  name="sync"
                  size={14}
                  color={tempMode === 'cycle' ? theme.onPrimaryContainer : theme.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.filterModeTabText,
                    {
                      color: tempMode === 'cycle' ? theme.onPrimaryContainer : theme.onSurfaceVariant,
                      fontWeight: tempMode === 'cycle' ? '700' : '500',
                    },
                  ]}
                >
                  Cycles
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterModeTab, tempMode === 'week' && { backgroundColor: theme.primaryContainer }]}
                onPress={() => setTempMode('week')}
              >
                <MaterialCommunityIcons
                  name="calendar-week"
                  size={14}
                  color={tempMode === 'week' ? theme.onPrimaryContainer : theme.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.filterModeTabText,
                    {
                      color: tempMode === 'week' ? theme.onPrimaryContainer : theme.onSurfaceVariant,
                      fontWeight: tempMode === 'week' ? '700' : '500',
                    },
                  ]}
                >
                  Weekly
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterModeTab, tempMode === 'all' && { backgroundColor: theme.primaryContainer }]}
                onPress={() => setTempMode('all')}
              >
                <MaterialCommunityIcons
                  name="all-inclusive"
                  size={14}
                  color={tempMode === 'all' ? theme.onPrimaryContainer : theme.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.filterModeTabText,
                    {
                      color: tempMode === 'all' ? theme.onPrimaryContainer : theme.onSurfaceVariant,
                      fontWeight: tempMode === 'all' ? '700' : '500',
                    },
                  ]}
                >
                  All Time
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterModeTab, tempMode === 'day' && { backgroundColor: theme.primaryContainer }]}
                onPress={() => setTempMode('day')}
              >
                <MaterialCommunityIcons
                  name="calendar-today"
                  size={14}
                  color={tempMode === 'day' ? theme.onPrimaryContainer : theme.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.filterModeTabText,
                    {
                      color: tempMode === 'day' ? theme.onPrimaryContainer : theme.onSurfaceVariant,
                      fontWeight: tempMode === 'day' ? '700' : '500',
                    },
                  ]}
                >
                  Specific Day
                </Text>
              </TouchableOpacity>
            </View>

            {/* Timeframe sub-selection */}
            {tempMode === 'week' && (
              <View style={styles.filterSubSection}>
                <Text style={[styles.filterSubLabel, { color: theme.onSurfaceVariant }]}>SELECT WEEK</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(
                    [
                      { key: 'this_week', label: 'This Week (Mon–Sun)' },
                      { key: 'last_week', label: 'Last Week' },
                    ] as const
                  ).map((wk) => {
                    const active = tempWeekPreset === wk.key;
                    return (
                      <TouchableOpacity
                        key={wk.key}
                        onPress={() => setTempWeekPreset(wk.key)}
                        style={[
                          styles.cycleSelectItem,
                          {
                            flex: 1,
                            backgroundColor: active ? theme.primaryContainer : theme.cardBg,
                            borderColor: active ? theme.primary : theme.divider,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.cycleSelectName,
                            { color: active ? theme.onPrimaryContainer : theme.onSurface, fontSize: 12.5 },
                          ]}
                        >
                          {wk.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {tempMode === 'cycle' && (
              <View style={styles.filterSubSection}>
                <Text style={[styles.filterSubLabel, { color: theme.onSurfaceVariant }]}>SELECT BUDGET CYCLE</Text>
                {allCycles.length === 0 ? (
                  <View style={[styles.cycleSelectItem, { backgroundColor: theme.cardBg, borderColor: theme.primary }]}>
                    <Text style={[styles.cycleSelectName, { color: theme.onSurface }]}>Current Cycle</Text>
                    <MaterialCommunityIcons name="check-circle" size={18} color={theme.primary} />
                  </View>
                ) : (
                  allCycles.map((c) => {
                    const isSelected = tempCycleId ? tempCycleId === c.id : c.id === activeCycle?.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.cycleSelectItem,
                          {
                            backgroundColor: isSelected
                              ? (isDarkMode ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)')
                              : theme.cardBg,
                            borderColor: isSelected ? theme.primary : theme.divider,
                          },
                        ]}
                        onPress={() => setTempCycleId(c.id)}
                        activeOpacity={0.7}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.cycleSelectName, { color: theme.onSurface }]}>{c.name}</Text>
                            {c.is_active && (
                              <View style={[styles.activeCycleBadge, { backgroundColor: theme.successContainer }]}>
                                <Text style={[styles.activeCycleBadgeText, { color: theme.success }]}>Active</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.cycleSelectDates, { color: theme.onSurfaceVariant }]}>
                            {c.start_date} to {c.end_date}
                          </Text>
                        </View>
                        <MaterialCommunityIcons
                          name={isSelected ? 'radiobox-marked' : 'radiobox-blank'}
                          size={20}
                          color={isSelected ? theme.primary : theme.outline}
                        />
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            )}

            {tempMode === 'all' && (
              <View style={[styles.allTimeInfoBox, { backgroundColor: theme.pillBg }]}>
                <MaterialCommunityIcons name="information-outline" size={16} color={theme.primary} />
                <Text style={[styles.allTimeInfoText, { color: theme.onSurfaceVariant }]}>
                  Displays complete financial history across all recorded transactions without cycle or date limits.
                </Text>
              </View>
            )}

            {tempMode === 'day' && (
              <View style={styles.filterSubSection}>
                <Text style={[styles.filterSubLabel, { color: theme.onSurfaceVariant }]}>SELECT DAY</Text>
                <TouchableOpacity
                  style={[styles.specificDayCard, { backgroundColor: theme.cardBg, borderColor: theme.primary }]}
                  onPress={onOpenCalendar}
                  activeOpacity={0.8}
                >
                  <View style={[styles.dayCardIcon, { backgroundColor: theme.primaryContainer }]}>
                    <MaterialCommunityIcons name="calendar" size={18} color={theme.onPrimaryContainer} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dayCardTitle, { color: theme.onSurface }]}>{formattedDayStr}</Text>
                    <Text style={[styles.dayCardSub, { color: theme.onSurfaceVariant }]}>Tap to change in calendar</Text>
                  </View>
                  <MaterialCommunityIcons name="pencil-outline" size={16} color={theme.primary} />
                </TouchableOpacity>

                {/* Quick Date Chips */}
                <View style={styles.quickDayRow}>
                  <TouchableOpacity
                    style={[
                      styles.quickDayChip,
                      {
                        backgroundColor: tempDay === todayStr ? theme.primaryContainer : theme.pillBg,
                        borderColor: tempDay === todayStr ? theme.primary : theme.outlineVariant,
                      },
                    ]}
                    onPress={() => setTempDay(todayStr)}
                  >
                    <Text
                      style={[
                        styles.quickDayChipText,
                        { color: tempDay === todayStr ? theme.onPrimaryContainer : theme.onSurface },
                      ]}
                    >
                      Today
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.quickDayChip,
                      {
                        backgroundColor: tempDay === yesterdayStr ? theme.primaryContainer : theme.pillBg,
                        borderColor: tempDay === yesterdayStr ? theme.primary : theme.outlineVariant,
                      },
                    ]}
                    onPress={() => setTempDay(yesterdayStr)}
                  >
                    <Text
                      style={[
                        styles.quickDayChipText,
                        { color: tempDay === yesterdayStr ? theme.onPrimaryContainer : theme.onSurface },
                      ]}
                    >
                      Yesterday
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.quickDayChip, { backgroundColor: theme.pillBg, borderColor: theme.outlineVariant }]}
                    onPress={onOpenCalendar}
                  >
                    <MaterialCommunityIcons name="calendar-month-outline" size={13} color={theme.primary} />
                    <Text style={[styles.quickDayChipText, { color: theme.primary }]}>Calendar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Section 2: Payment Status */}
            <Text style={[styles.filterSectionLabel, { color: theme.onSurfaceVariant, marginTop: 18 }]}>
              PAYMENT STATUS
            </Text>
            <View style={styles.statusOptionRow}>
              <TouchableOpacity
                style={[
                  styles.statusOptionPill,
                  {
                    backgroundColor: tempPaymentStatus === 'all' ? theme.primaryContainer : theme.pillBg,
                    borderColor: tempPaymentStatus === 'all' ? theme.primary : theme.outlineVariant,
                  },
                ]}
                onPress={() => setTempPaymentStatus('all')}
              >
                <MaterialCommunityIcons
                  name="check-all"
                  size={15}
                  color={tempPaymentStatus === 'all' ? theme.onPrimaryContainer : theme.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.statusOptionText,
                    {
                      color: tempPaymentStatus === 'all' ? theme.onPrimaryContainer : theme.onSurface,
                      fontWeight: tempPaymentStatus === 'all' ? '800' : '600',
                    },
                  ]}
                >
                  All
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusOptionPill,
                  {
                    backgroundColor: tempPaymentStatus === 'paid' ? theme.successContainer : theme.pillBg,
                    borderColor: tempPaymentStatus === 'paid' ? theme.success : theme.outlineVariant,
                  },
                ]}
                onPress={() => setTempPaymentStatus('paid')}
              >
                <MaterialCommunityIcons
                  name="check-circle"
                  size={15}
                  color={tempPaymentStatus === 'paid' ? theme.success : theme.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.statusOptionText,
                    {
                      color: tempPaymentStatus === 'paid' ? theme.success : theme.onSurface,
                      fontWeight: tempPaymentStatus === 'paid' ? '800' : '600',
                    },
                  ]}
                >
                  Paid Only
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusOptionPill,
                  {
                    backgroundColor: tempPaymentStatus === 'unpaid' ? theme.errorContainer : theme.pillBg,
                    borderColor: tempPaymentStatus === 'unpaid' ? theme.error : theme.outlineVariant,
                  },
                ]}
                onPress={() => setTempPaymentStatus('unpaid')}
              >
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={15}
                  color={tempPaymentStatus === 'unpaid' ? theme.error : theme.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.statusOptionText,
                    {
                      color: tempPaymentStatus === 'unpaid' ? theme.error : theme.onSurface,
                      fontWeight: tempPaymentStatus === 'unpaid' ? '800' : '600',
                    },
                  ]}
                >
                  Unpaid Only
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Action Buttons Footer */}
          <View style={[styles.filterModalFooter, { borderTopColor: theme.divider }]}>
            <TouchableOpacity
              style={[styles.filterResetBtn, { backgroundColor: theme.pillBg }]}
              onPress={handleReset}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterResetBtnText, { color: theme.onSurfaceVariant }]}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterApplyBtn, { backgroundColor: theme.primary }, M3Elevation.level2]}
              onPress={handleApply}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
              <Text style={styles.filterApplyBtnText}>Apply Filter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export const AnalyticsScreen: React.FC<{ onNavigateTab?: (tab: TabType) => void }> = ({ onNavigateTab }) => {
  const insets = useSafeAreaInsets();
  const {
    settings,
    transactions,
    categories,
    wallets,
    debts,
    allCycles,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addSubcategory,
    setCalendarCategoryFilterId,
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
    getEffectiveAmount,
  } = useBudget();

  const isDarkMode = settings.theme_mode === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;
  const curr = settings.base_currency;
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Filter states (Cycles picker, Weekly, All Time, Specific Day, Paid/Unpaid)
  const [filterMode, setFilterMode] = useState<'cycle' | 'week' | 'all' | 'day'>('cycle');
  const [weekPreset, setWeekPreset] = useState<'this_week' | 'last_week'>('this_week');
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [paymentStatus, setPaymentStatus] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [calendarPickerVisible, setCalendarPickerVisible] = useState(false);

  // Accordion state for expandable categories
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Record<string, boolean>>({});

  // Zoomed category in Expense Analyzer for drilldown subcategory Donut chart
  const [zoomedCategoryId, setZoomedCategoryId] = useState<string | null>(null);

  // Category / Subcategory Transactions Drilldown Sheet
  const [drilldownFilter, setDrilldownFilter] = useState<{
    categoryId: string;
    categoryName: string;
    subcategoryId?: string;
    subcategoryName?: string;
    txType: 'expense' | 'income';
    color: string;
  } | null>(null);
  const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const toggleCategoryExpand = (catId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCategoryIds((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  // Floating Action Button (FAB) Speed-Dial & Add Transaction Modal states
  const [reportTab, setReportTab] = useState<'cashflow' | 'spending' | 'loans' | 'transfers' | 'exports'>(
    analyticsFocus === 'expense' ? 'spending' : 'cashflow'
  );
  const [moduleMenuVisible, setModuleMenuVisible] = useState(false);
  useEffect(() => {
    if (analyticsFocus === 'expense') {
      setReportTab('spending');
    } else if (analyticsFocus === 'income' || analyticsFocus === 'overview') {
      setReportTab((prev) => (prev === 'exports' ? prev : 'cashflow'));
    }
  }, [analyticsFocus]);

  const [isFabOpen, setIsFabOpen] = useState(false);
  const [debtsModalVisible, setDebtsModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [addCategorySheetVisible, setAddCategorySheetVisible] = useState(false);
  const [addPrefilledCategoryId, setAddPrefilledCategoryId] = useState<string | undefined>(undefined);
  const [addPrefilledSubcategoryId, setAddPrefilledSubcategoryId] = useState<string | undefined>(undefined);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addModalType, setAddModalType] = useState<TransactionType>('expense');
  const [addIouMode, setAddIouMode] = useState(false);
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
    setAddIouMode(false);
    setAddModalType(type);
    setAddPrefilledCategoryId(undefined);
    setAddPrefilledSubcategoryId(undefined);
    if (type === 'transfer') {
      setAddModalVisible(true);
      return;
    }
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
    to_wallet_id?: string;
    category_id?: string;
    subcategory_id?: string;
    type: TransactionType;
    currency: string;
    date: string;
    time?: string;
    is_paid: boolean;
    tax_amount?: number;
    note?: string;
    media_uri?: string;
    repeat_frequency?: BillFrequency;
    repeat_due_day?: number;
    repeat_end_type?: RecurrenceEndType;
    repeat_end_occurrences?: number;
    repeat_end_date?: string;
    reminder_enabled?: boolean;
  }) => {
    await addTransaction({
      wallet_id: txData.wallet_id || wallets[0]?.id || '',
      to_wallet_id: txData.to_wallet_id,
      category_id: txData.category_id,
      subcategory_id: txData.subcategory_id,
      type: txData.type,
      amount: txData.amount,
      currency: txData.currency,
      date: txData.date,
      time: txData.time,
      is_paid: txData.is_paid,
      tax_amount: txData.tax_amount,
      note: txData.note,
      media_uri: txData.media_uri,
      repeat_frequency: txData.repeat_frequency,
      repeat_due_day: txData.repeat_due_day,
      repeat_end_type: txData.repeat_end_type,
      repeat_end_occurrences: txData.repeat_end_occurrences,
      repeat_end_date: txData.repeat_end_date,
      reminder_enabled: txData.reminder_enabled,
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

  // Active Cycle Filter
  const activeCycleFilter = useMemo(() => {
    if (selectedCycleId) {
      const found = allCycles.find((c) => c.id === selectedCycleId);
      if (found) return found;
    }
    return selectedAnalyticsCycle || currentCycle;
  }, [selectedCycleId, allCycles, selectedAnalyticsCycle, currentCycle]);

  // Effective cycle being analyzed
  const effectiveCycle = activeCycleFilter;

  // Filtered transactions by Timeframe (Day, Week, Cycle, All Time) & Payment Status (Paid, Unpaid)
  const activeTransactions = useMemo(() => {
    let result = transactions;

    if (filterMode === 'day' && selectedDay) {
      result = result.filter((t) => t.date === selectedDay);
    } else if (filterMode === 'week') {
      const now = new Date();
      const dayOfWeek = (now.getDay() + 6) % 7; // Monday = 0
      const monday = new Date(now);
      monday.setDate(now.getDate() - dayOfWeek + (weekPreset === 'last_week' ? -7 : 0));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const startStr = monday.toISOString().slice(0, 10);
      const endStr = sunday.toISOString().slice(0, 10);
      result = result.filter((t) => t.date >= startStr && t.date <= endStr);
    } else if (filterMode === 'cycle' && activeCycleFilter?.start_date && activeCycleFilter?.end_date) {
      result = result.filter(
        (t) => t.date >= activeCycleFilter.start_date && t.date <= activeCycleFilter.end_date
      );
    }

    if (paymentStatus === 'paid') {
      result = result.filter((t) => t.is_paid === true);
    } else if (paymentStatus === 'unpaid') {
      result = result.filter((t) => t.is_paid === false);
    }

    return result;
  }, [transactions, filterMode, weekPreset, selectedDay, activeCycleFilter, paymentStatus]);

  const filterButtonLabel = useMemo(() => {
    let timeframeLabel = '';
    if (filterMode === 'day') {
      const dObj = new Date(selectedDay + 'T00:00:00');
      timeframeLabel = !isNaN(dObj.getTime())
        ? dObj.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
        : selectedDay;
    } else if (filterMode === 'week') {
      timeframeLabel = weekPreset === 'last_week' ? 'Last Week' : 'This Week';
    } else if (filterMode === 'all') {
      timeframeLabel = 'All Time';
    } else {
      timeframeLabel = activeCycleFilter?.name || 'Cycle';
    }

    if (paymentStatus === 'paid') {
      return `${timeframeLabel} • Paid`;
    }
    if (paymentStatus === 'unpaid') {
      return `${timeframeLabel} • Unpaid`;
    }
    return timeframeLabel;
  }, [filterMode, weekPreset, selectedDay, activeCycleFilter, paymentStatus]);

  const hasActiveCustomFilter = useMemo(() => {
    return filterMode !== 'cycle' || Boolean(selectedCycleId) || paymentStatus !== 'all';
  }, [filterMode, selectedCycleId, paymentStatus]);

  // Universal inside-card top bar with custom badge on left and Export on right
  const renderCardTopBar = (centerElement?: React.ReactNode) => (
    <View style={styles.pieCardTopBar}>
      {/* Top Left: Custom Badge / Title */}
      {centerElement || <View />}

      {/* Top Right: Export Button */}
      <TouchableOpacity
        style={[styles.cardHeaderExportBtn, { backgroundColor: theme.primaryContainer }]}
        onPress={() => setExportModalVisible(true)}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons name="export-variant" size={14} color={theme.onPrimaryContainer} />
        <Text style={[styles.cardHeaderExportText, { color: theme.onPrimaryContainer }]}>Export</Text>
      </TouchableOpacity>
    </View>
  );

  // Expenses and Incomes
  const totalExpense = useMemo(() => {
    return activeTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + getEffectiveAmount(t), 0);
  }, [activeTransactions, getEffectiveAmount]);

  const totalIncome = useMemo(() => {
    return activeTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + getEffectiveAmount(t), 0);
  }, [activeTransactions, getEffectiveAmount]);

  const totalTaxInPeriod = useMemo(() => {
    return activeTransactions.reduce((sum, t) => sum + (t.tax_amount || 0), 0);
  }, [activeTransactions]);

  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((netSavings / totalIncome) * 100)) : 0;

  const previousPeriodComparison = useMemo(() => {
    const activeCycle = selectedAnalyticsCycle || currentCycle;
    if (!activeCycle || !allCycles || allCycles.length < 2) return null;
    const sorted = [...allCycles].sort((a, b) => b.start_date.localeCompare(a.start_date));
    const idx = sorted.findIndex((c) => c.id === activeCycle.id);
    const prevCycle = idx >= 0 ? sorted[idx + 1] : sorted.find((c) => c.end_date < activeCycle.start_date);
    if (!prevCycle) return null;

    const prevTxs = transactions.filter(
      (t) => t.date >= prevCycle.start_date && t.date <= prevCycle.end_date && t.is_paid !== false
    );
    const prevIncome = prevTxs
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + getEffectiveAmount(t), 0);
    const prevExpense = prevTxs
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + getEffectiveAmount(t), 0);
    const prevNet = prevIncome - prevExpense;
    const prevSavingsRate = prevIncome > 0 ? Math.max(0, Math.round((prevNet / prevIncome) * 100)) : 0;

    return {
      prevCycle,
      prevIncome,
      prevExpense,
      prevNet,
      prevSavingsRate,
      incomeDelta: totalIncome - prevIncome,
      expenseDelta: totalExpense - prevExpense,
      netDelta: netSavings - prevNet,
    };
  }, [selectedAnalyticsCycle, currentCycle, allCycles, transactions, getEffectiveAmount, totalIncome, totalExpense, netSavings]);

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

        const amt = getEffectiveAmount(t);
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
        const amt = getEffectiveAmount(t);
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
        const amt = getEffectiveAmount(t);
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
    const map: Record<string, { categoryId: string; categoryName: string; color: string; icon: string; amount: number; count: number }> = {};

    activeTransactions
      .filter((t) => t.type === 'income')
      .forEach((t) => {
        const cat = categories.find((c) => c.id === t.category_id);
        const catId = cat ? cat.id : 'other-inc';
        const name = cat ? cat.name : 'Other Inflow';
        const color = cat ? cat.color : '#10B981';
        const icon = cat ? cat.icon : 'cash-plus';

        if (!map[catId]) {
          map[catId] = { categoryId: catId, categoryName: name, color, icon, amount: 0, count: 0 };
        }
        map[catId].amount += (t.amount || t.base_amount || 0);
        map[catId].count += 1;
      });

    return Object.values(map).sort((a, b) => b.amount - a.amount);
  }, [activeTransactions, categories]);

  const drilldownTransactions = useMemo(() => {
    if (!drilldownFilter) return [];
    return activeTransactions
      .filter((t) => {
        if (t.type !== drilldownFilter.txType) return false;
        const catMatch =
          drilldownFilter.categoryId === 'other' || drilldownFilter.categoryId === 'other-inc'
            ? !t.category_id || !categories.some((c) => c.id === t.category_id)
            : t.category_id === drilldownFilter.categoryId;
        if (!catMatch) return false;
        if (drilldownFilter.subcategoryId) {
          return t.subcategory_id === drilldownFilter.subcategoryId;
        }
        return true;
      })
      .sort((a, b) => (b.date !== a.date ? b.date.localeCompare(a.date) : (b.created_at || b.id).localeCompare(a.created_at || a.id)));
  }, [drilldownFilter, activeTransactions, categories]);

  // Zoomed Category object
  const zoomedCategory = useMemo(() => {
    if (!zoomedCategoryId) return null;
    return categorySpending.find((c) => c.categoryId === zoomedCategoryId) || null;
  }, [zoomedCategoryId, categorySpending]);

  // Donut Pie chart slices for Expense Analyzer with Zoomable Subcategories
  const expensePieSlicesWithZoom = useMemo<DonutSlice[]>(() => {
    if (!zoomedCategory) {
      // All top categories with leader lines & popped largest slice
      return categorySpending.map((c, idx) => ({
        id: c.categoryId,
        name: c.categoryName,
        amount: c.amount,
        color: c.color,
        percent: c.percentOfTotal,
        isPopped: idx === 0,
      }));
    }

    // Zoomed category: show its subcategories
    const totalCatSpend = Math.max(1, zoomedCategory.amount);
    if (zoomedCategory.subcategories.length === 0) {
      return [
        {
          id: zoomedCategory.categoryId,
          name: zoomedCategory.categoryName,
          amount: zoomedCategory.amount,
          color: zoomedCategory.color,
          percent: 100,
          isPopped: true,
        },
      ];
    }

    const subColors = [
      zoomedCategory.color,
      '#EC4899', // Pink
      '#D946EF', // Fuchsia
      '#8B5CF6', // Purple
      '#6366F1', // Indigo
      '#3B82F6', // Blue
      '#0EA5E9', // Sky
      '#14B8A6', // Teal
      '#10B981', // Emerald
      '#F59E0B', // Amber
      '#F97316', // Orange
      '#EF4444', // Red
    ];

    return zoomedCategory.subcategories.map((sub, idx) => {
      const pct = Math.round((sub.amount / totalCatSpend) * 100);
      return {
        id: sub.id,
        name: sub.name,
        amount: sub.amount,
        color: subColors[idx % subColors.length],
        percent: pct,
        isPopped: idx === 0,
      };
    });
  }, [zoomedCategory, categorySpending]);

  const incomePieSlices = useMemo<DonutSlice[]>(() => {
    return categoryIncome.map((c, idx) => ({
      id: c.categoryName,
      name: c.categoryName,
      amount: c.amount,
      color: c.color,
      percent: totalIncome > 0 ? Math.round((c.amount / totalIncome) * 100) : 0,
      isPopped: idx === 0,
    }));
  }, [categoryIncome, totalIncome]);

  // Cash Flow Inflow vs Outflow Interaction Timeline for Overview
  const cashFlowTimeline = useMemo(() => {
    const datesMap: Record<string, { income: number; expense: number }> = {};

    activeTransactions.forEach((t) => {
      if (!datesMap[t.date]) {
        datesMap[t.date] = { income: 0, expense: 0 };
      }
      const amt = t.amount || t.base_amount || 0;
      if (t.type === 'income') {
        datesMap[t.date].income += amt;
      } else if (t.type === 'expense') {
        datesMap[t.date].expense += amt;
      }
    });

    const allDates = Object.keys(datesMap).sort();
    const datesToShow = allDates.slice(-7);

    let maxVal = 1;
    datesToShow.forEach((d) => {
      const { income, expense } = datesMap[d];
      if (income > maxVal) maxVal = income;
      if (expense > maxVal) maxVal = expense;
    });

    const buckets = datesToShow.map((d) => {
      const { income, expense } = datesMap[d];
      const dObj = new Date(d + 'T00:00:00');
      const dayLabel = !isNaN(dObj.getTime())
        ? dObj.toLocaleDateString(undefined, { weekday: 'short' })
        : d.slice(-2);
      const dayNum = d.slice(8, 10);

      return {
        date: d,
        dayLabel,
        dayNum,
        income,
        expense,
        net: income - expense,
        incomeHeightPct: Math.min(100, Math.max(6, Math.round((income / maxVal) * 100))),
        expenseHeightPct: Math.min(100, Math.max(6, Math.round((expense / maxVal) * 100))),
      };
    });

    return {
      buckets,
      maxVal,
      hasData: buckets.length > 0 && (totalIncome > 0 || totalExpense > 0),
    };
  }, [activeTransactions, totalIncome, totalExpense]);

  // Daily average spending calculation
  const dailyAverageSpend = useMemo(() => {
    const expenseDays = new Set(activeTransactions.filter((t) => t.type === 'expense').map((t) => t.date));
    const count = Math.max(1, expenseDays.size);
    return totalExpense / count;
  }, [activeTransactions, totalExpense]);

  // Target metrics for analyzer
  const effectiveBudget = effectiveCycle?.target_budget ?? overallBudgetLimit;
  const budgetSpent = totalExpense;
  const budgetRemaining = effectiveBudget - budgetSpent;
  const budgetPercent = effectiveBudget > 0 ? Math.round((budgetSpent / effectiveBudget) * 100) : 0;
  const isBudgetOver = effectiveBudget > 0 && budgetSpent > effectiveBudget;

  const effectiveIncomeGoal = effectiveCycle?.target_income ?? incomeGoal;
  const incomeEarned = totalIncome;
  const incomeRemainingToGo = Math.max(0, effectiveIncomeGoal - incomeEarned);
  const incomePercent = effectiveIncomeGoal > 0 ? Math.round((incomeEarned / effectiveIncomeGoal) * 100) : 0;
  const isIncomeGoalReached = effectiveIncomeGoal > 0 && incomeEarned >= effectiveIncomeGoal;

  const exportPayload = useMemo(() => {
    const timeframeLabel = filterMode === 'cycle'
      ? `${effectiveCycle?.name || 'Cycle'} (${effectiveCycle?.start_date || ''} to ${effectiveCycle?.end_date || ''})`
      : filterMode === 'day'
        ? `Day: ${selectedDay}`
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
    filterMode,
    selectedDay,
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
        {/* TOP 2-PILL HEADER: MODULE DROPDOWN (LEFT) & FILTER PILL (RIGHT) */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <TouchableOpacity
            onPress={() => setModuleMenuVisible(true)}
            activeOpacity={0.8}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: M3Shape.full,
              backgroundColor:
                reportTab === 'spending'
                  ? theme.errorContainer
                  : reportTab === 'cashflow' && analyticsFocus === 'income'
                    ? theme.successContainer
                    : theme.primaryContainer,
              borderWidth: 1,
              borderColor:
                reportTab === 'spending'
                  ? theme.error
                  : reportTab === 'cashflow' && analyticsFocus === 'income'
                    ? theme.success
                    : theme.primary,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <MaterialCommunityIcons
                name={
                  reportTab === 'spending'
                    ? 'arrow-top-right'
                    : reportTab === 'loans'
                      ? 'handshake-outline'
                      : reportTab === 'transfers'
                        ? 'swap-horizontal'
                        : reportTab === 'exports'
                          ? 'file-export-outline'
                          : analyticsFocus === 'income'
                            ? 'arrow-bottom-left'
                            : 'chart-timeline-variant-shimmer'
                }
                size={15}
                color={
                  reportTab === 'spending'
                    ? theme.error
                    : reportTab === 'cashflow' && analyticsFocus === 'income'
                      ? theme.success
                      : theme.onPrimaryContainer
                }
              />
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: '800',
                  color:
                    reportTab === 'spending'
                      ? theme.error
                      : reportTab === 'cashflow' && analyticsFocus === 'income'
                        ? theme.success
                        : theme.onPrimaryContainer,
                }}
                numberOfLines={1}
              >
                {reportTab === 'spending'
                  ? 'Spending'
                  : reportTab === 'loans'
                    ? 'Loans'
                    : reportTab === 'transfers'
                      ? 'Transfers'
                      : reportTab === 'exports'
                        ? 'Exports & Compare'
                        : analyticsFocus === 'income'
                          ? 'Income Sources'
                          : 'Income vs Expense'}
              </Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-down"
              size={16}
              color={
                reportTab === 'spending'
                  ? theme.error
                  : reportTab === 'cashflow' && analyticsFocus === 'income'
                    ? theme.success
                    : theme.onPrimaryContainer
              }
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setFilterModalVisible(true)}
            activeOpacity={0.8}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: M3Shape.full,
              backgroundColor: hasActiveCustomFilter
                ? (isDarkMode ? 'rgba(99, 102, 241, 0.22)' : 'rgba(99, 102, 241, 0.12)')
                : theme.pillBg,
              borderWidth: 1,
              borderColor: hasActiveCustomFilter ? theme.primary : theme.outlineVariant,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <MaterialCommunityIcons
                name="filter-variant"
                size={15}
                color={hasActiveCustomFilter ? theme.primary : theme.onSurfaceVariant}
              />
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: '700',
                  color: hasActiveCustomFilter ? theme.primary : theme.onSurface,
                }}
                numberOfLines={1}
              >
                {filterButtonLabel}
              </Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-down"
              size={15}
              color={hasActiveCustomFilter ? theme.primary : theme.onSurfaceVariant}
            />
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

        {/* 1. SPENDING SUB-TAB */}
        {reportTab === 'spending' && (
          <View style={styles.focusContainer}>
            {/* EXPENSE DONUT PIE CARD WITH ADVANCED LEADER LINES & ZOOMABLE SUBCATEGORIES */}
            <View style={[styles.analyzerCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}>
              {/* Card Top Header: Left = Filter Button, Center = Drilldown/All badge, Right = Export Button */}
              {renderCardTopBar(
                zoomedCategory ? (
                  <TouchableOpacity
                    style={[styles.unzoomPill, { backgroundColor: theme.primaryContainer }]}
                    onPress={() => setZoomedCategoryId(null)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="arrow-left" size={12} color={theme.onPrimaryContainer} />
                    <Text style={[styles.unzoomPillText, { color: theme.onPrimaryContainer }]} numberOfLines={1}>
                      {zoomedCategory.categoryName} (All)
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.flowDynamicsBadge, { backgroundColor: theme.pillBg }]}>
                    <MaterialCommunityIcons name="chart-pie" size={14} color={theme.error} />
                    <Text style={[styles.flowDynamicsBadgeText, { color: theme.error }]}>Expense Drilldown</Text>
                  </View>
                )
              )}

              <AdvancedDonutChart
                slices={expensePieSlicesWithZoom}
                total={zoomedCategory ? zoomedCategory.amount : totalExpense}
                centerTitle={formatCurrency(zoomedCategory ? zoomedCategory.amount : totalExpense, curr)}
                centerSubtitle={zoomedCategory ? zoomedCategory.categoryName : 'Total Spent'}
                onSlicePress={(sliceId) => {
                  if (zoomedCategoryId) {
                    setZoomedCategoryId(null);
                  } else {
                    setZoomedCategoryId(sliceId);
                    toggleCategoryExpand(sliceId);
                  }
                }}
                onResetPress={() => setZoomedCategoryId(null)}
                isZoomed={Boolean(zoomedCategoryId)}
                theme={theme}
              />
            </View>
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

            {/* TAXES & FEES CARD */}
            <View
              style={[
                styles.miniStatCard,
                {
                  backgroundColor: theme.cardBg,
                  borderColor: theme.divider,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: theme.pillBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialCommunityIcons name="receipt-text-outline" size={18} color={theme.tertiary} />
                </View>
                <View>
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: theme.onSurface }}>
                    Taxes & Fees Included
                  </Text>
                  <Text style={{ fontSize: 11.5, color: theme.onSurfaceVariant }}>
                    {totalExpense > 0
                      ? `${((totalTaxInPeriod / totalExpense) * 100).toFixed(1)}% of total spending`
                      : 'No spending recorded in this period'}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '800', color: theme.onSurface }}>
                {formatCurrency(totalTaxInPeriod, settings.base_currency)}
              </Text>
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

            {totalTaxInPeriod > 0 && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: theme.pillBg,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 10,
                  marginBottom: 10,
                  alignSelf: 'flex-start',
                }}
              >
                <MaterialCommunityIcons name="receipt-text-outline" size={14} color={theme.primary} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.onSurfaceVariant }}>
                  Taxes & Fees: {formatCurrency(totalTaxInPeriod, curr)}
                </Text>
              </View>
            )}

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
                          <TouchableOpacity
                            key={sub.id}
                            style={styles.subItemRow}
                            activeOpacity={0.7}
                            onPress={() =>
                              setDrilldownFilter({
                                categoryId: cat.categoryId,
                                categoryName: cat.categoryName,
                                subcategoryId: sub.id,
                                subcategoryName: sub.name,
                                txType: 'expense',
                                color: cat.color,
                              })
                            }
                          >
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
                          </TouchableOpacity>
                        ))}

                        <TouchableOpacity
                          style={{
                            marginTop: 8,
                            marginBottom: 4,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            paddingVertical: 9,
                            borderRadius: M3Shape.medium,
                            backgroundColor: theme.primaryContainer,
                          }}
                          activeOpacity={0.75}
                          onPress={() =>
                            setDrilldownFilter({
                              categoryId: cat.categoryId,
                              categoryName: cat.categoryName,
                              txType: 'expense',
                              color: cat.color,
                            })
                          }
                        >
                          <MaterialCommunityIcons name="format-list-bulleted" size={16} color={theme.onPrimaryContainer} />
                          <Text style={{ fontSize: 12.5, fontWeight: '800', color: theme.onPrimaryContainer }}>
                            View Transactions ({cat.count})
                          </Text>
                        </TouchableOpacity>

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

        {/* 2. CASHFLOW SUB-TAB: INCOME SOURCES VIEW */}
        {reportTab === 'cashflow' && analyticsFocus === 'income' && (
          <View style={styles.focusContainer}>
            {/* INCOME DONUT PIE CARD WITH ADVANCED LEADER LINES */}
            <View style={[styles.analyzerCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}>
              {/* Card Top Header: Left = Filter Button, Center = Badge, Right = Export Button */}
              {renderCardTopBar(
                <View style={[styles.flowDynamicsBadge, { backgroundColor: theme.pillBg }]}>
                  <MaterialCommunityIcons name="chart-pie" size={14} color={theme.success} />
                  <Text style={[styles.flowDynamicsBadgeText, { color: theme.success }]}>Income Sources</Text>
                </View>
              )}

              <AdvancedDonutChart
                slices={incomePieSlices}
                total={totalIncome}
                centerTitle={formatCurrency(totalIncome, curr)}
                centerSubtitle="Total Income"
                theme={theme}
              />
            </View>
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
                  <TouchableOpacity
                    key={cat.categoryId || idx}
                    activeOpacity={0.75}
                    onPress={() =>
                      setDrilldownFilter({
                        categoryId: cat.categoryId,
                        categoryName: cat.categoryName,
                        txType: 'income',
                        color: cat.color,
                      })
                    }
                    style={[styles.categoryRowCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }]}
                  >
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
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* 3. CASHFLOW SUB-TAB: OVERVIEW VIEW */}
        {reportTab === 'cashflow' && analyticsFocus !== 'income' && (
          <View style={styles.focusContainer}>
            {/* CASH FLOW INTERACTION HERO CARD (INFLOW VS OUTFLOW DYNAMICS) */}
            <View
              style={[
                styles.cashflowCard,
                { backgroundColor: theme.cardBg, borderColor: theme.divider },
                M3Elevation.level1,
              ]}
            >
              {/* Card Top Header: Left = Filter Button, Center = Badge, Right = Export Button */}
              {renderCardTopBar(
                <View style={[styles.flowDynamicsBadge, { backgroundColor: theme.pillBg }]}>
                  <MaterialCommunityIcons name="swap-vertical" size={14} color={theme.primary} />
                  <Text style={[styles.flowDynamicsBadgeText, { color: theme.primary }]}>Inflow vs Outflow</Text>
                </View>
              )}

              {/* Net Cash Flow Surplus / Deficit Hero */}
              <View style={styles.flowHeroDeltaRow}>
                <View>
                  <Text style={[styles.flowDeltaSub, { color: theme.onSurfaceVariant }]}>Net Cash Flow</Text>
                  <Text
                    style={[
                      styles.flowDeltaMain,
                      { color: netSavings >= 0 ? theme.success : theme.error },
                    ]}
                  >
                    {netSavings >= 0 ? '+' : ''}{formatCurrency(netSavings, settings.base_currency)}
                  </Text>
                </View>

                <View style={styles.flowHeroPillsCol}>
                  <View style={[styles.streamPill, { backgroundColor: theme.successContainer }]}>
                    <MaterialCommunityIcons name="arrow-bottom-left" size={13} color={theme.success} />
                    <Text style={[styles.streamPillText, { color: theme.success }]}>
                      +{formatCurrency(totalIncome, settings.base_currency)}
                    </Text>
                  </View>
                  <View style={[styles.streamPill, { backgroundColor: theme.errorContainer }]}>
                    <MaterialCommunityIcons name="arrow-top-right" size={13} color={theme.error} />
                    <Text style={[styles.streamPillText, { color: theme.error }]}>
                      -{formatCurrency(totalExpense, settings.base_currency)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* INFLOW VS OUTFLOW INTERACTION GRAPH */}
              <View style={styles.flowChartContainer}>
                {cashFlowTimeline.hasData ? (
                  <View style={styles.dualBarsWrapper}>
                    {cashFlowTimeline.buckets.map((b) => (
                      <View key={b.date} style={styles.dualBarCol}>
                        <View style={styles.dualBarTrackArea}>
                          {/* Green Inflow Bar */}
                          <View
                            style={[
                              styles.singleDualBar,
                              {
                                height: `${b.income > 0 ? b.incomeHeightPct : 4}%`,
                                backgroundColor: b.income > 0 ? theme.success : theme.divider,
                                opacity: b.income > 0 ? 1 : 0.35,
                              },
                            ]}
                          />
                          {/* Red Outflow Bar */}
                          <View
                            style={[
                              styles.singleDualBar,
                              {
                                height: `${b.expense > 0 ? b.expenseHeightPct : 4}%`,
                                backgroundColor: b.expense > 0 ? theme.error : theme.divider,
                                opacity: b.expense > 0 ? 1 : 0.35,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.dualBarDayText, { color: theme.onSurfaceVariant }]}>
                          {b.dayLabel}
                        </Text>
                        <Text style={[styles.dualBarNumText, { color: theme.onSurface }]}>
                          {b.dayNum}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyChartNotice}>
                    <Text style={[styles.emptyChartNoticeText, { color: theme.onSurfaceVariant }]}>
                      Record income & expenses to view daily interaction flow
                    </Text>
                  </View>
                )}
              </View>

              {/* Income Retention & Burn Rate Gauge */}
              <View style={styles.retentionContainer}>
                <View style={[styles.retentionBarTrack, { backgroundColor: theme.surfaceVariant }]}>
                  {totalIncome > 0 ? (
                    <>
                      <View
                        style={[
                          styles.retentionSegment,
                          {
                            width: `${Math.min(100, Math.round((totalExpense / totalIncome) * 100))}%`,
                            backgroundColor: theme.error,
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.retentionSegment,
                          {
                            flex: 1,
                            backgroundColor: theme.success,
                          },
                        ]}
                      />
                    </>
                  ) : (
                    <View style={[styles.retentionSegment, { width: '100%', backgroundColor: theme.divider }]} />
                  )}
                </View>

                <View style={styles.retentionLabelsRow}>
                  <Text style={[styles.retentionLabelText, { color: theme.error }]}>
                    ● {Math.min(100, totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : 100)}% Burned
                  </Text>
                  <Text style={[styles.retentionLabelText, { color: theme.success, fontWeight: '700' }]}>
                    ● {savingsRate}% Retained
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
              <TouchableOpacity
                onPress={() => {
                  setReportTab('spending');
                  setAnalyticsFocus('expense');
                }}
                activeOpacity={0.7}
              >
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
                        <TouchableOpacity
                          key={sub.id}
                          style={styles.subItemRow}
                          activeOpacity={0.7}
                          onPress={() =>
                            setDrilldownFilter({
                              categoryId: cat.categoryId,
                              categoryName: cat.categoryName,
                              subcategoryId: sub.id,
                              subcategoryName: sub.name,
                              txType: 'expense',
                              color: cat.color,
                            })
                          }
                        >
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
                        </TouchableOpacity>
                      ))}

                      <TouchableOpacity
                        style={{
                          marginTop: 8,
                          marginBottom: 4,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          paddingVertical: 9,
                          borderRadius: M3Shape.medium,
                          backgroundColor: theme.primaryContainer,
                        }}
                        activeOpacity={0.75}
                        onPress={() =>
                          setDrilldownFilter({
                            categoryId: cat.categoryId,
                            categoryName: cat.categoryName,
                            txType: 'expense',
                            color: cat.color,
                          })
                        }
                      >
                        <MaterialCommunityIcons name="format-list-bulleted" size={16} color={theme.onPrimaryContainer} />
                        <Text style={{ fontSize: 12.5, fontWeight: '800', color: theme.onPrimaryContainer }}>
                          View Transactions ({cat.count})
                        </Text>
                      </TouchableOpacity>

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

        {/* 4. LOANS MODULE */}
        {reportTab === 'loans' && (
          <View style={styles.focusContainer}>
            {(() => {
              const openDebts = debts.filter((d) => d.status === 'open');
              const settledCount = debts.filter((d) => d.status === 'settled').length;
              const owedToYou = openDebts
                .filter((d) => d.type === 'lent')
                .reduce((s, d) => s + Math.max(0, d.amount - (d.paid_amount || 0)), 0);
              const youOwe = openDebts
                .filter((d) => d.type === 'borrowed')
                .reduce((s, d) => s + Math.max(0, d.amount - (d.paid_amount || 0)), 0);
              const netLoans = owedToYou - youOwe;

              const byPersonMap: Record<string, { name: string; lent: number; borrowed: number }> = {};
              openDebts.forEach((d) => {
                const key = d.person_name.trim().toLowerCase();
                if (!byPersonMap[key]) {
                  byPersonMap[key] = { name: d.person_name.trim(), lent: 0, borrowed: 0 };
                }
                const rem = Math.max(0, d.amount - (d.paid_amount || 0));
                if (d.type === 'lent') byPersonMap[key].lent += rem;
                else byPersonMap[key].borrowed += rem;
              });
              const peopleRows = Object.values(byPersonMap).sort(
                (a, b) => Math.abs(b.lent - b.borrowed) - Math.abs(a.lent - a.borrowed)
              );

              return (
                <>
                  <View
                    style={[
                      styles.analyzerCard,
                      { backgroundColor: theme.cardBg, borderColor: theme.divider },
                      M3Elevation.level1,
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <MaterialCommunityIcons name="handshake-outline" size={18} color={theme.primary} />
                        <Text style={{ fontSize: 15, fontWeight: '800', color: theme.onSurface }}>
                          Loans Position
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => setDebtsModalVisible(true)}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: theme.primary }}>
                          Manage →
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                      <View style={{ flex: 1, padding: 10, borderRadius: M3Shape.small, backgroundColor: theme.successContainer }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.success }}>Owed to You</Text>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: theme.onSurface, marginTop: 2 }}>
                          {formatCurrency(owedToYou, curr)}
                        </Text>
                      </View>
                      <View style={{ flex: 1, padding: 10, borderRadius: M3Shape.small, backgroundColor: theme.errorContainer }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.error }}>You Owe</Text>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: theme.onSurface, marginTop: 2 }}>
                          {formatCurrency(youOwe, curr)}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 10,
                        borderRadius: M3Shape.small,
                        backgroundColor: theme.pillBg,
                      }}
                    >
                      <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.onSurfaceVariant }}>
                        Net Position ({openDebts.length} open • {settledCount} settled)
                      </Text>
                      <Text
                        style={{
                          fontSize: 13.5,
                          fontWeight: '800',
                          color: netLoans >= 0 ? theme.success : theme.error,
                        }}
                      >
                        {netLoans >= 0 ? '+' : ''}
                        {formatCurrency(netLoans, curr)}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.analyzerCard,
                      { backgroundColor: theme.cardBg, borderColor: theme.divider },
                      M3Elevation.level1,
                    ]}
                  >
                    <Text style={{ fontSize: 14.5, fontWeight: '800', color: theme.onSurface, marginBottom: 10 }}>
                      Open Balances by Person
                    </Text>
                    {peopleRows.length === 0 ? (
                      <Text style={{ fontSize: 12.5, color: theme.onSurfaceVariant }}>
                        No open loans right now.
                      </Text>
                    ) : (
                      <View style={{ gap: 8 }}>
                        {peopleRows.map((p) => {
                          const net = p.lent - p.borrowed;
                          return (
                            <View
                              key={p.name}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingVertical: 8,
                                paddingHorizontal: 10,
                                borderRadius: M3Shape.small,
                                backgroundColor: theme.pillBg,
                              }}
                            >
                              <View>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.onSurface }}>
                                  {p.name}
                                </Text>
                                <Text style={{ fontSize: 11, color: theme.onSurfaceVariant }}>
                                  {net >= 0 ? 'Owes you' : 'You owe'}
                                </Text>
                              </View>
                              <Text
                                style={{
                                  fontSize: 13.5,
                                  fontWeight: '800',
                                  color: net >= 0 ? theme.success : theme.error,
                                }}
                              >
                                {formatCurrency(Math.abs(net), curr)}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                </>
              );
            })()}
          </View>
        )}

        {/* 5. TRANSFERS MODULE */}
        {reportTab === 'transfers' && (
          <View style={styles.focusContainer}>
            {(() => {
              const transferTxs = activeTransactions.filter((t) => t.type === 'transfer');
              const totalMoved = transferTxs.reduce((s, t) => s + (t.base_amount || t.amount || 0), 0);
              return (
                <View
                  style={[
                    styles.analyzerCard,
                    { backgroundColor: theme.cardBg, borderColor: theme.divider },
                    M3Elevation.level1,
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <MaterialCommunityIcons name="swap-horizontal" size={18} color={theme.tertiary} />
                      <Text style={{ fontSize: 15, fontWeight: '800', color: theme.onSurface }}>
                        Wallet Transfers
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.onSurfaceVariant }}>
                      {transferTxs.length} transfers
                    </Text>
                  </View>

                  <View
                    style={{
                      padding: 12,
                      borderRadius: M3Shape.small,
                      backgroundColor: theme.pillBg,
                      marginBottom: 12,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.onSurfaceVariant }}>
                      Total Moved
                    </Text>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: theme.tertiary }}>
                      {formatCurrency(totalMoved, curr)}
                    </Text>
                  </View>

                  {transferTxs.length === 0 ? (
                    <Text style={{ fontSize: 12.5, color: theme.onSurfaceVariant }}>
                      No transfers recorded in this timeframe.
                    </Text>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {transferTxs.map((tx) => {
                        const fromW = wallets.find((w) => w.id === tx.wallet_id)?.name || 'Wallet';
                        const toW = wallets.find((w) => w.id === tx.to_wallet_id)?.name || 'Wallet';
                        return (
                          <View
                            key={tx.id}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingVertical: 8,
                              paddingHorizontal: 10,
                              borderRadius: M3Shape.small,
                              backgroundColor: theme.pillBg,
                            }}
                          >
                            <View style={{ flex: 1, marginRight: 8 }}>
                              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.onSurface }} numberOfLines={1}>
                                {fromW} → {toW}
                              </Text>
                              <Text style={{ fontSize: 11, color: theme.onSurfaceVariant }} numberOfLines={1}>
                                {tx.date}{tx.note ? ` • ${tx.note}` : ''}
                              </Text>
                            </View>
                            <Text style={{ fontSize: 13.5, fontWeight: '800', color: theme.tertiary }}>
                              {formatCurrency(tx.amount, tx.currency || curr)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })()}
          </View>
        )}

        {/* 6. EXPORTS & PERIOD COMPARISON SUB-TAB */}
        {reportTab === 'exports' && (
          <View style={styles.focusContainer}>
            {/* Period Comparison Card */}
            <View
              style={[
                styles.analyzerCard,
                { backgroundColor: theme.cardBg, borderColor: theme.divider },
                M3Elevation.level1,
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialCommunityIcons name="compare-horizontal" size={18} color={theme.primary} />
                  <Text style={{ fontSize: 15, fontWeight: '800', color: theme.onSurface }}>
                    Period Comparison
                  </Text>
                </View>
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: theme.onSurfaceVariant }}>
                  {previousPeriodComparison ? `vs ${previousPeriodComparison.prevCycle.name}` : 'Current Period'}
                </Text>
              </View>

              {previousPeriodComparison ? (
                <View style={{ gap: 8 }}>
                  {(
                    [
                      {
                        label: 'Income',
                        cur: totalIncome,
                        prev: previousPeriodComparison.prevIncome,
                        delta: previousPeriodComparison.incomeDelta,
                        positiveGood: true,
                      },
                      {
                        label: 'Expense',
                        cur: totalExpense,
                        prev: previousPeriodComparison.prevExpense,
                        delta: previousPeriodComparison.expenseDelta,
                        positiveGood: false,
                      },
                      {
                        label: 'Net Cashflow',
                        cur: netSavings,
                        prev: previousPeriodComparison.prevNet,
                        delta: previousPeriodComparison.netDelta,
                        positiveGood: true,
                      },
                    ] as const
                  ).map((row) => {
                    const isGood = row.positiveGood ? row.delta >= 0 : row.delta <= 0;
                    const deltaColor = row.delta === 0 ? theme.onSurfaceVariant : isGood ? theme.success : theme.error;
                    return (
                      <View
                        key={row.label}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: 8,
                          paddingHorizontal: 10,
                          borderRadius: M3Shape.small,
                          backgroundColor: theme.pillBg,
                        }}
                      >
                        <View>
                          <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.onSurface }}>
                            {row.label}
                          </Text>
                          <Text style={{ fontSize: 11, color: theme.onSurfaceVariant }}>
                            Prev: {formatCurrency(row.prev, settings.base_currency)}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: 13.5, fontWeight: '800', color: theme.onSurface }}>
                            {formatCurrency(row.cur, settings.base_currency)}
                          </Text>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: deltaColor }}>
                            {row.delta >= 0 ? '+' : ''}
                            {formatCurrency(row.delta, settings.base_currency)}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={{ fontSize: 12.5, color: theme.onSurfaceVariant }}>
                  Need at least two budget cycles to compare periods. Current net: {formatCurrency(netSavings, settings.base_currency)} ({savingsRate}% saved).
                </Text>
              )}
            </View>

            {/* Export & Share Reports */}
            <View
              style={[
                styles.analyzerCard,
                { backgroundColor: theme.cardBg, borderColor: theme.divider },
                M3Elevation.level1,
              ]}
            >
              <Text style={{ fontSize: 15, fontWeight: '800', color: theme.onSurface, marginBottom: 4 }}>
                Export Reports
              </Text>
              <Text style={[styles.exportModalSubtitle, { color: theme.onSurfaceVariant, marginBottom: 12 }]}>
                {exportPayload.timeframe} • {exportPayload.transactions.length} transactions
              </Text>

              <View style={styles.exportOptionsList}>
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
            </View>
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

        {/* Record Income Button */}
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

        {/* Transfer Button */}
        <TouchableOpacity
          style={[
            styles.fabRecordBtn,
            {
              backgroundColor: theme.primaryContainer,
              borderColor: theme.primary,
            },
            M3Elevation.level3,
          ]}
          onPress={() => handleOpenAddFlow('transfer')}
          activeOpacity={0.85}
          accessibilityLabel="Record Transfer"
        >
          <View style={styles.fabRecordBtnContent}>
            <View style={styles.fabRecordHeaderRow}>
              <MaterialCommunityIcons name="swap-horizontal" size={16} color={theme.primary} />
              <Text
                style={[styles.fabRecordBtnTitle, { color: theme.onPrimaryContainer }]}
                numberOfLines={1}
              >
                Transfer
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
                  { color: theme.primary },
                ]}
                numberOfLines={1}
              >
                {wallets.length} wallets
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* IOU / Split Button (Bottom - Above FAB) */}
        <TouchableOpacity
          style={[
            styles.fabRecordBtn,
            {
              backgroundColor: isDarkMode ? '#312E81' : '#E0E7FF',
              borderColor: isDarkMode ? '#818CF8' : '#4338CA',
            },
            M3Elevation.level3,
          ]}
          onPress={() => {
            setIsFabOpen(false);
            setAddIouMode(true);
            setAddModalType('expense');
            setAddPrefilledCategoryId(undefined);
            setAddPrefilledSubcategoryId(undefined);
            setAddModalVisible(true);
          }}
          activeOpacity={0.85}
          accessibilityLabel="Loans and Splits"
        >
          <View style={styles.fabRecordBtnContent}>
            <View style={styles.fabRecordHeaderRow}>
              <MaterialCommunityIcons
                name="handshake-outline"
                size={16}
                color={isDarkMode ? '#A5B4FC' : '#4338CA'}
              />
              <Text
                style={[
                  styles.fabRecordBtnTitle,
                  { color: isDarkMode ? '#E0E7FF' : '#312E81' },
                ]}
                numberOfLines={1}
              >
                Loan / Split
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
                  { color: isDarkMode ? '#C7D2FE' : '#4338CA' },
                ]}
                numberOfLines={1}
              >
                {(() => {
                  const openCount = debts.filter((d) => d.status === 'open').length;
                  return openCount > 0 ? `${openCount} open` : 'Loans & Splits';
                })()}
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
      <CategoryManagerModal
        mode="pick"
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
        initialIouMode={addIouMode}
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

      <DebtsModal
        visible={debtsModalVisible}
        onClose={() => setDebtsModalVisible(false)}
      />

      {/* CATEGORY / SUBCATEGORY TRANSACTIONS DRILLDOWN SHEET */}
      <Modal
        visible={Boolean(drilldownFilter)}
        transparent
        animationType="slide"
        onRequestClose={() => setDrilldownFilter(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setDrilldownFilter(null)} />
          <View
            style={{
              maxHeight: '82%',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              backgroundColor: theme.surface,
              paddingHorizontal: 18,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: 10 }}>
              <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: theme.outlineVariant }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: drilldownFilter?.color || theme.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MaterialCommunityIcons name="format-list-bulleted" size={18} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: theme.onSurface }} numberOfLines={1}>
                  {drilldownFilter?.subcategoryName
                    ? `${drilldownFilter.categoryName} • ${drilldownFilter.subcategoryName}`
                    : drilldownFilter?.categoryName}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: theme.onSurfaceVariant }}>
                  {drilldownTransactions.length} {drilldownTransactions.length === 1 ? 'transaction' : 'transactions'} •{' '}
                  {formatCurrency(
                    drilldownTransactions.reduce((s, t) => s + (drilldownFilter?.txType === 'expense' ? getEffectiveAmount(t) : t.amount), 0),
                    curr
                  )}
                </Text>
              </View>
              {drilldownFilter && drilldownFilter.categoryId !== 'other' && drilldownFilter.categoryId !== 'other-inc' && onNavigateTab && (
                <TouchableOpacity
                  onPress={() => {
                    const catId = drilldownFilter.categoryId;
                    setDrilldownFilter(null);
                    setCalendarCategoryFilterId(catId);
                    onNavigateTab('calendar');
                  }}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: M3Shape.full,
                    backgroundColor: theme.primaryContainer,
                  }}
                >
                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: theme.onPrimaryContainer }}>
                    History →
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setDrilldownFilter(null)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: theme.pillBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MaterialCommunityIcons name="close" size={18} color={theme.onSurface} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
              {drilldownTransactions.length === 0 ? (
                <Text style={{ textAlign: 'center', color: theme.onSurfaceVariant, paddingVertical: 24 }}>
                  No matching transactions found.
                </Text>
              ) : (
                drilldownTransactions.map((tx) => {
                  const cat = categories.find((c) => c.id === tx.category_id);
                  const sub = cat?.subcategories?.find((s) => s.id === tx.subcategory_id);
                  const wallet = wallets.find((w) => w.id === tx.wallet_id);
                  const isExp = tx.type === 'expense';
                  const eff = isExp ? getEffectiveAmount(tx) : tx.amount;
                  return (
                    <TouchableOpacity
                      key={tx.id}
                      onPress={() => setViewingTransaction(tx)}
                      activeOpacity={0.75}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        padding: 12,
                        borderRadius: M3Shape.medium,
                        backgroundColor: theme.cardBg,
                        borderWidth: 1,
                        borderColor: theme.divider,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13.5, fontWeight: '700', color: theme.onSurface }} numberOfLines={1}>
                          {sub?.name || cat?.name || 'Transaction'}
                        </Text>
                        <Text style={{ fontSize: 11.5, color: theme.onSurfaceVariant }} numberOfLines={1}>
                          {[tx.date, wallet?.name, tx.note || null].filter(Boolean).join(' • ')}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: isExp ? theme.error : theme.success }}>
                        {isExp ? '-' : '+'}{formatCurrency(eff, tx.currency || curr)}
                      </Text>
                      <MaterialCommunityIcons name="chevron-right" size={16} color={theme.onSurfaceVariant} />
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <TransactionDetailModal
        visible={Boolean(viewingTransaction)}
        transaction={viewingTransaction}
        categories={categories}
        wallets={wallets}
        theme={theme}
        baseCurrency={curr}
        onClose={() => setViewingTransaction(null)}
        onEdit={(tx) => {
          setViewingTransaction(null);
          setEditingTransaction(tx);
        }}
        onDelete={async (id) => {
          await deleteTransaction(id);
          setViewingTransaction(null);
        }}
      />

      {Boolean(editingTransaction) && (
        <TransactionDetailsModal
          visible={Boolean(editingTransaction)}
          txType={editingTransaction?.type || 'expense'}
          initialTransactionId={editingTransaction?.id}
          initialAmount={editingTransaction?.amount || 0}
          initialWalletId={editingTransaction?.wallet_id || ''}
          initialToWalletId={editingTransaction?.to_wallet_id || undefined}
          initialCategoryId={editingTransaction?.category_id || undefined}
          initialSubcategoryId={editingTransaction?.subcategory_id || undefined}
          initialDate={editingTransaction?.date}
          initialTime={editingTransaction?.time}
          initialNote={editingTransaction?.note}
          initialMediaUri={editingTransaction?.media_uri}
          initialIsPaid={editingTransaction?.is_paid}
          initialTaxAmount={editingTransaction?.tax_amount || 0}
          initialCurrency={editingTransaction?.currency}
          isEditing={true}
          wallets={wallets}
          categories={categories}
          theme={theme}
          baseCurrency={curr}
          onClose={() => setEditingTransaction(null)}
          onSave={async (data) => {
            if (!editingTransaction) return;
            await updateTransaction({
              id: editingTransaction.id,
              ...data,
            });
            setEditingTransaction(null);
          }}
          onAddSubcategory={addSubcategory}
        />
      )}

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

      {/* FILTER PICKER MODAL (CYCLES, ALL TIME, SPECIFIC DAY, PAID/UNPAID) */}
      <AnalyticsFilterModal
        visible={filterModalVisible}
        filterMode={filterMode}
        weekPreset={weekPreset}
        selectedCycleId={selectedCycleId}
        selectedDay={selectedDay}
        paymentStatus={paymentStatus}
        allCycles={allCycles}
        activeCycle={activeCycleFilter}
        theme={theme}
        isDarkMode={isDarkMode}
        insets={insets}
        onClose={() => setFilterModalVisible(false)}
        onApply={(params) => {
          setFilterMode(params.filterMode);
          setWeekPreset(params.weekPreset);
          setSelectedCycleId(params.selectedCycleId);
          setSelectedDay(params.selectedDay);
          setPaymentStatus(params.paymentStatus);
        }}
        onOpenCalendar={() => setCalendarPickerVisible(true)}
      />

      {/* CALENDAR PICKER MODAL FOR SPECIFIC DAY */}
      <CalendarPickerModal
        visible={calendarPickerVisible}
        selectedDate={selectedDay}
        theme={theme}
        onClose={() => setCalendarPickerVisible(false)}
        onSelectDate={(d) => {
          setSelectedDay(d);
          setFilterMode('day');
          setCalendarPickerVisible(false);
        }}
      />

      {/* REPORT MODULE DROPDOWN MODAL */}
      <Modal
        visible={moduleMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModuleMenuVisible(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'center',
            paddingHorizontal: 24,
          }}
          onPress={() => setModuleMenuVisible(false)}
        >
          <View
            style={[
              {
                backgroundColor: theme.surface,
                borderRadius: M3Shape.large,
                padding: 16,
                borderWidth: 1,
                borderColor: theme.divider,
                gap: 8,
              },
              M3Elevation.level3,
            ]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={{ fontSize: 14, fontWeight: '800', color: theme.onSurface, marginBottom: 4 }}>
              Select Report Module
            </Text>
            {(
              [
                {
                  key: 'cashflow',
                  label: 'Income vs Expense',
                  desc: 'Net cashflow, retention & burn rate',
                  icon: 'chart-timeline-variant-shimmer',
                  color: theme.primary,
                  active: reportTab === 'cashflow' && analyticsFocus !== 'income',
                  onSelect: () => {
                    setReportTab('cashflow');
                    setAnalyticsFocus('overview');
                  },
                },
                {
                  key: 'spending',
                  label: 'Spending',
                  desc: 'Categories, budget caps, velocity & taxes',
                  icon: 'arrow-top-right',
                  color: theme.error,
                  active: reportTab === 'spending',
                  onSelect: () => {
                    setReportTab('spending');
                    setAnalyticsFocus('expense');
                  },
                },
                {
                  key: 'income',
                  label: 'Income Sources',
                  desc: 'Income donut, sources & goal progress',
                  icon: 'arrow-bottom-left',
                  color: theme.success,
                  active: reportTab === 'cashflow' && analyticsFocus === 'income',
                  onSelect: () => {
                    setReportTab('cashflow');
                    setAnalyticsFocus('income');
                  },
                },
                {
                  key: 'loans',
                  label: 'Loans',
                  desc: 'Owed to you, you owe & net loan position',
                  icon: 'handshake-outline',
                  color: theme.primary,
                  active: reportTab === 'loans',
                  onSelect: () => {
                    setReportTab('loans');
                  },
                },
                {
                  key: 'transfers',
                  label: 'Transfers',
                  desc: 'Wallet-to-wallet movements in period',
                  icon: 'swap-horizontal',
                  color: theme.tertiary,
                  active: reportTab === 'transfers',
                  onSelect: () => {
                    setReportTab('transfers');
                  },
                },
                {
                  key: 'exports',
                  label: 'Exports & Compare',
                  desc: 'Period comparison, CSV, TXT & clipboard',
                  icon: 'file-export-outline',
                  color: theme.tertiary,
                  active: reportTab === 'exports',
                  onSelect: () => {
                    setReportTab('exports');
                  },
                },
              ] as const
            ).map((mod) => (
              <TouchableOpacity
                key={mod.key}
                onPress={() => {
                  mod.onSelect();
                  setModuleMenuVisible(false);
                }}
                activeOpacity={0.75}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  borderRadius: M3Shape.medium,
                  backgroundColor: mod.active ? theme.primaryContainer : theme.pillBg,
                  borderWidth: 1,
                  borderColor: mod.active ? theme.primary : 'transparent',
                }}
              >
                <MaterialCommunityIcons name={mod.icon as any} size={20} color={mod.color} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13.5,
                      fontWeight: '800',
                      color: mod.active ? theme.onPrimaryContainer : theme.onSurface,
                    }}
                  >
                    {mod.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11.5,
                      color: mod.active ? theme.onPrimaryContainer : theme.onSurfaceVariant,
                    }}
                  >
                    {mod.desc}
                  </Text>
                </View>
                {mod.active && (
                  <MaterialCommunityIcons name="check" size={18} color={theme.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
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
  pieCardTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 6,
  },
  cardHeaderFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: M3Shape.full,
    borderWidth: 1,
    maxWidth: 135,
  },
  cardHeaderFilterText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardHeaderFlipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4.5,
    paddingHorizontal: 9,
    borderRadius: M3Shape.full,
    borderWidth: 1,
  },
  cardHeaderFlipText: {
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cardHeaderExportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: M3Shape.full,
  },
  cardHeaderExportText: {
    fontSize: 11,
    fontWeight: '700',
  },
  flipHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: M3Shape.full,
    marginTop: 8,
  },
  flipHintText: {
    fontSize: 10,
    fontWeight: '600',
  },
  unzoomPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: M3Shape.full,
    marginTop: 4,
  },
  unzoomPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  flowDynamicsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4.5,
    paddingHorizontal: 9,
    borderRadius: M3Shape.full,
  },
  flowDynamicsBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  flowHeroDeltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
    paddingHorizontal: 4,
  },
  flowDeltaSub: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  flowDeltaMain: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  flowHeroPillsCol: {
    gap: 4,
    alignItems: 'flex-end',
  },
  streamPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: M3Shape.full,
  },
  streamPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  flowChartContainer: {
    marginVertical: 12,
  },
  dualBarsWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 110,
    paddingHorizontal: 6,
  },
  dualBarCol: {
    flex: 1,
    alignItems: 'center',
  },
  dualBarTrackArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
    width: '100%',
    height: 75,
  },
  singleDualBar: {
    width: 7,
    borderRadius: 3.5,
  },
  dualBarDayText: {
    fontSize: 9.5,
    fontWeight: '600',
    marginTop: 6,
  },
  dualBarNumText: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 1,
  },
  emptyChartNotice: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyChartNoticeText: {
    fontSize: 12,
    textAlign: 'center',
  },
  retentionContainer: {
    marginTop: 4,
  },
  retentionBarTrack: {
    flexDirection: 'row',
    height: 7,
    borderRadius: M3Shape.full,
    overflow: 'hidden',
  },
  retentionSegment: {
    height: '100%',
  },
  retentionLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  retentionLabelText: {
    fontSize: 11,
    fontWeight: '600',
  },
  filterModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    justifyContent: 'flex-end',
  },
  filterModalDismissArea: {
    flex: 1,
  },
  filterModalSheet: {
    borderTopLeftRadius: M3Shape.extraLarge,
    borderTopRightRadius: M3Shape.extraLarge,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  dragHandleRow: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  dragHandlePill: {
    width: 38,
    height: 4,
    borderRadius: 2,
  },
  filterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 6,
  },
  filterIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterModalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  filterCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSectionLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  filterModeTabRow: {
    flexDirection: 'row',
    borderRadius: M3Shape.full,
    padding: 3,
    marginBottom: 14,
  },
  filterModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: M3Shape.full,
  },
  filterModeTabText: {
    fontSize: 12,
  },
  filterSubSection: {
    marginBottom: 10,
  },
  filterSubLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  cycleSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: M3Shape.medium,
    borderWidth: 1,
    marginBottom: 6,
  },
  cycleSelectName: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  activeCycleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  activeCycleBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  cycleSelectDates: {
    fontSize: 11,
    marginTop: 2,
  },
  allTimeInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: M3Shape.medium,
    marginBottom: 10,
  },
  allTimeInfoText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  specificDayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: M3Shape.medium,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  dayCardIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCardTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  dayCardSub: {
    fontSize: 11,
    marginTop: 1,
  },
  quickDayRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  quickDayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: M3Shape.full,
    borderWidth: 1,
  },
  quickDayChipText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  statusOptionRow: {
    flexDirection: 'column',
    gap: 6,
    marginBottom: 12,
  },
  statusOptionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: M3Shape.medium,
    borderWidth: 1,
  },
  statusOptionText: {
    fontSize: 13,
  },
  filterModalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  filterResetBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: M3Shape.large,
  },
  filterResetBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  filterApplyBtn: {
    flex: 1.8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: M3Shape.large,
  },
  filterApplyBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
