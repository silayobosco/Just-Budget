import React, { useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { BudgetProvider, useBudget } from './src/context/BudgetContext';
import { Header } from './src/components/Header';
import { BottomTabs, TabType } from './src/components/BottomTabs';
import { HomeScreen } from './src/screens/HomeScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { WalletsScreen } from './src/screens/WalletsScreen';
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { lightTheme, darkTheme } from './src/theme';

const MainApp: React.FC = () => {
  const { settings, isLoading } = useBudget();
  const theme = settings.theme_mode === 'dark' ? darkTheme : lightTheme;

  const [currentTab, setCurrentTab] = useState<TabType>('home');

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
      <Header />

      {/* Main Tab Screen Content */}
      <View style={[styles.content, { backgroundColor: theme.background }]}>
        {currentTab === 'home' && <HomeScreen />}
        {currentTab === 'calendar' && <CalendarScreen />}
        {currentTab === 'wallets' && <WalletsScreen />}
        {currentTab === 'analytics' && <AnalyticsScreen />}
        {currentTab === 'settings' && <SettingsScreen />}
      </View>

      {/* Bottom Navigation */}
      <BottomTabs currentTab={currentTab} onSelectTab={setCurrentTab} />
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
