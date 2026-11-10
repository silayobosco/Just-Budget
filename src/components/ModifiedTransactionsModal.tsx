import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Transaction, Category, Wallet, RecurringBill } from '../types';
import { formatCurrency } from '../utils/format';
import { M3Elevation, M3Shape } from '../theme';

interface ModifiedTransactionsModalProps {
  visible: boolean;
  onClose: () => void;
  transactions: Transaction[];
  categories: Category[];
  wallets: Wallet[];
  recurringBills?: RecurringBill[];
  theme: any;
  baseCurrency: string;
  onSelectTransaction: (tx: Transaction) => void;
}

export const ModifiedTransactionsModal: React.FC<ModifiedTransactionsModalProps> = ({
  visible,
  onClose,
  transactions,
  categories,
  wallets,
  recurringBills,
  theme,
  baseCurrency,
  onSelectTransaction,
}) => {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? Math.max(StatusBar.currentHeight || 0, 24) : 0);
  const bottomInset = Math.max(insets.bottom, 16);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'expense' | 'income' | 'transfer'>('all');
  const [onlyEdited, setOnlyEdited] = useState(true);

  // Filter and sort transactions
  const filteredTransactions = useMemo(() => {
    let list = [...transactions];

    if (onlyEdited) {
      list = list.filter((t) => Boolean(t.updated_at));
    }

    if (selectedType !== 'all') {
      list = list.filter((t) => t.type === selectedType);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((t) => {
        const cat = categories.find((c) => c.id === t.category_id);
        const sub = cat?.subcategories?.find((s) => s.id === t.subcategory_id);
        const wal = wallets.find((w) => w.id === t.wallet_id);
        const toWal = t.to_wallet_id ? wallets.find((w) => w.id === t.to_wallet_id) : undefined;
        return (
          (t.note && t.note.toLowerCase().includes(q)) ||
          (cat && cat.name.toLowerCase().includes(q)) ||
          (sub && sub.name.toLowerCase().includes(q)) ||
          (wal && wal.name.toLowerCase().includes(q)) ||
          (toWal && toWal.name.toLowerCase().includes(q)) ||
          t.amount.toString().includes(q) ||
          t.date.includes(q)
        );
      });
    }

    // Sort by modified date descending (fall back to created_at or date)
    return list.sort((a, b) => {
      const timeA = a.updated_at || a.created_at || a.date;
      const timeB = b.updated_at || b.created_at || b.date;
      return timeB.localeCompare(timeA);
    });
  }, [transactions, onlyEdited, selectedType, searchQuery, categories, wallets]);

  const editedCount = useMemo(() => {
    return transactions.filter((t) => Boolean(t.updated_at)).length;
  }, [transactions]);

  const formatEditDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      const isYesterday = d.toDateString() === yesterday.toDateString();

      const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

      if (isToday) return `Today at ${timeStr}`;
      if (isYesterday) return `Yesterday at ${timeStr}`;
      return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} at ${timeStr}`;
    } catch {
      return isoString;
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.background, paddingTop: topInset }]}>
        {/* Header Bar */}
        <View style={[styles.headerBar, { borderBottomColor: theme.divider }]}>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: theme.cardBg || theme.surface }]}
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color={theme.onSurface} />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: theme.onSurface }]}>Modified Transactions</Text>
            <Text style={[styles.headerSubtitle, { color: theme.onSurfaceVariant }]}>
              {editedCount} edited • sorted by last modified
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.filterToggleBtn,
              { backgroundColor: onlyEdited ? theme.primaryContainer : theme.cardBg || theme.surface },
            ]}
            onPress={() => setOnlyEdited(!onlyEdited)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={onlyEdited ? 'filter-check' : 'filter-variant'}
              size={18}
              color={onlyEdited ? theme.primary : theme.onSurfaceVariant}
            />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={theme.onSurfaceVariant} />
          <TextInput
            style={[styles.searchInput, { color: theme.onSurface }]}
            placeholder="Search by note, category, wallet, amount..."
            placeholderTextColor={theme.onSurfaceVariant}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {Boolean(searchQuery) && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <MaterialCommunityIcons name="close-circle" size={18} color={theme.onSurfaceVariant} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips */}
        <View style={styles.chipRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor: selectedType === 'all' ? theme.primary : theme.cardBg || theme.surface,
                  borderColor: selectedType === 'all' ? theme.primary : theme.divider,
                },
              ]}
              onPress={() => setSelectedType('all')}
            >
              <Text style={[styles.filterChipText, { color: selectedType === 'all' ? theme.onPrimary : theme.onSurface }]}>
                All
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor: selectedType === 'expense' ? theme.error : theme.cardBg || theme.surface,
                  borderColor: selectedType === 'expense' ? theme.error : theme.divider,
                },
              ]}
              onPress={() => setSelectedType('expense')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: selectedType === 'expense' ? '#FFFFFF' : theme.onSurface },
                ]}
              >
                Expenses
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor: selectedType === 'income' ? theme.success : theme.cardBg || theme.surface,
                  borderColor: selectedType === 'income' ? theme.success : theme.divider,
                },
              ]}
              onPress={() => setSelectedType('income')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: selectedType === 'income' ? '#FFFFFF' : theme.onSurface },
                ]}
              >
                Income
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor: selectedType === 'transfer' ? theme.tertiary : theme.cardBg || theme.surface,
                  borderColor: selectedType === 'transfer' ? theme.tertiary : theme.divider,
                },
              ]}
              onPress={() => setSelectedType('transfer')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: selectedType === 'transfer' ? '#FFFFFF' : theme.onSurface },
                ]}
              >
                Transfers
              </Text>
            </TouchableOpacity>

            {/* Toggle chip for Edited Only vs All */}
            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor: onlyEdited ? theme.primaryContainer : theme.cardBg || theme.surface,
                  borderColor: onlyEdited ? theme.primary : theme.divider,
                },
              ]}
              onPress={() => setOnlyEdited(!onlyEdited)}
            >
              <MaterialCommunityIcons
                name="clock-edit-outline"
                size={14}
                color={onlyEdited ? theme.primary : theme.onSurfaceVariant}
              />
              <Text
                style={[
                  styles.filterChipText,
                  { color: onlyEdited ? theme.primary : theme.onSurfaceVariant, fontWeight: onlyEdited ? '700' : '500' },
                ]}
              >
                {onlyEdited ? 'Edited Only' : 'All Activity'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Transactions List */}
        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomInset + 30 }]}
          showsVerticalScrollIndicator={false}
        >
          {filteredTransactions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: theme.cardBg || theme.surface }]}>
                <MaterialCommunityIcons name="clock-edit-outline" size={44} color={theme.onSurfaceVariant} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.onSurface }]}>
                {onlyEdited ? 'No Modified Transactions' : 'No Transactions Found'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.onSurfaceVariant }]}>
                {onlyEdited
                  ? 'Transactions that you edit will automatically show up here with their full modification history.'
                  : 'Try adjusting your search query or filters.'}
              </Text>
              {onlyEdited && (
                <TouchableOpacity
                  style={[styles.viewAllBtn, { backgroundColor: theme.primaryContainer }]}
                  onPress={() => setOnlyEdited(false)}
                >
                  <Text style={[styles.viewAllBtnText, { color: theme.primary }]}>Show All Recent Activity</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredTransactions.map((tx) => {
              const cat = categories.find((c) => c.id === tx.category_id);
              const sub = cat?.subcategories?.find((s) => s.id === tx.subcategory_id);
              const wal = wallets.find((w) => w.id === tx.wallet_id);
              const toWal = tx.to_wallet_id ? wallets.find((w) => w.id === tx.to_wallet_id) : undefined;
              const isExpense = tx.type === 'expense';
              const isIncome = tx.type === 'income';
              const isTransfer = tx.type === 'transfer';

              const amountColor = isExpense
                ? theme.error
                : isIncome
                ? theme.success
                : theme.tertiary;

              const iconBg = isTransfer
                ? theme.tertiary
                : cat?.color || theme.primary;

              return (
                <TouchableOpacity
                  key={tx.id}
                  style={[
                    styles.txCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.divider,
                    },
                    M3Elevation.level1,
                  ]}
                  onPress={() => {
                    onClose();
                    onSelectTransaction(tx);
                  }}
                  activeOpacity={0.7}
                >
                  {/* Category / Transfer Icon */}
                  <View style={[styles.txIconCircle, { backgroundColor: iconBg }]}>
                    <MaterialCommunityIcons
                      name={isTransfer ? 'swap-horizontal' : (cat?.icon as any) || 'cash'}
                      size={20}
                      color="#FFFFFF"
                    />
                  </View>

                  {/* Main Details */}
                  <View style={styles.txDetailsCol}>
                    <View style={styles.txTopRow}>
                      <Text style={[styles.txTitle, { color: theme.onSurface }]} numberOfLines={1}>
                        {isTransfer
                          ? `Transfer: ${wal?.name || 'Wallet'} → ${toWal?.name || 'Wallet'}`
                          : sub
                          ? `${cat?.name}: ${sub.name}`
                          : cat?.name || 'Uncategorized'}
                      </Text>
                      <Text style={[styles.txAmount, { color: amountColor }]}>
                        {isExpense ? '-' : isIncome ? '+' : ''}
                        {formatCurrency(tx.amount, tx.currency || baseCurrency)}
                      </Text>
                    </View>

                    {Boolean(tx.note) && (
                      <Text style={[styles.txNote, { color: theme.onSurfaceVariant }]} numberOfLines={1}>
                        {tx.note}
                      </Text>
                    )}

                    {/* Metadata Badges */}
                    <View style={styles.txMetaRow}>
                      {Boolean(tx.updated_at) ? (
                        <View style={[styles.auditBadge, { backgroundColor: theme.tertiaryContainer || '#EDE9FE' }]}>
                          <MaterialCommunityIcons
                            name="clock-edit-outline"
                            size={12}
                            color={theme.tertiary || '#6D28D9'}
                          />
                          <Text
                            style={[
                              styles.auditBadgeText,
                              { color: theme.onTertiaryContainer || '#5B21B6' },
                            ]}
                          >
                            Edited: {formatEditDate(tx.updated_at)}
                          </Text>
                        </View>
                      ) : (
                        <View style={[styles.auditBadge, { backgroundColor: theme.pillBg || '#F3F4F6' }]}>
                          <MaterialCommunityIcons
                            name="clock-plus-outline"
                            size={12}
                            color={theme.onSurfaceVariant}
                          />
                          <Text style={[styles.auditBadgeText, { color: theme.onSurfaceVariant }]}>
                            Created: {formatEditDate(tx.created_at)}
                          </Text>
                        </View>
                      )}

                      <Text style={[styles.txOriginalDate, { color: theme.onSurfaceVariant }]}>
                        Tx Date: {tx.date}
                      </Text>
                    </View>
                  </View>

                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={theme.onSurfaceVariant}
                    style={{ marginLeft: 4 }}
                  />
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  filterToggleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  chipRow: {
    marginTop: 10,
    marginBottom: 6,
  },
  chipScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  txIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txDetailsCol: {
    flex: 1,
  },
  txTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  txNote: {
    fontSize: 12,
    marginTop: 2,
  },
  txMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  auditBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  auditBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  txOriginalDate: {
    fontSize: 11,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  viewAllBtn: {
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  viewAllBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
