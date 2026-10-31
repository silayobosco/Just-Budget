import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Category, Subcategory, Wallet, TransactionType, BillFrequency, RecurrenceEndType } from '../types';
import { formatCurrency } from '../utils/format';
import { M3Elevation, M3Shape } from '../theme';
import { AnalogClockModal } from './AnalogClockModal';
import { CalendarPickerModal } from './CalendarPickerModal';

interface TransactionDetailsModalProps {
  visible: boolean;
  txType: TransactionType;
  initialAmount: number;
  initialWalletId: string;
  initialCategoryId?: string;
  initialSubcategoryId?: string;
  initialDate?: string;
  initialTime?: string;
  wallets: Wallet[];
  categories: Category[];
  theme: any;
  baseCurrency: string;
  onClose: () => void;
  onSave: (tx: {
    amount: number;
    wallet_id: string;
    category_id?: string;
    subcategory_id?: string;
    type: TransactionType;
    currency: string;
    date: string;
    time?: string;
    is_paid: boolean;
    note?: string;
    media_uri?: string;
    repeat_frequency?: BillFrequency;
    repeat_due_day?: number;
    repeat_end_type?: RecurrenceEndType;
    repeat_end_occurrences?: number;
    repeat_end_date?: string;
    reminder_enabled?: boolean;
  }) => Promise<void>;
  onManageCategories?: () => void;
  onAddSubcategory?: (categoryId: string, name: string) => Promise<string>;
}

const COMMON_CURRENCIES = ['USD', 'EUR', 'GBP', 'KES', 'INR', 'JPY', 'CAD', 'AUD', 'UGX', 'TZS', 'ZAR'];

