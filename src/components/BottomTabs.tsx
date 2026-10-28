import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBudget } from '../context/BudgetContext';
import { lightTheme, darkTheme, M3Shape, M3Elevation } from '../theme';

export type TabType = 'home' | 'calendar' | 'wallets' | 'analytics' | 'settings';

interface BottomTabsProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export const BottomTabs: React.FC<BottomTabsProps> = ({ currentTab, onSelectTab }) => {
  const { settings } = useBudget();
  const theme = settings.theme_mode === 'dark' ? darkTheme : lightTheme;

  const tabs: { key: TabType; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
    { key: 'home', label: 'Home', icon: 'view-dashboard-outline' },
    { key: 'calendar', label: 'Calendar', icon: 'calendar-month-outline' },
    { key: 'wallets', label: 'Wallets', icon: 'wallet-outline' },
    { key: 'analytics', label: 'Analytics', icon: 'chart-box-outline' },
    { key: 'settings', label: 'Settings', icon: 'cog-outline' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderTopColor: theme.divider }, M3Elevation.level2]}>
      {tabs.map((tab) => {
        const isActive = currentTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            onPress={() => onSelectTab(tab.key)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.iconPill,
                {
                  backgroundColor: isActive ? theme.primaryContainer : 'transparent',
                },
              ]}
            >
              <MaterialCommunityIcons
                name={tab.icon}
                size={22}
                color={isActive ? theme.onPrimaryContainer : theme.onSurfaceVariant}
              />
            </View>
            <Text
              style={[
                styles.tabLabel,
                {
                  color: isActive ? theme.onSurface : theme.onSurfaceVariant,
                  fontWeight: isActive ? '700' : '500',
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 70,
    borderTopWidth: 1,
    paddingHorizontal: 8,
    paddingBottom: 6,
    paddingTop: 6,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  iconPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: M3Shape.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
});
