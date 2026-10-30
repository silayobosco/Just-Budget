import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBudget } from '../context/BudgetContext';
import { lightTheme, darkTheme, M3Shape } from '../theme';
import { formatCycleDateRange } from '../utils/format';

interface HeaderProps {
  onOpenCategories?: () => void;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenCategories,
  onOpenSettings,
}) => {
  const { settings, currentCycle, dailyAllowanceStats, openCycleModal } = useBudget();
  const isDarkMode = settings.theme_mode === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  const cycleDisplayRange = currentCycle?.start_date && currentCycle?.end_date
    ? formatCycleDateRange(currentCycle.start_date, currentCycle.end_date)
    : (currentCycle?.name || 'Active Cycle');

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderBottomColor: theme.divider }]}>
      <View style={styles.titleRow}>
        <View style={styles.brandContainer}>
          <View style={[styles.badgePill, { backgroundColor: theme.primaryContainer }]}>
            <Text style={[styles.badgeText, { color: theme.onPrimaryContainer }]}>JB</Text>
          </View>
          <View>
            <Text style={[styles.title, { color: theme.onSurface }]}>just budget</Text>
            {currentCycle && (
              <TouchableOpacity onPress={openCycleModal} activeOpacity={0.7} style={styles.subtitleTouch}>
                <Text style={[styles.subtitle, { color: theme.onSurfaceVariant }]}>
                  {cycleDisplayRange}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={14} color={theme.onSurfaceVariant} style={{ marginTop: 1, marginLeft: 2 }} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Remaining Days in Cycle Badge */}
        {currentCycle && (
          <TouchableOpacity
            style={[
              styles.daysBadge,
              {
                backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.16)' : theme.primaryContainer,
                borderColor: isDarkMode ? 'rgba(129, 140, 248, 0.32)' : 'rgba(0, 0, 0, 0.08)',
              },
            ]}
            onPress={openCycleModal}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="calendar-clock-outline"
              size={13}
              color={isDarkMode ? '#A5B4FC' : theme.primary}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.daysBadgeText,
                { color: isDarkMode ? '#E0E7FF' : theme.onPrimaryContainer },
              ]}
              numberOfLines={1}
            >
              {dailyAllowanceStats.daysRemaining} {dailyAllowanceStats.daysRemaining === 1 ? 'day left' : 'days left'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  badgePill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: M3Shape.full,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitleTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  daysBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: M3Shape.full,
    borderWidth: 1,
  },
  daysBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 38,
    height: 38,
    borderRadius: M3Shape.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
