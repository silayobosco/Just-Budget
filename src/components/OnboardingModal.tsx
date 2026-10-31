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

export const OnboardingModal: React.FC = () => {
  const { settings, completeOnboarding } = useBudget();
  const isDarkMode = settings.theme_mode === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');
  const [currencySearch, setCurrencySearch] = useState<string>('');
  const [walletName, setWalletName] = useState<string>('Cash Wallet');
  const [startingBalance, setStartingBalance] = useState<string>('');
  const [budgetCap, setBudgetCap] = useState<string>('');
  const [incomeGoal, setIncomeGoal] = useState<string>('');

  const isVisible = !settings.onboarding_completed;

  const filteredCurrencies = CURRENCIES.filter(
    (c) =>
      c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
      c.name.toLowerCase().includes(currencySearch.toLowerCase())
  );

  const handleFinish = async () => {
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
  };

  if (!isVisible) return null;

  return (
    <Modal visible={isVisible} animationType="slide" transparent={false}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Welcome Branding */}
          <View style={styles.heroSection}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.onboardingLogoImage}
              resizeMode="cover"
            />
            <Text style={[styles.welcomeTitle, { color: theme.onSurface }]}>Welcome to just budget</Text>
            <Text style={[styles.welcomeSubtitle, { color: theme.onSurfaceVariant }]}>
              Offline-first, completely private personal finance. Let's set up your core currency to get started.
            </Text>
          </View>

          {/* Step 1: Currency Selection */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }, M3Elevation.level1]}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepNumberBadge, { backgroundColor: theme.primary }]}>
                <Text style={[styles.stepNumberText, { color: theme.onPrimary }]}>1</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.stepTitle, { color: theme.onSurface }]}>Choose Base Currency</Text>
                <Text style={[styles.stepSub, { color: theme.onSurfaceVariant }]}>
                  All wallets and budgets will calculate in this currency.
                </Text>
              </View>
            </View>

            {/* Currency Search Input */}
            <View style={[styles.searchBox, { backgroundColor: theme.pillBg }]}>
              <MaterialCommunityIcons name="magnify" size={18} color={theme.onSurfaceVariant} />
              <TextInput
                style={[styles.searchInput, { color: theme.onSurface }]}
                placeholder="Search currency (e.g. TZS, USD, EUR)"
                placeholderTextColor={theme.onSurfaceVariant}
                value={currencySearch}
                onChangeText={setCurrencySearch}
              />
              {currencySearch.length > 0 && (
                <TouchableOpacity onPress={() => setCurrencySearch('')}>
                  <MaterialCommunityIcons name="close-circle" size={16} color={theme.onSurfaceVariant} />
                </TouchableOpacity>
              )}
            </View>

            {/* Currency List */}
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

          {/* Step 2: Register First Wallet (Optional) */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }, M3Elevation.level1]}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepNumberBadge, { backgroundColor: theme.surfaceVariant }]}>
                <Text style={[styles.stepNumberText, { color: theme.onSurfaceVariant }]}>2</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.stepTitle, { color: theme.onSurface }]}>Register First Wallet</Text>
                <Text style={[styles.stepSub, { color: theme.onSurfaceVariant }]}>
                  Optional — you can also add more wallets later.
                </Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>Wallet Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                placeholder="e.g. Cash, Bank Account, M-Pesa"
                placeholderTextColor={theme.onSurfaceVariant}
                value={walletName}
                onChangeText={setWalletName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>
                Starting Balance ({selectedCurrency})
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                placeholder="0"
                placeholderTextColor={theme.onSurfaceVariant}
                keyboardType="decimal-pad"
                value={startingBalance}
                onChangeText={setStartingBalance}
              />
            </View>
          </View>

          {/* Step 3: Budget Targets (Optional) */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }, M3Elevation.level1]}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepNumberBadge, { backgroundColor: theme.surfaceVariant }]}>
                <Text style={[styles.stepNumberText, { color: theme.onSurfaceVariant }]}>3</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.stepTitle, { color: theme.onSurface }]}>Cycle Budget Targets</Text>
                <Text style={[styles.stepSub, { color: theme.onSurfaceVariant }]}>
                  Set your initial spending cap or income target (or leave blank).
                </Text>
              </View>
            </View>

            <View style={styles.inputsRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>
                  Budget Cap ({selectedCurrency})
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                  placeholder="e.g. 1500"
                  placeholderTextColor={theme.onSurfaceVariant}
                  keyboardType="decimal-pad"
                  value={budgetCap}
                  onChangeText={setBudgetCap}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>
                  Income Goal ({selectedCurrency})
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                  placeholder="e.g. 2000"
                  placeholderTextColor={theme.onSurfaceVariant}
                  keyboardType="decimal-pad"
                  value={incomeGoal}
                  onChangeText={setIncomeGoal}
                />
              </View>
            </View>
          </View>

          {/* Finish Button */}
          <TouchableOpacity
            style={[styles.finishBtn, { backgroundColor: theme.primary }]}
            onPress={handleFinish}
            activeOpacity={0.8}
          >
            <Text style={[styles.finishBtnText, { color: theme.onPrimary }]}>
              Get Started with {selectedCurrency}
            </Text>
            <MaterialCommunityIcons name="arrow-right" size={20} color={theme.onPrimary} />
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  onboardingLogoImage: {
    width: 64,
    height: 64,
    borderRadius: 16,
    marginBottom: 14,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: M3Shape.extraLarge,
    padding: 18,
    marginBottom: 16,
    gap: 12,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  stepNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 13,
    fontWeight: '800',
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  stepSub: {
    fontSize: 11.5,
    marginTop: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: M3Shape.medium,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 2,
  },
  currencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  currencyPill: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: M3Shape.large,
    borderWidth: 1.5,
  },
  currencyPillLeft: {
    flex: 1,
  },
  currencyCode: {
    fontSize: 13,
    fontWeight: '800',
  },
  currencyName: {
    fontSize: 10,
    marginTop: 1,
  },
  currencyPillRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  currencySymbol: {
    fontSize: 13,
    fontWeight: '700',
  },
  inputGroup: {
    gap: 4,
  },
  inputsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: M3Shape.medium,
    fontSize: 13,
  },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: M3Shape.full,
    marginTop: 8,
  },
  finishBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
});

