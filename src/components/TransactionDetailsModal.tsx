import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  StatusBar,
  useWindowDimensions,
  Dimensions,
  Keyboard,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Category, Subcategory, Wallet, TransactionType, BillFrequency, RecurrenceEndType } from '../types';
import { formatCurrency, formatTypingNumber, parseCleanNumber } from '../utils/format';
import { M3Elevation, M3Shape } from '../theme';
import { AnalogClockModal } from './AnalogClockModal';
import { CalendarPickerModal } from './CalendarPickerModal';
import { CategoryPickerSheet } from './CategoryPickerSheet';
import { useBudget } from '../context/BudgetContext';

interface TransactionDetailsModalProps {
  visible: boolean;
  txType: TransactionType;
  initialAmount: number;
  initialWalletId: string;
  initialToWalletId?: string;
  initialCategoryId?: string;
  initialSubcategoryId?: string;
  initialDate?: string;
  initialTime?: string;
  initialNote?: string;
  initialMediaUri?: string | null;
  initialIsPaid?: boolean;
  initialTaxAmount?: number;
  initialCurrency?: string;
  isEditing?: boolean;
  initialRepeatEnabled?: boolean;
  initialRepeatFrequency?: BillFrequency;
  initialRepeatDueDay?: number;
  initialRepeatEndType?: RecurrenceEndType;
  initialRepeatEndOccurrences?: number;
  initialRepeatEndDate?: string;
  initialReminderEnabled?: boolean;
  wallets: Wallet[];
  categories: Category[];
  theme: any;
  baseCurrency: string;
  onClose: () => void;
  onSave: (tx: {
    amount: number;
    wallet_id: string;
    to_wallet_id?: string;
    category_id?: string;
    subcategory_id?: string;
    type: TransactionType;
    currency: string;
    date: string;
    time?: string;
    is_paid: boolean;
    tax_amount?: number;
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

const COMMON_CURRENCIES = ['TZS', 'USD', 'EUR', 'GBP', 'KES', 'INR', 'JPY', 'CAD', 'AUD', 'UGX', 'ZAR'];

export const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({
  visible,
  txType: defaultTxType,
  initialAmount,
  initialWalletId,
  initialToWalletId,
  initialCategoryId,
  initialSubcategoryId,
  initialDate,
  initialTime,
  initialNote,
  initialMediaUri,
  initialIsPaid,
  initialTaxAmount,
  initialCurrency,
  isEditing,
  initialRepeatEnabled,
  initialRepeatFrequency,
  initialRepeatDueDay,
  initialRepeatEndType,
  initialRepeatEndOccurrences,
  initialRepeatEndDate,
  initialReminderEnabled,
  wallets,
  categories,
  theme,
  baseCurrency,
  onClose,
  onSave,
  onManageCategories,
  onAddSubcategory,
}) => {
  const { debts, addDebt } = useBudget();
  const insets = useSafeAreaInsets();
  const insetsRef = useRef(insets);
  insetsRef.current = insets;
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? Math.max(StatusBar.currentHeight || 0, 28) : 0);
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 48 : 20);
  const { height: windowHeight } = useWindowDimensions();
  const bottomScrollPadding = Math.max(360, Math.round(windowHeight * 0.52)) + bottomInset;
  const [currentType, setCurrentType] = useState<TransactionType>(defaultTxType);
  const [amountStr, setAmountStr] = useState<string>('');
  const [taxAmountStr, setTaxAmountStr] = useState<string>('');
  const amountInputRef = useRef<any>(null);
  const [categorySheetVisible, setCategorySheetVisible] = useState<boolean>(false);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    const handleKeyboardShow = (e: any) => {
      const coordHeight = e?.endCoordinates?.height || 0;
      const screenY = e?.endCoordinates?.screenY;
      const screenHeight = Dimensions.get('screen').height;
      const heightFromScreenBottom =
        screenY != null && screenHeight > screenY ? screenHeight - screenY : 0;

      // When screen coordinates are available, heightFromScreenBottom measures the exact distance
      // from the bottom of the screen to the top edge of the keyboard.
      // If screenY is not present, fallback to coordHeight + insets.bottom.
      const effectiveHeight =
        heightFromScreenBottom > 0
          ? heightFromScreenBottom
          : coordHeight > 0
          ? coordHeight + (Platform.OS === 'android' ? (insetsRef.current.bottom || 0) : 0)
          : 0;

      try {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      } catch (err) {
        // ignore
      }
      setKeyboardHeight(effectiveHeight);
    };

    const handleKeyboardHide = () => {
      try {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      } catch (err) {
        // ignore
      }
      setKeyboardHeight(0);
    };

    const subs = [
      Keyboard.addListener('keyboardDidShow', handleKeyboardShow),
      Keyboard.addListener('keyboardDidHide', handleKeyboardHide),
    ];
    if (Platform.OS === 'ios') {
      subs.push(
        Keyboard.addListener('keyboardWillShow', handleKeyboardShow),
        Keyboard.addListener('keyboardWillHide', handleKeyboardHide)
      );
    } else {
      try {
        subs.push(Keyboard.addListener('keyboardWillShow', handleKeyboardShow));
        subs.push(Keyboard.addListener('keyboardWillHide', handleKeyboardHide));
      } catch (err) {
        // ignore
      }
    }

    return () => {
      subs.forEach((s) => s.remove());
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
    }
  }, [visible]);

  // Focus helper: focuses the amount input cleanly if not already focused
  const focusAmountInput = () => {
    if (amountInputRef.current && !amountInputRef.current.isFocused()) {
      amountInputRef.current.focus();
    }
  };

  // Automatically focus amount input once modal is visible
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(focusAmountInput, 150);
      return () => clearTimeout(timer);
    }
  }, [visible]);
  const [selectedWalletId, setSelectedWalletId] = useState<string>(initialWalletId);
  const [selectedToWalletId, setSelectedToWalletId] = useState<string>(initialToWalletId || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(initialCategoryId || '');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>(initialSubcategoryId || '');
  const [lastExpenseCatId, setLastExpenseCatId] = useState<string>(
    defaultTxType === 'expense' ? (initialCategoryId || '') : ''
  );
  const [lastExpenseSubId, setLastExpenseSubId] = useState<string>(
    defaultTxType === 'expense' ? (initialSubcategoryId || '') : ''
  );
  const [lastIncomeCatId, setLastIncomeCatId] = useState<string>(
    defaultTxType === 'income' ? (initialCategoryId || '') : ''
  );
  const [lastIncomeSubId, setLastIncomeSubId] = useState<string>(
    defaultTxType === 'income' ? (initialSubcategoryId || '') : ''
  );
  const [quickSubModalVisible, setQuickSubModalVisible] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [note, setNote] = useState<string>('');
  const [currency, setCurrency] = useState<string>(baseCurrency);
  const [dateStr, setDateStr] = useState<string>('');
  const [timeStr, setTimeStr] = useState<string>('');
  const [isPaid, setIsPaid] = useState<boolean>(true);
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [cameraVisible, setCameraVisible] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitIncludeMe, setSplitIncludeMe] = useState(true);
  const [splitPeople, setSplitPeople] = useState<{ name: string; customAmount?: string }[]>([]);
  const [splitPersonInput, setSplitPersonInput] = useState('');

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const displayDate = useMemo(() => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const currentYear = new Date().getFullYear().toString();
      if (parts[0] !== currentYear) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return `${parts[2]}-${parts[1]}`;
    }
    return dateStr;
  }, [dateStr]);

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
      setAmountStr(initialAmount > 0 ? formatTypingNumber(initialAmount.toString()) : '');
      setTaxAmountStr(
        initialTaxAmount && initialTaxAmount > 0
          ? formatTypingNumber(initialTaxAmount.toString())
          : ''
      );
      const initFrom = initialWalletId || (wallets.length > 0 ? wallets[0].id : '');
      setSelectedWalletId(initFrom);
      const initTo =
        initialToWalletId ||
        (wallets.length > 1 ? (wallets.find((w) => w.id !== initFrom)?.id || '') : '');
      setSelectedToWalletId(initTo);
      setSelectedCategoryId(initialCategoryId || '');
      setSelectedSubcategoryId(initialSubcategoryId || '');
      const initCat = categories.find((c) => c.id === initialCategoryId);
      if (initCat?.type === 'income' || defaultTxType === 'income') {
        setLastIncomeCatId(initialCategoryId || '');
        setLastIncomeSubId(initialSubcategoryId || '');
        setLastExpenseCatId('');
        setLastExpenseSubId('');
      } else {
        setLastExpenseCatId(initialCategoryId || '');
        setLastExpenseSubId(initialSubcategoryId || '');
        setLastIncomeCatId('');
        setLastIncomeSubId('');
      }
      setNote(initialNote || '');
      setCurrency(initialCurrency || baseCurrency);
      const initD = initialDate || new Date().toISOString().slice(0, 10);
      setDateStr(initD);
      const parsedDay = parseInt(initD.slice(8, 10), 10);
      setRepeatDueDay(!isNaN(parsedDay) ? parsedDay : new Date().getDate());
      setTimeStr(
        initialTime ||
          `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
      );
      setIsPaid(initialIsPaid !== undefined ? initialIsPaid : true);
      setMediaUri(initialMediaUri || null);
      setRepeatEnabled(initialRepeatEnabled !== undefined ? initialRepeatEnabled : false);
      setRepeatFrequency(initialRepeatFrequency || 'monthly');
      if (initialRepeatDueDay !== undefined) {
        setRepeatDueDay(initialRepeatDueDay);
      }
      setRepeatEndType(initialRepeatEndType || 'never');
      setRepeatEndOccurrences(
        initialRepeatEndOccurrences !== undefined ? String(initialRepeatEndOccurrences) : '12'
      );
      if (initialRepeatEndDate) {
        setRepeatEndDate(initialRepeatEndDate);
      } else {
        const nextY = new Date();
        nextY.setFullYear(nextY.getFullYear() + 1);
        setRepeatEndDate(nextY.toISOString().slice(0, 10));
      }
      setReminderEnabled(initialReminderEnabled !== undefined ? initialReminderEnabled : true);
      setSplitEnabled(false);
      setSplitIncludeMe(true);
      setSplitPeople([]);
      setSplitPersonInput('');
    }
  }, [
    visible,
    defaultTxType,
    initialAmount,
    initialWalletId,
    initialToWalletId,
    initialCategoryId,
    initialSubcategoryId,
    initialDate,
    initialTime,
    initialNote,
    initialMediaUri,
    initialIsPaid,
    initialTaxAmount,
    initialCurrency,
    initialRepeatEnabled,
    initialRepeatFrequency,
    initialRepeatDueDay,
    initialRepeatEndType,
    initialRepeatEndOccurrences,
    initialRepeatEndDate,
    initialReminderEnabled,
    baseCurrency,
    wallets,
  ]);

  const activeCategories = categories.filter((c) => c.type === currentType);
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const selectedSubcategory = selectedCategory?.subcategories?.find(
    (s: Subcategory) => s.id === selectedSubcategoryId
  );
  const selectedWallet = wallets.find((w) => w.id === selectedWalletId);
  const selectedToWallet = wallets.find((w) => w.id === selectedToWalletId);

  const handleSelectCategory = (cat: Category) => {
    if (selectedCategoryId === cat.id) {
      setSelectedCategoryId('');
      setSelectedSubcategoryId('');
      if (currentType === 'expense') {
        setLastExpenseCatId('');
        setLastExpenseSubId('');
      } else if (currentType === 'income') {
        setLastIncomeCatId('');
        setLastIncomeSubId('');
      }
    } else {
      setSelectedCategoryId(cat.id);
      setSelectedSubcategoryId('');
      if (currentType === 'expense') {
        setLastExpenseCatId(cat.id);
        setLastExpenseSubId('');
      } else if (currentType === 'income') {
        setLastIncomeCatId(cat.id);
        setLastIncomeSubId('');
      }
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
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Denied', 'Gallery permission is required to select receipt photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setMediaUri(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Error', `Unable to pick image: ${err?.message || 'Unknown error'}`);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const current = await ImagePicker.getCameraPermissionsAsync();
      let granted = current.granted;
      if (!granted) {
        const req = await ImagePicker.requestCameraPermissionsAsync();
        granted = req.granted;
      }
      if (!granted) {
        Alert.alert(
          'Camera Permission',
          'Camera permission is required to capture photo receipts. Please enable camera permission in device settings.',
          [{ text: 'OK' }]
        );
        return;
      }
      setCameraVisible(true);
    } catch (err: any) {
      console.warn('Camera capture error:', err);
      Alert.alert(
        'Camera Unavailable',
        'Unable to open the camera on this device. Would you like to choose a receipt photo from your gallery instead?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Gallery', onPress: () => handlePickFromGallery() },
        ]
      );
    }
  };

  const handleCapturePhoto = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        setMediaUri(photo.uri);
        setCameraVisible(false);
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err?.message || 'Unable to take the photo. Please try again.');
    }
  };

  const knownDebtPeople = useMemo(() => {
    const map = new Map<string, string>();
    debts.forEach((d) => {
      const clean = d.person_name.trim();
      if (clean) {
        const key = clean.toLowerCase();
        if (!map.has(key)) map.set(key, clean);
      }
    });
    const addedKeys = new Set(splitPeople.map((p) => p.name.trim().toLowerCase()));
    return Array.from(map.values()).filter((n) => !addedKeys.has(n.toLowerCase()));
  }, [debts, splitPeople]);

  const splitSummary = useMemo(() => {
    const total = parseCleanNumber(amountStr) || 0;
    const count = splitPeople.length;
    const divisor = splitIncludeMe ? count + 1 : Math.max(1, count);
    const equalShare = count > 0 && divisor > 0 ? Math.round((total / divisor) * 100) / 100 : 0;
    const resolved = splitPeople.map((p) => {
      const custom = p.customAmount?.trim() ? parseCleanNumber(p.customAmount) : NaN;
      const share = !isNaN(custom) && custom >= 0 ? custom : equalShare;
      return { name: p.name.trim(), share };
    });
    const totalOwedByOthers = resolved.reduce((s, r) => s + r.share, 0);
    const yourShare = Math.max(0, Math.round((total - totalOwedByOthers) * 100) / 100);
    return { total, equalShare, resolved, totalOwedByOthers, yourShare };
  }, [amountStr, splitPeople, splitIncludeMe]);

  const handleAddSplitPerson = (rawName?: string) => {
    const clean = (rawName ?? splitPersonInput).trim();
    if (!clean) return;
    if (splitPeople.some((p) => p.name.toLowerCase() === clean.toLowerCase())) {
      if (!rawName) setSplitPersonInput('');
      return;
    }
    setSplitPeople((prev) => [...prev, { name: clean }]);
    if (!rawName) setSplitPersonInput('');
  };

  const handleSave = async () => {
    const parsed = parseCleanNumber(amountStr);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0');
      return;
    }
    const parsedTax = taxAmountStr.trim() ? parseCleanNumber(taxAmountStr) : 0;
    if (isNaN(parsedTax) || parsedTax < 0) {
      Alert.alert('Invalid Tax / Fee', 'Please enter a valid tax or fee amount (0 or greater).');
      return;
    }
    if (parsedTax > parsed) {
      Alert.alert(
        'Tax / Fee Exceeds Total',
        'The included tax or fee cannot be greater than the total transaction amount.'
      );
      return;
    }
    if (!selectedWalletId && wallets.length === 0) {
      Alert.alert('No Wallet', 'Please create a wallet first');
      return;
    }
    if (currentType === 'transfer') {
      if (wallets.length < 2) {
        Alert.alert('Transfer Requires 2 Wallets', 'Please create at least two wallets to record a transfer.');
        return;
      }
      if (!selectedToWalletId || selectedToWalletId === selectedWalletId) {
        Alert.alert('Invalid Destination', 'Source and destination wallets must be different.');
        return;
      }
    }

    if (currentType === 'expense' && !isEditing && splitEnabled) {
      if (splitPeople.length === 0) {
        Alert.alert('Add Participants', 'Add at least one person to split this expense with, or turn off Split Expense.');
        return;
      }
      if (splitSummary.totalOwedByOthers > parsed + 0.01) {
        Alert.alert('Split Exceeds Total', 'The sum of split shares cannot exceed the total expense amount.');
        return;
      }
    }

    await onSave({
      amount: parsed,
      wallet_id: selectedWalletId || wallets[0].id,
      to_wallet_id: currentType === 'transfer' ? selectedToWalletId : undefined,
      category_id: currentType === 'transfer' ? undefined : (selectedCategoryId || undefined),
      subcategory_id: currentType === 'transfer' ? undefined : (selectedSubcategoryId || undefined),
      type: currentType,
      currency,
      date: dateStr,
      time: timeStr,
      is_paid: isPaid,
      tax_amount: parsedTax > 0 ? parsedTax : 0,
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

    if (currentType === 'expense' && !isEditing && splitEnabled && splitSummary.resolved.length > 0) {
      const splitNote = note.trim() ? `${note.trim()} (Split)` : 'Split expense';
      for (const participant of splitSummary.resolved) {
        if (participant.share > 0) {
          await addDebt({
            type: 'lent',
            person_name: participant.name,
            amount: participant.share,
            currency,
            date: dateStr,
            wallet_id: selectedWalletId || wallets[0]?.id,
            note: splitNote,
          });
        }
      }
    }
    onClose();
  };

  if (!visible) return null;

  const isExpense = currentType === 'expense';
  const isTransfer = currentType === 'transfer';
  const accentColor = isTransfer ? theme.primary : isExpense ? theme.error : theme.success;
  const accentContainer = isTransfer ? theme.primaryContainer : isExpense ? theme.errorContainer : theme.successContainer;
  const onAccentContainer = isTransfer ? theme.onPrimaryContainer : isExpense ? theme.onErrorContainer : theme.onSuccessContainer;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      statusBarTranslucent={true}
      onShow={() => {
        setTimeout(focusAmountInput, 100);
      }}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
            paddingBottom: keyboardHeight,
          },
        ]}
      >
        {/* Top App Bar */}
        <View
          style={[
            styles.topBar,
            {
              backgroundColor: theme.surface,
              borderBottomColor: theme.divider,
              paddingTop: topInset + 8,
            },
          ]}
        >
          <TouchableOpacity
            onPress={onClose}
            style={[styles.backBtn, { backgroundColor: theme.pillBg }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color={theme.onSurface} />
          </TouchableOpacity>
          <Text style={[styles.topBarTitle, { color: theme.onSurface }]}>
            {isEditing ? 'Edit Transaction' : isTransfer ? 'New Transfer' : 'Transaction Details'}
          </Text>
          <View style={styles.topBarPlaceholder} />
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomScrollPadding }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 1. CATEGORY / DESTINATION WALLET & TYPE SWITCHER */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
            <View style={styles.typeSwitcherRow}>
              <TouchableOpacity
                style={[
                  styles.typeTab,
                  currentType === 'income' && { backgroundColor: theme.successContainer, borderColor: theme.success },
                ]}
                onPress={() => {
                  setCurrentType('income');
                  setSelectedCategoryId(lastIncomeCatId);
                  setSelectedSubcategoryId(lastIncomeSubId);
                }}
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
                onPress={() => {
                  setCurrentType('expense');
                  setSelectedCategoryId(lastExpenseCatId);
                  setSelectedSubcategoryId(lastExpenseSubId);
                }}
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

              <TouchableOpacity
                style={[
                  styles.typeTab,
                  currentType === 'transfer' && { backgroundColor: theme.primaryContainer, borderColor: theme.primary },
                ]}
                onPress={() => {
                  setCurrentType('transfer');
                  if (!selectedToWalletId || selectedToWalletId === selectedWalletId) {
                    const other = wallets.find((w) => w.id !== selectedWalletId);
                    if (other) {
                      setSelectedToWalletId(other.id);
                    }
                  }
                }}
              >
                <MaterialCommunityIcons
                  name="swap-horizontal-bold"
                  size={16}
                  color={currentType === 'transfer' ? theme.primary : theme.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.typeTabText,
                    { color: currentType === 'transfer' ? theme.onPrimaryContainer : theme.onSurfaceVariant },
                  ]}
                >
                  Transfer
                </Text>
              </TouchableOpacity>
            </View>

            {isTransfer ? (
              <View style={{ gap: 6, marginTop: 4 }}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>
                    DESTINATION WALLET (TRANSFER TO)
                  </Text>
                  {selectedToWallet && (
                    <Text style={[styles.fieldHeaderBalance, { color: theme.primary }]}>
                      Bal: {formatCurrency(selectedToWallet.current_balance, selectedToWallet.currency || baseCurrency)}
                    </Text>
                  )}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScrollRow}>
                  {wallets
                    .filter((w) => w.id !== selectedWalletId)
                    .map((w) => {
                      const isSelected = w.id === selectedToWalletId;
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
                          onPress={() => setSelectedToWalletId(w.id)}
                        >
                          <MaterialCommunityIcons
                            name={(w.icon as any) || 'bank-transfer-in'}
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
                            <Text
                              style={[
                                styles.walletChipBalText,
                                { color: isSelected ? theme.primary : theme.onSurfaceVariant },
                              ]}
                            >
                              {' '}({formatCurrency(w.current_balance, w.currency || baseCurrency)})
                            </Text>
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                </ScrollView>
              </View>
            ) : (
              <>
                <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant, marginTop: 4 }]}>CATEGORY</Text>

                {/* Breadcrumb Category Selector: clicking it opens CategoryPickerSheet */}
                <TouchableOpacity
                  style={[
                    styles.categorySelectorRow,
                    {
                      backgroundColor: theme.pillBg,
                      borderColor: selectedCategory ? (selectedCategory.color || theme.primary) : theme.divider,
                    },
                  ]}
                  onPress={() => setCategorySheetVisible(true)}
                  activeOpacity={0.7}
                  accessibilityLabel="Select category"
                >
                  <View style={styles.categorySelectorLeft}>
                    <View
                      style={[
                        styles.catIconWrap,
                        {
                          backgroundColor: selectedCategory
                            ? (selectedCategory.color || theme.primary)
                            : theme.pillBg,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={(selectedCategory?.icon as any) || 'shape-outline'}
                        size={18}
                        color={selectedCategory ? '#FFFFFF' : theme.onSurfaceVariant}
                      />
                    </View>

                    <View style={styles.categoryBreadcrumbCol}>
                      {selectedCategory ? (
                        <Text style={[styles.categoryBreadcrumbText, { color: theme.onSurface }]} numberOfLines={1}>
                          <Text style={{ fontWeight: '700' }}>{selectedCategory.name}</Text>
                          {selectedSubcategory && (
                            <>
                              <Text style={{ color: theme.onSurfaceVariant, fontWeight: '400' }}>{' > '}</Text>
                              <Text style={{ fontWeight: '700', color: theme.primary }}>{selectedSubcategory.name}</Text>
                            </>
                          )}
                        </Text>
                      ) : (
                        <Text style={[styles.categoryPlaceholderText, { color: theme.onSurfaceVariant }]}>
                          Select Category
                        </Text>
                      )}
                    </View>
                  </View>

                  <MaterialCommunityIcons name="chevron-right" size={20} color={theme.onSurfaceVariant} />
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* 2. WALLET SELECTION */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>
                {isTransfer ? 'SOURCE WALLET (TRANSFER FROM)' : 'SELECT WALLET'}
              </Text>
              {selectedWallet && (
                <Text style={[styles.fieldHeaderBalance, { color: theme.primary }]}>
                  Bal: {formatCurrency(selectedWallet.current_balance, selectedWallet.currency || baseCurrency)}
                </Text>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScrollRow}>
              {wallets
                .filter((w) => !isTransfer || w.id !== selectedToWalletId)
                .map((w) => {
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
                      onPress={() => {
                        setSelectedWalletId(w.id);
                        if (isTransfer && w.id === selectedToWalletId) {
                          const nextTo = wallets.find((o) => o.id !== w.id);
                          if (nextTo) setSelectedToWalletId(nextTo.id);
                        }
                      }}
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
                        <Text
                          style={[
                            styles.walletChipBalText,
                            { color: isSelected ? theme.primary : theme.onSurfaceVariant },
                          ]}
                        >
                          {' '}({formatCurrency(w.current_balance, w.currency || baseCurrency)})
                        </Text>
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>

          {/* 3. AMOUNT ROW (NEXT ITEM AFTER WALLET) */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
            <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>AMOUNT</Text>
            <View style={styles.amountInputRow}>
              <TouchableOpacity
                style={[styles.currencyChip, { backgroundColor: theme.pillBg, borderColor: theme.divider }]}
                onPress={() => setCurrencyPickerVisible(true)}
              >
                <Text style={[styles.currencyText, { color: theme.primary }]}>{currency}</Text>
                <MaterialCommunityIcons name="menu-down" size={16} color={theme.onSurfaceVariant} />
              </TouchableOpacity>

              <TextInput
                ref={amountInputRef}
                style={[styles.amountInput, { color: theme.onSurface }]}
                placeholder="0.00"
                placeholderTextColor={theme.onSurfaceVariant}
                keyboardType={Platform.OS === 'android' ? 'numeric' : 'decimal-pad'}
                value={amountStr}
                onChangeText={(text) => setAmountStr(formatTypingNumber(text))}
                selectTextOnFocus={false}
              />

              <TouchableOpacity
                style={[
                  styles.paidChip,
                  {
                    backgroundColor: isPaid ? theme.successContainer : theme.pillBg,
                    borderColor: isPaid ? theme.success : theme.divider,
                  },
                ]}
                onPress={() => setIsPaid((prev) => !prev)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Status: ${isPaid ? 'Paid' : 'Unpaid'}. Tap to toggle.`}
              >
                <MaterialCommunityIcons
                  name={isPaid ? 'check-circle' : 'clock-outline'}
                  size={15}
                  color={isPaid ? theme.success : theme.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.paidChipText,
                    {
                      color: isPaid ? theme.onSuccessContainer : theme.onSurfaceVariant,
                    },
                  ]}
                >
                  {isPaid ? 'Paid' : 'Unpaid'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Optional Tax / Fee (Exclusive - added live to total amount) */}
            <View style={[styles.taxRow, { borderTopColor: theme.divider }]}>
              <MaterialCommunityIcons
                name="receipt-text-outline"
                size={16}
                color={theme.onSurfaceVariant}
              />
              <Text style={[styles.taxLabel, { color: theme.onSurfaceVariant }]}>
                Add Tax / Fee
              </Text>
              <TextInput
                style={[
                  styles.taxInput,
                  {
                    color: theme.onSurface,
                    backgroundColor: theme.pillBg,
                    borderColor: theme.divider,
                  },
                ]}
                placeholder="0"
                placeholderTextColor={theme.onSurfaceVariant}
                keyboardType={Platform.OS === 'android' ? 'numeric' : 'decimal-pad'}
                value={taxAmountStr}
                onChangeText={(text) => {
                  const formatted = formatTypingNumber(text);
                  const prevTax = taxAmountStr.trim() ? parseCleanNumber(taxAmountStr) : 0;
                  const nextTax = formatted.trim() ? parseCleanNumber(formatted) : 0;
                  const currentTotal = amountStr.trim() ? parseCleanNumber(amountStr) : 0;
                  const safePrevTax = !isNaN(prevTax) && prevTax > 0 ? prevTax : 0;
                  const safeNextTax = !isNaN(nextTax) && nextTax > 0 ? nextTax : 0;
                  const safeTotal = !isNaN(currentTotal) && currentTotal > 0 ? currentTotal : 0;
                  const baseAmount = Math.max(0, safeTotal - safePrevTax);
                  const updatedTotal = Math.round((baseAmount + safeNextTax) * 100) / 100;
                  setTaxAmountStr(formatted);
                  setAmountStr(updatedTotal > 0 ? formatTypingNumber(updatedTotal.toString()) : '');
                }}
              />
              {(() => {
                const totalVal = parseCleanNumber(amountStr);
                const taxVal = taxAmountStr.trim() ? parseCleanNumber(taxAmountStr) : 0;
                if (!isNaN(totalVal) && !isNaN(taxVal) && taxVal > 0 && totalVal >= taxVal) {
                  return (
                    <View style={[styles.taxNetBadge, { backgroundColor: theme.primaryContainer }]}>
                      <Text style={[styles.taxNetText, { color: theme.onPrimaryContainer }]}>
                        Base {(totalVal - taxVal).toLocaleString()}
                      </Text>
                    </View>
                  );
                }
                return null;
              })()}
            </View>
          </View>

          {/* 4. DATE & TIME */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
            <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>DATE & TIME</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateTimeChipsContainer}
            >
              {/* 1. Today chip */}
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

              {/* 2. Yesterday chip */}
              <TouchableOpacity
                style={[
                  styles.dateTimeQuickChip,
                  {
                    backgroundColor: dateStr === yesterdayStr ? theme.primaryContainer : theme.pillBg,
                    borderColor: dateStr === yesterdayStr ? theme.primary : theme.divider,
                  },
                ]}
                onPress={() => {
                  if (dateStr === yesterdayStr) {
                    setDateStr(todayStr);
                  } else {
                    setDateStr(yesterdayStr);
                  }
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

              {/* 3. Calendar chip (icon pill between Yesterday and Time) */}
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
                      {
                        color: theme.onPrimaryContainer,
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {displayDate}
                  </Text>
                )}
              </TouchableOpacity>

              {/* 4. Time chip */}
              <TouchableOpacity
                style={[styles.dateTimeQuickChip, { backgroundColor: theme.pillBg, borderColor: theme.divider }]}
                onPress={() => setClockVisible(true)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="clock-time-four-outline" size={14} color={theme.primary} />
                <Text style={[styles.dateTimeQuickChipText, { color: theme.onSurface, fontWeight: '600' }]}>
                  {timeStr}
                </Text>
                <MaterialCommunityIcons name="pencil-outline" size={12} color={theme.onSurfaceVariant} />
              </TouchableOpacity>
            </ScrollView>
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

          {/* 6. MEDIA ATTACHMENTS (RECEIPT / PHOTO) */}
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

          {/* SPLIT EXPENSE (CREATE IOUs) */}
          {currentType === 'expense' && !isEditing && (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleTextCol}>
                  <View style={styles.labelWithIcon}>
                    <MaterialCommunityIcons name="account-group-outline" size={18} color={theme.primary} />
                    <Text style={[styles.toggleTitle, { color: theme.onSurface }]}>Split Expense</Text>
                  </View>
                  <Text style={[styles.toggleSubtitle, { color: theme.onSurfaceVariant }]}>
                    Automatically create IOUs for other people's shares
                  </Text>
                </View>
                <Switch
                  value={splitEnabled}
                  onValueChange={setSplitEnabled}
                  trackColor={{ false: theme.outlineVariant, true: theme.primaryContainer }}
                  thumbColor={splitEnabled ? theme.primary : '#f4f3f4'}
                />
              </View>

              {splitEnabled && (
                <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.divider }}>
                  {/* Include Me Toggle */}
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}
                    onPress={() => setSplitIncludeMe((prev) => !prev)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: theme.onSurface }}>
                      Include me in equal split
                    </Text>
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 12,
                        backgroundColor: splitIncludeMe ? theme.primaryContainer : theme.pillBg,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11.5,
                          fontWeight: '700',
                          color: splitIncludeMe ? theme.onPrimaryContainer : theme.onSurfaceVariant,
                        }}
                      >
                        {splitIncludeMe ? 'Included' : 'Paid 100% for others'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Add Person Row */}
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                    <TextInput
                      style={[
                        styles.taxInput,
                        {
                          flex: 1,
                          maxWidth: undefined,
                          textAlign: 'left',
                          paddingVertical: 8,
                          color: theme.onSurface,
                          backgroundColor: theme.pillBg,
                          borderColor: theme.divider,
                        },
                      ]}
                      placeholder="Person name (e.g. Alex)"
                      placeholderTextColor={theme.onSurfaceVariant}
                      value={splitPersonInput}
                      onChangeText={setSplitPersonInput}
                      onSubmitEditing={() => handleAddSplitPerson()}
                      returnKeyType="done"
                    />
                    <TouchableOpacity
                      style={{
                        backgroundColor: theme.primary,
                        paddingHorizontal: 14,
                        borderRadius: M3Shape.small,
                        justifyContent: 'center',
                      }}
                      onPress={() => handleAddSplitPerson()}
                    >
                      <Text style={{ color: theme.onPrimary, fontSize: 13, fontWeight: '800' }}>Add</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Quick-tap existing people */}
                  {knownDebtPeople.length > 0 && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 6, marginBottom: 10 }}
                    >
                      {knownDebtPeople.map((person) => (
                        <TouchableOpacity
                          key={person}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 14,
                            backgroundColor: theme.pillBg,
                            borderWidth: 1,
                            borderColor: theme.divider,
                          }}
                          onPress={() => handleAddSplitPerson(person)}
                        >
                          <MaterialCommunityIcons name="plus" size={13} color={theme.primary} />
                          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.onSurface }}>
                            {person}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}

                  {/* Participant Shares List */}
                  {splitPeople.map((p, idx) => {
                    const resolvedItem = splitSummary.resolved[idx];
                    return (
                      <View
                        key={p.name}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          paddingVertical: 6,
                          borderBottomWidth: idx < splitPeople.length - 1 ? 1 : 0,
                          borderBottomColor: theme.divider,
                        }}
                      >
                        <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: theme.onSurface }}>
                          {p.name}
                        </Text>
                        <TextInput
                          style={[
                            styles.taxInput,
                            {
                              minWidth: 90,
                              color: theme.onSurface,
                              backgroundColor: theme.pillBg,
                              borderColor: theme.divider,
                            },
                          ]}
                          placeholder={splitSummary.equalShare > 0 ? formatTypingNumber(splitSummary.equalShare.toString()) : '0'}
                          placeholderTextColor={theme.onSurfaceVariant}
                          keyboardType={Platform.OS === 'android' ? 'numeric' : 'decimal-pad'}
                          value={p.customAmount ?? ''}
                          onChangeText={(txt) => {
                            const formatted = formatTypingNumber(txt);
                            setSplitPeople((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, customAmount: formatted } : item))
                            );
                          }}
                        />
                        <TouchableOpacity
                          onPress={() => setSplitPeople((prev) => prev.filter((_, i) => i !== idx))}
                          hitSlop={6}
                        >
                          <MaterialCommunityIcons name="close-circle" size={18} color={theme.error} />
                        </TouchableOpacity>
                        {resolvedItem && (
                          <Text style={{ fontSize: 11, color: theme.primary, fontWeight: '700', minWidth: 46, textAlign: 'right' }}>
                            {formatCurrency(resolvedItem.share, currency)}
                          </Text>
                        )}
                      </View>
                    );
                  })}

                  {splitPeople.length > 0 && (
                    <View
                      style={{
                        marginTop: 10,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        borderRadius: M3Shape.small,
                        backgroundColor: theme.primaryContainer,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: theme.onPrimaryContainer }}>
                        Your share: {formatCurrency(splitSummary.yourShare, currency)}
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: theme.onPrimaryContainer }}>
                        {splitPeople.length} IOU{splitPeople.length > 1 ? 's' : ''} = {formatCurrency(splitSummary.totalOwedByOthers, currency)}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* 7. REPEAT & REMINDERS (RECURRING TRANSACTION) */}
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
        </ScrollView>

        {/* DOCKED BOTTOM SAVE BUTTON (ALWAYS VISIBLE AT BOTTOM OF SCREEN) */}
        <View
          style={[
            styles.dockedFooter,
            {
              backgroundColor: theme.surface,
              borderTopColor: theme.divider,
              paddingBottom: keyboardHeight > 0 ? 10 : bottomInset + 12,
            },
            M3Elevation.level2,
          ]}
        >
          <TouchableOpacity
            style={[styles.mainSaveBtn, { backgroundColor: accentColor }, M3Elevation.level2]}
            onPress={handleSave}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="check" size={20} color="#FFFFFF" />
            <Text style={styles.mainSaveBtnText}>
              {isEditing ? 'Update Transaction' : isTransfer ? 'Save Transfer' : isExpense ? 'Save Expense' : 'Save Income'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* CATEGORY SELECTOR BOTTOM SHEET */}
        <CategoryPickerSheet
          visible={categorySheetVisible}
          txType={currentType === 'transfer' ? 'expense' : currentType}
          amount={parseCleanNumber(amountStr)}
          walletId={selectedWalletId}
          wallets={wallets}
          categories={categories}
          theme={theme}
          baseCurrency={baseCurrency}
          initialCategoryId={selectedCategoryId}
          initialSubcategoryId={selectedSubcategoryId}
          selectOnly={true}
          useNativeModal={false}
          onClose={() => {
            setCategorySheetVisible(false);
            setTimeout(() => {
              amountInputRef.current?.focus();
            }, 120);
          }}
          onSave={({ categoryId, subcategoryId }) => {
            const catId = categoryId || '';
            const subId = subcategoryId || '';
            setSelectedCategoryId(catId);
            setSelectedSubcategoryId(subId);
            if (currentType === 'expense') {
              setLastExpenseCatId(catId);
              setLastExpenseSubId(subId);
            } else if (currentType === 'income') {
              setLastIncomeCatId(catId);
              setLastIncomeSubId(subId);
            }
            setCategorySheetVisible(false);
            setTimeout(() => {
              amountInputRef.current?.focus();
            }, 120);
          }}
          onManageCategories={onManageCategories}
          onAddSubcategory={onAddSubcategory}
        />

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

        <Modal
          visible={cameraVisible}
          animationType="fade"
          presentationStyle="fullScreen"
          statusBarTranslucent
          onRequestClose={() => setCameraVisible(false)}
        >
          <View style={styles.cameraScreen}>
            <CameraView
              ref={cameraRef}
              style={styles.cameraPreview}
              facing="back"
              onMountError={({ message }) => {
                setCameraVisible(false);
                Alert.alert('Camera Unavailable', message);
              }}
            />
            <View style={[styles.cameraControls, { paddingBottom: bottomInset + 16 }]}> 
              <TouchableOpacity
                style={[styles.cameraCloseButton, { backgroundColor: 'rgba(0, 0, 0, 0.55)' }]}
                onPress={() => setCameraVisible(false)}
                accessibilityLabel="Close camera"
              >
                <MaterialCommunityIcons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cameraShutter, { borderColor: '#FFFFFF' }]}
                onPress={handleCapturePhoto}
                accessibilityLabel="Take photo"
              >
                <View style={[styles.cameraShutterInner, { backgroundColor: '#FFFFFF' }]} />
              </TouchableOpacity>
              <View style={styles.cameraControlSpacer} />
            </View>
          </View>
        </Modal>

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
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBarPlaceholder: {
    width: 36,
    height: 36,
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
    paddingBottom: 24,
  },
  section: {
    gap: 6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldHeaderBalance: {
    fontSize: 11,
    fontWeight: '700',
  },
  card: {
    borderRadius: M3Shape.large,
    padding: 14,
    borderWidth: 1,
    gap: 10,
  },
  recurringCard: {
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
  paidChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: M3Shape.medium,
    borderWidth: 1,
    gap: 4,
  },
  paidChipText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  taxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  taxLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  taxInput: {
    minWidth: 74,
    maxWidth: 110,
    fontSize: 13.5,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: M3Shape.small,
    borderWidth: 1,
    textAlign: 'right',
  },
  taxNetBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: M3Shape.small,
  },
  taxNetText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dateTimeChipsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
    alignItems: 'center',
  },
  dateTimeQuickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: M3Shape.medium,
    borderWidth: 1,
    gap: 5,
  },
  dateTimeQuickChipText: {
    fontSize: 12.5,
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
  walletChipBalText: {
    fontSize: 11,
    fontWeight: '600',
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
  cameraScreen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraPreview: {
    flex: 1,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 20,
  },
  cameraCloseButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraShutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraShutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  cameraControlSpacer: {
    width: 46,
  },
  categorySelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: M3Shape.large,
    borderWidth: 1.5,
    marginTop: 4,
  },
  categorySelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  categoryBreadcrumbCol: {
    flex: 1,
  },
  categoryBreadcrumbText: {
    fontSize: 15,
  },
  categoryPlaceholderText: {
    fontSize: 15,
    fontWeight: '500',
  },
  dockedFooter: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  mainSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: M3Shape.large,
    marginTop: 0,
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
