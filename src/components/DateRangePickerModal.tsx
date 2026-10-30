import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBudget } from '../context/BudgetContext';
import { lightTheme, darkTheme } from '../theme';

interface DateRangePickerModalProps {
  visible: boolean;
  initialStartDate?: string;
  initialEndDate?: string;
  onClose: () => void;
  onSave: (startDate: string, endDate: string) => Promise<void> | void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const WEEKDAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const DateRangePickerModal: React.FC<DateRangePickerModalProps> = ({
  visible,
  initialStartDate,
  initialEndDate,
  onClose,
  onSave,
}) => {
  const { settings } = useBudget();
  const theme = settings.theme_mode === 'dark' ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  // Selected range state
  const [startDate, setStartDate] = useState<string | null>(initialStartDate || null);
  const [endDate, setEndDate] = useState<string | null>(initialEndDate || null);

  // Sync with initial props whenever modal opens
  useEffect(() => {
    if (visible) {
      setStartDate(initialStartDate || null);
      setEndDate(initialEndDate || null);
    }
  }, [visible, initialStartDate, initialEndDate]);

  // Generate 12 calendar months starting from current month (or earlier if start date is in past)
  const calendarMonths = useMemo(() => {
    const today = new Date();
    let startYear = today.getFullYear();
    let startMonth = today.getMonth();

    if (initialStartDate) {
      const [sy, sm] = initialStartDate.split('-').map(Number);
      if (sy < startYear || (sy === startYear && sm - 1 < startMonth)) {
        startYear = sy;
        startMonth = sm - 1;
      }
    }

    const monthsList = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(startYear, startMonth + i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      // Monday is col 0, Sunday is col 6
      const firstDayWeekday = (new Date(year, month, 1).getDay() + 6) % 7;

      const cells: {
        dateStr: string;
        dayNumber: number;
        col: number;
        isFirstDay: boolean;
        isLastDay: boolean;
        daysInMonth: number;
      }[] = [];

      // Leading empty cells
      for (let pad = 0; pad < firstDayWeekday; pad++) {
        cells.push({
          dateStr: '',
          dayNumber: 0,
          col: pad,
          isFirstDay: false,
          isLastDay: false,
          daysInMonth,
        });
      }

      // Day cells
      for (let day = 1; day <= daysInMonth; day++) {
        const col = (firstDayWeekday + day - 1) % 7;
        const mm = String(month + 1).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        const dateStr = `${year}-${mm}-${dd}`;

        cells.push({
          dateStr,
          dayNumber: day,
          col,
          isFirstDay: day === 1,
          isLastDay: day === daysInMonth,
          daysInMonth,
        });
      }

      monthsList.push({
        year,
        month,
        title: `${MONTH_NAMES[month]} ${year}`,
        cells,
      });
    }

    return monthsList;
  }, [initialStartDate]);

  // Day press handling
  const handleDayPress = (dateStr: string) => {
    if (!startDate || (startDate && endDate)) {
      setStartDate(dateStr);
      setEndDate(null);
    } else {
      // startDate is already picked, picking endDate
      if (dateStr >= startDate) {
        setEndDate(dateStr);
      } else {
        // Earlier date tapped -> restart range from that date
        setStartDate(dateStr);
        setEndDate(null);
      }
    }
  };

  const handleSave = () => {
    if (!startDate) return;
    const finalEnd = endDate || startDate;
    onSave(startDate, finalEnd);
    onClose();
  };

  // Format header display: e.g. "29 Oct – 5 Nov"
  const headerRangeText = useMemo(() => {
    if (!startDate) return 'Select date range';

    const formatShort = (str: string) => {
      const [y, m, d] = str.split('-').map(Number);
      return `${d} ${SHORT_MONTHS[m - 1]}`;
    };

    if (startDate && !endDate) {
      return `${formatShort(startDate)} – Select end date`;
    }

    if (startDate && endDate) {
      if (startDate === endDate) {
        return formatShort(startDate);
      }
      return `${formatShort(startDate)} – ${formatShort(endDate)}`;
    }

    return 'Select date range';
  }, [startDate, endDate]);

  const canSave = Boolean(startDate);

  // Cell width calculation: 7 equal columns with symmetric screen padding
  const totalHorizontalPad = 32;
  const availableGridWidth = screenWidth - totalHorizontalPad;
  const cellWidth = Math.floor(availableGridWidth / 7);
  const sidePadding = (screenWidth - cellWidth * 7) / 2;

  // The range highlight band color matching the screenshot
  const rangeBandColor =
    settings.theme_mode === 'dark' ? 'rgba(0, 162, 255, 0.22)' : 'rgba(0, 120, 230, 0.16)';
  const circleColor = theme.primary; // Bright accent blue

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
            paddingTop: Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight || 20 : 20),
          },
        ]}
      >
        {/* TOP BAR: CLOSE (✕) & SAVE */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="close" size={26} color={theme.onSurface} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSave}
            disabled={!canSave}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.saveButtonText,
                { color: canSave ? theme.primary : theme.onSurfaceVariant },
              ]}
            >
              SAVE
            </Text>
          </TouchableOpacity>
        </View>

        {/* HERO TITLE SECTION: SELECT DATE & RANGE */}
        <View style={styles.headerSection}>
          <Text style={[styles.headerSubtitle, { color: theme.onSurfaceVariant }]}>
            SELECT DATE
          </Text>
          <Text
            style={[styles.headerRangeTitle, { color: theme.onSurface }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {headerRangeText}
          </Text>
        </View>

        {/* FIXED WEEKDAYS HEADER (M T W T F S S) */}
        <View style={[styles.weekdaysRow, { paddingHorizontal: sidePadding }]}>
          {WEEKDAY_HEADERS.map((w, idx) => (
            <View key={idx} style={[styles.weekdayCell, { width: cellWidth }]}>
              <Text style={[styles.weekdayText, { color: theme.onSurfaceVariant }]}>
                {w}
              </Text>
            </View>
          ))}
        </View>
        <View style={[styles.headerDivider, { backgroundColor: theme.divider }]} />

        {/* SCROLLABLE LIST OF CALENDAR MONTHS (2 FULLY VISIBLE BEFORE SCROLLING) */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) + 20 }]}
        >
          {calendarMonths.map((m) => (
            <View key={m.title} style={styles.monthContainer}>
              <Text style={[styles.monthTitle, { color: theme.onSurfaceVariant }]}>
                {m.title}
              </Text>

              {/* Month Grid */}
              <View style={[styles.monthGrid, { paddingHorizontal: sidePadding }]}>
                {m.cells.map((cell, idx) => {
                  if (!cell.dateStr) {
                    return <View key={idx} style={[styles.emptyCell, { width: cellWidth }]} />;
                  }

                  const isStart = cell.dateStr === startDate;
                  const isEnd = cell.dateStr === endDate;
                  const hasBoth = Boolean(startDate && endDate);
                  const isSingleDay = hasBoth && startDate === endDate;
                  const isInRange =
                    hasBoth &&
                    cell.dateStr > (startDate as string) &&
                    cell.dateStr < (endDate as string);

                  // Band logic
                  const showRightBand =
                    (isStart && hasBoth && !isSingleDay) || isInRange;
                  const showLeftBand =
                    (isEnd && hasBoth && !isSingleDay) || isInRange;

                  // Corner rounding for bands at week edges or month start/end
                  const isRowStart = cell.col === 0 || cell.isFirstDay;
                  const isRowEnd = cell.col === 6 || cell.isLastDay;

                  return (
                    <TouchableOpacity
                      key={cell.dateStr}
                      style={[styles.dayCell, { width: cellWidth }]}
                      onPress={() => handleDayPress(cell.dateStr)}
                      activeOpacity={0.7}
                    >
                      {/* CONNECTING RANGE BAND (POLYLINE VISUAL CONNECTOR) */}
                      {/* Left half band */}
                      {showLeftBand && (
                        <View
                          style={[
                            styles.bandSegment,
                            {
                              left: 0,
                              width: '50%',
                              backgroundColor: rangeBandColor,
                              borderTopLeftRadius: isRowStart ? 18 : 0,
                              borderBottomLeftRadius: isRowStart ? 18 : 0,
                            },
                          ]}
                        />
                      )}

                      {/* Right half band */}
                      {showRightBand && (
                        <View
                          style={[
                            styles.bandSegment,
                            {
                              left: '50%',
                              width: '50%',
                              backgroundColor: rangeBandColor,
                              borderTopRightRadius: isRowEnd ? 18 : 0,
                              borderBottomRightRadius: isRowEnd ? 18 : 0,
                            },
                          ]}
                        />
                      )}

                      {/* START / END CIRCLE OR INTERMEDIATE TEXT */}
                      {isStart || isEnd ? (
                        <View
                          style={[
                            styles.circleBadge,
                            { backgroundColor: circleColor },
                          ]}
                        >
                          <Text style={styles.selectedDayNumberText}>
                            {cell.dayNumber}
                          </Text>
                        </View>
                      ) : (
                        <Text
                          style={[
                            styles.dayNumberText,
                            {
                              color: isInRange ? theme.onSurface : theme.onSurface,
                              fontWeight: isInRange ? '600' : '500',
                            },
                          ]}
                        >
                          {cell.dayNumber}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  headerSection: {
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 16,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  headerRangeTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  weekdaysRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekdayCell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  weekdayText: {
    fontSize: 13,
    fontWeight: '700',
  },
  headerDivider: {
    height: 1,
    marginHorizontal: 18,
    marginTop: 6,
    marginBottom: 12,
  },
  scrollContent: {
    paddingTop: 8,
  },
  monthContainer: {
    marginBottom: 24,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyCell: {
    height: 44,
  },
  dayCell: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  bandSegment: {
    position: 'absolute',
    top: 4,
    height: 36,
  },
  circleBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  selectedDayNumberText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  dayNumberText: {
    fontSize: 15,
    zIndex: 2,
  },
});
