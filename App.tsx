import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
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

const MainApp: React.FC = () => {
  const {
    settings,
    isLoading,
    isCycleModalOpen,
    closeCycleModal,
    setSelectedCalendarDate,
    setSelectedCalendarCycle,
    getLastCalendarJumpAt,
  } = useBudget();
  const theme = settings.theme_mode === 'dark' ? darkTheme : lightTheme;

  const [currentTab, setCurrentTab] = useState<TabType>('home');
  const prevTabRef = useRef<TabType>('home');
  const leftHistoryAtRef = useRef<number | null>(null);

  // Reset History tab focus to today when returning after 30+ seconds on other pages (excluding explicit date jumps)
  useEffect(() => {
    const prev = prevTabRef.current;
    if (prev === 'calendar' && currentTab !== 'calendar') {
      leftHistoryAtRef.current = Date.now();
    } else if (currentTab === 'calendar' && prev !== 'calendar') {
      const leftAt = leftHistoryAtRef.current;
      const lastJumpAt = getLastCalendarJumpAt();
      if (leftAt !== null && Date.now() - leftAt >= 30_000 && lastJumpAt < leftAt) {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        setSelectedCalendarDate(todayStr);
        setSelectedCalendarCycle(null);
      }
    }
    prevTabRef.current = currentTab;
  }, [currentTab, getLastCalendarJumpAt, setSelectedCalendarDate, setSelectedCalendarCycle]);

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
        {currentTab === 'analytics' && <AnalyticsScreen onNavigateTab={setCurrentTab} />}
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
