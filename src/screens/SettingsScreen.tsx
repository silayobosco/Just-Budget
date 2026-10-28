import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBudget } from '../context/BudgetContext';
import { lightTheme, darkTheme, M3Shape, M3Elevation } from '../theme';
import { formatCurrency } from '../utils/format';
import { CategoryManagerModal } from '../components/CategoryManagerModal';
import { RecurringBillsModal } from '../components/RecurringBillsModal';

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
  } = useBudget();
  const theme = settings.theme_mode === 'dark' ? darkTheme : lightTheme;

  const [categoriesModalVisible, setCategoriesModalVisible] = useState(false);
  const [recurringBillsModalVisible, setRecurringBillsModalVisible] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const currencies = ['USD', 'EUR', 'GBP', 'TZS', 'KES', 'INR', 'CAD', 'AUD', 'JPY', 'CNY', 'ZAR', 'AED'];

  const handleSelectBaseCurrency = async (curr: string) => {
    await updateSettings({ base_currency: curr });
  };

  const handleToggleTheme = async (isDark: boolean) => {
    await updateSettings({ theme_mode: isDark ? 'dark' : 'light' });
  };

  const handleExport = async () => {
    try {
      setStatusMessage('Preparing backup file...');
      const success = await exportBackup();
      if (success) {
        setStatusMessage('Backup dialog opened. Save directly to Google Drive or Files.');
      } else {
        setStatusMessage('Sharing not supported on this platform.');
      }
    } catch (err: any) {
      setStatusMessage(`Export failed: ${err.message}`);
    }
  };

  const handleImport = async () => {
    try {
      setStatusMessage('Opening document picker...');
      const result = await importBackup();
      setStatusMessage(result.message);
      if (result.success) {
        Alert.alert('Success', 'Your budget session has been restored completely!');
      }
    } catch (err: any) {
      setStatusMessage(`Restore failed: ${err.message}`);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* SECTION 1: PREFERENCES & CURRENCY */}
        <Text style={[styles.sectionHeader, { color: theme.primary }]}>PREFERENCES & CURRENCY</Text>
        <View style={[styles.cardGroup, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}>
          {/* Base Currency Selection */}
          <View style={styles.listItem}>
            <View style={styles.itemHeaderRow}>
              <View style={[styles.itemIconCircle, { backgroundColor: theme.primaryContainer }]}>
                <MaterialCommunityIcons name="currency-usd" size={20} color={theme.onPrimaryContainer} />
              </View>
              <View style={styles.itemTextWrap}>
                <Text style={[styles.itemTitle, { color: theme.onSurface }]}>Primary Base Currency</Text>
                <Text style={[styles.itemSubtitle, { color: theme.onSurfaceVariant }]}>
                  Active: <Text style={{ fontWeight: '700', color: theme.primary }}>{settings.base_currency}</Text> • Used for daily allowance & converted portfolio
                </Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.currSelectorScroll}>
              {currencies.map((c) => {
                const isSelected = c === settings.base_currency;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.currChip,
                      {
                        backgroundColor: isSelected ? theme.primary : theme.pillBg,
                      },
                    ]}
                    onPress={() => handleSelectBaseCurrency(c)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.currChipText,
                        {
                          color: isSelected ? theme.onPrimary : theme.onSurface,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

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

        {/* SECTION 2: GOOGLE DRIVE & DATA BACKUP */}
        <Text style={[styles.sectionHeader, { color: theme.primary }]}>GOOGLE DRIVE & CLOUD BACKUP</Text>
        <View style={[styles.cardGroup, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}>
          {/* Info Banner */}
          <View style={[styles.infoBanner, { backgroundColor: theme.heroBg }]}>
            <MaterialCommunityIcons name="shield-check-outline" size={22} color={theme.primary} />
            <Text style={[styles.infoBannerText, { color: theme.onSurface }]}>
              All financial data stays strictly on your device. Export portable backups to Google Drive or Files and restore anytime on another device.
            </Text>
          </View>

          {/* Session Overview Stats */}
          <View style={styles.sessionStatsRow}>
            <View style={styles.sessionStatCol}>
              <Text style={[styles.sessionStatVal, { color: theme.primary }]}>{wallets.length}</Text>
              <Text style={[styles.sessionStatLabel, { color: theme.onSurfaceVariant }]}>Wallets</Text>
            </View>
            <View style={[styles.sessionStatDivider, { backgroundColor: theme.divider }]} />
            <View style={styles.sessionStatCol}>
              <Text style={[styles.sessionStatVal, { color: theme.primary }]}>{transactions.length}</Text>
              <Text style={[styles.sessionStatLabel, { color: theme.onSurfaceVariant }]}>Transactions</Text>
            </View>
            <View style={[styles.sessionStatDivider, { backgroundColor: theme.divider }]} />
            <View style={styles.sessionStatCol}>
              <Text style={[styles.sessionStatVal, { color: theme.primary }]}>{currentCycle?.name?.split(' ')[0] || 'Active'}</Text>
              <Text style={[styles.sessionStatLabel, { color: theme.onSurfaceVariant }]}>Cycle</Text>
            </View>
          </View>

          <View style={[styles.itemDivider, { backgroundColor: theme.divider }]} />

          {/* Export to Google Drive */}
          <TouchableOpacity style={styles.listItemRow} onPress={handleExport} activeOpacity={0.7}>
            <View style={[styles.itemIconCircle, { backgroundColor: '#E0F2FE' }]}>
              <MaterialCommunityIcons name="google-drive" size={22} color="#0284C7" />
            </View>
            <View style={styles.itemTextWrap}>
              <Text style={[styles.itemTitle, { color: theme.onSurface }]}>Export to Google Drive / Files</Text>
              <Text style={[styles.itemSubtitle, { color: theme.onSurfaceVariant }]}>
                Creates and shares a portable .jbbackup archive
              </Text>
            </View>
            <MaterialCommunityIcons name="export-variant" size={20} color={theme.primary} />
          </TouchableOpacity>

          <View style={[styles.itemDivider, { backgroundColor: theme.divider }]} />

          {/* Restore from File */}
          <TouchableOpacity style={styles.listItemRow} onPress={handleImport} activeOpacity={0.7}>
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

        {/* SECTION 3: ABOUT */}
        <Text style={[styles.sectionHeader, { color: theme.primary }]}>ABOUT</Text>
        <View style={[styles.cardGroup, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}>
          <View style={styles.aboutRow}>
            <View style={[styles.itemIconCircle, { backgroundColor: theme.primaryContainer }]}>
              <Text style={{ fontWeight: '800', color: theme.onPrimaryContainer }}>JB</Text>
            </View>
            <View style={styles.itemTextWrap}>
              <Text style={[styles.itemTitle, { color: theme.onSurface }]}>just budget</Text>
              <Text style={[styles.itemSubtitle, { color: theme.onSurfaceVariant }]}>
                Version 1.0.0 • Offline-First Budget & Savings Planner
              </Text>
              <Text style={[styles.aboutNote, { color: theme.onSurfaceVariant }]}>
                Designed with Material 3 Expressive tokens. SQLite persistence with manual Google Drive backup.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

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
});