export const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({
  visible,
  txType: defaultTxType,
  initialAmount,
  initialWalletId,
  initialCategoryId,
  initialSubcategoryId,
  initialDate,
  initialTime,
  wallets,
  categories,
  theme,
  baseCurrency,
  onClose,
  onSave,
  onManageCategories,
  onAddSubcategory,
}) => {
  const [currentType, setCurrentType] = useState<TransactionType>(defaultTxType);
  const [amountStr, setAmountStr] = useState<string>('');
  const [selectedWalletId, setSelectedWalletId] = useState<string>(initialWalletId);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(initialCategoryId || '');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>(initialSubcategoryId || '');
  const [quickSubModalVisible, setQuickSubModalVisible] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [note, setNote] = useState<string>('');
  const [currency, setCurrency] = useState<string>(baseCurrency);
  const [dateStr, setDateStr] = useState<string>('');
  const [timeStr, setTimeStr] = useState<string>('');
  const [isPaid, setIsPaid] = useState<boolean>(true);
  const [mediaUri, setMediaUri] = useState<string | null>(null);

  // Recurrence states
  const [repeatEnabled, setRepeatEnabled] = useState<boolean>(false);
  const [repeatFrequency, setRepeatFrequency] = useState<BillFrequency>('monthly');
  const [repeatDueDay, setRepeatDueDay] = useState<number>(() => new Date().getDate());
  const [repeatEndType, setRepeatEndType] = useState<RecurrenceEndType>('never');
  const [repeatEndOccurrences, setRepeatEndOccurrences] = useState<string>('12');
  const [repeatEndDate, setRepeatEndDate] = useState<string>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [endCalendarVisible, setEndCalendarVisible] = useState<boolean>(false);
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(true);

  // Sub-modals
  const [calendarVisible, setCalendarVisible] = useState<boolean>(false);
  const [clockVisible, setClockVisible] = useState<boolean>(false);
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      setCurrentType(defaultTxType);
      setAmountStr(initialAmount > 0 ? initialAmount.toString() : '');
      setSelectedWalletId(initialWalletId || (wallets.length > 0 ? wallets[0].id : ''));
      setSelectedCategoryId(initialCategoryId || '');
      setSelectedSubcategoryId(initialSubcategoryId || '');
      setNote('');
      setCurrency(baseCurrency);
      const initD = initialDate || new Date().toISOString().slice(0, 10);
      setDateStr(initD);
      const parsedDay = parseInt(initD.slice(8, 10), 10);
      setRepeatDueDay(!isNaN(parsedDay) ? parsedDay : new Date().getDate());
      setTimeStr(
        initialTime ||
          `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
      );
      setIsPaid(true);
      setMediaUri(null);
      setRepeatEnabled(false);
      setRepeatFrequency('monthly');
      setRepeatEndType('never');
      setRepeatEndOccurrences('12');
      const nextY = new Date();
      nextY.setFullYear(nextY.getFullYear() + 1);
      setRepeatEndDate(nextY.toISOString().slice(0, 10));
      setReminderEnabled(true);
    }
  }, [
    visible,
    defaultTxType,
    initialAmount,
    initialWalletId,
    initialCategoryId,
    initialSubcategoryId,
    initialDate,
    initialTime,
    baseCurrency,
    wallets,
  ]);

  const activeCategories = categories.filter((c) => c.type === currentType);
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  // Auto-clear category if not belonging to active type
  useEffect(() => {
    if (selectedCategoryId) {
      const match = activeCategories.find((c) => c.id === selectedCategoryId);
      if (!match) {
        setSelectedCategoryId('');
        setSelectedSubcategoryId('');
      }
    }
  }, [currentType, activeCategories, selectedCategoryId]);

  const handleSelectCategory = (cat: Category) => {
    if (selectedCategoryId === cat.id) {
      setSelectedCategoryId('');
      setSelectedSubcategoryId('');
    } else {
      setSelectedCategoryId(cat.id);
      setSelectedSubcategoryId('');
    }
  };

  const handleSaveQuickSub = async () => {
    if (!newSubName.trim() || !selectedCategoryId) return;
    if (onAddSubcategory) {
      const newId = await onAddSubcategory(selectedCategoryId, newSubName.trim());
      setSelectedSubcategoryId(newId);
    }
    setNewSubName('');
    setQuickSubModalVisible(false);
  };

  const handlePickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setMediaUri(result.assets[0].uri);
      }
    } catch (err) {
      Alert.alert('Error', 'Unable to pick image');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Camera Permission', 'Camera permission is required to capture photo receipts.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setMediaUri(result.assets[0].uri);
      }
    } catch (err) {
      Alert.alert('Error', 'Unable to capture photo');
    }
  };

  const handleSave = async () => {
    const parsed = parseFloat(amountStr);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0');
      return;
    }
    if (!selectedWalletId && wallets.length === 0) {
      Alert.alert('No Wallet', 'Please create a wallet first');
      return;
    }

    await onSave({
      amount: parsed,
      wallet_id: selectedWalletId || wallets[0].id,
      category_id: selectedCategoryId || undefined,
      subcategory_id: selectedSubcategoryId || undefined,
      type: currentType,
      currency,
      date: dateStr,
      time: timeStr,
      is_paid: isPaid,
      note: note.trim() || undefined,
      media_uri: mediaUri || undefined,
      repeat_frequency: repeatEnabled ? repeatFrequency : undefined,
      repeat_due_day: repeatEnabled ? repeatDueDay : undefined,
      repeat_end_type: repeatEnabled ? repeatEndType : undefined,
      repeat_end_occurrences:
        repeatEnabled && repeatEndType === 'after_occurrences'
          ? parseInt(repeatEndOccurrences, 10) || 12
          : undefined,
      repeat_end_date: repeatEnabled && repeatEndType === 'on_date' ? repeatEndDate : undefined,
      reminder_enabled: repeatEnabled ? reminderEnabled : undefined,
    });
    onClose();
  };

  if (!visible) return null;

  const isExpense = currentType === 'expense';
  const accentColor = isExpense ? theme.error : theme.success;
  const accentContainer = isExpense ? theme.errorContainer : theme.successContainer;
  const onAccentContainer = isExpense ? theme.onErrorContainer : theme.onSuccessContainer;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Top App Bar */}
        <View style={[styles.topBar, { backgroundColor: theme.surface, borderBottomColor: theme.divider }]}>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.backBtn, { backgroundColor: theme.pillBg }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color={theme.onSurface} />
          </TouchableOpacity>
          <Text style={[styles.topBarTitle, { color: theme.onSurface }]}>Transaction Details</Text>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.topSaveBtn, { backgroundColor: accentColor }]}
          >
            <Text style={styles.topSaveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 1. TYPE SELECTOR & AMOUNT ROW */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
            <View style={styles.typeSwitcherRow}>
              <TouchableOpacity
                style={[
                  styles.typeTab,
                  currentType === 'income' && { backgroundColor: theme.successContainer, borderColor: theme.success },
                ]}
                onPress={() => setCurrentType('income')}
              >
                <MaterialCommunityIcons
                  name="arrow-up-circle"
                  size={16}
                  color={currentType === 'income' ? theme.success : theme.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.typeTabText,
                    { color: currentType === 'income' ? theme.onSuccessContainer : theme.onSurfaceVariant },
                  ]}
                >
                  Income
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeTab,
                  currentType === 'expense' && { backgroundColor: theme.errorContainer, borderColor: theme.error },
                ]}
                onPress={() => setCurrentType('expense')}
              >
                <MaterialCommunityIcons
                  name="arrow-down-circle"
                  size={16}
                  color={currentType === 'expense' ? theme.error : theme.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.typeTabText,
                    { color: currentType === 'expense' ? theme.onErrorContainer : theme.onSurfaceVariant },
                  ]}
                >
                  Expense
                </Text>
              </TouchableOpacity>
            </View>

            {/* Amount & Currency input row */}
            <View style={styles.amountInputRow}>
              <TouchableOpacity
                style={[styles.currencyChip, { backgroundColor: theme.pillBg, borderColor: theme.divider }]}
                onPress={() => setCurrencyPickerVisible(true)}
              >
                <Text style={[styles.currencyText, { color: theme.primary }]}>{currency}</Text>
                <MaterialCommunityIcons name="menu-down" size={16} color={theme.onSurfaceVariant} />
              </TouchableOpacity>

              <TextInput
                style={[styles.amountInput, { color: theme.onSurface }]}
                placeholder="0.00"
                placeholderTextColor={theme.onSurfaceVariant}
                keyboardType="decimal-pad"
                value={amountStr}
                onChangeText={setAmountStr}
              />
            </View>
          </View>

          {/* 2. WALLET SELECTION */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
            <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>SELECT WALLET</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScrollRow}>
              {wallets.map((w) => {
                const isSelected = w.id === selectedWalletId;
                return (
                  <TouchableOpacity
                    key={w.id}
                    style={[
                      styles.walletChip,
                      {
                        backgroundColor: isSelected ? theme.primaryContainer : theme.pillBg,
                        borderColor: isSelected ? theme.primary : 'transparent',
                      },
                    ]}
                    onPress={() => setSelectedWalletId(w.id)}
                  >
                    <MaterialCommunityIcons
                      name={(w.icon as any) || 'wallet'}
                      size={15}
                      color={isSelected ? theme.primary : theme.onSurfaceVariant}
                    />
                    <Text
                      style={[
                        styles.walletChipText,
                        {
                          color: isSelected ? theme.onPrimaryContainer : theme.onSurface,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {w.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* 3. CATEGORY & SUBCATEGORY */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>CATEGORY</Text>
              {onManageCategories && (
                <TouchableOpacity onPress={onManageCategories}>
                  <Text style={[styles.manageLink, { color: theme.primary }]}>Manage</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.categoryWrap}>
              {activeCategories.map((c) => {
                const isSelected = c.id === selectedCategoryId;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.categoryCard,
                      {
                        backgroundColor: isSelected ? theme.primaryContainer : theme.pillBg,
                        borderColor: isSelected ? theme.primary : 'transparent',
                      },
                    ]}
                    onPress={() => handleSelectCategory(c)}
                  >
                    <View style={[styles.catIconWrap, { backgroundColor: c.color || theme.primary }]}>
                      <MaterialCommunityIcons name={(c.icon as any) || 'folder'} size={16} color="#FFFFFF" />
                    </View>
                    <Text
                      style={[
                        styles.categoryName,
                        {
                          color: isSelected ? theme.onPrimaryContainer : theme.onSurface,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Subcategories grid if category selected */}
            {selectedCategory && (
              <View style={styles.subArea}>
                <Text style={[styles.fieldSubLabel, { color: theme.onSurfaceVariant }]}>
                  SUBCATEGORY (OPTIONAL)
                </Text>
                <View style={styles.categoryWrap}>
                  {(selectedCategory.subcategories || []).map((sub: Subcategory) => {
                    const isSubSelected = sub.id === selectedSubcategoryId;
                    return (
                      <TouchableOpacity
                        key={sub.id}
                        style={[
                          styles.categoryCard,
                          {
                            backgroundColor: isSubSelected ? theme.primaryContainer : theme.pillBg,
                            borderColor: isSubSelected ? theme.primary : 'transparent',
                          },
                        ]}
                        onPress={() => setSelectedSubcategoryId(isSubSelected ? '' : sub.id)}
                      >
                        <View style={[styles.catIconWrap, { backgroundColor: selectedCategory.color || theme.primary }]}>
                          <MaterialCommunityIcons name="label-outline" size={16} color="#FFFFFF" />
                        </View>
                        <Text
                          style={[
                            styles.categoryName,
                            {
                              color: isSubSelected ? theme.onPrimaryContainer : theme.onSurface,
                              fontWeight: isSubSelected ? '700' : '500',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {sub.name}
                        </Text>
                        {isSubSelected && (
                          <View style={[styles.checkBadge, { backgroundColor: theme.primary }]}>
                            <MaterialCommunityIcons name="check" size={10} color="#FFFFFF" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}

                  {/* + New Subcategory Button */}
                  <TouchableOpacity
                    style={[
                      styles.categoryCard,
                      styles.manageCatCard,
                      { backgroundColor: theme.pillBg, borderColor: theme.outlineVariant },
                    ]}
                    onPress={() => setQuickSubModalVisible(true)}
                  >
                    <MaterialCommunityIcons name="plus" size={18} color={theme.primary} />
                    <Text style={[styles.categoryName, { color: theme.primary, fontWeight: '700' }]}>
                      New
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* 4. DATE, TIME & PAID TOGGLE */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
            <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>DATE & TIME</Text>
            <View style={styles.dateTimeRow}>
              {/* Date chip */}
              <TouchableOpacity
                style={[styles.dateTimeChip, { backgroundColor: theme.pillBg, borderColor: theme.divider }]}
                onPress={() => setCalendarVisible(true)}
              >
                <MaterialCommunityIcons name="calendar-month-outline" size={16} color={theme.primary} />
                <Text style={[styles.dateTimeChipText, { color: theme.onSurface }]}>{dateStr}</Text>
                <MaterialCommunityIcons name="pencil-outline" size={13} color={theme.onSurfaceVariant} />
              </TouchableOpacity>

              {/* Time chip */}
              <TouchableOpacity
                style={[styles.dateTimeChip, { backgroundColor: theme.pillBg, borderColor: theme.divider }]}
                onPress={() => setClockVisible(true)}
              >
                <MaterialCommunityIcons name="clock-time-four-outline" size={16} color={theme.primary} />
                <Text style={[styles.dateTimeChipText, { color: theme.onSurface }]}>{timeStr}</Text>
                <MaterialCommunityIcons name="pencil-outline" size={13} color={theme.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            {/* Paid Toggle Switch */}
            <View style={[styles.paidRow, { borderTopColor: theme.divider }]}>
              <View style={styles.paidInfo}>
                <MaterialCommunityIcons
                  name={isPaid ? 'check-circle' : 'clock-alert-outline'}
                  size={20}
                  color={isPaid ? theme.success : theme.error}
                />
                <View>
                  <Text style={[styles.paidTitle, { color: theme.onSurface }]}>
                    {isPaid ? 'Paid' : 'Unpaid / Pending'}
                  </Text>
                  <Text style={[styles.paidSubtitle, { color: theme.onSurfaceVariant }]}>
                    {isPaid ? 'Balance adjusted immediately' : 'Does not affect wallet balance yet'}
                  </Text>
                </View>
              </View>
              <Switch
                value={isPaid}
                onValueChange={setIsPaid}
                trackColor={{ false: theme.outlineVariant, true: theme.successContainer }}
                thumbColor={isPaid ? theme.success : '#f4f3f4'}
              />
            </View>
          </View>

          {/* 5. NOTE INPUT */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
            <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>NOTE & TAGS</Text>
            <TextInput
              style={[styles.noteInput, { backgroundColor: theme.pillBg, color: theme.onSurface, borderColor: theme.divider }]}
              placeholder="Add optional notes, tags, or description..."
              placeholderTextColor={theme.onSurfaceVariant}
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* 6. REPEAT & REMINDERS */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextCol}>
                <View style={styles.labelWithIcon}>
                  <MaterialCommunityIcons name="repeat" size={18} color={theme.primary} />
                  <Text style={[styles.toggleTitle, { color: theme.onSurface }]}>Recurring Transaction</Text>
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
                {/* 1. Frequency Row */}
                <Text style={[styles.fieldSubLabel, { color: theme.onSurfaceVariant }]}>Frequency</Text>
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

                {/* 2. Repeat Day */}
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
                        onPress={() => setRepeatDueDay((prev) => Math.max(1, prev - 1))}
                      >
                        <MaterialCommunityIcons name="minus" size={18} color={theme.onSurface} />
                      </TouchableOpacity>
                      <View style={[styles.dayDisplayBox, { backgroundColor: theme.pillBg, borderColor: theme.divider }]}>
                        <Text style={[styles.dayDisplayText, { color: theme.primary }]}>
                          Day {repeatDueDay}
                        </Text>
                        <Text style={[styles.dayDisplaySub, { color: theme.onSurfaceVariant }]}>of month</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.stepperBtn, { backgroundColor: theme.pillBg }]}
                        onPress={() => setRepeatDueDay((prev) => Math.min(31, prev + 1))}
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
                                  color: repeatDueDay === d ? theme.onPrimaryContainer : theme.onSurface,
                                  fontWeight: repeatDueDay === d ? '700' : '500',
                                },
                              ]}
                            >
                              {d === 1 ? '1st' : d === 15 ? '15th' : 'End'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>

                {/* 3. Ends On */}
                <View style={[styles.optionSection, { borderTopColor: theme.divider }]}>
                  <Text style={[styles.fieldSubLabel, { color: theme.onSurfaceVariant }]}>Ends On</Text>
                  <View style={styles.endsOnTabsRow}>
                    <TouchableOpacity
                      style={[
                        styles.endsOnTab,
                        {
                          backgroundColor: repeatEndType === 'never' ? theme.primary : theme.pillBg,
                          borderColor: repeatEndType === 'never' ? theme.primary : theme.divider,
                        },
                      ]}
                      onPress={() => setRepeatEndType('never')}
                    >
                      <Text
                        style={[
                          styles.endsOnTabText,
                          {
                            color: repeatEndType === 'never' ? theme.onPrimary : theme.onSurface,
                            fontWeight: repeatEndType === 'never' ? '700' : '500',
                          },
                        ]}
                      >
                        Never
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.endsOnTab,
                        {
                          backgroundColor: repeatEndType === 'after_occurrences' ? theme.primary : theme.pillBg,
                          borderColor: repeatEndType === 'after_occurrences' ? theme.primary : theme.divider,
                        },
                      ]}
                      onPress={() => setRepeatEndType('after_occurrences')}
                    >
                      <Text
                        style={[
                          styles.endsOnTabText,
                          {
                            color: repeatEndType === 'after_occurrences' ? theme.onPrimary : theme.onSurface,
                            fontWeight: repeatEndType === 'after_occurrences' ? '700' : '500',
                          },
                        ]}
                      >
                        After Occurrences
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.endsOnTab,
                        {
                          backgroundColor: repeatEndType === 'on_date' ? theme.primary : theme.pillBg,
                          borderColor: repeatEndType === 'on_date' ? theme.primary : theme.divider,
                        },
                      ]}
                      onPress={() => setRepeatEndType('on_date')}
                    >
                      <Text
                        style={[
                          styles.endsOnTabText,
                          {
                            color: repeatEndType === 'on_date' ? theme.onPrimary : theme.onSurface,
                            fontWeight: repeatEndType === 'on_date' ? '700' : '500',
                          },
                        ]}
                      >
                        On Date
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* After occurrences sub-row */}
                  {repeatEndType === 'after_occurrences' && (
                    <View style={styles.endConfigRow}>
                      <Text style={[styles.endConfigLabel, { color: theme.onSurface }]}>Stop after</Text>
                      <TextInput
                        style={[
                          styles.occurrencesInput,
                          { backgroundColor: theme.pillBg, color: theme.onSurface, borderColor: theme.divider },
                        ]}
                        keyboardType="number-pad"
                        value={repeatEndOccurrences}
                        onChangeText={setRepeatEndOccurrences}
                        maxLength={4}
                      />
                      <Text style={[styles.endConfigLabel, { color: theme.onSurface }]}>occurrences</Text>
                    </View>
                  )}

                  {/* On date sub-row */}
                  {repeatEndType === 'on_date' && (
                    <View style={styles.endConfigRow}>
                      <Text style={[styles.endConfigLabel, { color: theme.onSurface }]}>Stop on</Text>
                      <TouchableOpacity
                        style={[styles.endDateChip, { backgroundColor: theme.pillBg, borderColor: theme.divider }]}
                        onPress={() => setEndCalendarVisible(true)}
                      >
                        <MaterialCommunityIcons name="calendar-month-outline" size={16} color={theme.primary} />
                        <Text style={[styles.endDateChipText, { color: theme.onSurface }]}>{repeatEndDate}</Text>
                        <MaterialCommunityIcons name="pencil-outline" size={13} color={theme.onSurfaceVariant} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* 4. Reminder Row */}
                <View style={[styles.reminderRow, { borderTopColor: theme.divider }]}>
                  <View style={styles.labelWithIcon}>
                    <MaterialCommunityIcons name="bell-outline" size={18} color={theme.primary} />
                    <Text style={[styles.reminderTitle, { color: theme.onSurface }]}>Enable Due Reminder</Text>
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

          {/* 7. MEDIA ATTACHMENTS (RECEIPT / PHOTO) */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
            <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>MEDIA & RECEIPT</Text>

            {mediaUri ? (
              <View style={styles.mediaPreviewContainer}>
                <Image source={{ uri: mediaUri }} style={styles.mediaImage} />
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

          {/* BOTTOM SAVE BUTTON */}
          <TouchableOpacity
            style={[styles.mainSaveBtn, { backgroundColor: accentColor }, M3Elevation.level2]}
            onPress={handleSave}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="check" size={20} color="#FFFFFF" />
            <Text style={styles.mainSaveBtnText}>
              Save {isExpense ? 'Expense' : 'Income'}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* TIME PICKER MODAL */}
        <AnalogClockModal
          visible={clockVisible}
          initialTime={timeStr}
          theme={theme}
          onClose={() => setClockVisible(false)}
          onSave={(t) => setTimeStr(t)}
        />

        {/* CALENDAR PICKER MODAL (DATE) */}
        <CalendarPickerModal
          visible={calendarVisible}
          selectedDate={dateStr}
          theme={theme}
          onClose={() => setCalendarVisible(false)}
          onSelectDate={(d) => setDateStr(d)}
        />

        {/* CALENDAR PICKER MODAL (RECURRING END DATE) */}
        <CalendarPickerModal
          visible={endCalendarVisible}
          selectedDate={repeatEndDate}
          theme={theme}
          onClose={() => setEndCalendarVisible(false)}
          onSelectDate={(d) => setRepeatEndDate(d)}
        />

        {/* CURRENCY SELECTOR MODAL */}
        {currencyPickerVisible && (
          <Modal
            visible={currencyPickerVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setCurrencyPickerVisible(false)}
          >
            <View style={styles.currencyModalBackdrop}>
              <View style={[styles.currencyModalBox, { backgroundColor: theme.surface }]}>
                <Text style={[styles.currencyModalTitle, { color: theme.onSurface }]}>Select Currency</Text>
                <ScrollView style={{ maxHeight: 280 }}>
                  {COMMON_CURRENCIES.map((currCode) => {
                    const isCurrSelected = currCode === currency;
                    return (
                      <TouchableOpacity
                        key={currCode}
                        style={[
                          styles.currencyItem,
                          {
                            backgroundColor: isCurrSelected ? theme.primaryContainer : 'transparent',
                          },
                        ]}
                        onPress={() => {
                          setCurrency(currCode);
                          setCurrencyPickerVisible(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.currencyItemText,
                            {
                              color: isCurrSelected ? theme.onPrimaryContainer : theme.onSurface,
                              fontWeight: isCurrSelected ? '700' : '400',
                            },
                          ]}
                        >
                          {currCode}
                        </Text>
                        {isCurrSelected && (
                          <MaterialCommunityIcons name="check" size={16} color={theme.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <TouchableOpacity
                  style={[styles.currencyCloseBtn, { backgroundColor: theme.pillBg }]}
                  onPress={() => setCurrencyPickerVisible(false)}
                >
                  <Text style={{ color: theme.onSurface, fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}
        {/* QUICK NEW SUBCATEGORY MODAL */}
        {quickSubModalVisible && (
          <View style={styles.quickModalBackdrop}>
            <View style={[styles.quickModalBox, { backgroundColor: theme.surface }]}>
              <Text style={[styles.quickModalTitle, { color: theme.onSurface }]}>New Subcategory</Text>
              <Text style={[styles.quickModalSubtitle, { color: theme.onSurfaceVariant }]}>
                For {selectedCategory?.name}
              </Text>
              <TextInput
                style={[
                  styles.quickModalInput,
                  { backgroundColor: theme.pillBg, color: theme.onSurface },
                ]}
                placeholder="Subcategory Name (e.g. Dining Out)"
                placeholderTextColor={theme.onSurfaceVariant}
                value={newSubName}
                onChangeText={setNewSubName}
                autoFocus={true}
              />
              <View style={styles.quickModalBtnRow}>
                <TouchableOpacity
                  style={[styles.quickModalBtn, { backgroundColor: theme.pillBg }]}
                  onPress={() => {
                    setNewSubName('');
                    setQuickSubModalVisible(false);
                  }}
                >
                  <Text style={{ color: theme.onSurface }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickModalBtn, { backgroundColor: theme.primary }]}
                  onPress={handleSaveQuickSub}
                >
                  <Text style={{ color: theme.onPrimary, fontWeight: '700' }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 48 : 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  topSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: M3Shape.full,
  },
  topSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  card: {
    borderRadius: M3Shape.large,
    padding: 14,
    borderWidth: 1,
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  fieldSubLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 4,
  },
  manageLink: {
    fontSize: 12,
    fontWeight: '700',
  },
  typeSwitcherRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: M3Shape.medium,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  typeTabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  currencyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: M3Shape.medium,
    borderWidth: 1,
    gap: 2,
  },
  currencyText: {
    fontSize: 14,
    fontWeight: '800',
  },
  amountInput: {
    flex: 1,
    fontSize: 26,
    fontWeight: '800',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  chipsScrollRow: {
    gap: 8,
    paddingVertical: 2,
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: M3Shape.medium,
    borderWidth: 1.5,
    gap: 6,
  },
  walletChipText: {
    fontSize: 12.5,
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryCard: {
    width: '31%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: M3Shape.medium,
    borderWidth: 1.5,
    gap: 6,
    position: 'relative',
  },
  manageCatCard: {
    borderStyle: 'dashed',
    justifyContent: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontSize: 11.5,
    flex: 1,
  },
  subArea: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  subChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: M3Shape.full,
    borderWidth: 1,
  },
  subChipText: {
    fontSize: 11.5,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateTimeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: M3Shape.medium,
    borderWidth: 1,
  },
  dateTimeChipText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  paidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  paidInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  paidTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  paidSubtitle: {
    fontSize: 11,
  },
  noteInput: {
    borderRadius: M3Shape.medium,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    fontSize: 13,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleTextCol: {
    flex: 1,
    gap: 2,
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  toggleSubtitle: {
    fontSize: 11,
  },
  recurringOptions: {
    gap: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  freqRow: {
    flexDirection: 'row',
    gap: 8,
  },
  freqBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: M3Shape.medium,
    alignItems: 'center',
    borderWidth: 1,
  },
  freqBtnText: {
    fontSize: 12,
  },
  optionSection: {
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  weekdayBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: M3Shape.medium,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  weekdayBtnText: {
    fontSize: 11,
  },
  dayMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDisplayBox: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: M3Shape.medium,
    borderWidth: 1,
    alignItems: 'center',
  },
  dayDisplayText: {
    fontSize: 13,
    fontWeight: '800',
  },
  dayDisplaySub: {
    fontSize: 9,
  },
  quickDaysRow: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 'auto',
  },
  quickDayChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: M3Shape.full,
    borderWidth: 1,
  },
  quickDayChipText: {
    fontSize: 11,
  },
  endsOnTabsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  endsOnTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: M3Shape.medium,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  endsOnTabText: {
    fontSize: 10.5,
  },
  endConfigRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  endConfigLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  occurrencesInput: {
    width: 60,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: M3Shape.medium,
    borderWidth: 1,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  endDateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: M3Shape.medium,
    borderWidth: 1,
  },
  endDateChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  reminderTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  mediaPreviewContainer: {
    alignItems: 'center',
    gap: 8,
  },
  mediaImage: {
    width: '100%',
    height: 180,
    borderRadius: M3Shape.medium,
  },
  removeMediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: M3Shape.full,
  },
  removeMediaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  mediaActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  mediaActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: M3Shape.medium,
    borderWidth: 1,
  },
  mediaActionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  mainSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: M3Shape.large,
    marginTop: 8,
  },
  mainSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  currencyModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  currencyModalBox: {
    width: '100%',
    maxWidth: 320,
    borderRadius: M3Shape.extraLarge,
    padding: 20,
    gap: 12,
  },
  currencyModalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: M3Shape.medium,
  },
  currencyItemText: {
    fontSize: 14,
  },
  currencyCloseBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: M3Shape.full,
    marginTop: 4,
  },
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
  quickModalSubtitle: {
    fontSize: 12,
    marginTop: -8,
  },
  quickModalInput: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: M3Shape.medium,
    fontSize: 14,
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
});
