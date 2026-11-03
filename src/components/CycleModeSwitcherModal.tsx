import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBudget } from '../context/BudgetContext';
import { lightTheme, darkTheme, M3Shape } from '../theme';

interface CycleModeSwitcherModalProps {
  visible: boolean;
  onClose: () => void;
}

export const CycleModeSwitcherModal: React.FC<CycleModeSwitcherModalProps> = ({
  visible,
  onClose,
}) => {
  const { settings, allCycles, updateSettings, setActiveBudgetCycle, openCycleModal } = useBudget();
  const isDarkMode = settings.theme_mode === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  const handleOpenCycleManager = () => {
    onClose();
    setTimeout(() => {
      openCycleModal();
    }, 150);
  };

  const handleSelectMode = async (mode: 'regular' | 'custom') => {
    await updateSettings({ cycle_mode: mode });
    if (mode === 'regular') {
      const regCycle = allCycles.find((c) => c.id.startsWith('cycle-reg-')) || allCycles[0];
      if (regCycle) {
        await setActiveBudgetCycle(regCycle.id);
      }
    } else {
      const customCycle = allCycles.find((c) => !c.id.startsWith('cycle-reg-')) || allCycles[0];
      if (customCycle) {
        await setActiveBudgetCycle(customCycle.id);
      }
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[styles.modeSwitcherBox, { backgroundColor: theme.surface }]}
          onStartShouldSetResponder={() => true}
        >
          {/* Header */}
          <View style={styles.modeSwitcherHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialCommunityIcons name="calendar-sync" size={22} color={theme.primary} />
              <Text style={[styles.modeSwitcherTitle, { color: theme.onSurface }]}>Cycle Mode</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="close" size={20} color={theme.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.modeSwitcherSub, { color: theme.onSurfaceVariant }]}>
            Shift between regular recurring calendar months and custom arbitrary periods. Press & hold to manage cycles.
          </Text>

          {/* Mode Option 1: Regular Calendar */}
          <TouchableOpacity
            style={[
              styles.modeCard,
              {
                backgroundColor: settings.cycle_mode === 'regular'
                  ? (isDarkMode ? 'rgba(99, 102, 241, 0.22)' : theme.primaryContainer)
                  : theme.pillBg,
                borderColor: settings.cycle_mode === 'regular' ? theme.primary : 'transparent',
              },
            ]}
            onPress={() => handleSelectMode('regular')}
            onLongPress={handleOpenCycleManager}
            delayLongPress={350}
            activeOpacity={0.75}
          >
            <View style={[styles.modeCardIconWrap, { backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.2)' : theme.primaryContainer }]}>
              <MaterialCommunityIcons
                name="calendar-month"
                size={22}
                color={isDarkMode ? '#A5B4FC' : theme.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.modeCardTitle, { color: theme.onSurface }]}>Regular Calendar</Text>
                {settings.cycle_mode === 'regular' && (
                  <View style={[styles.modeActivePill, { backgroundColor: theme.primary }]}>
                    <Text style={[styles.modeActivePillText, { color: theme.onPrimary }]}>Active</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.modeCardDesc, { color: theme.onSurfaceVariant }]}>
                Monthly cycle repeating on the {settings.cycle_month_start_day || 1}st of each month.
              </Text>
            </View>
            <MaterialCommunityIcons
              name={settings.cycle_mode === 'regular' ? 'radiobox-marked' : 'radiobox-blank'}
              size={22}
              color={settings.cycle_mode === 'regular' ? theme.primary : theme.outlineVariant}
            />
          </TouchableOpacity>

          {/* Mode Option 2: Custom Periods */}
          <TouchableOpacity
            style={[
              styles.modeCard,
              {
                backgroundColor: settings.cycle_mode === 'custom'
                  ? (isDarkMode ? 'rgba(99, 102, 241, 0.22)' : theme.primaryContainer)
                  : theme.pillBg,
                borderColor: settings.cycle_mode === 'custom' ? theme.primary : 'transparent',
              },
            ]}
            onPress={() => handleSelectMode('custom')}
            onLongPress={handleOpenCycleManager}
            delayLongPress={350}
            activeOpacity={0.75}
          >
            <View style={[styles.modeCardIconWrap, { backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.2)' : theme.primaryContainer }]}>
              <MaterialCommunityIcons
                name="calendar-range"
                size={22}
                color={isDarkMode ? '#A5B4FC' : theme.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.modeCardTitle, { color: theme.onSurface }]}>Custom Periods</Text>
                {settings.cycle_mode === 'custom' && (
                  <View style={[styles.modeActivePill, { backgroundColor: theme.primary }]}>
                    <Text style={[styles.modeActivePillText, { color: theme.onPrimary }]}>Active</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.modeCardDesc, { color: theme.onSurfaceVariant }]}>
                Arbitrary date ranges, pay periods, or custom multi-week intervals.
              </Text>
            </View>
            <MaterialCommunityIcons
              name={settings.cycle_mode === 'custom' ? 'radiobox-marked' : 'radiobox-blank'}
              size={22}
              color={settings.cycle_mode === 'custom' ? theme.primary : theme.outlineVariant}
            />
          </TouchableOpacity>

          {/* Hint for editing */}
          <View style={[styles.modeHintRow, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : theme.pillBg }]}>
            <MaterialCommunityIcons name="gesture-tap-hold" size={16} color={theme.primary} />
            <Text style={[styles.modeHintText, { color: theme.onSurfaceVariant }]}>
              Hold any cycle chip on the calendar header to edit dates and budget targets.
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modeSwitcherBox: {
    width: '100%',
    maxWidth: 360,
    borderRadius: M3Shape.extraLarge,
    padding: 20,
    gap: 12,
  },
  modeSwitcherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modeSwitcherTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modeSwitcherSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: M3Shape.large,
    borderWidth: 1.5,
    gap: 12,
  },
  modeCardIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeCardTitle: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  modeCardDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  modeActivePill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: M3Shape.full,
  },
  modeActivePillText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  modeHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: M3Shape.medium,
    marginTop: 4,
  },
  modeHintText: {
    fontSize: 11,
    flex: 1,
    lineHeight: 15,
  },
});

