import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBudget } from '../context/BudgetContext';
import { lightTheme, darkTheme, M3Shape } from '../theme';
import { formatCycleDateRange, formatCurrency } from '../utils/format';
import { TabType } from './BottomTabs';
import { CycleModeSwitcherModal } from './CycleModeSwitcherModal';

interface HeaderProps {
  currentTab?: TabType;
  onNavigateTab?: (tab: TabType) => void;
  onOpenCategories?: () => void;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onNavigateTab,
  onOpenCategories,
  onOpenSettings,
}) => {
  const {
    settings,
    currentCycle,
    dailyAllowanceStats,
    openCycleModal,
    totalConvertedBalance,
    wallets,
    isViewingCurrentCycle,
    selectedCalendarCycle,
  } = useBudget();
  const isDarkMode = settings.theme_mode === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  const [modeModalVisible, setModeModalVisible] = useState(false);

  const isCalendarTab = currentTab === 'calendar';
  const isRegularMode = settings.cycle_mode === 'regular';

  // Only show Total Wallets balance when browsing a non-current cycle on calendar page
  const showRightBalanceChip = isCalendarTab && !isViewingCurrentCycle;

  const displayedCycle = isCalendarTab && selectedCalendarCycle ? selectedCalendarCycle : currentCycle;
  const cycleDisplayRange = displayedCycle?.start_date && displayedCycle?.end_date
    ? formatCycleDateRange(displayedCycle.start_date, displayedCycle.end_date)
    : (displayedCycle?.name || 'Active Cycle');

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderBottomColor: theme.divider }]}>
      <View style={styles.titleRow}>
        <View style={styles.brandContainer}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logoImage}
            resizeMode="cover"
          />
          <View>
            <Text style={[styles.title, { color: theme.onSurface }]}>just budget</Text>
            {/* Cycle Date Range under App Name (Tapping always opens Cycle Type Switcher dialog) */}
            {currentCycle ? (
              <TouchableOpacity
                onPress={() => setModeModalVisible(true)}
                activeOpacity={0.7}
                style={styles.subtitleTouch}
                accessibilityLabel="Switch Cycle Type"
              >
                <Text style={[styles.subtitle, { color: theme.onSurfaceVariant }]}>
                  {cycleDisplayRange}
                </Text>
                <MaterialCommunityIcons
                  name="chevron-down"
                  size={14}
                  color={theme.onSurfaceVariant}
                  style={{ marginTop: 1, marginLeft: 2 }}
                />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => setModeModalVisible(true)}
                activeOpacity={0.7}
                style={styles.subtitleTouch}
                accessibilityLabel="Switch Cycle Type"
              >
                <Text style={[styles.subtitle, { color: theme.primary, fontWeight: '700' }]}>
                  + Set Budget Cycle
                </Text>
                <MaterialCommunityIcons
                  name="chevron-down"
                  size={14}
                  color={theme.primary}
                  style={{ marginTop: 1, marginLeft: 2 }}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Right Chip: Total Wallets Balance (Tapping opens Wallets screen across all tabs) */}
        <TouchableOpacity
          style={[
            styles.daysBadge,
            {
              backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.16)' : theme.primaryContainer,
              borderColor: isDarkMode ? 'rgba(129, 140, 248, 0.32)' : 'rgba(0, 0, 0, 0.08)',
            },
          ]}
          onPress={() => onNavigateTab?.('wallets')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Open Wallets Screen"
        >
          <MaterialCommunityIcons
            name={wallets.length === 0 ? 'wallet-plus-outline' : 'wallet-outline'}
            size={14}
            color={isDarkMode ? '#A5B4FC' : theme.primary}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.daysBadgeText,
              { color: isDarkMode ? '#E0E7FF' : theme.onPrimaryContainer, fontWeight: '800' },
            ]}
            numberOfLines={1}
          >
            {wallets.length === 0
              ? '+ Add Wallet'
              : formatCurrency(totalConvertedBalance, settings.base_currency)}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Cycle Mode Switcher Modal (Opened when tapping cycle type in calendar page) */}
      <CycleModeSwitcherModal
        visible={modeModalVisible}
        onClose={() => setModeModalVisible(false)}
      />
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
  logoImage: {
    width: 32,
    height: 32,
    borderRadius: 8,
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
  switchBadge: {
    marginLeft: 6,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: M3Shape.full,
    alignItems: 'center',
    justifyContent: 'center',
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
