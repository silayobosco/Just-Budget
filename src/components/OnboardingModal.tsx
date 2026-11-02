import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBudget } from '../context/BudgetContext';
import { lightTheme, darkTheme, M3Shape, M3Elevation } from '../theme';

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

export const OnboardingModal: React.FC = () => {
  const { settings, completeOnboarding } = useBudget();
  const isDarkMode = settings.theme_mode === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');
  const [currencySearch, setCurrencySearch] = useState<string>('');
  const [walletName, setWalletName] = useState<string>('Cash');
  const [startingBalance, setStartingBalance] = useState<string>('');
  const [budgetCap, setBudgetCap] = useState<string>('');
  const [incomeGoal, setIncomeGoal] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const isVisible = !settings.onboarding_completed;

  const filteredCurrencies = CURRENCIES.filter(
    (c) =>
      c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
      c.name.toLowerCase().includes(currencySearch.toLowerCase())
  );

  const handleNext = () => {
    if (currentStep < 2) {
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
      // Clear wallet fields and advance to Step 3
      setWalletName('');
      setStartingBalance('');
      setCurrentStep(2);
    } else if (currentStep === 2) {
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
      const startBal = parseFloat(startingBalance);
      const bCap = parseFloat(budgetCap);
      const iGoal = parseFloat(incomeGoal);

      await completeOnboarding({
        currency: selectedCurrency,
        firstWalletName: walletName.trim() || undefined,
        startingBalance: !isNaN(startBal) ? startBal : undefined,
        budgetCap: !isNaN(bCap) ? bCap : undefined,
        incomeGoal: !isNaN(iGoal) ? iGoal : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isVisible) return null;

  const currentCurrencyObj = CURRENCIES.find((c) => c.code === selectedCurrency) || CURRENCIES[0];

  return (
    <Modal visible={isVisible} animationType="slide" transparent={false}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
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

            {/* Segmented Progress Indicators */}
            <View style={styles.progressSegmentsWrap}>
              {[0, 1, 2].map((stepIdx) => {
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

            {/* STEP 2: REGISTER FIRST WALLET (OPTIONAL) */}
            {currentStep === 1 && (
              <View style={styles.stepContainer}>
                <View style={styles.stepHeroBadge}>
                  <View style={[styles.stepIconCircle, { backgroundColor: theme.primaryContainer }]}>
                    <MaterialCommunityIcons name="wallet-outline" size={32} color={theme.primary} />
                  </View>
                  <Text style={[styles.stepHeaderTitle, { color: theme.onSurface }]}>Register First Wallet</Text>
                  <Text style={[styles.stepHeaderSubtitle, { color: theme.onSurfaceVariant }]}>
                    Set up your primary wallet or starting balance. You can select a preset or type a custom name.
                  </Text>
                </View>

                {/* Quick Presets */}
                <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant, marginTop: 12 }]}>
                  QUICK PRESETS
                </Text>
                <View style={styles.presetsRow}>
                  {WALLET_PRESETS.map((p) => {
                    const isPicked = walletName.toLowerCase() === p.name.toLowerCase();
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
                        onPress={() => setWalletName(p.name)}
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
                      value={walletName}
                      onChangeText={setWalletName}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>
                      Starting Balance ({selectedCurrency})
                    </Text>
                    <View style={[styles.balanceInputWrap, { backgroundColor: theme.pillBg }]}>
                      <Text style={[styles.currencyPrefixText, { color: theme.primary }]}>
                        {currentCurrencyObj.symbol}
                      </Text>
                      <TextInput
                        style={[styles.balanceInput, { color: theme.onSurface }]}
                        placeholder="0"
                        placeholderTextColor={theme.onSurfaceVariant}
                        keyboardType="decimal-pad"
                        value={startingBalance}
                        onChangeText={setStartingBalance}
                      />
                    </View>
                    <Text style={[styles.fieldHint, { color: theme.onSurfaceVariant }]}>
                      Leave blank or 0 to start clean.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* STEP 3: BUDGET TARGETS (OPTIONAL) */}
            {currentStep === 2 && (
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
          <View style={[styles.bottomBar, { backgroundColor: theme.surface, borderTopColor: theme.divider }]}>
            {currentStep < 2 ? (
              <TouchableOpacity
                style={[styles.primaryActionBtn, { backgroundColor: theme.primary }, M3Elevation.level2]}
                onPress={handleNext}
                activeOpacity={0.85}
              >
                <Text style={[styles.primaryActionBtnText, { color: theme.onPrimary }]}>
                  {currentStep === 0 ? `Continue with ${selectedCurrency}` : 'Continue to Targets'}
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
                  {currentStep === 1 ? 'Skip Wallet Setup' : 'Skip & Finish Setup'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
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
    maxWidth: 64,
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
    marginBottom: 20,
    marginTop: 10,
  },
  stepIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  stepHeaderTitle: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
  },
  stepHeaderSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
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
  card: {
    borderRadius: M3Shape.extraLarge,
    padding: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    height: 46,
    borderRadius: M3Shape.medium,
    paddingHorizontal: 14,
    fontSize: 15,
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
    fontSize: 16,
    fontWeight: '700',
  },
  fieldHint: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 6,
    marginLeft: 2,
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
});
