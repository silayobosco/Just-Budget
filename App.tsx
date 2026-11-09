import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { BudgetProvider, useBudget } from './src/context/BudgetContext';
import { Header } from './src/components/Header';
import { BottomTabs, TabType } from './src/components/BottomTabs';
import { BudgetCycleModal } from './src/components/BudgetCycleModal';
import { OnboardingModal } from './src/components/OnboardingModal';
import { AppLockOverlay } from './src/components/AppLockOverlay';
import { HomeScreen } from './src/screens/HomeScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { WalletsScreen } from './src/screens/WalletsScreen';
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { lightTheme, darkTheme } from './src/theme';
import { parseDeepLinkUrl } from './src/services/deepLinking';

const MainApp: React.FC = () => {
  const { settings, isLoading, isCycleModalOpen, closeCycleModal, setPendingDeepLinkTx } = useBudget();
  const theme = settings.theme_mode === 'dark' ? darkTheme : lightTheme;

  const [currentTab, setCurrentTab] = useState<TabType>('home');

  // Handle incoming deep links (from Android shortcuts, Google Assistant, or Gemini)
  useEffect(() => {
    const handleIncomingUrl = (rawUrl?: string | null) => {
      if (!rawUrl) return;
      const parsed = parseDeepLinkUrl(rawUrl);
      if (!parsed) return;

      if (parsed.action === 'tab' && parsed.tab) {
        setCurrentTab(parsed.tab);
      } else if (parsed.action === 'transaction' && parsed.transaction) {
        setCurrentTab('home');
        setPendingDeepLinkTx(parsed.transaction);
      }
    };

    // Cold start (app launched by deep link)
    Linking.getInitialURL().then(handleIncomingUrl);

    // Warm start (app brought to foreground by deep link)
    const subscription = Linking.addEventListener('url', ({ url }) => handleIncomingUrl(url));
    return () => {
      subscription.remove();
    };
  }, [setPendingDeepLinkTx]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.surface }]} edges={['top', 'left', 'right']}>
      <StatusBar style={settings.theme_mode === 'dark' ? 'light' : 'dark'} />

      {/* Header */}
      <Header currentTab={currentTab} onNavigateTab={setCurrentTab} />

      {/* Main Tab Screen Content */}
      <View style={[styles.content, { backgroundColor: theme.background }]}>
        {currentTab === 'home' && <HomeScreen onNavigateTab={setCurrentTab} />}
        {currentTab === 'calendar' && <CalendarScreen onNavigateTab={setCurrentTab} />}
        {currentTab === 'wallets' && <WalletsScreen />}
        {currentTab === 'analytics' && <AnalyticsScreen />}
        {currentTab === 'settings' && <SettingsScreen />}
      </View>

      {/* Bottom Navigation */}
      <BottomTabs currentTab={currentTab} onSelectTab={setCurrentTab} />

      {/* Global Cycle & Budget Manager Modal */}
      <BudgetCycleModal
        visible={isCycleModalOpen}
        theme={theme}
        onClose={closeCycleModal}
      />

      {/* Onboarding Currency & Setup Modal */}
      <OnboardingModal />

      {/* Security App Lock Screen */}
      <AppLockOverlay />
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <BudgetProvider>
        <MainApp />
      </BudgetProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
