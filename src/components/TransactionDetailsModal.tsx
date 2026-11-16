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
  Linking,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView } from 'expo-camera';
import * as Contacts from 'expo-contacts';
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
  initialIouMode?: boolean;
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
  initialTransactionId?: string;
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
  initialIouMode = false,
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
  initialTransactionId,
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
  const {
    debts,
    addDebt,
    recordDebtPayment,
    debtSettlements,
    undoTransactionDebtSettlements,
    getLastCreatedTransactionId,
  } = useBudget();
  const insets = useSafeAreaInsets();
  const insetsRef = useRef(insets);
  insetsRef.current = insets;
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? Math.max(StatusBar.currentHeight || 0, 28) : 0);
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 48 : 20);
  const { height: windowHeight } = useWindowDimensions();
  const bottomScrollPadding = Math.max(360, Math.round(windowHeight * 0.52)) + bottomInset;
  const [currentType, setCurrentType] = useState<TransactionType>(defaultTxType);
  const [isIouMode, setIsIouMode] = useState<boolean>(initialIouMode);
  const [iouAction, setIouAction] = useState<'lent' | 'borrowed' | 'settle'>('lent');
  const [iouPersonName, setIouPersonName] = useState<string>('');
  const [iouUseWallet, setIouUseWallet] = useState<boolean>(true);
  const [iouIncludeMyShare, setIouIncludeMyShare] = useState<boolean>(true);
  const [iouMyShareStr, setIouMyShareStr] = useState<string>('');
  const [iouDueDate, setIouDueDate] = useState<string>('');
  const [iouDueCalendarVisible, setIouDueCalendarVisible] = useState<boolean>(false);
  const [amountStr, setAmountStr] = useState<string>('');
  const [taxAmountStr, setTaxAmountStr] = useState<string>('');
  const amountInputRef = useRef<any>(null);
  const taxInputRef = useRef<any>(null);
  const noteInputRef = useRef<any>(null);
  const [categorySheetVisible, setCategorySheetVisible] = useState<boolean>(false);
  const [typeDropdownVisible, setTypeDropdownVisible] = useState<boolean>(false);
  const [activeSheet, setActiveSheet] = useState<'category' | 'wallet' | 'iou' | null>(null);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  const animateLayout = () => {
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch (err) {
      // ignore
    }
  };

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

  // Automatically focus amount input once modal is visible only when editing (new flow focuses after Wallet selection)
  useEffect(() => {
    if (visible && isEditing) {
      const timer = setTimeout(focusAmountInput, 150);
      return () => clearTimeout(timer);
    }
  }, [visible, isEditing]);
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
  const [settleIouEnabled, setSettleIouEnabled] = useState(false);
  const [selectedDebtId, setSelectedDebtId] = useState('');

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
      const initFrom = !isEditing && initialIouMode ? '' : initialWalletId || '';
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
      setSettleIouEnabled(false);
      setSelectedDebtId('');
      setIsIouMode(Boolean(initialIouMode));
      setIouAction('lent');
      setIouPersonName('');
      setIouUseWallet(true);
      setIouIncludeMyShare(true);
      setIouMyShareStr('');
      setIouDueDate('');
      setIouDueCalendarVisible(false);
      setTypeDropdownVisible(false);
      setExpandedCategoryId(initialCategoryId || null);
      if (isEditing) {
        setActiveSheet(null);
      } else if (initialIouMode) {
        setActiveSheet('wallet');
      } else if (defaultTxType === 'transfer') {
        setActiveSheet('wallet');
      } else if (!initialCategoryId) {
        setActiveSheet('category');
      } else {
        setActiveSheet('wallet');
      }
    }
  }, [
    visible,
    defaultTxType,
    initialIouMode,
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

  const openLentDebts = useMemo(
    () => debts.filter((d) => d.status === 'open' && d.type === 'lent'),
    [debts]
  );

  const allOpenDebts = useMemo(
    () => debts.filter((d) => d.status === 'open'),
    [debts]
  );

  const allKnownPeople = useMemo(() => {
    const map = new Map<string, string>();
    debts.forEach((d) => {
      const clean = d.person_name.trim();
      if (clean) {
        const key = clean.toLowerCase();
        if (!map.has(key)) map.set(key, clean);
      }
    });
    return Array.from(map.values());
  }, [debts]);

  const existingTxSettlements = useMemo(() => {
    if (!isEditing || !initialTransactionId) return [];
    return debtSettlements.filter((s) => s.transaction_id === initialTransactionId);
  }, [isEditing, initialTransactionId, debtSettlements]);

  const existingLinkedDebts = useMemo(() => {
    if (!isEditing) return [];
    return debts.filter((d) => {
      if (d.date !== dateStr) return false;
      if (d.wallet_id && d.wallet_id !== selectedWalletId) return false;
      const dNote = d.note || '';
      const isSplit = dNote.includes('(Split)') || dNote === 'Split expense';
      if (!isSplit) return false;
      if (initialNote && dNote !== 'Split expense') {
        return dNote.startsWith(initialNote);
      }
      return true;
    });
  }, [isEditing, debts, dateStr, selectedWalletId, initialNote]);

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

  const handlePickFromContacts = async () => {
    try {
      const { status, canAskAgain } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Contacts Permission',
          'Contacts permission is optional — you can still type names or tap known people.',
          !canAskAgain
            ? [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
            : [{ text: 'OK' }]
        );
        return;
      }
      const contact = await Contacts.Contact.presentPicker();
      if (contact) {
        let displayName = (await contact.getFullName())?.trim() || '';
        if (!displayName) {
          const details = await contact.getDetails([
            Contacts.ContactField.GIVEN_NAME,
            Contacts.ContactField.FAMILY_NAME,
            Contacts.ContactField.COMPANY,
          ]);
          displayName =
            [details.givenName, details.familyName].filter(Boolean).join(' ').trim() ||
            details.company?.trim() ||
            '';
        }
        if (displayName) {
          animateLayout();
          handleAddSplitPerson(displayName);
          setIouPersonName(displayName);
        }
      }
    } catch (err: any) {
      Alert.alert('Contacts Unavailable', err?.message || 'Could not open contacts picker.');
    }
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
    if (!isIouMode && !selectedWalletId && wallets.length === 0) {
      Alert.alert('No Wallet', 'Please create a wallet first');
      return;
    }
    if (isIouMode) {
      if (iouAction === 'settle') {
        if (!selectedDebtId) {
          Alert.alert('Select a Loan', 'Please choose an open loan to settle.');
          return;
        }
      } else {
        const pendingName = (splitPersonInput.trim() || iouPersonName.trim());
        if (splitPeople.length === 0 && !pendingName) {
          Alert.alert('Person Name Required', 'Please enter or select at least one person.');
          return;
        }
        if (splitPeople.length > 0 && splitSummary.totalOwedByOthers > parsed + 0.01) {
          Alert.alert('Split Exceeds Total', 'The sum of split shares cannot exceed the total amount.');
          return;
        }
        if (iouIncludeMyShare && splitPeople.length <= 1) {
          const defaultShare =
            iouAction === 'borrowed' ? parsed : Math.round((parsed / 2) * 100) / 100;
          const parsedMyShare = iouMyShareStr.trim()
            ? parseCleanNumber(iouMyShareStr)
            : defaultShare;
          const isValidShare =
            iouAction === 'borrowed'
              ? !isNaN(parsedMyShare) && parsedMyShare > 0 && parsedMyShare <= parsed
              : !isNaN(parsedMyShare) && parsedMyShare >= 0 && parsedMyShare < parsed;
          if (!isValidShare) {
            Alert.alert(
              'Invalid Share',
              iouAction === 'borrowed'
                ? 'Your share must be greater than 0 and not exceed the total amount.'
                : 'Your share must be between 0 and less than the total amount.'
            );
            return;
          }
        }
      }
    }
    if (!isIouMode && currentType === 'transfer') {
      if (wallets.length < 2) {
        Alert.alert('Transfer Requires 2 Wallets', 'Please create at least two wallets to record a transfer.');
        return;
      }
      if (!selectedToWalletId || selectedToWalletId === selectedWalletId) {
        Alert.alert('Invalid Destination', 'Source and destination wallets must be different.');
        return;
      }
    }

    if (!isIouMode && currentType === 'expense' && splitEnabled) {
      if (splitPeople.length === 0) {
        Alert.alert('Add Participants', 'Add at least one person to split this expense with, or turn off Split Expense.');
        return;
      }
      if (splitSummary.totalOwedByOthers > parsed + 0.01) {
        Alert.alert('Split Exceeds Total', 'The sum of split shares cannot exceed the total expense amount.');
        return;
      }
    }

    if (!isIouMode && currentType === 'income' && settleIouEnabled && !selectedDebtId) {
      Alert.alert('Select a Loan', 'Choose which open loan this income is repaying, or turn off Settle Open Loan.');
      return;
    }

    const performSave = async (recordExcessAsCredit: boolean) => {
      if (isIouMode) {
        const walletIdForIou =
          iouUseWallet && selectedWalletId ? selectedWalletId : undefined;

        if (iouAction === 'settle' && selectedDebtId) {
          const targetDebt = debts.find((d) => d.id === selectedDebtId);
          let createdTxId: string | undefined;
          if (walletIdForIou && targetDebt) {
            const settleTxType: TransactionType =
              targetDebt.type === 'lent' ? 'income' : 'expense';
            await onSave({
              amount: parsed,
              wallet_id: walletIdForIou,
              type: settleTxType,
              currency,
              date: dateStr,
              time: timeStr,
              is_paid: isPaid,
              tax_amount: parsedTax > 0 ? parsedTax : 0,
              note:
                note.trim() ||
                `Loan Settlement (${targetDebt.person_name})`,
              media_uri: mediaUri || undefined,
              repeat_frequency: repeatEnabled ? repeatFrequency : undefined,
              repeat_due_day: repeatEnabled ? repeatDueDay : undefined,
              repeat_end_type: repeatEnabled ? repeatEndType : undefined,
              repeat_end_occurrences:
                repeatEnabled && repeatEndType === 'after_occurrences'
                  ? parseInt(repeatEndOccurrences, 10) || 12
                  : undefined,
              repeat_end_date:
                repeatEnabled && repeatEndType === 'on_date' ? repeatEndDate : undefined,
              reminder_enabled: repeatEnabled ? reminderEnabled : undefined,
            });
            createdTxId = getLastCreatedTransactionId() || undefined;
          }
          await recordDebtPayment(selectedDebtId, parsed, {
            recordExcessAsCredit,
            transactionId: createdTxId,
          });
          onClose();
          return;
        }

        const fallbackName = splitPersonInput.trim() || iouPersonName.trim();
        const resolvedParticipants: { name: string; share: number }[] =
          splitPeople.length > 0
            ? splitSummary.resolved
            : [
              {
                name: fallbackName,
                share:
                  iouAction === 'lent' && iouIncludeMyShare
                    ? Math.max(
                      0,
                      Math.round(
                        (parsed -
                          (iouMyShareStr.trim()
                            ? parseCleanNumber(iouMyShareStr)
                            : Math.round((parsed / 2) * 100) / 100)) *
                        100
                      ) / 100
                    )
                    : parsed,
              },
            ];

        const namesLabel = resolvedParticipants.map((p) => p.name).join(', ');

        if (iouAction === 'lent' && iouIncludeMyShare) {
          let originTxId: string | undefined;
          if (walletIdForIou) {
            await onSave({
              amount: parsed,
              wallet_id: walletIdForIou,
              category_id: selectedCategoryId || undefined,
              subcategory_id: selectedSubcategoryId || undefined,
              type: 'expense',
              currency,
              date: dateStr,
              time: timeStr,
              is_paid: isPaid,
              tax_amount: parsedTax > 0 ? parsedTax : 0,
              note: note.trim()
                ? `${note.trim()} (Split with ${namesLabel})`
                : `Split with ${namesLabel}`,
              media_uri: mediaUri || undefined,
              repeat_frequency: repeatEnabled ? repeatFrequency : undefined,
              repeat_due_day: repeatEnabled ? repeatDueDay : undefined,
              repeat_end_type: repeatEnabled ? repeatEndType : undefined,
              repeat_end_occurrences:
                repeatEnabled && repeatEndType === 'after_occurrences'
                  ? parseInt(repeatEndOccurrences, 10) || 12
                  : undefined,
              repeat_end_date:
                repeatEnabled && repeatEndType === 'on_date' ? repeatEndDate : undefined,
              reminder_enabled: repeatEnabled ? reminderEnabled : undefined,
            });
            originTxId = getLastCreatedTransactionId() || undefined;
          }
          for (const participant of resolvedParticipants) {
            if (participant.share > 0) {
              await addDebt({
                type: 'lent',
                person_name: participant.name,
                amount: participant.share,
                currency,
                date: dateStr,
                due_date: iouDueDate || undefined,
                wallet_id: walletIdForIou,
                origin_transaction_id: originTxId,
                note: note.trim() ? `${note.trim()} (Split)` : 'Split bill',
              });
            }
          }
          onClose();
          return;
        }

        if (iouAction === 'borrowed' && iouIncludeMyShare) {
          const parsedMyShare =
            splitPeople.length > 1
              ? splitSummary.yourShare
              : iouMyShareStr.trim()
                ? parseCleanNumber(iouMyShareStr)
                : parsed;
          const expenseWalletId = walletIdForIou || wallets[0]?.id;
          if (expenseWalletId && parsedMyShare > 0) {
            await onSave({
              amount: parsedMyShare,
              wallet_id: expenseWalletId,
              category_id: selectedCategoryId || undefined,
              subcategory_id: selectedSubcategoryId || undefined,
              type: 'expense',
              currency,
              date: dateStr,
              time: timeStr,
              is_paid: walletIdForIou ? isPaid : false,
              tax_amount: parsedTax > 0 ? parsedTax : 0,
              note: note.trim()
                ? `${note.trim()} (Paid by ${namesLabel})`
                : `Paid by ${namesLabel}`,
              media_uri: mediaUri || undefined,
              repeat_frequency: repeatEnabled ? repeatFrequency : undefined,
              repeat_due_day: repeatEnabled ? repeatDueDay : undefined,
              repeat_end_type: repeatEnabled ? repeatEndType : undefined,
              repeat_end_occurrences:
                repeatEnabled && repeatEndType === 'after_occurrences'
                  ? parseInt(repeatEndOccurrences, 10) || 12
                  : undefined,
              repeat_end_date:
                repeatEnabled && repeatEndType === 'on_date' ? repeatEndDate : undefined,
              reminder_enabled: repeatEnabled ? reminderEnabled : undefined,
            });
          }
          for (const participant of resolvedParticipants) {
            if (participant.share > 0) {
              await addDebt({
                type: 'borrowed',
                person_name: participant.name,
                amount: participant.share,
                currency,
                date: dateStr,
                due_date: iouDueDate || undefined,
                wallet_id: walletIdForIou,
                note: note.trim() || undefined,
              });
            }
          }
          onClose();
          return;
        }

        for (const participant of resolvedParticipants) {
          if (participant.share > 0) {
            await addDebt({
              type: iouAction === 'borrowed' ? 'borrowed' : 'lent',
              person_name: participant.name,
              amount: participant.share,
              currency,
              date: dateStr,
              due_date: iouDueDate || undefined,
              wallet_id: walletIdForIou,
              note: note.trim() || undefined,
            });
          }
        }
        onClose();
        return;
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

      if (currentType === 'expense' && splitEnabled && splitSummary.resolved.length > 0) {
        const originTxId =
          isEditing && initialTransactionId
            ? initialTransactionId
            : getLastCreatedTransactionId() || undefined;
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
              origin_transaction_id: originTxId,
              note: splitNote,
            });
          }
        }
      }

      if (currentType === 'income' && settleIouEnabled && selectedDebtId) {
        const txId =
          isEditing && initialTransactionId
            ? initialTransactionId
            : getLastCreatedTransactionId() || undefined;
        await recordDebtPayment(selectedDebtId, parsed, {
          recordExcessAsCredit,
          transactionId: txId,
        });
      }
      onClose();
    };

    const activeSettleDebtId =
      isIouMode && iouAction === 'settle'
        ? selectedDebtId
        : !isIouMode && currentType === 'income' && settleIouEnabled
          ? selectedDebtId
          : '';

    if (activeSettleDebtId) {
      const targetDebt = debts.find((d) => d.id === activeSettleDebtId);
      if (targetDebt) {
        const remaining = Math.max(0, targetDebt.amount - (targetDebt.paid_amount || 0));
        const normalizedPerson = targetDebt.person_name.trim().toLowerCase();
        const otherOpenTotal = debts
          .filter(
            (d) =>
              d.id !== targetDebt.id &&
              d.status === 'open' &&
              d.type === targetDebt.type &&
              d.person_name.trim().toLowerCase() === normalizedPerson
          )
          .reduce((sum, d) => sum + Math.max(0, d.amount - (d.paid_amount || 0)), 0);

        const unabsorbedExcess = Math.round((parsed - remaining - otherOpenTotal) * 100) / 100;
        if (unabsorbedExcess > 0.009) {
          const debtCurr = targetDebt.currency || currency;
          Alert.alert(
            'Overpayment Detected',
            `${targetDebt.person_name} overpaid by ${formatCurrency(unabsorbedExcess, debtCurr)}. Claim the extra as a tip or record it as change you owe them?`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Claim as Tip', onPress: () => performSave(false) },
              { text: 'Record as Credit', onPress: () => performSave(true) },
            ]
          );
          return;
        }
      }
    }

    await performSave(true);
  };

  if (!visible) return null;

  const isExpense = !isIouMode && currentType === 'expense';
  const isTransfer = !isIouMode && currentType === 'transfer';
  const iouAccent = '#4338CA';
  const iouContainer = '#E0E7FF';
  const onIouContainer = '#312E81';
  const accentColor = isIouMode ? iouAccent : isTransfer ? theme.primary : isExpense ? theme.error : theme.success;
  const accentContainer = isIouMode ? iouContainer : isTransfer ? theme.primaryContainer : isExpense ? theme.errorContainer : theme.successContainer;
  const onAccentContainer = isIouMode ? onIouContainer : isTransfer ? theme.onPrimaryContainer : isExpense ? theme.onErrorContainer : theme.onSuccessContainer;

  const renderIouParticipantCards = (forExpense = false) => {
    const totalAmt = parseCleanNumber(amountStr) || 0;
    const includeMe = forExpense ? splitIncludeMe : iouIncludeMyShare;
    const accent = forExpense ? theme.primary : iouAccent;
    const container = forExpense ? theme.primaryContainer : iouContainer;
    const onContainer = forExpense ? theme.onPrimaryContainer : onIouContainer;
    const autoSingleMyShare =
      !forExpense && iouAction === 'borrowed'
        ? totalAmt
        : Math.round((totalAmt / 2) * 100) / 100;
    const singleMyShareVal =
      !forExpense && splitPeople.length <= 1 && includeMe
        ? iouMyShareStr.trim()
          ? parseCleanNumber(iouMyShareStr)
          : autoSingleMyShare
        : splitSummary.yourShare;

    return (
      <View style={{ gap: 6 }}>
        {includeMe && (
          <View
            style={[
              styles.walletSheetRow,
              {
                backgroundColor: theme.primaryContainer,
                borderColor: theme.primary,
                paddingVertical: 7,
              },
            ]}
          >
            <View style={styles.walletSheetLeft}>
              <MaterialCommunityIcons
                name="account-star-outline"
                size={16}
                color={theme.primary}
              />
              <Text
                style={[
                  styles.walletSheetName,
                  { color: theme.onPrimaryContainer, fontWeight: '700' },
                ]}
                numberOfLines={1}
              >
                Me (Your Share)
              </Text>
            </View>
            <View style={styles.walletSheetRight}>
              {!forExpense && splitPeople.length <= 1 ? (
                <TextInput
                  style={[
                    styles.taxInput,
                    {
                      color: theme.onSurface,
                      backgroundColor: theme.surface,
                      borderColor: theme.divider,
                      minWidth: 82,
                      paddingVertical: 4,
                      fontSize: 12.5,
                    },
                  ]}
                  placeholder={autoSingleMyShare > 0 ? autoSingleMyShare.toString() : 'Auto'}
                  placeholderTextColor={theme.onSurfaceVariant}
                  keyboardType={Platform.OS === 'android' ? 'numeric' : 'decimal-pad'}
                  value={iouMyShareStr}
                  onChangeText={(t) => setIouMyShareStr(formatTypingNumber(t))}
                />
              ) : (
                <View
                  style={[
                    styles.taxInput,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.divider,
                      minWidth: 82,
                      paddingVertical: 5,
                      alignItems: 'flex-end',
                    },
                  ]}
                >
                  <Text style={{ color: theme.onSurface, fontSize: 12.5, fontWeight: '700' }}>
                    {formatCurrency(singleMyShareVal, currency)}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                onPress={() => {
                  animateLayout();
                  if (!forExpense) setIouIncludeMyShare(false);
                  setSplitIncludeMe(false);
                }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityLabel="Remove my share"
              >
                <MaterialCommunityIcons name="close-circle" size={18} color={theme.error} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {splitPeople.map((p, idx) => {
          const resolvedShare =
            !forExpense && splitPeople.length === 1 && iouAction === 'lent' && includeMe && !p.customAmount?.trim()
              ? Math.max(0, Math.round((totalAmt - singleMyShareVal) * 100) / 100)
              : splitSummary.resolved[idx]?.share || 0;
          return (
            <View
              key={p.name}
              style={[
                styles.walletSheetRow,
                {
                  backgroundColor: container,
                  borderColor: accent,
                  paddingVertical: 7,
                },
              ]}
            >
              <View style={styles.walletSheetLeft}>
                <MaterialCommunityIcons
                  name="account-check-outline"
                  size={16}
                  color={accent}
                />
                <Text
                  style={[
                    styles.walletSheetName,
                    { color: onContainer, fontWeight: '700' },
                  ]}
                  numberOfLines={1}
                >
                  {p.name}
                </Text>
              </View>
              <View style={styles.walletSheetRight}>
                <TextInput
                  style={[
                    styles.taxInput,
                    {
                      color: theme.onSurface,
                      backgroundColor: theme.surface,
                      borderColor: theme.divider,
                      minWidth: 82,
                      paddingVertical: 4,
                      fontSize: 12.5,
                    },
                  ]}
                  placeholder={resolvedShare > 0 ? resolvedShare.toString() : 'Auto'}
                  placeholderTextColor={theme.onSurfaceVariant}
                  keyboardType={Platform.OS === 'android' ? 'numeric' : 'decimal-pad'}
                  value={p.customAmount || ''}
                  onChangeText={(txt) => {
                    const formatted = formatTypingNumber(txt);
                    setSplitPeople((prev) =>
                      prev.map((item, i) =>
                        i === idx ? { ...item, customAmount: formatted } : item
                      )
                    );
                  }}
                />
                <TouchableOpacity
                  onPress={() => {
                    animateLayout();
                    setSplitPeople((prev) => prev.filter((_, i) => i !== idx));
                  }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  accessibilityLabel={`Remove ${p.name}`}
                >
                  <MaterialCommunityIcons name="close-circle" size={18} color={theme.error} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {totalAmt > 0 && splitPeople.length > 0 && (
          <Text style={{ fontSize: 11.5, color: theme.onSurfaceVariant, fontWeight: '600' }}>
            Loan total: {formatCurrency(
              !forExpense && splitPeople.length === 1 && iouAction === 'lent' && includeMe && !splitPeople[0].customAmount?.trim()
                ? Math.max(0, Math.round((totalAmt - singleMyShareVal) * 100) / 100)
                : splitSummary.totalOwedByOthers,
              currency
            )}
            {includeMe ? `  •  My share: ${formatCurrency(singleMyShareVal, currency)}` : ''}
          </Text>
        )}
      </View>
    );
  };

  const renderPeopleSplitBody = (forExpense = false) => {
    const includeMe = forExpense ? splitIncludeMe : iouIncludeMyShare;
    const accent = forExpense ? theme.primary : iouAccent;
    const container = forExpense ? theme.primaryContainer : iouContainer;

    return (
      <View style={{ gap: 8 }}>
        {/* Categorized Expense / Split Option (at top) */}
        <View
          style={[
            styles.iouSplitToggleBox,
            {
              borderTopWidth: 0,
              paddingTop: 0,
              paddingBottom: 8,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: theme.divider,
            },
          ]}
        >
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={[styles.toggleTitle, { color: theme.onSurface, fontSize: 13 }]}>
                {forExpense ? 'Include me in split' : 'Include my share as Expense'}
              </Text>
              <Text style={[styles.toggleSubtitle, { color: theme.onSurfaceVariant }]}>
                {forExpense
                  ? includeMe
                    ? 'Your share stays in expense analytics; others become open loans'
                    : 'Paid 100% for others — full amount becomes open loans'
                  : iouAction === 'borrowed'
                    ? 'Categorize your expense (e.g. someone paid for your lunch)'
                    : 'Categorize your part of a shared bill without inflating analytics'}
              </Text>
            </View>
            <Switch
              value={includeMe}
              onValueChange={(val) => {
                animateLayout();
                if (forExpense) {
                  setSplitIncludeMe(val);
                } else {
                  setIouIncludeMyShare(val);
                  setSplitIncludeMe(val);
                  if (val && !selectedCategoryId) {
                    setActiveSheet('category');
                  }
                }
              }}
              trackColor={{ false: theme.outlineVariant, true: container }}
              thumbColor={includeMe ? accent : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Selected Split Participants & Me */}
        {(splitPeople.length > 0 || includeMe) && renderIouParticipantCards(forExpense)}

        {knownDebtPeople.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScrollRow}
          >
            {knownDebtPeople.map((person) => (
              <TouchableOpacity
                key={person}
                style={[
                  styles.walletChip,
                  {
                    backgroundColor: theme.pillBg,
                    borderColor: theme.divider,
                  },
                ]}
                onPress={() => {
                  animateLayout();
                  handleAddSplitPerson(person);
                }}
              >
                <MaterialCommunityIcons
                  name="account-plus-outline"
                  size={14}
                  color={accent}
                />
                <Text
                  style={[
                    styles.walletChipText,
                    { color: theme.onSurface, fontWeight: '600' },
                  ]}
                >
                  {person}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Add Person & Contacts Row (at bottom) */}
        <View style={styles.iouPersonInputRow}>
          <TouchableOpacity
            style={[
              styles.iouPersonNextBtn,
              {
                backgroundColor: theme.pillBg,
                borderWidth: 1,
                borderColor: theme.divider,
                paddingHorizontal: 10,
              },
            ]}
            onPress={handlePickFromContacts}
            accessibilityRole="button"
            accessibilityLabel="Pick from contacts"
          >
            <MaterialCommunityIcons
              name="account-box-outline"
              size={18}
              color={accent}
            />
          </TouchableOpacity>
          <TextInput
            style={[
              styles.iouPersonInput,
              {
                backgroundColor: theme.pillBg,
                color: theme.onSurface,
                borderColor: theme.divider,
              },
            ]}
            placeholder="Add person (e.g. James)"
            placeholderTextColor={theme.onSurfaceVariant}
            value={splitPersonInput}
            onChangeText={(txt) => {
              setSplitPersonInput(txt);
              if (!forExpense) setIouPersonName(txt);
            }}
            returnKeyType="done"
            onSubmitEditing={() => handleAddSplitPerson()}
          />
          <TouchableOpacity
            style={[
              styles.iouPersonNextBtn,
              {
                backgroundColor: theme.pillBg,
                borderWidth: 1,
                borderColor: splitPersonInput.trim() ? accent : theme.divider,
              },
            ]}
            disabled={!splitPersonInput.trim()}
            onPress={() => handleAddSplitPerson()}
          >
            <Text
              style={{
                color: splitPersonInput.trim() ? accent : theme.onSurfaceVariant,
                fontWeight: '700',
                fontSize: 12.5,
              }}
            >
              + Add
            </Text>
          </TouchableOpacity>
          {!forExpense && (
            <TouchableOpacity
              style={[
                styles.iouPersonNextBtn,
                {
                  backgroundColor:
                    splitPeople.length > 0 || splitPersonInput.trim()
                      ? accent
                      : theme.pillBg,
                },
              ]}
              disabled={splitPeople.length === 0 && !splitPersonInput.trim()}
              onPress={() => {
                if (splitPersonInput.trim()) {
                  handleAddSplitPerson();
                }
                animateLayout();
                const nextSheet =
                  iouIncludeMyShare && !selectedCategoryId ? 'category' : null;
                setActiveSheet(nextSheet);
                if (!nextSheet) {
                  setTimeout(focusAmountInput, 140);
                }
              }}
            >
              <Text
                style={{
                  color:
                    splitPeople.length > 0 || splitPersonInput.trim()
                      ? '#FFFFFF'
                      : theme.onSurfaceVariant,
                  fontWeight: '700',
                  fontSize: 12.5,
                }}
              >
                Next
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderCategoryCard = () => {
    if (isTransfer || (isIouMode && (iouAction === 'settle' || !iouIncludeMyShare))) return null;
    return (
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
        <TouchableOpacity
          style={styles.accordionHeader}
          onPress={() => {
            animateLayout();
            const next = activeSheet === 'category' ? null : 'category';
            if (next) Keyboard.dismiss();
            setActiveSheet(next);
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Toggle category sheet"
        >
          <View style={styles.accordionHeaderLeft}>
            <View
              style={[
                styles.catIconWrap,
                {
                  backgroundColor: selectedCategory
                    ? selectedCategory.color || theme.primary
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
            <View style={styles.accordionTitleCol}>
              <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>CATEGORY</Text>
              {selectedCategory ? (
                <Text style={[styles.categoryBreadcrumbText, { color: theme.onSurface }]} numberOfLines={1}>
                  <Text style={{ fontWeight: '700' }}>{selectedCategory.name}</Text>
                  {selectedSubcategory && (
                    <>
                      <Text style={{ color: theme.onSurfaceVariant, fontWeight: '400' }}>{' > '}</Text>
                      <Text style={{ fontWeight: '700', color: theme.primary }}>
                        {selectedSubcategory.name}
                      </Text>
                    </>
                  )}
                </Text>
              ) : (
                <Text style={[styles.categoryPlaceholderText, { color: theme.onSurfaceVariant }]}>
                  Tap to select category
                </Text>
              )}
            </View>
          </View>

          <View style={styles.accordionHeaderRight}>
            {activeSheet === 'category' && onManageCategories && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation?.();
                  onManageCategories();
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.manageLink, { color: theme.primary }]}>Manage</Text>
              </TouchableOpacity>
            )}
            <MaterialCommunityIcons
              name={activeSheet === 'category' ? 'chevron-up' : 'chevron-down'}
              size={22}
              color={theme.onSurfaceVariant}
            />
          </View>
        </TouchableOpacity>

        {activeSheet === 'category' && (
          <View style={[styles.sheetListWrap, { borderTopColor: theme.divider }]}>
            {activeCategories.length === 0 ? (
              <Text style={[styles.emptySheetText, { color: theme.onSurfaceVariant }]}>
                No {currentType} categories yet.
              </Text>
            ) : (
              activeCategories.map((cat) => {
                const isCatSelected = cat.id === selectedCategoryId;
                const subs = cat.subcategories || [];
                const isCatExpanded = expandedCategoryId === cat.id;
                const hasExpandable = subs.length > 0 || Boolean(onAddSubcategory);

                return (
                  <View key={cat.id} style={styles.catGroupBlock}>
                    <View
                      style={[
                        styles.catSheetRow,
                        {
                          backgroundColor: isCatSelected ? theme.primaryContainer : theme.pillBg,
                          borderColor: isCatSelected ? (cat.color || theme.primary) : 'transparent',
                        },
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.catSheetRowMain}
                        onPress={() => {
                          animateLayout();
                          setSelectedCategoryId(cat.id);
                          setSelectedSubcategoryId('');
                          if (currentType === 'expense') {
                            setLastExpenseCatId(cat.id);
                            setLastExpenseSubId('');
                          } else {
                            setLastIncomeCatId(cat.id);
                            setLastIncomeSubId('');
                          }
                          if (isIouMode) {
                            setActiveSheet(null);
                            setTimeout(focusAmountInput, 140);
                          } else {
                            setActiveSheet('wallet');
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.catSheetIconBadge,
                            { backgroundColor: cat.color || theme.primary },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={(cat.icon as any) || 'shape-outline'}
                            size={16}
                            color="#FFFFFF"
                          />
                        </View>
                        <Text
                          style={[
                            styles.catSheetRowTitle,
                            {
                              color: isCatSelected ? theme.onPrimaryContainer : theme.onSurface,
                              fontWeight: isCatSelected ? '800' : '600',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {cat.name}
                        </Text>
                        {subs.length > 0 && (
                          <Text style={[styles.catSubCountBadge, { color: theme.onSurfaceVariant }]}>
                            {subs.length}
                          </Text>
                        )}
                      </TouchableOpacity>

                      {hasExpandable && (
                        <TouchableOpacity
                          style={[
                            styles.catDropperBtn,
                            {
                              backgroundColor: isCatExpanded ? theme.primary : theme.surface,
                              borderColor: isCatExpanded ? theme.primary : theme.divider,
                            },
                          ]}
                          onPress={() => {
                            animateLayout();
                            setExpandedCategoryId(isCatExpanded ? null : cat.id);
                          }}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessibilityLabel={`Toggle ${cat.name} subcategories`}
                        >
                          <MaterialCommunityIcons
                            name={isCatExpanded ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color={isCatExpanded ? '#FFFFFF' : theme.onSurfaceVariant}
                          />
                        </TouchableOpacity>
                      )}
                    </View>

                    {isCatExpanded && (
                      <View style={[styles.subcatSheetList, { borderLeftColor: cat.color || theme.primary }]}>
                        {subs.map((sub: Subcategory) => {
                          const isSubSelected =
                            isCatSelected && sub.id === selectedSubcategoryId;
                          return (
                            <TouchableOpacity
                              key={sub.id}
                              style={[
                                styles.subcatSheetRow,
                                {
                                  backgroundColor: isSubSelected
                                    ? theme.primaryContainer
                                    : theme.surface,
                                  borderColor: isSubSelected ? theme.primary : theme.divider,
                                },
                              ]}
                              onPress={() => {
                                animateLayout();
                                setSelectedCategoryId(cat.id);
                                setSelectedSubcategoryId(sub.id);
                                if (currentType === 'expense') {
                                  setLastExpenseCatId(cat.id);
                                  setLastExpenseSubId(sub.id);
                                } else {
                                  setLastIncomeCatId(cat.id);
                                  setLastIncomeSubId(sub.id);
                                }
                                if (isIouMode) {
                                  setActiveSheet(null);
                                  setTimeout(focusAmountInput, 140);
                                } else {
                                  setActiveSheet('wallet');
                                }
                              }}
                              activeOpacity={0.7}
                            >
                              <MaterialCommunityIcons
                                name={isSubSelected ? 'check-circle' : 'subdirectory-arrow-right'}
                                size={15}
                                color={isSubSelected ? theme.primary : theme.onSurfaceVariant}
                              />
                              <Text
                                style={[
                                  styles.subcatSheetRowText,
                                  {
                                    color: isSubSelected
                                      ? theme.onPrimaryContainer
                                      : theme.onSurface,
                                    fontWeight: isSubSelected ? '700' : '500',
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {sub.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}

                        {onAddSubcategory && (
                          <TouchableOpacity
                            style={[
                              styles.subcatSheetRow,
                              {
                                backgroundColor: theme.pillBg,
                                borderColor: theme.divider,
                                borderStyle: 'dashed',
                              },
                            ]}
                            onPress={() => {
                              setSelectedCategoryId(cat.id);
                              setNewSubName('');
                              setQuickSubModalVisible(true);
                            }}
                            activeOpacity={0.7}
                          >
                            <MaterialCommunityIcons name="plus" size={15} color={theme.primary} />
                            <Text
                              style={[
                                styles.subcatSheetRowText,
                                { color: theme.primary, fontWeight: '700' },
                              ]}
                            >
                              Add Subcategory
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      statusBarTranslucent={true}
      onShow={() => {
        if (isEditing) {
          setTimeout(focusAmountInput, 100);
        }
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
        {/* Top App Bar with Type Dropdown */}
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

          <TouchableOpacity
            style={[
              styles.topBarDropdownBtn,
              {
                backgroundColor: accentContainer,
                borderColor: accentColor,
              },
            ]}
            onPress={() => {
              Keyboard.dismiss();
              animateLayout();
              setTypeDropdownVisible((prev) => !prev);
            }}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Change transaction type"
          >
            <MaterialCommunityIcons
              name={
                isIouMode
                  ? 'handshake-outline'
                  : isTransfer
                    ? 'swap-horizontal-bold'
                    : isExpense
                      ? 'arrow-down-circle'
                      : 'arrow-up-circle'
              }
              size={16}
              color={accentColor}
            />
            <Text style={[styles.topBarDropdownText, { color: onAccentContainer }]}>
              {isEditing ? 'Edit ' : ''}
              {isIouMode ? 'Loan' : isTransfer ? 'Transfer' : isExpense ? 'Expense' : 'Income'} Details
            </Text>
            <MaterialCommunityIcons
              name={typeDropdownVisible ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={onAccentContainer}
            />
          </TouchableOpacity>

          <View style={styles.topBarPlaceholder} />
        </View>

        {/* Anchored Type Dropdown Menu */}
        {typeDropdownVisible && (
          <View style={styles.dropdownBackdropWrap} pointerEvents="box-none">
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setTypeDropdownVisible(false)}
            />
            <View
              style={[
                styles.typeDropdownMenu,
                {
                  top: topInset + 54,
                  backgroundColor: theme.surface,
                  borderColor: theme.divider,
                },
              ]}
            >
              {(
                [
                  {
                    key: 'expense',
                    label: 'Expense Details',
                    icon: 'arrow-down-circle',
                    color: theme.error,
                    container: theme.errorContainer,
                  },
                  {
                    key: 'income',
                    label: 'Income Details',
                    icon: 'arrow-up-circle',
                    color: theme.success,
                    container: theme.successContainer,
                  },
                  {
                    key: 'transfer',
                    label: 'Transfer Details',
                    icon: 'swap-horizontal-bold',
                    color: theme.primary,
                    container: theme.primaryContainer,
                  },
                  {
                    key: 'iou',
                    label: 'Loan Details',
                    icon: 'handshake-outline',
                    color: iouAccent,
                    container: iouContainer,
                  },
                ] as const
              ).map((opt) => {
                const isSelected =
                  opt.key === 'iou' ? isIouMode : !isIouMode && currentType === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.typeDropdownItem,
                      isSelected && { backgroundColor: opt.container },
                    ]}
                    onPress={() => {
                      animateLayout();
                      setTypeDropdownVisible(false);
                      if (opt.key === 'iou') {
                        setIsIouMode(true);
                        setActiveSheet('wallet');
                        return;
                      }
                      setIsIouMode(false);
                      setCurrentType(opt.key);
                      if (opt.key === 'income') {
                        setSelectedCategoryId(lastIncomeCatId);
                        setSelectedSubcategoryId(lastIncomeSubId);
                        if (!lastIncomeCatId) setActiveSheet('category');
                        else if (activeSheet === 'iou') setActiveSheet('wallet');
                      } else if (opt.key === 'expense') {
                        setSelectedCategoryId(lastExpenseCatId);
                        setSelectedSubcategoryId(lastExpenseSubId);
                        if (!lastExpenseCatId) setActiveSheet('category');
                        else if (activeSheet === 'iou') setActiveSheet('wallet');
                      } else {
                        if (!selectedToWalletId || selectedToWalletId === selectedWalletId) {
                          const other = wallets.find((w) => w.id !== selectedWalletId);
                          if (other) setSelectedToWalletId(other.id);
                        }
                        if (activeSheet === 'category' || activeSheet === 'iou') setActiveSheet('wallet');
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name={opt.icon as any} size={18} color={opt.color} />
                    <Text
                      style={[
                        styles.typeDropdownItemText,
                        { color: theme.onSurface, fontWeight: isSelected ? '800' : '600' },
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {isSelected && (
                      <MaterialCommunityIcons name="check" size={18} color={opt.color} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomScrollPadding }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 0A. SEPARATE IOU TYPE CARD (IOU Mode) */}
          {isIouMode && (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
              <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>LOAN TYPE</Text>
              <View style={styles.iouActionRow}>
                {(
                  [
                    { key: 'lent', label: 'Receive', icon: 'arrow-bottom-left' },
                    { key: 'borrowed', label: 'Pay', icon: 'arrow-top-right' },
                    { key: 'settle', label: 'Settle', icon: 'check-decagram-outline' },
                  ] as const
                ).map((act) => {
                  const active = iouAction === act.key;
                  return (
                    <TouchableOpacity
                      key={act.key}
                      style={[
                        styles.iouActionPill,
                        {
                          backgroundColor: active ? iouContainer : theme.pillBg,
                          borderColor: active ? iouAccent : theme.divider,
                        },
                      ]}
                      onPress={() => {
                        animateLayout();
                        setIouAction(act.key);
                        const includeByDefault = act.key === 'lent';
                        setIouIncludeMyShare(includeByDefault);
                        setSplitIncludeMe(includeByDefault);
                      }}
                      activeOpacity={0.75}
                    >
                      <MaterialCommunityIcons
                        name={act.icon as any}
                        size={14}
                        color={active ? iouAccent : theme.onSurfaceVariant}
                      />
                      <Text
                        style={[
                          styles.iouActionPillText,
                          {
                            color: active ? onIouContainer : theme.onSurfaceVariant,
                            fontWeight: active ? '800' : '600',
                          },
                        ]}
                      >
                        {act.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {!isIouMode && renderCategoryCard()}

          {/* 2. COLLAPSIBLE WALLET SHEET */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
            <TouchableOpacity
              style={styles.accordionHeader}
              onPress={() => {
                animateLayout();
                const next = activeSheet === 'wallet' ? null : 'wallet';
                if (next) Keyboard.dismiss();
                setActiveSheet(next);
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Toggle wallet sheet"
            >
              <View style={styles.accordionHeaderLeft}>
                <View style={[styles.catIconWrap, { backgroundColor: theme.primaryContainer }]}>
                  <MaterialCommunityIcons
                    name={(selectedWallet?.icon as any) || 'wallet'}
                    size={18}
                    color={theme.primary}
                  />
                </View>
                <View style={styles.accordionTitleCol}>
                  <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>
                    {isTransfer ? 'WALLETS (FROM → TO)' : 'WALLET'}
                  </Text>
                  {isTransfer ? (
                    <Text style={[styles.categoryBreadcrumbText, { color: theme.onSurface }]} numberOfLines={1}>
                      <Text style={{ fontWeight: '700' }}>{selectedWallet?.name || 'Source'}</Text>
                      <Text style={{ color: theme.onSurfaceVariant }}>{'  →  '}</Text>
                      <Text style={{ fontWeight: '700', color: theme.primary }}>
                        {selectedToWallet?.name || 'Destination'}
                      </Text>
                    </Text>
                  ) : !iouUseWallet && isIouMode ? (
                    <Text style={[styles.categoryBreadcrumbText, { color: theme.onSurfaceVariant }]} numberOfLines={1}>
                      No Wallet (Cashless / Off-wallet)
                    </Text>
                  ) : selectedWallet ? (
                    <Text style={[styles.categoryBreadcrumbText, { color: theme.onSurface }]} numberOfLines={1}>
                      <Text style={{ fontWeight: '700' }}>{selectedWallet.name}</Text>
                      <Text style={{ color: theme.onSurfaceVariant, fontWeight: '500' }}>
                        {'  •  '}
                        {formatCurrency(selectedWallet.current_balance, selectedWallet.currency || baseCurrency)}
                      </Text>
                    </Text>
                  ) : (
                    <Text style={[styles.categoryPlaceholderText, { color: theme.onSurfaceVariant }]}>
                      Tap to select wallet
                    </Text>
                  )}
                </View>
              </View>

              <MaterialCommunityIcons
                name={activeSheet === 'wallet' ? 'chevron-up' : 'chevron-down'}
                size={22}
                color={theme.onSurfaceVariant}
              />
            </TouchableOpacity>

            {activeSheet === 'wallet' && (
              <View style={[styles.sheetListWrap, { borderTopColor: theme.divider }]}>
                {isTransfer ? (
                  <>
                    <Text style={[styles.fieldSubLabel, { color: theme.onSurfaceVariant }]}>
                      SOURCE WALLET (TRANSFER FROM)
                    </Text>
                    {wallets
                      .filter((w) => w.id !== selectedToWalletId)
                      .map((w) => {
                        const isSelected = w.id === selectedWalletId;
                        return (
                          <TouchableOpacity
                            key={`from-${w.id}`}
                            style={[
                              styles.walletSheetRow,
                              {
                                backgroundColor: isSelected ? theme.primaryContainer : theme.pillBg,
                                borderColor: isSelected ? theme.primary : 'transparent',
                              },
                            ]}
                            onPress={() => {
                              setSelectedWalletId(w.id);
                              if (w.id === selectedToWalletId) {
                                const nextTo = wallets.find((o) => o.id !== w.id);
                                if (nextTo) setSelectedToWalletId(nextTo.id);
                              }
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={styles.walletSheetLeft}>
                              <MaterialCommunityIcons
                                name={(w.icon as any) || 'wallet'}
                                size={18}
                                color={isSelected ? theme.primary : theme.onSurfaceVariant}
                              />
                              <Text
                                style={[
                                  styles.walletSheetName,
                                  {
                                    color: isSelected ? theme.onPrimaryContainer : theme.onSurface,
                                    fontWeight: isSelected ? '800' : '600',
                                  },
                                ]}
                              >
                                {w.name}
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.walletSheetBal,
                                { color: isSelected ? theme.primary : theme.onSurfaceVariant },
                              ]}
                            >
                              {formatCurrency(w.current_balance, w.currency || baseCurrency)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}

                    <Text style={[styles.fieldSubLabel, { color: theme.onSurfaceVariant, marginTop: 8 }]}>
                      DESTINATION WALLET (TRANSFER TO)
                    </Text>
                    {wallets
                      .filter((w) => w.id !== selectedWalletId)
                      .map((w) => {
                        const isSelected = w.id === selectedToWalletId;
                        return (
                          <TouchableOpacity
                            key={`to-${w.id}`}
                            style={[
                              styles.walletSheetRow,
                              {
                                backgroundColor: isSelected ? theme.primaryContainer : theme.pillBg,
                                borderColor: isSelected ? theme.primary : 'transparent',
                              },
                            ]}
                            onPress={() => {
                              animateLayout();
                              setSelectedToWalletId(w.id);
                              setActiveSheet(null);
                              setTimeout(focusAmountInput, 140);
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={styles.walletSheetLeft}>
                              <MaterialCommunityIcons
                                name={(w.icon as any) || 'bank-transfer-in'}
                                size={18}
                                color={isSelected ? theme.primary : theme.onSurfaceVariant}
                              />
                              <Text
                                style={[
                                  styles.walletSheetName,
                                  {
                                    color: isSelected ? theme.onPrimaryContainer : theme.onSurface,
                                    fontWeight: isSelected ? '800' : '600',
                                  },
                                ]}
                              >
                                {w.name}
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.walletSheetBal,
                                { color: isSelected ? theme.primary : theme.onSurfaceVariant },
                              ]}
                            >
                              {formatCurrency(w.current_balance, w.currency || baseCurrency)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                  </>
                ) : (
                  <>
                    {isIouMode && (
                      <TouchableOpacity
                        style={[
                          styles.walletSheetRow,
                          {
                            backgroundColor: !iouUseWallet ? iouContainer : theme.pillBg,
                            borderColor: !iouUseWallet ? iouAccent : 'transparent',
                          },
                        ]}
                        onPress={() => {
                          animateLayout();
                          setIouUseWallet(false);
                          setActiveSheet('iou');
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.walletSheetLeft}>
                          <MaterialCommunityIcons
                            name="wallet-outline"
                            size={18}
                            color={!iouUseWallet ? iouAccent : theme.onSurfaceVariant}
                          />
                          <Text
                            style={[
                              styles.walletSheetName,
                              {
                                color: !iouUseWallet ? onIouContainer : theme.onSurface,
                                fontWeight: !iouUseWallet ? '800' : '600',
                              },
                            ]}
                          >
                            No Wallet (Cashless / Off-wallet)
                          </Text>
                        </View>
                        {!iouUseWallet && (
                          <MaterialCommunityIcons name="check-circle" size={17} color={iouAccent} />
                        )}
                      </TouchableOpacity>
                    )}
                    {wallets.map((w) => {
                      const isSelected = (!isIouMode || iouUseWallet) && w.id === selectedWalletId;
                      return (
                        <TouchableOpacity
                          key={w.id}
                          style={[
                            styles.walletSheetRow,
                            {
                              backgroundColor: isSelected ? theme.primaryContainer : theme.pillBg,
                              borderColor: isSelected ? theme.primary : 'transparent',
                            },
                          ]}
                          onPress={() => {
                            animateLayout();
                            setIouUseWallet(true);
                            setSelectedWalletId(w.id);
                            if (isIouMode) {
                              setActiveSheet('iou');
                            } else {
                              setActiveSheet(null);
                              setTimeout(focusAmountInput, 140);
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={styles.walletSheetLeft}>
                            <MaterialCommunityIcons
                              name={(w.icon as any) || 'wallet'}
                              size={18}
                              color={isSelected ? theme.primary : theme.onSurfaceVariant}
                            />
                            <Text
                              style={[
                                styles.walletSheetName,
                                {
                                  color: isSelected ? theme.onPrimaryContainer : theme.onSurface,
                                  fontWeight: isSelected ? '800' : '600',
                                },
                              ]}
                            >
                              {w.name}
                            </Text>
                          </View>
                          <View style={styles.walletSheetRight}>
                            <Text
                              style={[
                                styles.walletSheetBal,
                                { color: isSelected ? theme.primary : theme.onSurfaceVariant },
                              ]}
                            >
                              {formatCurrency(w.current_balance, w.currency || baseCurrency)}
                            </Text>
                            {isSelected && (
                              <MaterialCommunityIcons name="check-circle" size={17} color={theme.primary} />
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}
              </View>
            )}
          </View>

          {/* 0B. COLLAPSIBLE PEOPLE / OPEN IOU CARD (IOU Mode) */}
          {isIouMode && (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => {
                  animateLayout();
                  const next = activeSheet === 'iou' ? null : 'iou';
                  if (next) Keyboard.dismiss();
                  setActiveSheet(next);
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Toggle people sheet"
              >
                <View style={styles.accordionHeaderLeft}>
                  <View style={[styles.catIconWrap, { backgroundColor: iouContainer }]}>
                    <MaterialCommunityIcons
                      name={iouAction === 'settle' ? 'handshake-outline' : 'account-group-outline'}
                      size={18}
                      color={iouAccent}
                    />
                  </View>
                  <View style={styles.accordionTitleCol}>
                    <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>
                      {iouAction === 'settle' ? 'OPEN LOAN TO SETTLE' : 'PEOPLE'}
                    </Text>
                    {iouAction === 'settle' ? (
                      (() => {
                        const chosen = allOpenDebts.find((d) => d.id === selectedDebtId);
                        return chosen ? (
                          <Text style={[styles.categoryBreadcrumbText, { color: theme.onSurface }]} numberOfLines={1}>
                            <Text style={{ fontWeight: '700' }}>{chosen.person_name}</Text>
                            <Text style={{ color: theme.onSurfaceVariant }}>
                              {' • '}Rem: {formatCurrency(Math.max(0, chosen.amount - (chosen.paid_amount || 0)), chosen.currency || currency)}
                            </Text>
                          </Text>
                        ) : (
                          <Text style={[styles.categoryPlaceholderText, { color: theme.onSurfaceVariant }]}>
                            Tap to select open loan
                          </Text>
                        );
                      })()
                    ) : splitPeople.length > 0 || iouPersonName.trim() ? (
                      <Text style={[styles.categoryBreadcrumbText, { color: theme.onSurface }]} numberOfLines={1}>
                        <Text style={{ fontWeight: '700' }}>
                          {splitPeople.length > 0
                            ? splitPeople.map((p) => p.name).join(', ')
                            : iouPersonName.trim()}
                        </Text>
                        {iouIncludeMyShare && (
                          <Text style={{ color: theme.primary, fontWeight: '600' }}>
                            {' • Categorized'}
                          </Text>
                        )}
                      </Text>
                    ) : (
                      <Text style={[styles.categoryPlaceholderText, { color: theme.onSurfaceVariant }]}>
                        Tap to add or select people
                      </Text>
                    )}
                  </View>
                </View>

                <MaterialCommunityIcons
                  name={activeSheet === 'iou' ? 'chevron-up' : 'chevron-down'}
                  size={22}
                  color={theme.onSurfaceVariant}
                />
              </TouchableOpacity>

              {activeSheet === 'iou' && (
                <View style={[styles.sheetListWrap, { borderTopColor: theme.divider }]}>
                  {iouAction === 'settle' ? (
                    <View style={{ gap: 6 }}>
                      {allOpenDebts.length === 0 ? (
                        <Text style={[styles.emptySheetText, { color: theme.onSurfaceVariant }]}>
                          No open loans to settle right now.
                        </Text>
                      ) : (
                        allOpenDebts.map((debt) => {
                          const remaining = Math.max(0, debt.amount - (debt.paid_amount || 0));
                          const isSelected = selectedDebtId === debt.id;
                          const isLent = debt.type === 'lent';
                          return (
                            <TouchableOpacity
                              key={debt.id}
                              style={[
                                styles.walletSheetRow,
                                {
                                  backgroundColor: isSelected ? iouContainer : theme.pillBg,
                                  borderColor: isSelected ? iouAccent : 'transparent',
                                },
                              ]}
                              onPress={() => {
                                animateLayout();
                                setSelectedDebtId(debt.id);
                                setIouPersonName(debt.person_name);
                                const cur = parseCleanNumber(amountStr);
                                if (isNaN(cur) || cur <= 0) {
                                  setAmountStr(formatTypingNumber(remaining.toString()));
                                }
                                setActiveSheet(null);
                                setTimeout(focusAmountInput, 140);
                              }}
                              activeOpacity={0.7}
                            >
                              <View style={styles.walletSheetLeft}>
                                <MaterialCommunityIcons
                                  name={isLent ? 'account-arrow-left' : 'account-arrow-right'}
                                  size={18}
                                  color={isLent ? theme.success : theme.error}
                                />
                                <View style={{ flex: 1 }}>
                                  <Text
                                    style={[
                                      styles.walletSheetName,
                                      {
                                        color: isSelected ? onIouContainer : theme.onSurface,
                                        fontWeight: isSelected ? '800' : '600',
                                      },
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {debt.person_name} ({isLent ? 'owes you' : 'you owe'})
                                  </Text>
                                  {!!debt.note && (
                                    <Text style={{ fontSize: 11, color: theme.onSurfaceVariant }} numberOfLines={1}>
                                      {debt.note}
                                    </Text>
                                  )}
                                </View>
                              </View>
                              <Text
                                style={[
                                  styles.walletSheetBal,
                                  { color: isSelected ? iouAccent : theme.onSurfaceVariant },
                                ]}
                              >
                                {formatCurrency(remaining, debt.currency || currency)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </View>
                  ) : (
                    renderPeopleSplitBody(false)
                  )}
                </View>
              )}

              {activeSheet !== 'iou' &&
                iouAction !== 'settle' &&
                (splitPeople.length > 0 || iouIncludeMyShare) && (
                  <View style={[styles.sheetListWrap, { borderTopColor: theme.divider }]}>
                    {renderIouParticipantCards()}
                  </View>
                )}
            </View>
          )}

          {isIouMode && renderCategoryCard()}

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
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => taxInputRef.current?.focus()}
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
                ref={taxInputRef}
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
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => noteInputRef.current?.focus()}
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

          {/* SEPARATE DUE / END DATE CARD (IOU Mode) */}
          {isIouMode && iouAction !== 'settle' && (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
              <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>DUE / END DATE (OPTIONAL)</Text>
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
                  const d = new Date(dateStr + 'T12:00:00');
                  d.setDate(d.getDate() + days);
                  const presetStr = d.toISOString().slice(0, 10);
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
          {!isIouMode && currentType === 'expense' && (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleTextCol}>
                  <View style={styles.labelWithIcon}>
                    <MaterialCommunityIcons name="account-group-outline" size={18} color={theme.primary} />
                    <Text style={[styles.toggleTitle, { color: theme.onSurface }]}>Split Expense</Text>
                  </View>
                  <Text style={[styles.toggleSubtitle, { color: theme.onSurfaceVariant }]}>
                    Automatically create loans for other people's shares
                  </Text>
                </View>
                <Switch
                  value={splitEnabled}
                  onValueChange={setSplitEnabled}
                  trackColor={{ false: theme.outlineVariant, true: theme.primaryContainer }}
                  thumbColor={splitEnabled ? theme.primary : '#f4f3f4'}
                />
              </View>

              {isEditing && existingLinkedDebts.length > 0 && (
                <View
                  style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: M3Shape.small,
                    backgroundColor: theme.pillBg,
                    gap: 4,
                  }}
                >
                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: theme.onSurfaceVariant }}>
                    EXISTING LOANS FROM THIS EXPENSE
                  </Text>
                  {existingLinkedDebts.map((d) => (
                    <Text key={d.id} style={{ fontSize: 12.5, fontWeight: '700', color: theme.onSurface }}>
                      • {d.person_name}: {formatCurrency(d.amount, d.currency || currency)} ({d.status})
                    </Text>
                  ))}
                </View>
              )}

              {splitEnabled && (
                <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.divider }}>
                  {renderPeopleSplitBody(true)}
                </View>
              )}
            </View>
          )}

          {/* SETTLE OPEN IOU (ON INCOME) */}
          {!isIouMode && currentType === 'income' && (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleTextCol}>
                  <View style={styles.labelWithIcon}>
                    <MaterialCommunityIcons name="handshake-outline" size={18} color={theme.success} />
                    <Text style={[styles.toggleTitle, { color: theme.onSurface }]}>Settle Open Loan</Text>
                  </View>
                  <Text style={[styles.toggleSubtitle, { color: theme.onSurfaceVariant }]}>
                    Apply this income to an open loan someone owes you
                  </Text>
                </View>
                <Switch
                  value={settleIouEnabled}
                  onValueChange={(val) => {
                    setSettleIouEnabled(val);
                    if (val && !selectedDebtId && openLentDebts.length === 1) {
                      const only = openLentDebts[0];
                      setSelectedDebtId(only.id);
                      const cur = parseCleanNumber(amountStr);
                      if (isNaN(cur) || cur <= 0) {
                        const rem = Math.max(0, only.amount - (only.paid_amount || 0));
                        setAmountStr(formatTypingNumber(rem.toString()));
                      }
                    }
                  }}
                  trackColor={{ false: theme.outlineVariant, true: theme.successContainer }}
                  thumbColor={settleIouEnabled ? theme.success : '#f4f3f4'}
                />
              </View>

              {isEditing && existingTxSettlements.length > 0 && (
                <View
                  style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: M3Shape.small,
                    backgroundColor: theme.successContainer,
                    gap: 6,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 11.5, fontWeight: '800', color: theme.onSuccessContainer }}>
                      SETTLED LOAN(S) LINKED TO THIS TRANSACTION
                    </Text>
                    <TouchableOpacity
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 12,
                        backgroundColor: theme.errorContainer,
                      }}
                      onPress={() => {
                        if (!initialTransactionId) return;
                        Alert.alert(
                          'Undo Loan Settlement?',
                          'This will restore the settled debt balance back to open and remove any overpayment credit created from this transaction.',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Undo',
                              style: 'destructive',
                              onPress: () => undoTransactionDebtSettlements(initialTransactionId),
                            },
                          ]
                        );
                      }}
                    >
                      <Text style={{ fontSize: 11.5, fontWeight: '800', color: theme.onErrorContainer }}>
                        Undo
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {existingTxSettlements.map((s) => (
                    <Text key={s.id} style={{ fontSize: 12.5, fontWeight: '700', color: theme.onSuccessContainer }}>
                      • Settled {s.person_name}'s {formatCurrency(s.applied_amount, s.currency || currency)} debt
                      {s.excess_amount > 0.009
                        ? ` (exceeded ${formatCurrency(s.excess_amount, s.currency || currency)} • ${s.excess_mode === 'credit' ? 'Credit' : 'Tip'
                        })`
                        : ''}
                    </Text>
                  ))}
                </View>
              )}

              {settleIouEnabled && (
                openLentDebts.length === 0 ? (
                  <Text style={{ fontSize: 12.5, color: theme.onSurfaceVariant, marginTop: 10 }}>
                    No open loans owed to you yet.
                  </Text>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.divider }}
                  >
                    {openLentDebts.map((d) => {
                      const rem = Math.max(0, d.amount - (d.paid_amount || 0));
                      const selected = selectedDebtId === d.id;
                      return (
                        <TouchableOpacity
                          key={d.id}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: M3Shape.medium,
                            borderWidth: 1,
                            backgroundColor: selected ? theme.successContainer : theme.pillBg,
                            borderColor: selected ? theme.success : theme.divider,
                          }}
                          onPress={() => {
                            setSelectedDebtId(d.id);
                            const cur = parseCleanNumber(amountStr);
                            if (isNaN(cur) || cur <= 0) {
                              setAmountStr(formatTypingNumber(rem.toString()));
                            }
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12.5,
                              fontWeight: '800',
                              color: selected ? theme.onSuccessContainer : theme.onSurface,
                            }}
                          >
                            {d.person_name}
                          </Text>
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '600',
                              color: selected ? theme.onSuccessContainer : theme.onSurfaceVariant,
                            }}
                          >
                            Owes {formatCurrency(rem, d.currency || currency)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )
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

          {/* NOTE & TAGS */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
            <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>NOTE & TAGS</Text>
            <TextInput
              ref={noteInputRef}
              style={[styles.noteInput, { backgroundColor: theme.pillBg, color: theme.onSurface, borderColor: theme.divider }]}
              placeholder="Add optional notes, tags, or description..."
              placeholderTextColor={theme.onSurfaceVariant}
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
            />
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

        {/* CALENDAR PICKER MODAL (IOU DUE / END DATE) */}
        <CalendarPickerModal
          visible={iouDueCalendarVisible}
          selectedDate={iouDueDate || dateStr}
          theme={theme}
          onClose={() => setIouDueCalendarVisible(false)}
          onSelectDate={(d) => setIouDueDate(d)}
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
  topBarDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: M3Shape.full,
    borderWidth: 1,
  },
  topBarDropdownText: {
    fontSize: 14,
    fontWeight: '800',
  },
  dropdownBackdropWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 50,
    alignItems: 'center',
  },
  typeDropdownMenu: {
    position: 'absolute',
    width: 220,
    borderRadius: M3Shape.large,
    borderWidth: 1,
    padding: 6,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 12,
  },
  typeDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: M3Shape.medium,
  },
  typeDropdownItemText: {
    flex: 1,
    fontSize: 14,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  accordionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  accordionTitleCol: {
    flex: 1,
    gap: 2,
  },
  accordionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetListWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    gap: 8,
  },
  emptySheetText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 10,
  },
  catGroupBlock: {
    gap: 6,
  },
  catSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: M3Shape.medium,
    borderWidth: 1,
    paddingRight: 8,
    overflow: 'hidden',
  },
  catSheetRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  catSheetIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catSheetRowTitle: {
    flex: 1,
    fontSize: 14,
  },
  catSubCountBadge: {
    fontSize: 11.5,
    fontWeight: '700',
    marginRight: 4,
  },
  catDropperBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subcatSheetList: {
    marginLeft: 18,
    paddingLeft: 12,
    borderLeftWidth: 2,
    gap: 6,
  },
  subcatSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: M3Shape.medium,
    borderWidth: 1,
  },
  subcatSheetRowText: {
    flex: 1,
    fontSize: 13,
  },
  walletSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: M3Shape.medium,
    borderWidth: 1,
    gap: 10,
  },
  walletSheetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  walletSheetRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  walletSheetName: {
    fontSize: 14,
  },
  walletSheetBal: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  iouActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  iouActionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: M3Shape.medium,
    borderWidth: 1,
  },
  iouActionPillText: {
    fontSize: 12,
  },
  iouPersonInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iouPersonInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: M3Shape.medium,
    borderWidth: 1,
    fontSize: 14,
  },
  iouPersonNextBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: M3Shape.medium,
  },
  iouSplitToggleBox: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    gap: 8,
  },
  iouMyShareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
});
