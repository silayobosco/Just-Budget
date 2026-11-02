import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemeColors, M3Shape, M3Elevation } from '../theme';
import { getRegularCycleDates } from '../utils/format';

interface CycleStartDayCalendarProps {
  selectedDay: number;
  onSelectDay: (day: number) => void;
  theme: ThemeColors;
  isDarkMode?: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const START_DAY_PRESETS = [
  { label: '1st (Month Start)', day: 1 },
  { label: '15th (Mid-Month)', day: 15 },
  { label: '25th (Pay Day)', day: 25 },
  { label: '28th (Month-End)', day: 28 },
];

const getOrdinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export const CycleStartDayCalendar: React.FC<CycleStartDayCalendarProps> = ({
  selectedDay,
  onSelectDay,
  theme,
  isDarkMode = false,
}) => {
  const [viewDate, setViewDate] = useState<Date>(() => new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Monday = 0 ... Sunday = 6
  const firstDayWeekday = (new Date(year, month, 1).getDay() + 6) % 7;

  const today = useMemo(() => new Date(), []);
  const isCurrentMonthView = today.getFullYear() === year && today.getMonth() === month;
  const todayDateNum = today.getDate();

  const handlePrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  // Preview current cycle calculated from selected day
  const cyclePreview = useMemo(() => {
    const valid = Math.min(31, Math.max(1, selectedDay || 1));
    return getRegularCycleDates(valid);
  }, [selectedDay]);

  return (
    <View style={styles.container}>
      {/* QUICK PRESETS ROW */}
      <View style={styles.presetsRow}>
        {START_DAY_PRESETS.map((p) => {
          const isSelected = selectedDay === p.day;
          return (
            <TouchableOpacity
              key={p.day}
              style={[
                styles.presetChip,
                {
                  backgroundColor: isSelected ? theme.primaryContainer : theme.pillBg,
                  borderColor: isSelected ? theme.primary : 'transparent',
                },
              ]}
              onPress={() => onSelectDay(p.day)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.presetChipText,
                  {
                    color: isSelected ? theme.onPrimaryContainer : theme.onSurface,
                    fontWeight: isSelected ? '700' : '500',
                  },
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* CALENDAR CARD */}
      <View
        style={[
          styles.calendarCard,
          {
            backgroundColor: theme.cardBg,
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : theme.divider,
          },
          M3Elevation.level1,
        ]}
      >
        {/* CALENDAR HEADER: MONTH & YEAR WITH CHEVRONS */}
        <View style={styles.calendarHeader}>
          <TouchableOpacity
            onPress={handlePrevMonth}
            style={[styles.navArrowBtn, { backgroundColor: theme.pillBg }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="chevron-left" size={20} color={theme.onSurface} />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={[styles.calendarMonthText, { color: theme.onSurface }]}>
              {MONTH_NAMES[month]} {year}
            </Text>
            <Text style={[styles.calendarSubText, { color: theme.onSurfaceVariant }]}>
              Tap any date to set month start day
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleNextMonth}
            style={[styles.navArrowBtn, { backgroundColor: theme.pillBg }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.onSurface} />
          </TouchableOpacity>
        </View>

        {/* WEEKDAY COLUMN LABELS */}
        <View style={styles.weekdayRow}>
          {WEEKDAY_HEADERS.map((w, idx) => (
            <View key={idx} style={styles.weekdayCell}>
              <Text style={[styles.weekdayText, { color: theme.onSurfaceVariant }]}>{w}</Text>
            </View>
          ))}
        </View>

        {/* DAYS GRID */}
        <View style={styles.daysGrid}>
          {/* Empty padding cells for start of month */}
          {Array.from({ length: firstDayWeekday }).map((_, idx) => (
            <View key={`pad-${idx}`} style={styles.dayCellWrapper} />
          ))}

          {/* Month Day Cells */}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const isSelected = selectedDay === dayNum;
            const isToday = isCurrentMonthView && todayDateNum === dayNum;

            return (
              <View key={`day-${dayNum}`} style={styles.dayCellWrapper}>
                <TouchableOpacity
                  style={[
                    styles.dayCircle,
                    isSelected && { backgroundColor: theme.primary },
                    isToday && !isSelected && {
                      borderColor: theme.primary,
                      borderWidth: 1.5,
                      backgroundColor: theme.pillBg,
                    },
                  ]}
                  onPress={() => onSelectDay(dayNum)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dayText,
                      {
                        color: isSelected
                          ? theme.onPrimary
                          : isToday
                          ? theme.primary
                          : theme.onSurface,
                        fontWeight: isSelected || isToday ? '700' : '500',
                      },
                    ]}
                  >
                    {dayNum}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}

          {/* Day 31 fallback cell if current month only has 28 or 30 days */}
          {daysInMonth < 31 && (
            <View key="day-31-extra" style={styles.dayCellWrapper}>
              <TouchableOpacity
                style={[
                  styles.dayCircle,
                  selectedDay === 31 && { backgroundColor: theme.primary },
                  { opacity: 0.8 },
                ]}
                onPress={() => onSelectDay(31)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dayText,
                    {
                      color: selectedDay === 31 ? theme.onPrimary : theme.onSurfaceVariant,
                      fontWeight: selectedDay === 31 ? '700' : '500',
                    },
                  ]}
                >
                  31
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* LIVE PREVIEW BANNER */}
        <View style={[styles.previewBanner, { backgroundColor: theme.pillBg }]}>
          <MaterialCommunityIcons name="calendar-check" size={18} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.previewTitle, { color: theme.onSurface }]}>
              Cycle starts on the <Text style={{ color: theme.primary, fontWeight: '800' }}>{getOrdinal(selectedDay)}</Text> of every month
            </Text>
            <Text style={[styles.previewRange, { color: theme.onSurfaceVariant }]}>
              Active Cycle: <Text style={{ fontWeight: '700', color: theme.onSurface }}>{cyclePreview.name}</Text>
            </Text>
            <Text style={[styles.previewDates, { color: theme.onSurfaceVariant }]}>
              ({cyclePreview.startDate} to {cyclePreview.endDate})
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: M3Shape.full,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 12,
  },
  calendarCard: {
    borderRadius: M3Shape.large,
    borderWidth: 1,
    padding: 14,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  calendarMonthText: {
    fontSize: 15,
    fontWeight: '800',
  },
  calendarSubText: {
    fontSize: 11,
    marginTop: 1,
  },
  navArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: '700',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCellWrapper: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 13,
  },
  previewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    padding: 10,
    borderRadius: M3Shape.medium,
  },
  previewTitle: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  previewRange: {
    fontSize: 11.5,
    marginTop: 2,
  },
  previewDates: {
    fontSize: 10.5,
    marginTop: 1,
  },
});

