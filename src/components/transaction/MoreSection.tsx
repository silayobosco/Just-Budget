import React from 'react';
import {
  Image,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BillFrequency, RecurrenceEndType } from '../../types';
import { transactionFormStyles as styles } from './styles';
import { TransactionFormState } from './useTransactionForm';

interface MoreSectionProps {
  form: TransactionFormState;
  theme: any;
}

export const MoreSection: React.FC<MoreSectionProps> = ({ form, theme }) => {
  const {
    formKind,
    repeatEnabled,
    setRepeatEnabled,
    repeatFrequency,
    setRepeatFrequency,
    repeatDueDay,
    setRepeatDueDay,
    repeatEndType,
    setRepeatEndType,
    repeatEndOccurrences,
    setRepeatEndOccurrences,
    repeatEndDate,
    setEndCalendarVisible,
    reminderEnabled,
    setReminderEnabled,
    mediaUri,
    setMediaUri,
    handleTakePhoto,
    handlePickFromGallery,
    note,
    setNote,
    noteInputRef,
  } = form;

  const isLoan = formKind === 'loan';

  return (
    <>
      {/* 1. Repeat (Expense, Income, Transfer) or Reminder (Loan) */}
      {!isLoan ? (
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <View style={styles.labelWithIcon}>
                <MaterialCommunityIcons name="repeat" size={18} color={theme.primary} />
                <Text style={[styles.toggleTitle, { color: theme.onSurface }]}>
                  Recurring Transaction
                </Text>
              </View>
              <Text style={[styles.toggleSubtitle, { color: theme.onSurfaceVariant }]}>
                Schedule automatic repeating bill or income
              </Text>
            </View>
            <Switch
              value={repeatEnabled}
              onValueChange={setRepeatEnabled}
              trackColor={{ false: theme.outlineVariant, true: theme.primaryContainer }}
              thumbColor={repeatEnabled ? theme.primary : '#f4f3f4'}
            />
          </View>

          {repeatEnabled && (
            <View style={styles.recurringOptions}>
              <Text style={[styles.fieldSubLabel, { color: theme.onSurfaceVariant }]}>
                Frequency
              </Text>
              <View style={styles.freqRow}>
                {(['weekly', 'monthly', 'yearly'] as BillFrequency[]).map((freq) => (
                  <TouchableOpacity
                    key={freq}
                    style={[
                      styles.freqBtn,
                      {
                        backgroundColor: repeatFrequency === freq ? theme.primary : theme.pillBg,
                        borderColor: repeatFrequency === freq ? theme.primary : theme.divider,
                      },
                    ]}
                    onPress={() => setRepeatFrequency(freq)}
                  >
                    <Text
                      style={[
                        styles.freqBtnText,
                        {
                          color: repeatFrequency === freq ? theme.onPrimary : theme.onSurface,
                          fontWeight: repeatFrequency === freq ? '700' : '500',
                        },
                      ]}
                    >
                      {freq.charAt(0).toUpperCase() + freq.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[styles.optionSection, { borderTopColor: theme.divider }]}>
                <Text style={[styles.fieldSubLabel, { color: theme.onSurfaceVariant }]}>
                  {repeatFrequency === 'weekly' ? 'Repeat on Day of Week' : 'Repeat on Day of Month'}
                </Text>
                {repeatFrequency === 'weekly' ? (
                  <View style={styles.weekdaysRow}>
                    {[
                      { label: 'Mon', day: 1 },
                      { label: 'Tue', day: 2 },
                      { label: 'Wed', day: 3 },
                      { label: 'Thu', day: 4 },
                      { label: 'Fri', day: 5 },
                      { label: 'Sat', day: 6 },
                      { label: 'Sun', day: 7 },
                    ].map((item) => {
                      const isDaySelected = repeatDueDay === item.day;
                      return (
                        <TouchableOpacity
                          key={item.day}
                          style={[
                            styles.weekdayBtn,
                            {
                              backgroundColor: isDaySelected ? theme.primary : theme.pillBg,
                              borderColor: isDaySelected ? theme.primary : theme.divider,
                            },
                          ]}
                          onPress={() => setRepeatDueDay(item.day)}
                        >
                          <Text
                            style={[
                              styles.weekdayBtnText,
                              {
                                color: isDaySelected ? theme.onPrimary : theme.onSurface,
                                fontWeight: isDaySelected ? '700' : '500',
                              },
                            ]}
                          >
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.dayMonthRow}>
                    <TouchableOpacity
                      style={[styles.stepperBtn, { backgroundColor: theme.pillBg }]}
                      onPress={() => setRepeatDueDay((d) => Math.max(1, d - 1))}
                    >
                      <MaterialCommunityIcons name="minus" size={18} color={theme.onSurface} />
                    </TouchableOpacity>

                    <View
                      style={[
                        styles.dayDisplayBox,
                        { backgroundColor: theme.pillBg, borderColor: theme.divider },
                      ]}
                    >
                      <Text style={[styles.dayDisplayText, { color: theme.primary }]}>
                        Day {repeatDueDay}
                      </Text>
                      <Text style={[styles.dayDisplaySub, { color: theme.onSurfaceVariant }]}>
                        of month
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.stepperBtn, { backgroundColor: theme.pillBg }]}
                      onPress={() => setRepeatDueDay((d) => Math.min(31, d + 1))}
                    >
                      <MaterialCommunityIcons name="plus" size={18} color={theme.onSurface} />
                    </TouchableOpacity>

                    <View style={styles.quickDaysRow}>
                      {[1, 15, 28].map((d) => (
                        <TouchableOpacity
                          key={d}
                          style={[
                            styles.quickDayChip,
                            {
                              backgroundColor: repeatDueDay === d ? theme.primaryContainer : theme.pillBg,
                              borderColor: repeatDueDay === d ? theme.primary : theme.divider,
                            },
                          ]}
                          onPress={() => setRepeatDueDay(d)}
                        >
                          <Text
                            style={[
                              styles.quickDayChipText,
                              {
                                color: repeatDueDay === d ? theme.primary : theme.onSurfaceVariant,
                                fontWeight: repeatDueDay === d ? '700' : '500',
                              },
                            ]}
                          >
                            {d === 1 ? '1st' : d === 15 ? '15th' : '28th'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              <View style={[styles.optionSection, { borderTopColor: theme.divider }]}>
                <Text style={[styles.fieldSubLabel, { color: theme.onSurfaceVariant }]}>Ends On</Text>
                <View style={styles.endsOnTabsRow}>
                  {[
                    { key: 'never', label: 'Never' },
                    { key: 'after_occurrences', label: 'After X times' },
                    { key: 'on_date', label: 'On Date' },
                  ].map((tab) => (
                    <TouchableOpacity
                      key={tab.key}
                      style={[
                        styles.endsOnTab,
                        {
                          backgroundColor: repeatEndType === tab.key ? theme.primaryContainer : theme.pillBg,
                          borderColor: repeatEndType === tab.key ? theme.primary : theme.divider,
                        },
                      ]}
                      onPress={() => setRepeatEndType(tab.key as RecurrenceEndType)}
                    >
                      <Text
                        style={[
                          styles.endsOnTabText,
                          {
                            color: repeatEndType === tab.key ? theme.primary : theme.onSurface,
                            fontWeight: repeatEndType === tab.key ? '700' : '500',
                          },
                        ]}
                      >
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {repeatEndType === 'after_occurrences' && (
                  <View style={styles.endConfigRow}>
                    <Text style={[styles.endConfigLabel, { color: theme.onSurface }]}>Stop after:</Text>
                    <TextInput
                      style={[
                        styles.occurrencesInput,
                        { backgroundColor: theme.pillBg, color: theme.onSurface, borderColor: theme.divider },
                      ]}
                      keyboardType="number-pad"
                      value={repeatEndOccurrences}
                      onChangeText={setRepeatEndOccurrences}
                    />
                    <Text style={[styles.endConfigLabel, { color: theme.onSurfaceVariant }]}>payments</Text>
                  </View>
                )}

                {repeatEndType === 'on_date' && (
                  <View style={styles.endConfigRow}>
                    <Text style={[styles.endConfigLabel, { color: theme.onSurface }]}>Ends on date:</Text>
                    <TouchableOpacity
                      style={[
                        styles.endDateChip,
                        { backgroundColor: theme.pillBg, borderColor: theme.divider },
                      ]}
                      onPress={() => setEndCalendarVisible(true)}
                    >
                      <MaterialCommunityIcons name="calendar" size={14} color={theme.primary} />
                      <Text style={[styles.endDateChipText, { color: theme.onSurface }]}>
                        {repeatEndDate}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={[styles.reminderRow, { borderTopColor: theme.divider }]}>
                <View style={styles.labelWithIcon}>
                  <MaterialCommunityIcons name="bell-ring-outline" size={16} color={theme.primary} />
                  <Text style={[styles.reminderTitle, { color: theme.onSurface }]}>
                    Remind me before due date
                  </Text>
                </View>
                <Switch
                  value={reminderEnabled}
                  onValueChange={setReminderEnabled}
                  trackColor={{ false: theme.outlineVariant, true: theme.primaryContainer }}
                  thumbColor={reminderEnabled ? theme.primary : '#f4f3f4'}
                />
              </View>
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <View style={styles.labelWithIcon}>
                <MaterialCommunityIcons name="bell-ring-outline" size={18} color={theme.primary} />
                <Text style={[styles.toggleTitle, { color: theme.onSurface }]}>Reminder</Text>
              </View>
              <Text style={[styles.toggleSubtitle, { color: theme.onSurfaceVariant }]}>
                Remind me before loan due date
              </Text>
            </View>
            <Switch
              value={reminderEnabled}
              onValueChange={setReminderEnabled}
              trackColor={{ false: theme.outlineVariant, true: theme.primaryContainer }}
              thumbColor={reminderEnabled ? theme.primary : '#f4f3f4'}
            />
          </View>
        </View>
      )}

      {/* 2. Media Attachment */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
        <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>
          MEDIA ATTACHMENT
        </Text>
        {mediaUri ? (
          <View style={styles.mediaPreviewContainer}>
            <Image source={{ uri: mediaUri }} style={styles.mediaImage} resizeMode="cover" />
            <TouchableOpacity
              style={[styles.removeMediaBtn, { backgroundColor: theme.error }]}
              onPress={() => setMediaUri(null)}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={16} color="#FFFFFF" />
              <Text style={styles.removeMediaText}>Remove Photo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.mediaActionsRow}>
            <TouchableOpacity
              style={[styles.mediaActionBtn, { backgroundColor: theme.pillBg, borderColor: theme.divider }]}
              onPress={handleTakePhoto}
            >
              <MaterialCommunityIcons name="camera-outline" size={20} color={theme.primary} />
              <Text style={[styles.mediaActionText, { color: theme.onSurface }]}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mediaActionBtn, { backgroundColor: theme.pillBg, borderColor: theme.divider }]}
              onPress={handlePickFromGallery}
            >
              <MaterialCommunityIcons name="image-outline" size={20} color={theme.primary} />
              <Text style={[styles.mediaActionText, { color: theme.onSurface }]}>From Gallery</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 3. Note */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
        <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>NOTE</Text>
        <TextInput
          ref={noteInputRef}
          style={[
            styles.noteInput,
            { backgroundColor: theme.pillBg, color: theme.onSurface, borderColor: theme.divider },
          ]}
          placeholder="Add optional notes or description..."
          placeholderTextColor={theme.onSurfaceVariant}
          multiline
          value={note}
          onChangeText={setNote}
        />
      </View>
    </>
  );
};
