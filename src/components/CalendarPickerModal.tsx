import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { M3Shape } from '../theme';

interface CalendarPickerModalProps {
  visible: boolean;
  selectedDate: string;
  theme: any;
  onClose: () => void;
  onSelectDate: (dateStr: string) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const CalendarPickerModal: React.FC<CalendarPickerModalProps> = ({
  visible,
  selectedDate,
  theme,
  onClose,
  onSelectDate,
}) => {
  const [viewMonth, setViewMonth] = useState<Date>(new Date());

  useEffect(() => {
    if (visible) {
      if (selectedDate) {
        const [y, m] = selectedDate.split('-').map(Number);
        if (y && m) {
          setViewMonth(new Date(y, m - 1, 1));
          return;
        }
      }
      setViewMonth(new Date());
    }
  }, [visible, selectedDate]);

  const calendarGrid = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { dayNum: number; dateString: string }[] = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push({ dayNum: 0, dateString: '' });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ dayNum: d, dateString });
    }
    return cells;
  }, [viewMonth]);

  if (!visible) return null;

  return (
    <View style={styles.quickModalBackdrop}>
      <View style={[styles.quickModalBox, { backgroundColor: theme.surface }]}>
        <View style={styles.calendarModalHeader}>
          <Text style={[styles.quickModalTitle, { color: theme.onSurface }]}>
            {MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
          </Text>
          <View style={styles.calNavRow}>
            <TouchableOpacity
              onPress={() => {
                const prev = new Date(viewMonth);
                prev.setMonth(prev.getMonth() - 1);
                setViewMonth(prev);
              }}
              style={[styles.calNavBtn, { backgroundColor: theme.pillBg }]}
            >
              <MaterialCommunityIcons name="chevron-left" size={20} color={theme.onSurface} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                const next = new Date(viewMonth);
                next.setMonth(next.getMonth() + 1);
                setViewMonth(next);
              }}
              style={[styles.calNavBtn, { backgroundColor: theme.pillBg }]}
            >
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.onSurface} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Weekday indicators */}
        <View style={styles.calWeekdayRow}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, idx) => (
            <Text key={idx} style={[styles.calWeekdayText, { color: theme.onSurfaceVariant }]}>
              {w}
            </Text>
          ))}
        </View>

        {/* Month Days Grid */}
        <View style={styles.calDaysGrid}>
          {calendarGrid.map((cell, idx) => {
            if (cell.dayNum === 0) {
              return <View key={idx} style={styles.calEmptyCell} />;
            }
            const isSelected = cell.dateString === selectedDate;
            const isToday = cell.dateString === new Date().toISOString().slice(0, 10);

            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.calDayCell,
                  {
                    backgroundColor: isSelected ? theme.primaryContainer : 'transparent',
                    borderColor: isSelected ? theme.primary : isToday ? theme.secondary : 'transparent',
                  },
                ]}
                onPress={() => {
                  onSelectDate(cell.dateString);
                  onClose();
                }}
              >
                <Text
                  style={[
                    styles.calDayNum,
                    {
                      color: isSelected
                        ? theme.onPrimaryContainer
                        : isToday
                        ? theme.primary
                        : theme.onSurface,
                      fontWeight: isSelected || isToday ? '700' : '500',
                    },
                  ]}
                >
                  {cell.dayNum}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Actions: Today shortcut & Cancel */}
        <View style={styles.quickModalBtnRow}>
          <TouchableOpacity
            style={[styles.quickModalBtn, { backgroundColor: theme.pillBg }]}
            onPress={() => {
              onSelectDate(new Date().toISOString().slice(0, 10));
              onClose();
            }}
          >
            <Text style={{ color: theme.primary, fontWeight: '700' }}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickModalBtn, { backgroundColor: theme.pillBg }]}
            onPress={onClose}
          >
            <Text style={{ color: theme.onSurface }}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  quickModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  quickModalBox: {
    width: '100%',
    maxWidth: 340,
    borderRadius: M3Shape.extraLarge,
    padding: 20,
    gap: 12,
  },
  quickModalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  quickModalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  quickModalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: M3Shape.full,
  },
  calendarModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  calNavRow: {
    flexDirection: 'row',
    gap: 6,
  },
  calNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calWeekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 6,
  },
  calWeekdayText: {
    fontSize: 11,
    fontWeight: '700',
    width: 36,
    textAlign: 'center',
  },
  calDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  calEmptyCell: {
    width: 38,
    height: 38,
    marginVertical: 2,
  },
  calDayCell: {
    width: 38,
    height: 38,
    marginVertical: 2,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  calDayNum: {
    fontSize: 13,
  },
});
