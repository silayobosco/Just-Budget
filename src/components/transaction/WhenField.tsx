import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { addLocalDays } from '../../utils/date';
import { transactionFormStyles as styles } from './styles';
import { TransactionFormState } from './useTransactionForm';

interface WhenFieldProps {
  form: TransactionFormState;
  theme: any;
}

export const WhenField: React.FC<WhenFieldProps> = ({ form, theme }) => {
  const {
    formKind,
    iouAction,
    dateStr,
    setDateStr,
    todayStr,
    yesterdayStr,
    displayDate,
    timeStr,
    setCalendarVisible,
    setClockVisible,
    iouDueDate,
    setIouDueDate,
    setIouDueCalendarVisible,
  } = form;

  const iouAccent = theme.primary;
  const iouContainer = theme.primaryContainer;
  const onIouContainer = theme.onPrimaryContainer;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
      <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>DATE & TIME</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateTimeChipsContainer}
      >
        <TouchableOpacity
          style={[
            styles.dateTimeQuickChip,
            {
              backgroundColor: dateStr === todayStr ? theme.primaryContainer : theme.pillBg,
              borderColor: dateStr === todayStr ? theme.primary : theme.divider,
            },
          ]}
          onPress={() => setDateStr(todayStr)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="calendar-today"
            size={14}
            color={dateStr === todayStr ? theme.primary : theme.onSurfaceVariant}
          />
          <Text
            style={[
              styles.dateTimeQuickChipText,
              {
                color: dateStr === todayStr ? theme.onPrimaryContainer : theme.onSurface,
                fontWeight: dateStr === todayStr ? '700' : '500',
              },
            ]}
          >
            Today
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.dateTimeQuickChip,
            {
              backgroundColor: dateStr === yesterdayStr ? theme.primaryContainer : theme.pillBg,
              borderColor: dateStr === yesterdayStr ? theme.primary : theme.divider,
            },
          ]}
          onPress={() => {
            setDateStr(dateStr === yesterdayStr ? todayStr : yesterdayStr);
          }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="history"
            size={14}
            color={dateStr === yesterdayStr ? theme.primary : theme.onSurfaceVariant}
          />
          <Text
            style={[
              styles.dateTimeQuickChipText,
              {
                color: dateStr === yesterdayStr ? theme.onPrimaryContainer : theme.onSurface,
                fontWeight: dateStr === yesterdayStr ? '700' : '500',
              },
            ]}
          >
            Yesterday
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.dateTimeQuickChip,
            {
              backgroundColor:
                dateStr !== todayStr && dateStr !== yesterdayStr
                  ? theme.primaryContainer
                  : theme.pillBg,
              borderColor:
                dateStr !== todayStr && dateStr !== yesterdayStr ? theme.primary : theme.divider,
            },
          ]}
          onPress={() => setCalendarVisible(true)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="calendar-month-outline"
            size={15}
            color={
              dateStr !== todayStr && dateStr !== yesterdayStr
                ? theme.primary
                : theme.onSurfaceVariant
            }
          />
          {dateStr !== todayStr && dateStr !== yesterdayStr && (
            <Text
              style={[
                styles.dateTimeQuickChipText,
                { color: theme.onPrimaryContainer, fontWeight: '700' },
              ]}
            >
              {displayDate}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.dateTimeQuickChip,
            {
              backgroundColor: theme.pillBg,
              borderColor: theme.divider,
            },
          ]}
          onPress={() => setClockVisible(true)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="clock-outline" size={14} color={theme.primary} />
          <Text style={[styles.dateTimeQuickChipText, { color: theme.onSurface, fontWeight: '600' }]}>
            {timeStr}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Requirement 6: Loan Due Date sits directly under Date; hidden for Settle */}
      {formKind === 'loan' && iouAction !== 'settle' && (
        <View style={{ marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.divider, gap: 8 }}>
          <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>DUE DATE (OPTIONAL)</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScrollRow}
          >
            <TouchableOpacity
              style={[
                styles.dateTimeQuickChip,
                {
                  backgroundColor: !iouDueDate ? iouContainer : theme.pillBg,
                  borderColor: !iouDueDate ? iouAccent : theme.divider,
                },
              ]}
              onPress={() => setIouDueDate('')}
            >
              <Text
                style={[
                  styles.dateTimeQuickChipText,
                  {
                    color: !iouDueDate ? onIouContainer : theme.onSurface,
                    fontWeight: !iouDueDate ? '700' : '500',
                  },
                ]}
              >
                No Due Date
              </Text>
            </TouchableOpacity>

            {[7, 30].map((days) => {
              const presetStr = addLocalDays(dateStr || todayStr, days);
              const active = iouDueDate === presetStr;
              return (
                <TouchableOpacity
                  key={days}
                  style={[
                    styles.dateTimeQuickChip,
                    {
                      backgroundColor: active ? iouContainer : theme.pillBg,
                      borderColor: active ? iouAccent : theme.divider,
                    },
                  ]}
                  onPress={() => setIouDueDate(presetStr)}
                >
                  <Text
                    style={[
                      styles.dateTimeQuickChipText,
                      {
                        color: active ? onIouContainer : theme.onSurface,
                        fontWeight: active ? '700' : '500',
                      },
                    ]}
                  >
                    +{days}d
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[
                styles.dateTimeQuickChip,
                {
                  backgroundColor: iouDueDate ? iouContainer : theme.pillBg,
                  borderColor: iouDueDate ? iouAccent : theme.divider,
                },
              ]}
              onPress={() => setIouDueCalendarVisible(true)}
            >
              <MaterialCommunityIcons
                name="calendar-clock"
                size={14}
                color={iouDueDate ? iouAccent : theme.onSurfaceVariant}
              />
              <Text
                style={[
                  styles.dateTimeQuickChipText,
                  {
                    color: iouDueDate ? onIouContainer : theme.onSurface,
                    fontWeight: iouDueDate ? '700' : '500',
                  },
                ]}
              >
                {iouDueDate || 'Pick Date'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}
    </View>
  );
};
