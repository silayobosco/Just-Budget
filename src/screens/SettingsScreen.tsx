import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Switch,
  Image,
  Modal,
  Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBudget } from '../context/BudgetContext';
import { lightTheme, darkTheme, M3Shape, M3Elevation } from '../theme';
import { formatCurrency } from '../utils/format';
import { CategoryManagerModal } from '../components/CategoryManagerModal';
import { RecurringBillsModal } from '../components/RecurringBillsModal';
import { SecuritySetupModal } from '../components/SecuritySetupModal';
import { sendTestNotificationAsync, requestNotificationPermissionsAsync } from '../services/notifications';

const CURRENCY_LIST = [
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling' },
  { code: 'RWF', symbol: 'FRw', name: 'Rwandan Franc' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'AU$', name: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
];

const FAQ_ITEMS = [
  {
    q: 'How does Just Budget keep my financial data private?',
    a: 'Just Budget is strictly offline-first. All accounts, wallets, transactions, and budgets are saved exclusively on your device using local SQLite. No accounts, ads, or external cloud servers are used.',
  },
  {
    q: 'How is the Daily Allowance calculated?',
    a: 'Your daily allowance divides your remaining cycle budget by the days remaining until your cycle ends. Spending less than your daily allowance builds savings, which can roll forward into upcoming days.',
  },
  {
    q: 'What does "Overspent Today" mean?',
    a: 'If your spending today exceeds today\'s allowance, the top card alerts you in red and recalculates a sustainable daily target for the remaining days so you stay within your overall cycle limit.',
  },
  {
    q: 'What is the difference between Accumulated and Monthly Reset?',
    a: 'Accumulated (Rollover) carries forward your unspent savings or overspent deficit into the subsequent cycle so your real-world balance is preserved. Monthly Reset starts fresh with your baseline budget every month.',
  },
  {
    q: 'How do I backup or transfer to another phone?',
    a: 'In Settings under Google Drive & Cloud Backup, tap "Export to Google Drive / Files". This creates a portable .jbbackup file that you can save or share. On a new device, tap "Restore Session from File" to load everything.',
  },
  {
    q: 'How do Wallets and Transfers work?',
    a: 'You can set up Cash, Bank, or Mobile Money wallets. When transferring money between wallets, use "Transfer Funds" so your expense budgets and daily allowance remain unaffected.',
  },
  {
    q: 'How do I report a bug or request a feature?',
    a: 'Tap "Report a Problem or Suggestion" in Settings or email juniorboss031@gmail.com directly. We value all feedback and implement user ideas regularly!',
  },
];

export const SettingsScreen: React.FC = () => {
  const {
    settings,
    updateSettings,
    exportBackup,
    importBackup,
    transactions,
    wallets,
    categories,
    recurringBills,
    currentCycle,
    allCycles,
    openCycleModal,
  } = useBudget();
  const theme = settings.theme_mode === 'dark' ? darkTheme : lightTheme;
  const isDark = settings.theme_mode === 'dark';

  const [categoriesModalVisible, setCategoriesModalVisible] = useState(false);
  const [recurringBillsModalVisible, setRecurringBillsModalVisible] = useState(false);
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [faqsModalVisible, setFaqsModalVisible] = useState(false);
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);
  const [securityModalVisible, setSecurityModalVisible] = useState(false);
  const [backupPasswordModalVisible, setBackupPasswordModalVisible] = useState(false);
  const [backupAction, setBackupAction] = useState<'export' | 'import'>('export');
  const [backupPassphrase, setBackupPassphrase] = useState('');
  const [backupPassError, setBackupPassError] = useState('');
  const [showBackupPassword, setShowBackupPassword] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const filteredCurrencies = useMemo(() => {
    const q = currencySearch.trim().toLowerCase();
    if (!q) return CURRENCY_LIST;
    return CURRENCY_LIST.filter(
      (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q)
    );
  }, [currencySearch]);

  const handleSelectBaseCurrency = async (curr: string) => {
    await updateSettings({ base_currency: curr });
    setCurrencyPickerVisible(false);
  };

  const handleToggleTheme = async (isDark: boolean) => {
    await updateSettings({ theme_mode: isDark ? 'dark' : 'light' });
  };

  const handleToggleNotifications = async (enabled: boolean) => {
    if (enabled) {
      const granted = await requestNotificationPermissionsAsync();
      if (!granted) {
        Alert.alert(
          'Notification Permission Required',
          'Please grant notification permission in Android settings to receive reminders.',
          [{ text: 'OK' }]
        );
        return;
      }
    }
    await updateSettings({ notifications_enabled: enabled });
  };

  const handleTestNotification = async () => {
    const success = await sendTestNotificationAsync();
    if (success) {
      Alert.alert('Notification Sent', 'A test reminder has been delivered to your notification tray!');
    } else {
      Alert.alert(
        'Permission Needed',
        'Please allow notification permissions in your phone settings to receive reminders.'
      );
    }
  };

  const handleContactSupport = async () => {
    const email = 'juniorboss031@gmail.com';
    const subject = encodeURIComponent('Just Budget - Feedback / Bug Report');
    const body = encodeURIComponent(
      `Hi,\n\nI want to report an issue or suggest a feature for Just Budget:\n\n[Write your message here]\n\nApp Version: 1.0.0\nTheme: ${settings.theme_mode}\nCurrency: ${settings.base_currency}`
    );
    const mailtoUrl = `mailto:${email}?subject=${subject}&body=${body}`;

    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
      } else {
        await Clipboard.setStringAsync(email);
        Alert.alert(
          'Contact Developer',
          `Email address copied to clipboard:\n\n${email}\n\nPlease paste it into your favorite email app.`,
          [{ text: 'OK' }]
        );
      }
    } catch {
      await Clipboard.setStringAsync(email);
      Alert.alert(
        'Contact Developer',
        `Email address copied to clipboard:\n\n${email}`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleExport = async (passphrase?: string) => {
    try {
      setStatusMessage('Preparing backup file...');
      const success = await exportBackup(passphrase);
      if (success) {
        setStatusMessage('Backup dialog opened. Save directly to Google Drive or Files.');
      } else {
        setStatusMessage('Sharing not supported on this platform.');
      }
    } catch (err: any) {
      setStatusMessage(`Export failed: ${err.message}`);
    }
  };

  const onExportPress = () => {
    if (settings.data_encryption_enabled) {
      setBackupAction('export');
      setBackupPassphrase('');
      setBackupPassError('');
      setBackupPasswordModalVisible(true);
    } else {
      handleExport();
    }
  };

  const handleImport = async (passphrase?: string) => {
    try {
      setStatusMessage('Opening document picker...');
      const result = await importBackup(passphrase);
      setStatusMessage(result.message);
      if (result.success) {
        Alert.alert('Success', 'Your budget session has been restored completely!');
        setBackupPasswordModalVisible(false);
      } else if (result.requiresPassphrase) {
        setBackupAction('import');
        setBackupPassphrase('');
        setBackupPassError(result.message || 'Please enter decryption password.');
        setBackupPasswordModalVisible(true);
      }
    } catch (err: any) {
      setStatusMessage(`Restore failed: ${err.message}`);
    }
  };

  const handleBackupPasswordSubmit = async () => {
    if (backupAction === 'export') {
      setBackupPasswordModalVisible(false);
      await handleExport(backupPassphrase.trim() ? backupPassphrase.trim() : undefined);
    } else {
      if (!backupPassphrase.trim()) {
        setBackupPassError('Please enter the password to decrypt the backup file.');
        return;
      }
      await handleImport(backupPassphrase.trim());
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* SECTION 1: PREFERENCES & CURRENCY */}
        <Text style={[styles.sectionHeader, { color: theme.primary }]}>PREFERENCES & CURRENCY</Text>
        <View style={[styles.cardGroup, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}>
          {/* Base Currency Selection (Picker) */}
          <TouchableOpacity
            style={styles.listItemRow}
            onPress={() => {
              setCurrencySearch('');
              setCurrencyPickerVisible(true);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.itemIconCircle, { backgroundColor: theme.primaryContainer }]}>
              <MaterialCommunityIcons name="currency-usd" size={20} color={theme.onPrimaryContainer} />
            </View>
            <View style={styles.itemTextWrap}>
              <Text style={[styles.itemTitle, { color: theme.onSurface }]}>Primary Base Currency</Text>
              <Text style={[styles.itemSubtitle, { color: theme.onSurfaceVariant }]}>
                Used across all wallets & calculations
              </Text>
            </View>
            <View style={[styles.pickerPill, { backgroundColor: theme.pillBg, borderColor: theme.divider }]}>
              <Text style={[styles.pickerPillText, { color: theme.primary }]}>{settings.base_currency}</Text>
              <MaterialCommunityIcons name="chevron-down" size={16} color={theme.primary} />
            </View>
          </TouchableOpacity>

          <View style={[styles.itemDivider, { backgroundColor: theme.divider }]} />

          {/* Dark Mode Toggle */}
          <View style={styles.listItemRow}>
            <View style={[styles.itemIconCircle, { backgroundColor: theme.tertiaryContainer }]}>
              <MaterialCommunityIcons name="theme-light-dark" size={20} color={theme.onTertiaryContainer} />
            </View>
            <View style={styles.itemTextWrap}>
              <Text style={[styles.itemTitle, { color: theme.onSurface }]}>Dark Mode</Text>
              <Text style={[styles.itemSubtitle, { color: theme.onSurfaceVariant }]}>
                Material 3 Expressive Dark Theme
              </Text>
            </View>
            <Switch
              value={settings.theme_mode === 'dark'}
              onValueChange={handleToggleTheme}
              thumbColor={settings.theme_mode === 'dark' ? theme.primary : '#FFFFFF'}
              trackColor={{ false: theme.divider, true: theme.primaryContainer }}
            />
          </View>

          <View style={[styles.itemDivider, { backgroundColor: theme.divider }]} />

          {/* Category & Budget Manager */}
          <TouchableOpacity
            style={styles.listItemRow}
            onPress={() => setCategoriesModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.itemIconCircle, { backgroundColor: '#F3E8FF' }]}>
              <MaterialCommunityIcons name="shape-outline" size={20} color="#9333EA" />
            </View>
            <View style={styles.itemTextWrap}>
              <Text style={[styles.itemTitle, { color: theme.onSurface }]}>Category & Budget Manager</Text>
              <Text style={[styles.itemSubtitle, { color: theme.onSurfaceVariant }]}>
                Envelopes, categories & spending limits across all wallets
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.onSurfaceVariant} />
          </TouchableOpacity>

          <View style={[styles.itemDivider, { backgroundColor: theme.divider }]} />

          {/* Budget Cycle Manager */}
          <TouchableOpacity
            style={styles.listItemRow}
            onPress={openCycleModal}
            activeOpacity={0.7}
          >
            <View style={[styles.itemIconCircle, { backgroundColor: '#E0E7FF' }]}>
              <MaterialCommunityIcons name="calendar-sync" size={20} color="#4F46E5" />
            </View>
            <View style={styles.itemTextWrap}>
              <Text style={[styles.itemTitle, { color: theme.onSurface }]}>Cycle & Budget Manager</Text>
              <Text style={[styles.itemSubtitle, { color: theme.onSurfaceVariant }]}>
                {settings.cycle_mode === 'custom'
                  ? `Custom Periods (${allCycles.length} total) • Active: ${currentCycle?.name || 'Custom'}`
                  : `Monthly Calendar (${currentCycle?.name || 'Active'}) • Start day & targets`}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.onSurfaceVariant} />
          </TouchableOpacity>

          <View style={[styles.itemDivider, { backgroundColor: theme.divider }]} />

          {/* Recurring Bills & Reminders */}
          <TouchableOpacity
            style={styles.listItemRow}
            onPress={() => setRecurringBillsModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.itemIconCircle, { backgroundColor: '#DCFCE7' }]}>
              <MaterialCommunityIcons name="calendar-clock" size={20} color="#15803D" />
            </View>
            <View style={styles.itemTextWrap}>
              <Text style={[styles.itemTitle, { color: theme.onSurface }]}>Recurring Bills & Reminders</Text>
              <Text style={[styles.itemSubtitle, { color: theme.onSurfaceVariant }]}>
                Subscriptions, fixed costs & upcoming bills ({recurringBills.length} active)
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.onSurfaceVariant} />
          </TouchableOpacity>
        </View>

        {/* SECTION 2: SECURITY & PRIVACY */}
        <Text style={[styles.sectionHeader, { color: theme.primary }]}>SECURITY & PRIVACY</Text>
        <View style={[styles.cardGroup, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}>
          {/* App Lock & Biometrics */}
          <TouchableOpacity
            style={styles.listItemRow}
            onPress={() => setSecurityModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.itemIconCircle, { backgroundColor: settings.app_lock_enabled ? '#DCFCE7' : (isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9') }]}>
              <MaterialCommunityIcons
                name={settings.app_lock_enabled ? 'shield-lock' : 'shield-lock-outline'}
                size={20}
                color={settings.app_lock_enabled ? '#15803D' : theme.onSurfaceVariant}
              />
            </View>
            <View style={styles.itemTextWrap}>
              <Text style={[styles.itemTitle, { color: theme.onSurface }]}>App Lock & Biometrics</Text>
              <Text style={[styles.itemSubtitle, { color: theme.onSurfaceVariant }]}>
                {settings.app_lock_enabled
                  ? (settings.biometrics_enabled ? 'Protected on launch with Passcode & Fingerprint' : 'Protected on launch with Passcode')
                  : 'Off • Never asks for authentication during regular app use'}
              </Text>
            </View>
            <View style={[
              styles.securityStatusBadge,
              { backgroundColor: settings.app_lock_enabled ? (isDark ? 'rgba(34, 197, 94, 0.2)' : '#DCFCE7') : theme.pillBg }
            ]}>
              <Text style={{
                fontSize: 12,
                fontWeight: '700',
                color: settings.app_lock_enabled ? (isDark ? '#4ADE80' : '#15803D') : theme.onSurfaceVariant
              }}>
                {settings.app_lock_enabled ? 'Active' : 'Setup'}
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color={settings.app_lock_enabled ? (isDark ? '#4ADE80' : '#15803D') : theme.onSurfaceVariant} />
            </View>
          </TouchableOpacity>

          <View style={[styles.itemDivider, { backgroundColor: theme.divider }]} />

          {/* Encrypted Backup Protection */}
          <View style={styles.listItemRow}>
            <View style={[styles.itemIconCircle, { backgroundColor: settings.data_encryption_enabled ? '#EDE9FE' : (isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9') }]}>
              <MaterialCommunityIcons
                name={settings.data_encryption_enabled ? 'file-lock' : 'file-lock-outline'}
                size={20}
                color={settings.data_encryption_enabled ? '#7C3AED' : theme.onSurfaceVariant}
              />
            </View>
            <View style={styles.itemTextWrap}>
              <Text style={[styles.itemTitle, { color: theme.onSurface }]}>Encrypted Backup Archive</Text>
              <Text style={[styles.itemSubtitle, { color: theme.onSurfaceVariant }]}>
                {settings.data_encryption_enabled ? 'Active • Passphrase required when exporting or restoring' : 'Off • Standard backup archives'}
              </Text>
            </View>
            <Switch
              value={Boolean(settings.data_encryption_enabled)}
              onValueChange={async (val) => {
                await updateSettings({ data_encryption_enabled: val });
              }}
              thumbColor={settings.data_encryption_enabled ? theme.primary : '#FFFFFF'}
              trackColor={{ false: theme.divider, true: theme.primaryContainer }}
            />
          </View>
        </View>

        {/* SECTION 3: NOTIFICATIONS & REMINDERS */}
        <Text style={[styles.sectionHeader, { color: theme.primary }]}>NOTIFICATIONS & REMINDERS</Text>
        <View style={[styles.cardGroup, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}>
          {/* Master Notifications Toggle */}
          <View style={styles.listItemRow}>
            <View style={[styles.itemIconCircle, { backgroundColor: settings.notifications_enabled !== false ? '#E0E7FF' : (isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9') }]}>
              <MaterialCommunityIcons
                name={settings.notifications_enabled !== false ? 'bell-ring-outline' : 'bell-off-outline'}
                size={20}
                color={settings.notifications_enabled !== false ? '#4F46E5' : theme.onSurfaceVariant}
              />
            </View>
            <View style={styles.itemTextWrap}>
              <Text style={[styles.itemTitle, { color: theme.onSurface }]}>Local Reminders & Alerts</Text>
              <Text style={[styles.itemSubtitle, { color: theme.onSurfaceVariant }]}>
                {settings.notifications_enabled !== false ? 'Active • Offline on-device notifications' : 'Disabled'}
              </Text>
            </View>
            <Switch
              value={settings.notifications_enabled !== false}
              onValueChange={handleToggleNotifications}
              thumbColor={settings.notifications_enabled !== false ? theme.primary : '#FFFFFF'}
              trackColor={{ false: theme.divider, true: theme.primaryContainer }}
            />
          </View>

          {settings.notifications_enabled !== false && (
            <>
              <View style={[styles.itemDivider, { backgroundColor: theme.divider }]} />

              {/* Bill Due Date Reminders */}
              <View style={styles.listItemRow}>
                <View style={[styles.itemIconCircle, { backgroundColor: '#DCFCE7' }]}>
                  <MaterialCommunityIcons name="calendar-alert" size={20} color="#15803D" />
                </View>
                <View style={styles.itemTextWrap}>
                  <Text style={[styles.itemTitle, { color: theme.onSurface }]}>Upcoming Bill Reminders</Text>
                  <Text style={[styles.itemSubtitle, { color: theme.onSurfaceVariant }]}>
                    Morning notification on the due date of upcoming bills
                  </Text>
                </View>
                <Switch
                  value={settings.bill_reminders_enabled !== false}
                  onValueChange={async (val) => {
                    await updateSettings({ bill_reminders_enabled: val });
                  }}
                  thumbColor={settings.bill_reminders_enabled !== false ? theme.primary : '#FFFFFF'}
                  trackColor={{ false: theme.divider, true: theme.primaryContainer }}
                />
              </View>

              <View style={[styles.itemDivider, { backgroundColor: theme.divider }]} />

              {/* Morning Daily Allowance Reminder */}
              <View style={styles.listItemRow}>
                <View style={[styles.itemIconCircle, { backgroundColor: '#FEF3C7' }]}>
                  <MaterialCommunityIcons name="weather-sunny" size={20} color="#D97706" />
                </View>
                <View style={styles.itemTextWrap}>
                  <Text style={[styles.itemTitle, { color: theme.onSurface }]}>Daily Allowance Briefing</Text>
                  <Text style={[styles.itemSubtitle, { color: theme.onSurfaceVariant }]}>
                    Daily 8:30 AM summary of your available spending limit
                  </Text>
                </View>
                <Switch
                  value={Boolean(settings.daily_allowance_reminder_enabled)}
                  onValueChange={async (val) => {
                    await updateSettings({ daily_allowance_reminder_enabled: val });
                  }}
                  thumbColor={settings.daily_allowance_reminder_enabled ? theme.primary : '#FFFFFF'}
                  trackColor={{ false: theme.divider, true: theme.primaryContainer }}
                />
              </View>

              <View style={[styles.itemDivider, { backgroundColor: theme.divider }]} />

              {/* Evening Expense Logging Reminder */}
              <View style={styles.listItemRow}>
                <View style={[styles.itemIconCircle, { backgroundColor: '#F3E8FF' }]}>
                  <MaterialCommunityIcons name="moon-waning-crescent" size={20} color="#9333EA" />
                </View>
                <View style={styles.itemTextWrap}>
                  <Text style={[styles.itemTitle, { color: theme.onSurface }]}>Evening Expense Check-in</Text>
                  <Text style={[styles.itemSubtitle, { color: theme.onSurfaceVariant }]}>
                    Daily 8:30 PM reminder to log unrecorded cash expenses
                  </Text>
                </View>
                <Switch
                  value={Boolean(settings.evening_reminder_enabled)}
                  onValueChange={async (val) => {
                    await updateSettings({ evening_reminder_enabled: val });
                  }}
                  thumbColor={settings.evening_reminder_enabled ? theme.primary : '#FFFFFF'}
                  trackColor={{ false: theme.divider, true: theme.primaryContainer }}
                />
              </View>

              <View style={[styles.itemDivider, { backgroundColor: theme.divider }]} />

              {/* Send Test Notification Button */}
              <TouchableOpacity
                style={styles.listItemRow}
                onPress={handleTestNotification}
                activeOpacity={0.7}
              >
                <View style={[styles.itemIconCircle, { backgroundColor: theme.primaryContainer }]}>
                  <MaterialCommunityIcons name="bell-check-outline" size={20} color={theme.primary} />
                </View>
                <View style={styles.itemTextWrap}>
                  <Text style={[styles.itemTitle, { color: theme.onSurface }]}>Send Test Notification</Text>
                  <Text style={[styles.itemSubtitle, { color: theme.onSurfaceVariant }]}>
                    Deliver an instant sample reminder to your status bar
                  </Text>
                </View>
                <MaterialCommunityIcons name="send-outline" size={18} color={theme.primary} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* SECTION 4: GOOGLE DRIVE & CLOUD BACKUP (Cleaned: Disclaimer & Dashboard Removed) */}
        <Text style={[styles.sectionHeader, { color: theme.primary }]}>GOOGLE DRIVE & CLOUD BACKUP</Text>
        <View style={[styles.cardGroup, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}>
          {/* Export to Google Drive */}
          <TouchableOpacity style={styles.listItemRow} onPress={onExportPress} activeOpacity={0.7}>
            <View style={[styles.itemIconCircle, { backgroundColor: '#E0F2FE' }]}>
              <MaterialCommunityIcons name="google-drive" size={22} color="#0284C7" />
            </View>
            <View style={styles.itemTextWrap}>
              <Text style={[styles.itemTitle, { color: theme.onSurface }]}>Export to Google Drive / Files</Text>
              <Text style={[styles.itemSubtitle, { color: theme.onSurfaceVariant }]}>
                {settings.data_encryption_enabled ? 'Creates encrypted .jbbackup archive' : 'Creates and shares a portable .jbbackup archive'}
              </Text>
            </View>
            <MaterialCommunityIcons name="export-variant" size={20} color={theme.primary} />
          </TouchableOpacity>

          <View style={[styles.itemDivider, { backgroundColor: theme.divider }]} />

          {/* Restore from File */}
          <TouchableOpacity style={styles.listItemRow} onPress={() => handleImport()} activeOpacity={0.7}>
            <View style={[styles.itemIconCircle, { backgroundColor: '#FEF3C7' }]}>
              <MaterialCommunityIcons name="file-download-outline" size={22} color="#D97706" />
            </View>
            <View style={styles.itemTextWrap}>
              <Text style={[styles.itemTitle, { color: theme.onSurface }]}>Restore Session from File</Text>
              <Text style={[styles.itemSubtitle, { color: theme.onSurfaceVariant }]}>
                Import .jbbackup file from Google Drive or storage
              </Text>
            </View>
            <MaterialCommunityIcons name="import" size={20} color={theme.primary} />
          </TouchableOpacity>

          {statusMessage ? (
            <View style={[styles.statusBox, { backgroundColor: theme.pillBg }]}>
              <Text style={[styles.statusText, { color: theme.onSurface }]}>{statusMessage}</Text>
            </View>
          ) : null}
        </View>

        {/* SECTION 3: HELP & SUPPORT */}
        <Text style={[styles.sectionHeader, { color: theme.primary }]}>HELP & SUPPORT</Text>
        <View style={[styles.cardGroup, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}>
          {/* FAQs */}
          <TouchableOpacity
            style={styles.listItemRow}
            onPress={() => setFaqsModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.itemIconCircle, { backgroundColor: '#EDE9FE' }]}>
              <MaterialCommunityIcons name="frequently-asked-questions" size={20} color="#7C3AED" />
            </View>
            <View style={styles.itemTextWrap}>
              <Text style={[styles.itemTitle, { color: theme.onSurface }]}>Frequently Asked Questions (FAQs)</Text>
              <Text style={[styles.itemSubtitle, { color: theme.onSurfaceVariant }]}>
                Offline storage, rollover cycles, envelopes & backups
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.onSurfaceVariant} />
          </TouchableOpacity>

          <View style={[styles.itemDivider, { backgroundColor: theme.divider }]} />

          {/* Contact & Report Problem / Suggestion */}
          <TouchableOpacity
            style={styles.listItemRow}
            onPress={handleContactSupport}
            activeOpacity={0.7}
          >
            <View style={[styles.itemIconCircle, { backgroundColor: '#FEE2E2' }]}>
              <MaterialCommunityIcons name="email-fast-outline" size={20} color="#DC2626" />
            </View>
            <View style={styles.itemTextWrap}>
              <Text style={[styles.itemTitle, { color: theme.onSurface }]}>Report a Problem or Suggestion</Text>
              <Text style={[styles.itemSubtitle, { color: theme.onSurfaceVariant }]}>
                Contact juniorboss031@gmail.com directly
              </Text>
            </View>
            <MaterialCommunityIcons name="send-outline" size={18} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {/* SECTION 4: ABOUT */}
        <Text style={[styles.sectionHeader, { color: theme.primary }]}>ABOUT</Text>
        <View style={[styles.cardGroup, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}>
          <View style={styles.aboutRow}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.aboutLogoImage}
              resizeMode="cover"
            />
            <View style={styles.itemTextWrap}>
              <Text style={[styles.itemTitle, { color: theme.onSurface }]}>just budget</Text>
              <Text style={[styles.itemSubtitle, { color: theme.onSurfaceVariant }]}>
                Version 1.0.0 • Offline-First Budget & Savings Planner
              </Text>
              <Text style={[styles.aboutNote, { color: theme.onSurfaceVariant }]}>
                Designed with Material 3 Expressive tokens. All financial data is 100% offline and stored in secure device SQLite.
              </Text>
            </View>
          </View>

          <View style={[styles.itemDivider, { backgroundColor: theme.divider }]} />

          <TouchableOpacity
            style={styles.developerRow}
            onPress={handleContactSupport}
            activeOpacity={0.7}
          >
            <View style={[styles.itemIconCircle, { backgroundColor: theme.primaryContainer }]}>
              <MaterialCommunityIcons name="email-check-outline" size={18} color={theme.primary} />
            </View>
            <View style={styles.itemTextWrap}>
              <Text style={[styles.itemTitle, { color: theme.onSurface, fontSize: 13 }]}>Developer Contact</Text>
              <Text style={[styles.developerEmail, { color: theme.primary }]}>juniorboss031@gmail.com</Text>
            </View>
            <MaterialCommunityIcons name="content-copy" size={16} color={theme.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* CURRENCY PICKER MODAL */}
      <Modal
        visible={currencyPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCurrencyPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.currencyModalBox, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialCommunityIcons name="currency-usd" size={22} color={theme.primary} />
                <Text style={[styles.modalTitle, { color: theme.onSurface }]}>Select Base Currency</Text>
              </View>
              <TouchableOpacity onPress={() => setCurrencyPickerVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close" size={22} color={theme.onSurface} />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={[styles.currencySearchWrap, { backgroundColor: theme.pillBg }]}>
              <MaterialCommunityIcons name="magnify" size={20} color={theme.onSurfaceVariant} />
              <TextInput
                style={[styles.currencySearchInput, { color: theme.onSurface }]}
                placeholder="Search currency code or name..."
                placeholderTextColor={theme.onSurfaceVariant}
                value={currencySearch}
                onChangeText={setCurrencySearch}
                clearButtonMode="while-editing"
              />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.currencyListScroll}>
              {filteredCurrencies.map((c) => {
                const isSelected = c.code === settings.base_currency;
                return (
                  <TouchableOpacity
                    key={c.code}
                    style={[
                      styles.currencyItemRow,
                      {
                        backgroundColor: isSelected ? (theme.primaryContainer || 'rgba(99,102,241,0.15)') : 'transparent',
                        borderColor: isSelected ? theme.primary : theme.divider,
                      },
                    ]}
                    onPress={() => handleSelectBaseCurrency(c.code)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.currencySymbolCircle, { backgroundColor: isSelected ? theme.primary : theme.pillBg }]}>
                      <Text style={[styles.currencySymbolText, { color: isSelected ? theme.onPrimary : theme.onSurface }]}>
                        {c.symbol}
                      </Text>
                    </View>

                    <View style={styles.currencyTextCol}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.currencyCodeText, { color: isSelected ? theme.primary : theme.onSurface }]}>
                          {c.code}
                        </Text>
                        <Text style={[styles.currencySymbolBadge, { color: theme.onSurfaceVariant }]}>
                          ({c.symbol})
                        </Text>
                      </View>
                      <Text style={[styles.currencyNameText, { color: theme.onSurfaceVariant }]}>
                        {c.name}
                      </Text>
                    </View>

                    {isSelected && (
                      <MaterialCommunityIcons name="check-circle" size={22} color={theme.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* FAQS MODAL */}
      <Modal
        visible={faqsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFaqsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.faqsModalBox, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialCommunityIcons name="frequently-asked-questions" size={22} color={theme.primary} />
                <Text style={[styles.modalTitle, { color: theme.onSurface }]}>FAQs & Help Guide</Text>
              </View>
              <TouchableOpacity onPress={() => setFaqsModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close" size={22} color={theme.onSurface} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.faqsScrollContent}>
              {FAQ_ITEMS.map((faq, index) => {
                const isExpanded = expandedFaqIndex === index;
                return (
                  <View
                    key={index}
                    style={[
                      styles.faqCard,
                      {
                        backgroundColor: theme.cardBg,
                        borderColor: isExpanded ? theme.primary : theme.divider,
                      },
                      M3Elevation.level1,
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.faqHeaderBtn}
                      onPress={() => setExpandedFaqIndex(isExpanded ? null : index)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.faqNumberCircle, { backgroundColor: isExpanded ? theme.primary : theme.pillBg }]}>
                        <Text style={[styles.faqNumberText, { color: isExpanded ? theme.onPrimary : theme.onSurfaceVariant }]}>
                          {index + 1}
                        </Text>
                      </View>
                      <Text style={[styles.faqQuestion, { color: theme.onSurface }]}>
                        {faq.q}
                      </Text>
                      <MaterialCommunityIcons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={theme.onSurfaceVariant}
                      />
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={[styles.faqAnswerWrap, { borderTopColor: theme.divider }]}>
                        <Text style={[styles.faqAnswerText, { color: theme.onSurfaceVariant }]}>
                          {faq.a}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}

              {/* Still have questions / contact footer */}
              <TouchableOpacity
                style={[styles.faqContactBtn, { backgroundColor: theme.primaryContainer }]}
                onPress={() => {
                  setFaqsModalVisible(false);
                  setTimeout(handleContactSupport, 200);
                }}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="email-fast-outline" size={20} color={theme.onPrimaryContainer} />
                <Text style={[styles.faqContactBtnText, { color: theme.onPrimaryContainer }]}>
                  Still have questions? Email juniorboss031@gmail.com
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Category Manager Modal */}
      <CategoryManagerModal
        visible={categoriesModalVisible}
        onClose={() => setCategoriesModalVisible(false)}
      />

      {/* Recurring Bills & Reminders Modal */}
      <RecurringBillsModal
        visible={recurringBillsModalVisible}
        onClose={() => setRecurringBillsModalVisible(false)}
      />

      {/* Security Setup Modal (PIN & Biometrics) */}
      <SecuritySetupModal
        visible={securityModalVisible}
        onClose={() => setSecurityModalVisible(false)}
      />

      {/* Encrypted Backup Passphrase Modal */}
      <Modal
        visible={backupPasswordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBackupPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.passwordModalBox, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialCommunityIcons
                  name={backupAction === 'export' ? 'file-lock' : 'file-key'}
                  size={22}
                  color={theme.primary}
                />
                <Text style={[styles.modalTitle, { color: theme.onSurface }]}>
                  {backupAction === 'export' ? 'Encrypt Backup' : 'Decrypt Backup'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setBackupPasswordModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="close" size={22} color={theme.onSurface} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.passwordModalSubtitle, { color: theme.onSurfaceVariant }]}>
              {backupAction === 'export'
                ? 'Create a passphrase to encrypt your exported backup. You will need this passphrase to restore your data.'
                : 'This backup is password protected. Enter the passphrase you used to export it.'}
            </Text>

            {backupPassError ? (
              <View style={[styles.passwordErrorBox, { backgroundColor: theme.errorContainer }]}>
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color={theme.error} />
                <Text style={[styles.passwordErrorText, { color: theme.error }]}>{backupPassError}</Text>
              </View>
            ) : null}

            <View style={[styles.passwordInputWrap, { backgroundColor: theme.pillBg, borderColor: theme.divider }]}>
              <MaterialCommunityIcons name="lock-outline" size={20} color={theme.onSurfaceVariant} />
              <TextInput
                style={[styles.passwordTextInput, { color: theme.onSurface }]}
                placeholder={backupAction === 'export' ? 'Passphrase (or leave empty for unencrypted)' : 'Enter decryption passphrase...'}
                placeholderTextColor={theme.onSurfaceVariant}
                value={backupPassphrase}
                onChangeText={(t) => {
                  setBackupPassphrase(t);
                  setBackupPassError('');
                }}
                secureTextEntry={!showBackupPassword}
                autoFocus
              />
              <TouchableOpacity
                onPress={() => setShowBackupPassword(!showBackupPassword)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons
                  name={showBackupPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color={theme.onSurfaceVariant}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.passwordModalActions}>
              <TouchableOpacity
                style={[styles.passwordCancelBtn, { borderColor: theme.divider }]}
                onPress={() => setBackupPasswordModalVisible(false)}
              >
                <Text style={[styles.passwordCancelText, { color: theme.onSurfaceVariant }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.passwordConfirmBtn, { backgroundColor: theme.primary }]}
                onPress={handleBackupPasswordSubmit}
              >
                <Text style={[styles.passwordConfirmText, { color: theme.onPrimary }]}>
                  {backupAction === 'export' ? 'Export' : 'Restore'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 14,
    paddingHorizontal: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  cardGroup: {
    borderWidth: 1,
    borderRadius: M3Shape.extraLarge,
    overflow: 'hidden',
    marginBottom: 10,
  },
  listItem: {
    padding: 14,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  aboutLogoImage: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginRight: 14,
  },
  itemTextWrap: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  itemSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  itemDivider: {
    height: 1,
    marginLeft: 64,
  },
  currSelectorScroll: {
    marginTop: 4,
    marginBottom: 4,
  },
  currChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: M3Shape.full,
    marginRight: 8,
  },
  currChipText: {
    fontSize: 13,
  },
  infoBanner: {
    flexDirection: 'row',
    padding: 14,
    gap: 10,
    alignItems: 'center',
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  sessionStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  sessionStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  sessionStatVal: {
    fontSize: 16,
    fontWeight: '800',
  },
  sessionStatLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  sessionStatDivider: {
    width: 1,
    height: 24,
  },
  statusBox: {
    padding: 10,
    margin: 12,
    borderRadius: M3Shape.medium,
  },
  statusText: {
    fontSize: 12,
    textAlign: 'center',
  },
  rateEditorBox: {
    borderWidth: 1,
    borderRadius: M3Shape.large,
    padding: 12,
    margin: 12,
  },
  rateEditorTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  rateEditorInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  rateEditorInput: {
    flex: 1,
    height: 38,
    borderRadius: M3Shape.medium,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  rateSaveBtn: {
    paddingHorizontal: 14,
    height: 38,
    borderRadius: M3Shape.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateCancelBtn: {
    paddingHorizontal: 14,
    height: 38,
    borderRadius: M3Shape.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  rateItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rateTagWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rateCurrCode: {
    fontSize: 15,
    fontWeight: '700',
  },
  baseBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: M3Shape.full,
  },
  baseBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  rateValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rateValueText: {
    fontSize: 14,
    fontWeight: '600',
  },
  rateEditIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutRow: {
    flexDirection: 'row',
    padding: 14,
    alignItems: 'center',
  },
  aboutNote: {
    fontSize: 11,
    marginTop: 4,
    lineHeight: 15,
  },
  pickerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: M3Shape.full,
    borderWidth: 1,
  },
  pickerPillText: {
    fontSize: 13,
    fontWeight: '800',
  },
  developerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  developerEmail: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 16,
  },
  currencyModalBox: {
    borderRadius: M3Shape.extraLarge,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  currencySearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: M3Shape.medium,
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 12,
  },
  currencySearchInput: {
    flex: 1,
    fontSize: 14,
    height: 44,
  },
  currencyListScroll: {
    maxHeight: 380,
  },
  currencyItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: M3Shape.large,
    borderWidth: 1,
    marginBottom: 6,
    gap: 12,
  },
  currencySymbolCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencySymbolText: {
    fontSize: 14,
    fontWeight: '800',
  },
  currencyTextCol: {
    flex: 1,
  },
  currencyCodeText: {
    fontSize: 15,
    fontWeight: '800',
  },
  currencySymbolBadge: {
    fontSize: 12,
    fontWeight: '600',
  },
  currencyNameText: {
    fontSize: 12,
    marginTop: 2,
  },
  faqsModalBox: {
    borderRadius: M3Shape.extraLarge,
    padding: 20,
    maxHeight: '88%',
  },
  faqsScrollContent: {
    paddingBottom: 16,
    gap: 10,
  },
  faqCard: {
    borderRadius: M3Shape.large,
    borderWidth: 1,
    overflow: 'hidden',
  },
  faqHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  faqNumberCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqNumberText: {
    fontSize: 11,
    fontWeight: '800',
  },
  faqQuestion: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    lineHeight: 18,
  },
  faqAnswerWrap: {
    borderTopWidth: 1,
    padding: 14,
    paddingTop: 10,
  },
  faqAnswerText: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  faqContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: M3Shape.full,
    marginTop: 10,
  },
  faqContactBtnText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  securityStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: M3Shape.full,
  },
  passwordModalBox: {
    borderRadius: M3Shape.extraLarge,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  passwordModalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  passwordErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: M3Shape.small,
    marginBottom: 12,
  },
  passwordErrorText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  passwordInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: M3Shape.medium,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 10,
    marginBottom: 20,
  },
  passwordTextInput: {
    flex: 1,
    fontSize: 14,
    height: 48,
  },
  passwordModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  passwordCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: M3Shape.full,
    borderWidth: 1,
  },
  passwordCancelText: {
    fontSize: 13,
    fontWeight: '700',
  },
  passwordConfirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: M3Shape.full,
  },
  passwordConfirmText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
