import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Keyboard,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BillFrequency,
  Category,
  RecurrenceEndType,
  TransactionType,
  Wallet,
} from '../types';
import { parseCleanNumber } from '../utils/format';
import { M3Elevation } from '../theme';
import { AnalogClockModal } from './AnalogClockModal';
import { CalendarPickerModal } from './CalendarPickerModal';
import { CategoryPickerSheet } from './CategoryPickerSheet';
import { FORM_FIELDS, FormSlotKey } from './transaction/formConfig';
import { transactionFormStyles as styles } from './transaction/styles';
import {
  SaveTransactionPayload,
  useTransactionForm,
} from './transaction/useTransactionForm';
import { AmountField } from './transaction/AmountField';
import { WhoField } from './transaction/WhoField';
import { WalletField } from './transaction/WalletField';
import { WhatField } from './transaction/WhatField';
import { WhenField } from './transaction/WhenField';
import { MoreSection } from './transaction/MoreSection';

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
  onSave: (tx: SaveTransactionPayload) => Promise<void>;
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
  const insets = useSafeAreaInsets();
  const insetsRef = useRef(insets);
  insetsRef.current = insets;
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? Math.max(StatusBar.currentHeight || 0, 28) : 0
  );
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 48 : 20);
  const { height: windowHeight } = useWindowDimensions();
  const bottomScrollPadding = Math.max(360, Math.round(windowHeight * 0.52)) + bottomInset;
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  useEffect(() => {
    const handleKeyboardShow = (e: any) => {
      const coordHeight = e?.endCoordinates?.height || 0;
      const screenY = e?.endCoordinates?.screenY;
      const screenHeight = Dimensions.get('screen').height;
      const heightFromScreenBottom =
        screenY != null && screenHeight > screenY ? screenHeight - screenY : 0;
      const effectiveHeight =
        heightFromScreenBottom > 0
          ? heightFromScreenBottom
          : coordHeight > 0
            ? coordHeight + (Platform.OS === 'android' ? insetsRef.current.bottom || 0 : 0)
            : 0;
      try {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      } catch {
        // ignore
      }
      setKeyboardHeight(effectiveHeight);
    };

    const handleKeyboardHide = () => {
      try {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      } catch {
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
      } catch {
        // ignore
      }
    }

    return () => {
      subs.forEach((s) => s.remove());
    };
  }, []);

  useEffect(() => {
    if (!visible) setKeyboardHeight(0);
  }, [visible]);

  const form = useTransactionForm({
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
  });

  const {
    formKind,
    currentType,
    setCurrentType,
    setIsIouMode,
    iouAction,
    setIouAction,
    setIouIncludeMyShare,
    setSplitIncludeMe,
    typeDropdownVisible,
    setTypeDropdownVisible,
    activeSheet,
    setActiveSheet,
    lastExpenseCatId,
    lastExpenseSubId,
    lastIncomeCatId,
    lastIncomeSubId,
    setSelectedCategoryId,
    setSelectedSubcategoryId,
    setLastExpenseCatId,
    setLastExpenseSubId,
    setLastIncomeCatId,
    setLastIncomeSubId,
    selectedWalletId,
    selectedToWalletId,
    setSelectedToWalletId,
    selectedCategoryId,
    selectedSubcategoryId,
    selectedCategory,
    amountStr,
    amountInputRef,
    dateStr,
    setDateStr,
    timeStr,
    setTimeStr,
    repeatEndDate,
    setRepeatEndDate,
    iouDueDate,
    setIouDueDate,
    iouDueCalendarVisible,
    setIouDueCalendarVisible,
    calendarVisible,
    setCalendarVisible,
    endCalendarVisible,
    setEndCalendarVisible,
    clockVisible,
    setClockVisible,
    currency,
    setCurrency,
    currencyPickerVisible,
    setCurrencyPickerVisible,
    categorySheetVisible,
    setCategorySheetVisible,
    cameraVisible,
    setCameraVisible,
    cameraRef,
    handleCapturePhoto,
    quickSubModalVisible,
    setQuickSubModalVisible,
    newSubName,
    setNewSubName,
    handleSaveQuickSub,
    handleSave,
    animateLayout,
  } = form;

  const isExpense = formKind === 'expense';
  const isTransfer = formKind === 'transfer';
  const isLoan = formKind === 'loan';
  const accentColor = isLoan
    ? theme.primary
    : isTransfer
      ? theme.primary
      : isExpense
        ? theme.error
        : theme.success;
  const iouAccent = theme.primary;
  const iouContainer = theme.primaryContainer;
  const onIouContainer = theme.onPrimaryContainer;

  const currentTypeMeta = isLoan
    ? { label: 'Loan', icon: 'handshake-outline', color: iouAccent, container: iouContainer }
    : isTransfer
      ? { label: 'Transfer', icon: 'swap-horizontal', color: theme.primary, container: theme.primaryContainer }
      : isExpense
        ? { label: 'Expense', icon: 'arrow-up-circle', color: theme.error, container: theme.errorContainer }
        : { label: 'Income', icon: 'arrow-down-circle', color: theme.success, container: theme.successContainer };

  const renderSlot = (slot: FormSlotKey) => {
    switch (slot) {
      case 'amount':
        return <AmountField key="amount" form={form} theme={theme} />;
      case 'fee':
        return null;
      case 'who':
        return (
          <WhoField
            key="who"
            form={form}
            theme={theme}
            isEditing={isEditing}
            initialTransactionId={initialTransactionId}
          />
        );
      case 'wallet':
        return (
          <WalletField
            key="wallet"
            form={form}
            wallets={wallets}
            baseCurrency={baseCurrency}
            theme={theme}
          />
        );
      case 'what':
        return (
          <WhatField
            key="what"
            form={form}
            categories={categories}
            theme={theme}
            onManageCategories={onManageCategories}
            onAddSubcategory={onAddSubcategory}
          />
        );
      case 'when':
        return <WhenField key="when" form={form} theme={theme} />;
      case 'more':
        return <MoreSection key="more" form={form} theme={theme} />;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.background, paddingTop: topInset }]}>
        {/* TOP BAR WITH TYPE DROPDOWN */}
        <View style={[styles.topBar, { borderBottomColor: theme.divider, backgroundColor: theme.surface }]}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn} accessibilityLabel="Close">
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.onSurface} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.topBarDropdownBtn,
              { backgroundColor: currentTypeMeta.container, borderColor: currentTypeMeta.color + '44' },
            ]}
            onPress={() => {
              Keyboard.dismiss();
              setTypeDropdownVisible((prev) => !prev);
            }}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Switch transaction type"
          >
            <MaterialCommunityIcons
              name={currentTypeMeta.icon as any}
              size={18}
              color={currentTypeMeta.color}
            />
            <Text style={[styles.topBarDropdownText, { color: theme.onSurface }]}>
              {currentTypeMeta.label}
            </Text>
            <MaterialCommunityIcons
              name={typeDropdownVisible ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={theme.onSurfaceVariant}
            />
          </TouchableOpacity>

          <View style={styles.topBarPlaceholder} />
        </View>

        {/* TYPE DROPDOWN MENU */}
        {typeDropdownVisible && (
          <View style={styles.dropdownBackdropWrap}>
            <TouchableOpacity
              style={StyleSheetBackdrop}
              activeOpacity={1}
              onPress={() => setTypeDropdownVisible(false)}
            />
            <View
              style={[
                styles.typeDropdownMenu,
                {
                  top: topInset + 58,
                  backgroundColor: theme.surface,
                  borderColor: theme.divider,
                },
              ]}
            >
              {(
                [
                  {
                    key: 'expense',
                    label: 'Expense',
                    icon: 'arrow-up-circle',
                    color: theme.error,
                    container: theme.errorContainer,
                  },
                  {
                    key: 'income',
                    label: 'Income',
                    icon: 'arrow-down-circle',
                    color: theme.success,
                    container: theme.successContainer,
                  },
                  {
                    key: 'transfer',
                    label: 'Transfer',
                    icon: 'swap-horizontal',
                    color: theme.primary,
                    container: theme.primaryContainer,
                  },
                  {
                    key: 'iou',
                    label: 'Loan',
                    icon: 'handshake-outline',
                    color: iouAccent,
                    container: iouContainer,
                  },
                ] as const
              ).map((opt) => {
                const isSelected =
                  opt.key === 'iou' ? isLoan : formKind === opt.key;
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
                        setActiveSheet(null);
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
          {/* SLOT 0: MODE (Loan Receive / Pay / Settle) */}
          {isLoan && (
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

          {/* SLOTS 1..7: UNIFIED FORM_FIELDS LOOP */}
          {FORM_FIELDS[formKind].map(renderSlot)}
        </ScrollView>

        {/* DOCKED BOTTOM SAVE BUTTON */}
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
              {isEditing
                ? 'Update Transaction'
                : isLoan
                  ? 'Save Loan'
                  : isTransfer
                    ? 'Save Transfer'
                    : isExpense
                      ? 'Save Expense'
                      : 'Save Income'}
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

        {/* CALENDAR PICKER MODAL (IOU DUE DATE) */}
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
                <Text style={[styles.currencyModalTitle, { color: theme.onSurface }]}>
                  Select Currency
                </Text>
                <ScrollView style={{ maxHeight: 280 }}>
                  {COMMON_CURRENCIES.map((currCode) => {
                    const isCurrSelected = currCode === currency;
                    return (
                      <TouchableOpacity
                        key={currCode}
                        style={[
                          styles.currencyItem,
                          {
                            backgroundColor: isCurrSelected
                              ? theme.primaryContainer
                              : 'transparent',
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
                              color: isCurrSelected
                                ? theme.onPrimaryContainer
                                : theme.onSurface,
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
              <Text style={[styles.quickModalTitle, { color: theme.onSurface }]}>
                New Subcategory
              </Text>
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

const StyleSheetBackdrop = {
  position: 'absolute' as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  backgroundColor: 'rgba(0,0,0,0.22)',
};
