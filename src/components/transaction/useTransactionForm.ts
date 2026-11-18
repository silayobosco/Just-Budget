import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Alert,
  Keyboard,
  LayoutAnimation,
  Linking,
  Platform,
  UIManager,
} from 'react-native';
import { CameraView } from 'expo-camera';
import * as Contacts from 'expo-contacts';
import * as ImagePicker from 'expo-image-picker';
import {
  BillFrequency,
  Category,
  RecurrenceEndType,
  Subcategory,
  TransactionType,
  Wallet,
} from '../../types';
import { formatCurrency, formatTypingNumber, parseCleanNumber } from '../../utils/format';
import { addLocalDays, addLocalYears, formatLocalDate } from '../../utils/date';
import { useBudget } from '../../context/BudgetContext';
import {
  ActiveSheet,
  ExpensePaidBy,
  FormKind,
  IouAction,
  validateForm,
} from './formConfig';

export interface SaveTransactionPayload {
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
}

export interface UseTransactionFormParams {
  visible: boolean;
  defaultTxType: TransactionType;
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
  baseCurrency: string;
  onClose: () => void;
  onSave: (tx: SaveTransactionPayload) => Promise<void>;
  onAddSubcategory?: (categoryId: string, name: string) => Promise<string>;
}

export function useTransactionForm({
  visible,
  defaultTxType,
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
  baseCurrency,
  onClose,
  onSave,
  onAddSubcategory,
}: UseTransactionFormParams) {
  const {
    debts,
    addDebt,
    recordDebtPayment,
    debtSettlements,
    undoTransactionDebtSettlements,
    getLastCreatedTransactionId,
  } = useBudget();

  const [currentType, setCurrentType] = useState<TransactionType>(defaultTxType);
  const [isIouMode, setIsIouMode] = useState<boolean>(initialIouMode);
  const formKind: FormKind = isIouMode ? 'loan' : currentType;

  const [iouAction, setIouAction] = useState<IouAction>('lent');
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
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [moreExpanded, setMoreExpanded] = useState<boolean>(false);

  const [selectedWalletId, setSelectedWalletId] = useState<string>(initialWalletId);
  const [selectedToWalletId, setSelectedToWalletId] = useState<string>(initialToWalletId || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(initialCategoryId || '');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>(initialSubcategoryId || '');
  const [lastExpenseCatId, setLastExpenseCatId] = useState<string>(
    defaultTxType === 'expense' ? initialCategoryId || '' : ''
  );
  const [lastExpenseSubId, setLastExpenseSubId] = useState<string>(
    defaultTxType === 'expense' ? initialSubcategoryId || '' : ''
  );
  const [lastIncomeCatId, setLastIncomeCatId] = useState<string>(
    defaultTxType === 'income' ? initialCategoryId || '' : ''
  );
  const [lastIncomeSubId, setLastIncomeSubId] = useState<string>(
    defaultTxType === 'income' ? initialSubcategoryId || '' : ''
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
  const [expenseSource, setExpenseSource] = useState<ExpensePaidBy>('wallet');
  const [splitIncludeMe, setSplitIncludeMe] = useState(true);
  const [splitPeople, setSplitPeople] = useState<{ name: string; customAmount?: string }[]>([]);
  const [splitPersonInput, setSplitPersonInput] = useState('');
  const [settleIouEnabled, setSettleIouEnabled] = useState(false);
  const [selectedDebtId, setSelectedDebtId] = useState('');

  const todayStr = useMemo(() => formatLocalDate(new Date()), []);
  const yesterdayStr = useMemo(() => addLocalDays(todayStr, -1), [todayStr]);

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

  const [repeatEnabled, setRepeatEnabled] = useState<boolean>(false);
  const [repeatFrequency, setRepeatFrequency] = useState<BillFrequency>('monthly');
  const [repeatDueDay, setRepeatDueDay] = useState<number>(() => new Date().getDate());
  const [repeatEndType, setRepeatEndType] = useState<RecurrenceEndType>('never');
  const [repeatEndOccurrences, setRepeatEndOccurrences] = useState<string>('12');
  const [repeatEndDate, setRepeatEndDate] = useState<string>(() =>
    addLocalYears(formatLocalDate(new Date()), 1)
  );
  const [endCalendarVisible, setEndCalendarVisible] = useState<boolean>(false);
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(true);

  const [calendarVisible, setCalendarVisible] = useState<boolean>(false);
  const [clockVisible, setClockVisible] = useState<boolean>(false);
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState<boolean>(false);

  const animateLayout = () => {
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const focusAmountInput = () => {
    if (amountInputRef.current && !amountInputRef.current.isFocused()) {
      amountInputRef.current.focus();
    }
  };

  useEffect(() => {
    if (!visible) return;
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
      (wallets.length > 1 ? wallets.find((w) => w.id !== initFrom)?.id || '' : '');
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
    const initD = initialDate || formatLocalDate(new Date());
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
    setRepeatEndDate(initialRepeatEndDate || addLocalYears(formatLocalDate(new Date()), 1));
    setReminderEnabled(initialReminderEnabled !== undefined ? initialReminderEnabled : true);
    setSplitEnabled(false);
    setExpenseSource('wallet');
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
    setMoreExpanded(false);
    setExpandedCategoryId(initialCategoryId || null);

    // Requirement 9: for a new expense, do not auto-open wallet sheet; focus Amount instead.
    if (isEditing) {
      setActiveSheet(null);
      const timer = setTimeout(focusAmountInput, 150);
      return () => clearTimeout(timer);
    } else if (!initialIouMode && defaultTxType === 'expense') {
      setActiveSheet(null);
      const timer = setTimeout(focusAmountInput, 150);
      return () => clearTimeout(timer);
    } else if (initialIouMode || defaultTxType === 'transfer') {
      setActiveSheet('wallet');
    } else if (!initialCategoryId) {
      setActiveSheet('category');
    } else {
      setActiveSheet(null);
      const timer = setTimeout(focusAmountInput, 150);
      return () => clearTimeout(timer);
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
    isEditing,
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
    const parsedTax = taxAmountStr.trim() ? parseCleanNumber(taxAmountStr) : 0;

    // 1. Unified form validation table keyed by formKind
    const validationErr = validateForm(formKind, {
      parsedAmount: parsed,
      expenseSource,
      splitEnabled,
      splitPeopleCount: splitPeople.length,
      splitPersonInput,
      splitTotalOwedByOthers: splitSummary.totalOwedByOthers,
      settleIouEnabled,
      selectedDebtId,
      selectedWalletId,
      selectedToWalletId,
      selectedCategoryId,
      iouAction,
      iouUseWallet,
      iouPersonName,
    });
    if (validationErr) {
      Alert.alert(validationErr.title, validationErr.message);
      if (validationErr.focusSheet) {
        animateLayout();
        setActiveSheet(validationErr.focusSheet);
      } else if (validationErr.focusAmount) {
        setTimeout(focusAmountInput, 120);
      }
      return;
    }

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

    if (formKind === 'loan' && iouAction !== 'settle' && iouIncludeMyShare && splitPeople.length <= 1) {
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

    const performSave = async (recordExcessAsCredit: boolean) => {
      if (formKind === 'loan') {
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
              is_paid: true,
              tax_amount: 0,
              note:
                note.trim() ||
                `Loan settlement (${targetDebt.person_name})`,
              media_uri: mediaUri || undefined,
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

        const fallbackName = (splitPersonInput.trim() || iouPersonName.trim());
        const resolvedParticipants =
          splitPeople.length > 0
            ? splitSummary.resolved
            : fallbackName
              ? [
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
                ]
              : [];

        const namesLabel = resolvedParticipants.map((p) => p.name).join(', ');

        if (iouAction === 'lent' && iouIncludeMyShare) {
          const parsedMyShare =
            splitPeople.length > 1
              ? splitSummary.yourShare
              : iouMyShareStr.trim()
                ? parseCleanNumber(iouMyShareStr)
                : Math.round((parsed / 2) * 100) / 100;
          const totalOutOfPocket =
            splitPeople.length > 1
              ? parsed
              : Math.round(
                  (parsedMyShare +
                    resolvedParticipants.reduce((s, p) => s + p.share, 0)) *
                    100
                ) / 100;
          let originTxId: string | undefined;
          if (walletIdForIou && totalOutOfPocket > 0) {
            await onSave({
              amount: totalOutOfPocket,
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
          const expenseWalletId = walletIdForIou || wallets[0]?.id || '';
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

      // Expense with Paid by = They Paid Full or Wallet + Loan
      if (formKind === 'expense' && expenseSource !== 'wallet') {
        const fallbackName = splitPersonInput.trim();
        const resolvedParticipants =
          splitPeople.length > 0
            ? splitSummary.resolved
            : fallbackName
              ? [
                  {
                    name: fallbackName,
                    share:
                      expenseSource === 'borrowed_partial' && splitIncludeMe
                        ? Math.round((parsed / 2) * 100) / 100
                        : parsed,
                  },
                ]
              : [];
        const totalOwed = resolvedParticipants.reduce((s, p) => s + p.share, 0);
        const namesLabel = resolvedParticipants.map((p) => p.name).join(', ');

        if (expenseSource === 'borrowed_partial') {
          const walletIdForPart = selectedWalletId;
          const walletPart = Math.max(0, Math.round((parsed - totalOwed) * 100) / 100);
          if (walletPart > 0) {
            await onSave({
              amount: walletPart,
              wallet_id: walletIdForPart,
              category_id: selectedCategoryId || undefined,
              subcategory_id: selectedSubcategoryId || undefined,
              type: 'expense',
              currency,
              date: dateStr,
              time: timeStr,
              is_paid: true,
              tax_amount: parsedTax > 0 ? parsedTax : 0,
              note: note.trim()
                ? `${note.trim()} (My part; ${namesLabel} paid ${formatCurrency(totalOwed, currency)})`
                : `My part (${namesLabel} paid ${formatCurrency(totalOwed, currency)})`,
              media_uri: mediaUri || undefined,
            });
          }

          let loanTxId: string | undefined;
          if (totalOwed > 0) {
            await onSave({
              amount: totalOwed,
              wallet_id: walletIdForPart,
              category_id: selectedCategoryId || undefined,
              subcategory_id: selectedSubcategoryId || undefined,
              type: 'expense',
              currency,
              date: dateStr,
              time: timeStr,
              is_paid: false,
              tax_amount: 0,
              note: note.trim()
                ? `${note.trim()} (Paid by ${namesLabel})`
                : `Paid by ${namesLabel}`,
            });
            loanTxId =
              isEditing && initialTransactionId
                ? initialTransactionId
                : getLastCreatedTransactionId() || undefined;
          }

          for (const participant of resolvedParticipants) {
            if (participant.share > 0) {
              await addDebt({
                type: 'borrowed',
                person_name: participant.name,
                amount: participant.share,
                currency,
                date: dateStr,
                wallet_id: walletIdForPart,
                origin_transaction_id: loanTxId,
                note: note.trim() || `Paid by ${participant.name}`,
              });
            }
          }
          onClose();
          return;
        }

        // Requirement 9: They Paid Full -> no selectedWalletId required; reuse Loan iouUseWallet pattern
        // Note: transactions.wallet_id is NOT NULL in schema, so pass wallets[0]?.id || '' with is_paid: false
        // (addTransaction only updates wallet balance when is_paid is true); debts.wallet_id stays undefined.
        const schemaBoundaryWalletId = wallets[0]?.id || '';
        let loanTxId: string | undefined;
        if (schemaBoundaryWalletId) {
          await onSave({
            amount: parsed,
            wallet_id: schemaBoundaryWalletId,
            category_id: selectedCategoryId || undefined,
            subcategory_id: selectedSubcategoryId || undefined,
            type: 'expense',
            currency,
            date: dateStr,
            time: timeStr,
            is_paid: false,
            tax_amount: parsedTax > 0 ? parsedTax : 0,
            note: note.trim()
              ? `${note.trim()} (Paid by ${namesLabel})`
              : `Paid by ${namesLabel}`,
            media_uri: mediaUri || undefined,
          });
          loanTxId =
            isEditing && initialTransactionId
              ? initialTransactionId
              : getLastCreatedTransactionId() || undefined;
        }

        for (const participant of resolvedParticipants) {
          if (participant.share > 0) {
            await addDebt({
              type: 'borrowed',
              person_name: participant.name,
              amount: participant.share,
              currency,
              date: dateStr,
              wallet_id: undefined,
              origin_transaction_id: loanTxId,
              note: note.trim() || `Paid by ${participant.name}`,
            });
          }
        }
        onClose();
        return;
      }

      // Standard Expense / Income / Transfer
      await onSave({
        amount: parsed,
        wallet_id: selectedWalletId,
        to_wallet_id: formKind === 'transfer' ? selectedToWalletId : undefined,
        category_id: formKind === 'transfer' ? undefined : selectedCategoryId || undefined,
        subcategory_id: formKind === 'transfer' ? undefined : selectedSubcategoryId || undefined,
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

      if (formKind === 'expense' && splitEnabled && splitSummary.resolved.length > 0) {
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
              wallet_id: selectedWalletId,
              origin_transaction_id: originTxId,
              note: splitNote,
            });
          }
        }
      }

      if (formKind === 'income' && settleIouEnabled && selectedDebtId) {
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
      formKind === 'loan' && iouAction === 'settle'
        ? selectedDebtId
        : formKind === 'income' && settleIouEnabled
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
          const excessLabel = formatCurrency(unabsorbedExcess, targetDebt.currency || currency);
          const absorbedLabel =
            otherOpenTotal > 0.009
              ? `After settling this loan and ${formatCurrency(otherOpenTotal, targetDebt.currency || currency)} of ${targetDebt.person_name}'s other open loans, ${excessLabel} remains.`
              : `This payment exceeds ${targetDebt.person_name}'s loan by ${excessLabel}.`;
          Alert.alert(
            'Payment Exceeds Loan',
            `${absorbedLabel} How should we record the extra ${excessLabel}?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Tip / Extra (No Loan)',
                onPress: () => {
                  performSave(false);
                },
              },
              {
                text:
                  targetDebt.type === 'lent'
                    ? `Credit (I Owe ${targetDebt.person_name})`
                    : `Credit (${targetDebt.person_name} Owes Me)`,
                onPress: () => {
                  performSave(true);
                },
              },
            ]
          );
          return;
        }
      }
    }

    await performSave(false);
  };

  return {
    // Derived mode & state
    formKind,
    currentType,
    setCurrentType,
    isIouMode,
    setIsIouMode,
    iouAction,
    setIouAction,
    iouPersonName,
    setIouPersonName,
    iouUseWallet,
    setIouUseWallet,
    iouIncludeMyShare,
    setIouIncludeMyShare,
    iouMyShareStr,
    setIouMyShareStr,
    iouDueDate,
    setIouDueDate,
    iouDueCalendarVisible,
    setIouDueCalendarVisible,
    amountStr,
    setAmountStr,
    taxAmountStr,
    setTaxAmountStr,
    amountInputRef,
    taxInputRef,
    noteInputRef,
    categorySheetVisible,
    setCategorySheetVisible,
    typeDropdownVisible,
    setTypeDropdownVisible,
    activeSheet,
    setActiveSheet,
    expandedCategoryId,
    setExpandedCategoryId,
    moreExpanded,
    setMoreExpanded,
    selectedWalletId,
    setSelectedWalletId,
    selectedToWalletId,
    setSelectedToWalletId,
    selectedCategoryId,
    setSelectedCategoryId,
    selectedSubcategoryId,
    setSelectedSubcategoryId,
    lastExpenseCatId,
    setLastExpenseCatId,
    lastExpenseSubId,
    setLastExpenseSubId,
    lastIncomeCatId,
    setLastIncomeCatId,
    lastIncomeSubId,
    setLastIncomeSubId,
    quickSubModalVisible,
    setQuickSubModalVisible,
    newSubName,
    setNewSubName,
    note,
    setNote,
    currency,
    setCurrency,
    dateStr,
    setDateStr,
    timeStr,
    setTimeStr,
    isPaid,
    setIsPaid,
    mediaUri,
    setMediaUri,
    cameraVisible,
    setCameraVisible,
    cameraRef,
    splitEnabled,
    setSplitEnabled,
    expenseSource,
    setExpenseSource,
    splitIncludeMe,
    setSplitIncludeMe,
    splitPeople,
    setSplitPeople,
    splitPersonInput,
    setSplitPersonInput,
    settleIouEnabled,
    setSettleIouEnabled,
    selectedDebtId,
    setSelectedDebtId,
    todayStr,
    yesterdayStr,
    displayDate,
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
    setRepeatEndDate,
    endCalendarVisible,
    setEndCalendarVisible,
    reminderEnabled,
    setReminderEnabled,
    calendarVisible,
    setCalendarVisible,
    clockVisible,
    setClockVisible,
    currencyPickerVisible,
    setCurrencyPickerVisible,
    // Derived helpers
    activeCategories,
    selectedCategory,
    selectedSubcategory,
    selectedWallet,
    selectedToWallet,
    knownDebtPeople,
    splitSummary,
    openLentDebts,
    allOpenDebts,
    existingTxSettlements,
    existingLinkedDebts,
    // Handlers
    animateLayout,
    focusAmountInput,
    handleSelectCategory,
    handleSaveQuickSub,
    handlePickFromGallery,
    handleTakePhoto,
    handleCapturePhoto,
    handleAddSplitPerson,
    handlePickFromContacts,
    handleSave,
    undoTransactionDebtSettlements,
  };
}

export type TransactionFormState = ReturnType<typeof useTransactionForm>;
