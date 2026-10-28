import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBudget } from '../context/BudgetContext';
import { lightTheme, darkTheme, M3Shape } from '../theme';

interface HeaderProps {
  onOpenCategories?: () => void;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenCategories,
  onOpenSettings,
}) => {
  const { settings, currentCycle } = useBudget();
  const theme = settings.theme_mode === 'dark' ? darkTheme : lightTheme;

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
              <Text style={[styles.subtitle, { color: theme.onSurfaceVariant }]}>
                {currentCycle.name}
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
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
    gap: 12,
  },
  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: M3Shape.full,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
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
