import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RecurringBill, Wallet } from '../types';
import { formatCurrency } from '../utils/format';
import { getActiveBillAlerts } from '../utils/recurring';
import { M3Elevation, M3Shape } from '../theme';

interface OverdueBillReminderBannerProps {
  recurringBills: RecurringBill[];
  wallets: Wallet[];
  baseCurrency: string;
  theme: any;
  onPayBill: (bill: RecurringBill) => Promise<void>;
  onNavigateToCalendar?: (dateStr: string) => void;
}

export const OverdueBillReminderBanner: React.FC<OverdueBillReminderBannerProps> = ({
  recurringBills,
  wallets,
  baseCurrency,
  theme,
  onPayBill,
  onNavigateToCalendar,
}) => {
  const [dismissed, setDismissed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const alerts = useMemo(() => getActiveBillAlerts(recurringBills), [recurringBills]);

  if (dismissed || alerts.totalUrgent === 0) return null;

  const isDarkMode = theme.dark;

  // Prioritize the oldest overdue bill first, then due today
  const urgentBills = [...alerts.overdue, ...alerts.dueToday];
  const primaryBill = urgentBills[0];
  const otherCount = urgentBills.length - 1;

  if (!primaryBill) return null;

  const todayStr = new Date().toISOString().slice(0, 10);
  const isOverdue = primaryBill.next_due_date < todayStr;
  const isIncome = primaryBill.type === 'income';
  const wallet = wallets.find((w) => w.id === primaryBill.wallet_id);

  const calculateDaysAgo = (dateStr: string) => {
    try {
      const due = new Date(dateStr + 'T00:00:00');
      const today = new Date(todayStr + 'T00:00:00');
      const diff = Math.round((today.getTime() - due.getTime()) / 86400000);
      return diff;
    } catch {
      return 1;
    }
  };

  const daysOverdue = isOverdue ? calculateDaysAgo(primaryBill.next_due_date) : 0;

  const handlePressRecord = () => {
    Alert.alert(
      isIncome ? 'Record Recurring Income' : 'Record Recurring Bill',
      `Record "${primaryBill.name}" (${formatCurrency(primaryBill.amount, primaryBill.currency || baseCurrency)}) as paid now?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Record Now',
          onPress: async () => {
            setIsProcessing(true);
            try {
              await onPayBill(primaryBill);
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View
      style={[
        styles.bannerContainer,
        {
          backgroundColor: isOverdue
            ? (isDarkMode ? 'rgba(239, 68, 68, 0.16)' : '#FEF2F2')
            : (isDarkMode ? 'rgba(245, 158, 11, 0.16)' : '#FFFBEB'),
          borderColor: isOverdue
            ? (isDarkMode ? 'rgba(239, 68, 68, 0.45)' : '#FECACA')
            : (isDarkMode ? 'rgba(245, 158, 11, 0.45)' : '#FDE68A'),
        },
        M3Elevation.level1,
      ]}
    >
      <View style={styles.topRow}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: isOverdue
                ? (isDarkMode ? 'rgba(239, 68, 68, 0.3)' : '#FEE2E2')
                : (isDarkMode ? 'rgba(245, 158, 11, 0.3)' : '#FEF3C7'),
            },
          ]}
        >
          <MaterialCommunityIcons
            name={isOverdue ? 'alert-circle-outline' : 'calendar-clock'}
            size={18}
            color={isOverdue ? (isDarkMode ? '#FCA5A5' : '#DC2626') : (isDarkMode ? '#FCD34D' : '#D97706')}
          />
        </View>

        <View style={styles.textWrap}>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.titleText,
                { color: isOverdue ? (isDarkMode ? '#FCA5A5' : '#991B1B') : (isDarkMode ? '#FCD34D' : '#92400E') },
              ]}
              numberOfLines={1}
            >
              {isOverdue
                ? `${primaryBill.name} (${daysOverdue}d overdue)`
                : `${primaryBill.name} due today`}
            </Text>

            {otherCount > 0 && (
              <View
                style={[
                  styles.otherBadge,
                  {
                    backgroundColor: isOverdue
                      ? (isDarkMode ? 'rgba(239, 68, 68, 0.4)' : '#FCA5A5')
                      : (isDarkMode ? 'rgba(245, 158, 11, 0.4)' : '#FDE68A'),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.otherBadgeText,
                    {
                      color: isOverdue
                        ? (isDarkMode ? '#FFFFFF' : '#7F1D1D')
                        : (isDarkMode ? '#FFFFFF' : '#78350F'),
                    },
                  ]}
                >
                  +{otherCount} more
                </Text>
              </View>
            )}
          </View>

          <Text
            style={[
              styles.subtitleText,
              { color: isOverdue ? (isDarkMode ? '#FECACA' : '#B91C1C') : (isDarkMode ? '#FDE68A' : '#B45309') },
            ]}
            numberOfLines={1}
          >
            {isIncome ? '+' : '-'}{formatCurrency(primaryBill.amount, primaryBill.currency || baseCurrency)}
            {wallet ? ` • ${wallet.name}` : ''}
          </Text>
        </View>

        {/* Dismiss Button */}
        <TouchableOpacity
          onPress={() => setDismissed(true)}
          style={styles.closeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Dismiss reminder"
        >
          <MaterialCommunityIcons
            name="close"
            size={16}
            color={isOverdue ? (isDarkMode ? '#FCA5A5' : '#991B1B') : (isDarkMode ? '#FCD34D' : '#92400E')}
          />
        </TouchableOpacity>
      </View>

      {/* Action Buttons Row */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[
            styles.calendarJumpBtn,
            {
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
              borderColor: isOverdue
                ? (isDarkMode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)')
                : (isDarkMode ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.2)'),
            },
          ]}
          onPress={() => onNavigateToCalendar?.(primaryBill.next_due_date)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="calendar-month-outline"
            size={14}
            color={isOverdue ? (isDarkMode ? '#FCA5A5' : '#B91C1C') : (isDarkMode ? '#FCD34D' : '#B45309')}
          />
          <Text
            style={[
              styles.calendarJumpBtnText,
              { color: isOverdue ? (isDarkMode ? '#FCA5A5' : '#B91C1C') : (isDarkMode ? '#FCD34D' : '#B45309') },
            ]}
          >
            View in Calendar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.recordActionBtn,
            {
              backgroundColor: isOverdue
                ? (isDarkMode ? '#EF4444' : '#DC2626')
                : (isDarkMode ? '#F59E0B' : '#D97706'),
            },
            M3Elevation.level1,
          ]}
          onPress={handlePressRecord}
          disabled={isProcessing}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
          <Text style={styles.recordActionBtnText}>
            {isIncome ? 'Receive' : 'Record as Paid'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleText: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  otherBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  otherBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  subtitleText: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    paddingTop: 2,
  },
  calendarJumpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  calendarJumpBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  recordActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  recordActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
