import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Dimensions,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBudget } from '../context/BudgetContext';
import { lightTheme, darkTheme, M3Shape, M3Elevation } from '../theme';
import { getRegularCycleDates, formatCycleDateRange } from '../utils/format';
import { DateRangePickerModal } from './DateRangePickerModal';
import { CycleStartDayCalendar } from './CycleStartDayCalendar';

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling' },
  { code: 'RWF', symbol: 'FRw', name: 'Rwandan Franc' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'CAD', symbol: '$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: '$', name: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'ZMW', symbol: 'ZK', name: 'Zambian Kwacha' },
];

const WALLET_PRESETS = [
  { name: 'Cash', icon: 'cash', color: '#10B981' },
  { name: 'Bank', icon: 'bank', color: '#3B82F6' },
  { name: 'Mobile Money', icon: 'cellphone', color: '#F59E0B' },
  { name: 'Savings', icon: 'piggy-bank', color: '#8B5CF6' },
];

const START_DAY_PRESETS = [
  { label: '1st of Month', day: 1 },
  { label: '15th (Mid-Month)', day: 15 },
  { label: '25th (Pay Day)', day: 25 },
  { label: '28th (Month-End)', day: 28 },
];

export const OnboardingModal: React.FC = () => {
  const { settings, completeOnboarding } = useBudget();
  const isDarkMode = settings.theme_mode === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  useEffect(() => {
    const onShow = (e: any) => {
      const coordHeight = e?.endCoordinates?.height || 0;
      const screenY = e?.endCoordinates?.screenY;
      const screenHeight = Dimensions.get('screen').height;
      const fromBottom = screenY != null && screenHeight > screenY ? screenHeight - screenY : 0;
      setKeyboardHeight(fromBottom > 0 ? fromBottom : coordHeight);
    };
    const onHide = () => setKeyboardHeight(0);

    const s1 = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', onShow);
    const s2 = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', onHide);
    return () => {
      s1.remove();
      s2.remove();
    };
  }, []);

  // 4-step wizard: 0: Currency, 1: Wallet, 2: Cycle Calendar, 3: Cycle Targets
  const [currentStep, setCurrentStep] = useState<number>(0);

  // Step 0: Currency
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');
  const [currencySearch, setCurrencySearch] = useState<string>('');

  // Step 1: Wallets (Individual balances per wallet)
  const [selectedWalletName, setSelectedWalletName] = useState<string>('Cash');
  const [walletBalances, setWalletBalances] = useState<Record<string, string>>({
    Cash: '',
    Bank: '',
    'Mobile Money': '',
    Savings: '',
  });

  const handleWalletNameChange = (newName: string) => {
    const oldName = selectedWalletName;
    setSelectedWalletName(newName);
    if (oldName !== newName) {
      setWalletBalances((prev) => {
        const next = { ...prev };
        next[newName] = next[oldName] || '';
        return next;
      });
    }
  };

  const handleBalanceChange = (val: string) => {
    setWalletBalances((prev) => ({
      ...prev,
      [selectedWalletName]: val,
    }));
  };

  // Step 2: Cycle Management
  const [cycleMode, setCycleMode] = useState<'regular' | 'custom'>('regular');
  const [cycleStartDayStr, setCycleStartDayStr] = useState<string>('1');
  const [cycleBalanceMode, setCycleBalanceMode] = useState<'monthly' | 'accumulated'>('monthly');

  // Custom cycle dates
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const oneMonthLaterStr = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const [customCycleName, setCustomCycleName] = useState<string>('Pay Period 1');
  const [customStartDate, setCustomStartDate] = useState<string>(todayStr);
  const [customEndDate, setCustomEndDate] = useState<string>(oneMonthLaterStr);
  const [isRangePickerOpen, setIsRangePickerOpen] = useState<boolean>(false);

  // Step 3: Targets
  const [budgetCap, setBudgetCap] = useState<string>('');
  const [incomeGoal, setIncomeGoal] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const isVisible = !settings.onboarding_completed;

  const filteredCurrencies = CURRENCIES.filter(
    (c) =>
      c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
      c.name.toLowerCase().includes(currencySearch.toLowerCase())
  );

  // Calculate regular cycle dates live based on selected start day
  const activeCyclePreview = useMemo(() => {
    const dayNum = parseInt(cycleStartDayStr, 10);
    const validDay = !isNaN(dayNum) ? Math.min(31, Math.max(1, dayNum)) : 1;
    if (cycleMode === 'custom') {
      const name = customCycleName.trim() || formatCycleDateRange(customStartDate, customEndDate);
      return { startDate: customStartDate, endDate: customEndDate, name };
    }
    return getRegularCycleDates(validDay);
  }, [cycleMode, cycleStartDayStr, customCycleName, customStartDate, customEndDate]);

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkipToNext = () => {
    if (currentStep === 1) {
      // Clear wallet fields and advance to Step 2
      setWalletBalances({
        Cash: '',
        Bank: '',
        'Mobile Money': '',
        Savings: '',
      });
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // Default to regular calendar on 1st and advance to Step 3
      setCycleMode('regular');
      setCycleStartDayStr('1');
      setCycleBalanceMode('monthly');
      setCurrentStep(3);
    } else if (currentStep === 3) {
      // Skip targets and finish
      setBudgetCap('');
      setIncomeGoal('');
      handleFinish();
    }
  };

  const handleFinish = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const bCap = parseFloat(budgetCap);
      const iGoal = parseFloat(incomeGoal);
      const dayNum = parseInt(cycleStartDayStr, 10);
      const validDay = !isNaN(dayNum) ? Math.min(31, Math.max(1, dayNum)) : 1;

      // Extract numeric balances for all configured wallets
      const parsedWalletBalances: Record<string, number> = {};
      for (const [wName, bStr] of Object.entries(walletBalances)) {
        const parsed = parseFloat(bStr);
        if (!isNaN(parsed) && parsed > 0) {
          parsedWalletBalances[wName] = parsed;
        }
      }

      await completeOnboarding({
        currency: selectedCurrency,
        walletBalances: parsedWalletBalances,
        firstWalletName: selectedWalletName.trim() || undefined,
        startingBalance: parsedWalletBalances[selectedWalletName] || undefined,
        budgetCap: !isNaN(bCap) ? bCap : undefined,
        incomeGoal: !isNaN(iGoal) ? iGoal : undefined,
        cycleMode,
        cycleMonthStartDay: validDay,
        cycleBalanceMode,
        customCycleStartDate: cycleMode === 'custom' ? customStartDate : undefined,
        customCycleEndDate: cycleMode === 'custom' ? customEndDate : undefined,
        customCycleName: cycleMode === 'custom' ? customCycleName.trim() || undefined : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isVisible && !isRangePickerOpen) return null;

  const currentCurrencyObj = CURRENCIES.find((c) => c.code === selectedCurrency) || CURRENCIES[0];

  return (
    <>
      <Modal
        visible={isVisible && !isRangePickerOpen}
        animationType="slide"
        statusBarTranslucent={true}
        presentationStyle="fullScreen"
      >
        <View
          style={[
            styles.safeArea,
            {
              backgroundColor: theme.background,
              paddingTop: topInset,
            },
          ]}
        >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          {/* Top Progress & Navigation Header */}
          <View style={[styles.topNav, { borderBottomColor: theme.divider, backgroundColor: theme.surface }]}>
            <View style={styles.topNavLeft}>
              {currentStep > 0 ? (
                <TouchableOpacity
                  onPress={handleBack}
                  style={[styles.navIconBtn, { backgroundColor: theme.pillBg }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons name="arrow-left" size={20} color={theme.onSurface} />
                </TouchableOpacity>
              ) : (
                <View style={styles.navPlaceholder} />
              )}
            </View>

            {/* Segmented Progress Indicators (4 Steps) */}
            <View style={styles.progressSegmentsWrap}>
              {[0, 1, 2, 3].map((stepIdx) => {
                const isCompleted = stepIdx < currentStep;
                const isCurrent = stepIdx === currentStep;
                return (
                  <View
                    key={stepIdx}
                    style={[
                      styles.progressSegment,
                      {
                        backgroundColor: isCurrent
                          ? theme.primary
                          : isCompleted
                          ? theme.primaryContainer
                          : theme.outlineVariant,
                      },
                    ]}
                  />
                );
              })}
            </View>

            <View style={styles.topNavRight}>
              {currentStep > 0 ? (
                <TouchableOpacity onPress={handleSkipToNext} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={[styles.skipBtnText, { color: theme.onSurfaceVariant }]}>Skip</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.navPlaceholder} />
              )}
            </View>
          </View>

          {/* Step Contents */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* STEP 1: CHOOSE CURRENCY */}
            {currentStep === 0 && (
              <View style={styles.stepContainer}>
                {/* Branding Hero */}
                <View style={styles.heroSection}>
                  <Image
                    source={require('../../assets/icon.png')}
                    style={styles.onboardingLogoImage}
                    resizeMode="cover"
                  />
                  <Text style={[styles.welcomeTitle, { color: theme.onSurface }]}>Welcome to just budget</Text>
                  <Text style={[styles.welcomeSubtitle, { color: theme.onSurfaceVariant }]}>
                    Private, offline-first personal finance. Choose your primary base currency:
                  </Text>
                </View>

                {/* Selected Currency Banner */}
                <View
                  style={[
                    styles.selectedCurrencyCard,
                    { backgroundColor: theme.primaryContainer, borderColor: theme.primary },
                  ]}
                >
                  <View style={styles.selectedCurrencyLeft}>
                    <Text style={[styles.selectedCurrencySymbol, { color: theme.onPrimaryContainer }]}>
                      {currentCurrencyObj.symbol}
                    </Text>
                    <View>
                      <Text style={[styles.selectedCurrencyCode, { color: theme.onPrimaryContainer }]}>
                        {currentCurrencyObj.code} — {currentCurrencyObj.name}
                      </Text>
                      <Text style={[styles.selectedCurrencyHint, { color: theme.onPrimaryContainer }]}>
                        Selected as base currency
                      </Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons name="check-circle" size={24} color={theme.primary} />
                </View>

                {/* Search Box */}
                <View style={[styles.searchBox, { backgroundColor: theme.pillBg, borderColor: theme.outlineVariant }]}>
                  <MaterialCommunityIcons name="magnify" size={20} color={theme.onSurfaceVariant} />
                  <TextInput
                    style={[styles.searchInput, { color: theme.onSurface }]}
                    placeholder="Search currency (e.g. USD, TZS, EUR)"
                    placeholderTextColor={theme.onSurfaceVariant}
                    value={currencySearch}
                    onChangeText={setCurrencySearch}
                  />
                  {currencySearch.length > 0 && (
                    <TouchableOpacity onPress={() => setCurrencySearch('')}>
                      <MaterialCommunityIcons name="close-circle" size={18} color={theme.onSurfaceVariant} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Currency Grid */}
                <View style={styles.currencyGrid}>
                  {filteredCurrencies.map((c) => {
                    const isSelected = selectedCurrency === c.code;
                    return (
                      <TouchableOpacity
                        key={c.code}
                        style={[
                          styles.currencyPill,
                          {
                            backgroundColor: isSelected ? theme.primaryContainer : theme.pillBg,
                            borderColor: isSelected ? theme.primary : 'transparent',
                          },
                        ]}
                        onPress={() => setSelectedCurrency(c.code)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.currencyPillLeft}>
                          <Text
                            style={[
                              styles.currencyCode,
                              { color: isSelected ? theme.onPrimaryContainer : theme.onSurface },
                            ]}
                          >
                            {c.code}
                          </Text>
                          <Text style={[styles.currencyName, { color: theme.onSurfaceVariant }]} numberOfLines={1}>
                            {c.name}
                          </Text>
                        </View>
                        <View style={styles.currencyPillRight}>
                          <Text style={[styles.currencySymbol, { color: theme.primary }]}>{c.symbol}</Text>
                          {isSelected && (
                            <MaterialCommunityIcons name="check-circle" size={16} color={theme.primary} />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* STEP 2: REGISTER WALLETS (OPTIONAL) */}
            {currentStep === 1 && (
              <View style={styles.stepContainer}>
                <View style={styles.stepHeroBadge}>
                  <View style={[styles.stepIconCircle, { backgroundColor: theme.primaryContainer }]}>
                    <MaterialCommunityIcons name="wallet-outline" size={32} color={theme.primary} />
                  </View>
                  <Text style={[styles.stepHeaderTitle, { color: theme.onSurface }]}>Register Wallets</Text>
                  <Text style={[styles.stepHeaderSubtitle, { color: theme.onSurfaceVariant }]}>
                    Set up your primary wallets and starting balances. Select each wallet preset to configure its balance.
                  </Text>
                </View>

                {/* Quick Presets */}
                <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant, marginTop: 12 }]}>
                  QUICK PRESETS (TAP TO SELECT & SET BALANCE)
                </Text>
                <View style={styles.presetsRow}>
                  {WALLET_PRESETS.map((p) => {
                    const isPicked = selectedWalletName.toLowerCase() === p.name.toLowerCase();
                    const balStr = walletBalances[p.name];
                    const hasBal = balStr && parseFloat(balStr) > 0;
                    return (
                      <TouchableOpacity
                        key={p.name}
                        style={[
                          styles.presetChip,
                          {
                            backgroundColor: isPicked ? theme.primaryContainer : theme.pillBg,
                            borderColor: isPicked ? theme.primary : 'transparent',
                          },
                        ]}
                        onPress={() => setSelectedWalletName(p.name)}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons
                          name={p.icon as any}
                          size={16}
                          color={isPicked ? theme.onPrimaryContainer : p.color}
                        />
                        <Text
                          style={[
                            styles.presetChipText,
                            {
                              color: isPicked ? theme.onPrimaryContainer : theme.onSurface,
                              fontWeight: isPicked ? '700' : '500',
                            },
                          ]}
                        >
                          {p.name}
                        </Text>
                        {hasBal && (
                          <View
                            style={[
                              styles.presetBadge,
                              {
                                backgroundColor: isPicked ? theme.primary : theme.cardBg,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.presetBadgeText,
                                {
                                  color: isPicked ? '#FFFFFF' : theme.primary,
                                },
                              ]}
                            >
                              {currentCurrencyObj.symbol}{balStr}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Wallet Form Card */}
                <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }, M3Elevation.level1]}>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>Wallet Name</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                      placeholder="e.g. Cash, Bank Account, Mobile Money"
                      placeholderTextColor={theme.onSurfaceVariant}
                      value={selectedWalletName}
                      onChangeText={handleWalletNameChange}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>
                      Starting Balance for {selectedWalletName} ({selectedCurrency})
                    </Text>
                    <View style={[styles.balanceInputWrap, { backgroundColor: theme.pillBg }]}>
                      <Text style={[styles.currencyPrefixText, { color: theme.primary }]}>
                        {currentCurrencyObj.symbol}
                      </Text>
                      <TextInput
                        style={[styles.balanceInput, { color: theme.onSurface }]}
                        placeholder="0.00"
                        placeholderTextColor={theme.onSurfaceVariant}
                        keyboardType="decimal-pad"
                        value={walletBalances[selectedWalletName] || ''}
                        onChangeText={handleBalanceChange}
                      />
                    </View>
                    <Text style={[styles.fieldHint, { color: theme.onSurfaceVariant }]}>
                      Each wallet preset saves its own starting balance independently.
                    </Text>
                  </View>
                </View>

                {/* CONFIGURED WALLETS SUMMARY CARD */}
                {Object.entries(walletBalances).some(([_, b]) => parseFloat(b) > 0) && (
                  <View style={[styles.walletsSummaryCard, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
                    <View style={styles.summaryTitleRow}>
                      <MaterialCommunityIcons name="wallet-outline" size={16} color={theme.primary} />
                      <Text style={[styles.summaryTitle, { color: theme.onSurfaceVariant }]}>
                        CONFIGURED WALLET BALANCES
                      </Text>
                    </View>
                    <View style={styles.summaryList}>
                      {Object.entries(walletBalances).map(([name, bStr]) => {
                        const val = parseFloat(bStr);
                        if (isNaN(val) || val <= 0) return null;
                        const isSelected = selectedWalletName.toLowerCase() === name.toLowerCase();
                        return (
                          <TouchableOpacity
                            key={name}
                            style={[
                              styles.summaryPill,
                              {
                                backgroundColor: isSelected ? theme.primaryContainer : theme.pillBg,
                                borderColor: isSelected ? theme.primary : 'transparent',
                              },
                            ]}
                            onPress={() => setSelectedWalletName(name)}
                          >
                            <Text
                              style={[
                                styles.summaryPillName,
                                { color: isSelected ? theme.onPrimaryContainer : theme.onSurface },
                              ]}
                            >
                              {name}:
                            </Text>
                            <Text
                              style={[
                                styles.summaryPillVal,
                                { color: isSelected ? theme.primary : theme.onSurface },
                              ]}
                            >
                              {currentCurrencyObj.symbol}{bStr}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* STEP 3: CONFIGURE BUDGET CYCLE (NEW!) */}
            {currentStep === 2 && (
              <View style={styles.stepContainer}>
                <View style={styles.stepHeroBadge}>
                  <View style={[styles.stepIconCircle, { backgroundColor: theme.primaryContainer }]}>
                    <MaterialCommunityIcons name="calendar-sync-outline" size={32} color={theme.primary} />
                  </View>
                  <Text style={[styles.stepHeaderTitle, { color: theme.onSurface }]}>Budget Cycle & Calendar</Text>
                  <Text style={[styles.stepHeaderSubtitle, { color: theme.onSurfaceVariant }]}>
                    Choose how your cycles recur and when allowances calculate.
                  </Text>
                </View>

                {/* Live Cycle Preview Banner */}
                <View
                  style={[
                    styles.cyclePreviewBanner,
                    { backgroundColor: theme.primaryContainer, borderColor: theme.primary },
                  ]}
                >
                  <MaterialCommunityIcons name="calendar-check" size={22} color={theme.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cyclePreviewLabel, { color: theme.onPrimaryContainer }]}>
                      INITIAL ACTIVE CYCLE
                    </Text>
                    <Text style={[styles.cyclePreviewName, { color: theme.onPrimaryContainer }]}>
                      {activeCyclePreview.name}
                    </Text>
                    <Text style={[styles.cyclePreviewDates, { color: theme.onPrimaryContainer }]}>
                      {activeCyclePreview.startDate} ➔ {activeCyclePreview.endDate}
                    </Text>
                  </View>
                </View>

                {/* Mode Selector Tabs */}
                <View style={[styles.modeTabsRow, { backgroundColor: theme.pillBg }]}>
                  <TouchableOpacity
                    style={[
                      styles.modeTab,
                      cycleMode === 'regular' && { backgroundColor: theme.primaryContainer },
                    ]}
                    onPress={() => setCycleMode('regular')}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name="calendar-month-outline"
                      size={18}
                      color={cycleMode === 'regular' ? theme.onPrimaryContainer : theme.onSurfaceVariant}
                    />
                    <Text
                      style={[
                        styles.modeTabText,
                        {
                          color: cycleMode === 'regular' ? theme.onPrimaryContainer : theme.onSurfaceVariant,
                          fontWeight: cycleMode === 'regular' ? '700' : '500',
                        },
                      ]}
                    >
                      Regular Monthly
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modeTab,
                      cycleMode === 'custom' && { backgroundColor: theme.primaryContainer },
                    ]}
                    onPress={() => setCycleMode('custom')}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name="calendar-range"
                      size={18}
                      color={cycleMode === 'custom' ? theme.onPrimaryContainer : theme.onSurfaceVariant}
                    />
                    <Text
                      style={[
                        styles.modeTabText,
                        {
                          color: cycleMode === 'custom' ? theme.onPrimaryContainer : theme.onSurfaceVariant,
                          fontWeight: cycleMode === 'custom' ? '700' : '500',
                        },
                      ]}
                    >
                      Custom Periods
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Mode 1: Regular Monthly Configuration */}
                {cycleMode === 'regular' && (
                  <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }, M3Elevation.level1]}>
                    <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>
                      MONTH START DAY (SELECT ON CALENDAR)
                    </Text>
                    <Text style={[styles.fieldHint, { color: theme.onSurfaceVariant, marginBottom: 10 }]}>
                      Choose when your cycle begins by tapping any date on the calendar below.
                    </Text>

                    <CycleStartDayCalendar
                      selectedDay={parseInt(cycleStartDayStr, 10) || 1}
                      onSelectDay={(day) => setCycleStartDayStr(day.toString())}
                      theme={theme}
                      isDarkMode={isDarkMode}
                    />

                    <View style={[styles.fieldDivider, { backgroundColor: theme.divider }]} />

                    {/* Balance Carryover Mode */}
                    <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>
                      ALLOWANCE CARRYOVER MODE
                    </Text>

                    <View style={styles.balanceModeRow}>
                      <TouchableOpacity
                        style={[
                          styles.balanceModeCard,
                          {
                            backgroundColor: cycleBalanceMode === 'monthly' ? theme.primaryContainer : theme.pillBg,
                            borderColor: cycleBalanceMode === 'monthly' ? theme.primary : 'transparent',
                          },
                        ]}
                        onPress={() => setCycleBalanceMode('monthly')}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons
                          name="restart"
                          size={22}
                          color={cycleBalanceMode === 'monthly' ? theme.onPrimaryContainer : theme.onSurfaceVariant}
                        />
                        <Text
                          style={[
                            styles.balanceModeTitle,
                            { color: cycleBalanceMode === 'monthly' ? theme.onPrimaryContainer : theme.onSurface },
                          ]}
                        >
                          Monthly Reset
                        </Text>
                        <Text
                          style={[
                            styles.balanceModeSub,
                            { color: cycleBalanceMode === 'monthly' ? theme.onPrimaryContainer : theme.onSurfaceVariant },
                          ]}
                        >
                          Allowance & budget start fresh each cycle
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.balanceModeCard,
                          {
                            backgroundColor: cycleBalanceMode === 'accumulated' ? theme.primaryContainer : theme.pillBg,
                            borderColor: cycleBalanceMode === 'accumulated' ? theme.primary : 'transparent',
                          },
                        ]}
                        onPress={() => setCycleBalanceMode('accumulated')}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons
                          name="trending-up"
                          size={22}
                          color={cycleBalanceMode === 'accumulated' ? theme.onPrimaryContainer : theme.onSurfaceVariant}
                        />
                        <Text
                          style={[
                            styles.balanceModeTitle,
                            { color: cycleBalanceMode === 'accumulated' ? theme.onPrimaryContainer : theme.onSurface },
                          ]}
                        >
                          Accumulated
                        </Text>
                        <Text
                          style={[
                            styles.balanceModeSub,
                            { color: cycleBalanceMode === 'accumulated' ? theme.onPrimaryContainer : theme.onSurfaceVariant },
                          ]}
                        >
                          Unspent allowance rolls into next cycle
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Mode 2: Custom Periods Configuration */}
                {cycleMode === 'custom' && (
                  <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }, M3Elevation.level1]}>
                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>PERIOD NAME</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                        placeholder="e.g. Pay Period 1 or Sprint 1"
                        placeholderTextColor={theme.onSurfaceVariant}
                        value={customCycleName}
                        onChangeText={setCustomCycleName}
                      />
                    </View>

                    <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant, marginTop: 4 }]}>
                      PERIOD DATES (CALENDAR RANGE)
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.dateRangePickerCard,
                        {
                          backgroundColor: theme.pillBg,
                          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : theme.divider,
                        },
                      ]}
                      onPress={() => setIsRangePickerOpen(true)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.dateRangePickerLeft}>
                        <View style={[styles.dateRangeIconWrap, { backgroundColor: theme.primaryContainer }]}>
                          <MaterialCommunityIcons name="calendar-range" size={20} color={theme.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.dateRangePickerRangeText, { color: theme.onSurface }]}>
                            {customStartDate && customEndDate
                              ? formatCycleDateRange(customStartDate, customEndDate)
                              : 'Tap to select date range'}
                          </Text>
                          <Text style={[styles.dateRangePickerSubText, { color: theme.onSurfaceVariant }]}>
                            {customStartDate && customEndDate
                              ? `${customStartDate} to ${customEndDate}`
                              : 'Select start and end dates on calendar'}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.changeDatesBadge, { backgroundColor: theme.primaryContainer }]}>
                        <Text style={[styles.changeDatesBadgeText, { color: theme.onPrimaryContainer }]}>
                          Pick Dates
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* STEP 4: BUDGET TARGETS (OPTIONAL) */}
            {currentStep === 3 && (
              <View style={styles.stepContainer}>
                <View style={styles.stepHeroBadge}>
                  <View style={[styles.stepIconCircle, { backgroundColor: theme.primaryContainer }]}>
                    <MaterialCommunityIcons name="bullseye-arrow" size={32} color={theme.primary} />
                  </View>
                  <Text style={[styles.stepHeaderTitle, { color: theme.onSurface }]}>Cycle Budget Targets</Text>
                  <Text style={[styles.stepHeaderSubtitle, { color: theme.onSurfaceVariant }]}>
                    Plan your cycle by setting an overall spending budget cap or monthly income goal.
                  </Text>
                </View>

                {/* Target Cycle Info Pill */}
                <View style={[styles.targetCyclePill, { backgroundColor: theme.pillBg }]}>
                  <MaterialCommunityIcons name="calendar-clock" size={16} color={theme.primary} />
                  <Text style={[styles.targetCycleText, { color: theme.onSurface }]}>
                    Configured Cycle: <Text style={{ fontWeight: '800' }}>{activeCyclePreview.name}</Text>
                  </Text>
                </View>

                {/* Targets Form Cards */}
                <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }, M3Elevation.level1]}>
                  {/* Budget Cap */}
                  <View style={styles.targetRow}>
                    <View style={[styles.targetIconCircle, { backgroundColor: theme.errorContainer }]}>
                      <MaterialCommunityIcons name="arrow-down-bold-circle-outline" size={22} color={theme.error} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.targetTitle, { color: theme.onSurface }]}>Spending Budget Cap</Text>
                      <Text style={[styles.targetSub, { color: theme.onSurfaceVariant }]}>
                        Maximum you intend to spend during this cycle.
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.balanceInputWrap, { backgroundColor: theme.pillBg, marginBottom: 16 }]}>
                    <Text style={[styles.currencyPrefixText, { color: theme.error }]}>
                      {currentCurrencyObj.symbol}
                    </Text>
                    <TextInput
                      style={[styles.balanceInput, { color: theme.onSurface }]}
                      placeholder="e.g. 1500"
                      placeholderTextColor={theme.onSurfaceVariant}
                      keyboardType="decimal-pad"
                      value={budgetCap}
                      onChangeText={setBudgetCap}
                    />
                  </View>

                  <View style={[styles.fieldDivider, { backgroundColor: theme.divider }]} />

                  {/* Income Goal */}
                  <View style={styles.targetRow}>
                    <View style={[styles.targetIconCircle, { backgroundColor: theme.successContainer }]}>
                      <MaterialCommunityIcons name="arrow-up-bold-circle-outline" size={22} color={theme.success} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.targetTitle, { color: theme.onSurface }]}>Monthly Income Goal</Text>
                      <Text style={[styles.targetSub, { color: theme.onSurfaceVariant }]}>
                        Expected revenue, salary, or inflow target.
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.balanceInputWrap, { backgroundColor: theme.pillBg }]}>
                    <Text style={[styles.currencyPrefixText, { color: theme.success }]}>
                      {currentCurrencyObj.symbol}
                    </Text>
                    <TextInput
                      style={[styles.balanceInput, { color: theme.onSurface }]}
                      placeholder="e.g. 2000"
                      placeholderTextColor={theme.onSurfaceVariant}
                      keyboardType="decimal-pad"
                      value={incomeGoal}
                      onChangeText={setIncomeGoal}
                    />
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Sticky Bottom Actions Bar */}
          <View
            style={[
              styles.bottomBar,
              {
                backgroundColor: theme.surface,
                borderTopColor: theme.divider,
                paddingBottom: keyboardHeight > 0 ? keyboardHeight + 8 : Math.max(insets.bottom + 8, 16),
              },
            ]}
          >
            {currentStep < 3 ? (
              <TouchableOpacity
                style={[styles.primaryActionBtn, { backgroundColor: theme.primary }, M3Elevation.level2]}
                onPress={handleNext}
                activeOpacity={0.85}
              >
                <Text style={[styles.primaryActionBtnText, { color: theme.onPrimary }]}>
                  {currentStep === 0
                    ? `Continue with ${selectedCurrency}`
                    : currentStep === 1
                    ? 'Continue to Budget Cycle'
                    : 'Continue to Cycle Targets'}
                </Text>
                <MaterialCommunityIcons name="arrow-right" size={20} color={theme.onPrimary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.primaryActionBtn, { backgroundColor: theme.primary }, M3Elevation.level2]}
                onPress={handleFinish}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="check" size={20} color={theme.onPrimary} />
                <Text style={[styles.primaryActionBtnText, { color: theme.onPrimary }]}>
                  {isSubmitting ? 'Setting Up...' : `Start Budgeting with ${selectedCurrency}`}
                </Text>
              </TouchableOpacity>
            )}

            {currentStep > 0 && (
              <TouchableOpacity
                style={styles.skipSecondaryBtn}
                onPress={handleSkipToNext}
                activeOpacity={0.7}
              >
                <Text style={[styles.skipSecondaryBtnText, { color: theme.onSurfaceVariant }]}>
                  {currentStep === 1
                    ? 'Skip Wallet Setup'
                    : currentStep === 2
                    ? 'Use Default Cycle (1st of month)'
                    : 'Skip & Finish Setup'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>

    <DateRangePickerModal
      visible={isRangePickerOpen}
      initialStartDate={customStartDate}
      initialEndDate={customEndDate}
      onClose={() => setIsRangePickerOpen(false)}
      onSave={(newStart, newEnd) => {
        setCustomStartDate(newStart);
        setCustomEndDate(newEnd);
        if (!customCycleName || customCycleName === 'Pay Period 1' || customCycleName.includes('–')) {
          setCustomCycleName(formatCycleDateRange(newStart, newEnd));
        }
        setIsRangePickerOpen(false);
      }}
    />
  </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topNav: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  topNavLeft: {
    width: 44,
    alignItems: 'flex-start',
  },
  topNavRight: {
    width: 44,
    alignItems: 'flex-end',
  },
  navPlaceholder: {
    width: 32,
    height: 32,
  },
  navIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressSegmentsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  progressSegment: {
    height: 4,
    flex: 1,
    borderRadius: 2,
    maxWidth: 48,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  stepContainer: {
    flex: 1,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 6,
  },
  onboardingLogoImage: {
    width: 64,
    height: 64,
    borderRadius: 16,
    marginBottom: 14,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  welcomeSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  stepHeroBadge: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 6,
  },
  stepIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  stepHeaderTitle: {
    fontSize: 21,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 4,
  },
  stepHeaderSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  selectedCurrencyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: M3Shape.large,
    borderWidth: 1.5,
    marginBottom: 14,
  },
  selectedCurrencyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedCurrencySymbol: {
    fontSize: 22,
    fontWeight: '900',
  },
  selectedCurrencyCode: {
    fontSize: 15,
    fontWeight: '800',
  },
  selectedCurrencyHint: {
    fontSize: 11,
    opacity: 0.8,
    marginTop: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: M3Shape.full,
    paddingHorizontal: 14,
    height: 44,
    marginBottom: 14,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  currencyGrid: {
    gap: 8,
  },
  currencyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: M3Shape.medium,
    borderWidth: 1.5,
  },
  currencyPillLeft: {
    flex: 1,
  },
  currencyCode: {
    fontSize: 15,
    fontWeight: '800',
  },
  currencyName: {
    fontSize: 12,
    marginTop: 2,
  },
  currencyPillRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencySymbol: {
    fontSize: 15,
    fontWeight: '700',
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    marginTop: 6,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: M3Shape.full,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 13,
  },
  presetBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 2,
  },
  presetBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  walletsSummaryCard: {
    borderRadius: M3Shape.large,
    padding: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  summaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  summaryList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  summaryPillName: {
    fontSize: 12,
    fontWeight: '600',
  },
  summaryPillVal: {
    fontSize: 12,
    fontWeight: '800',
  },
  card: {
    borderRadius: M3Shape.extraLarge,
    padding: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderRadius: M3Shape.medium,
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: '500',
  },
  balanceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: M3Shape.medium,
    paddingHorizontal: 14,
  },
  currencyPrefixText: {
    fontSize: 16,
    fontWeight: '800',
    marginRight: 8,
  },
  balanceInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  fieldHint: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
    marginLeft: 2,
  },
  cyclePreviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: M3Shape.large,
    borderWidth: 1.5,
    marginBottom: 14,
    gap: 12,
  },
  cyclePreviewLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  cyclePreviewName: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  cyclePreviewDates: {
    fontSize: 12,
    opacity: 0.85,
    marginTop: 1,
  },
  modeTabsRow: {
    flexDirection: 'row',
    borderRadius: M3Shape.full,
    padding: 4,
    marginBottom: 14,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: M3Shape.full,
  },
  modeTabText: {
    fontSize: 13,
  },
  startDayChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  startDayChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: M3Shape.full,
    borderWidth: 1,
  },
  startDayChipText: {
    fontSize: 12,
  },
  balanceModeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  balanceModeCard: {
    flex: 1,
    padding: 12,
    borderRadius: M3Shape.large,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 4,
  },
  balanceModeTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  balanceModeSub: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },
  targetCyclePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: M3Shape.full,
    marginBottom: 14,
    alignSelf: 'flex-start',
  },
  targetCycleText: {
    fontSize: 13,
    fontWeight: '500',
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  targetIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  targetSub: {
    fontSize: 12,
    marginTop: 2,
  },
  fieldDivider: {
    height: 1,
    marginVertical: 14,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    gap: 8,
  },
  primaryActionBtn: {
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  skipSecondaryBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  skipSecondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dateRangePickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: M3Shape.medium,
    borderWidth: 1,
    marginTop: 6,
  },
  dateRangePickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dateRangeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateRangePickerRangeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  dateRangePickerSubText: {
    fontSize: 11,
    marginTop: 1,
  },
  changeDatesBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: M3Shape.full,
    marginLeft: 8,
  },
  changeDatesBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
