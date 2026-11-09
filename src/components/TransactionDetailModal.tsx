import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Transaction, Category, Wallet, RecurringBill } from '../types';
import { formatCurrency } from '../utils/format';
import { M3Elevation, M3Shape } from '../theme';

interface TransactionDetailModalProps {
  visible: boolean;
  transaction: Transaction | null;
  categories: Category[];
  wallets: Wallet[];
  recurringBills?: RecurringBill[];
  theme: any;
  baseCurrency: string;
  onClose: () => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  visible,
  transaction,
  categories,
  wallets,
  recurringBills,
  theme,
  baseCurrency,
  onClose,
  onEdit,
  onDelete,
}) => {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? Math.max(StatusBar.currentHeight || 0, 28) : 0);
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 48 : 20);
  const [photoPreviewVisible, setPhotoPreviewVisible] = useState(false);

  const linkedBill = useMemo(() => {
    if (!transaction || !recurringBills) return undefined;
    if (transaction.recurring_bill_id) {
      const found = recurringBills.find((b) => b.id === transaction.recurring_bill_id);
      if (found) return found;
    }
    // Fallback: match by note/name, amount, wallet
    return recurringBills.find(
      (b) =>
        b.wallet_id === transaction.wallet_id &&
        Math.abs(b.amount - transaction.amount) < 0.01 &&
        (b.name === transaction.note || (transaction.note && b.name.includes(transaction.note)))
    );
  }, [transaction, recurringBills]);

  if (!visible || !transaction) return null;

  const isExpense = transaction.type === 'expense';
  const isIncome = transaction.type === 'income';
  const isTransfer = transaction.type === 'transfer';

  const category = categories.find((c) => c.id === transaction.category_id);
  const subcategory = category?.subcategories?.find((s) => s.id === transaction.subcategory_id);
  const wallet = wallets.find((w) => w.id === transaction.wallet_id);
  const toWallet = transaction.to_wallet_id ? wallets.find((w) => w.id === transaction.to_wallet_id) : undefined;

  // Format date nicely: e.g. "Saturday, 31 October 2026"
  const formattedFullDate = (() => {
    try {
      const parts = transaction.date.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      }
      return transaction.date;
    } catch {
      return transaction.date;
    }
  })();

  const typeColor = isExpense
    ? theme.error
    : isIncome
    ? theme.success
    : theme.tertiary;

  const typeContainerColor = isExpense
    ? theme.errorContainer
    : isIncome
    ? theme.successContainer
    : theme.tertiaryContainer || theme.primaryContainer;

  const onTypeContainerColor = isExpense
    ? theme.onErrorContainer
    : isIncome
    ? theme.onSuccessContainer
    : theme.onTertiaryContainer || theme.onPrimaryContainer;

  const handleDeletePrompt = () => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to permanently delete this transaction? Wallet balances will be adjusted automatically.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete(transaction.id);
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent={true} onRequestClose={onClose}>
      <View style={[styles.safeArea, { backgroundColor: theme.background }]}>
        {/* Top App Bar */}
        <View
          style={[
            styles.topBarWrapper,
            {
              backgroundColor: theme.surface,
              borderBottomColor: theme.divider,
              paddingTop: topInset,
            },
          ]}
        >
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.backBtn, { backgroundColor: theme.pillBg }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="arrow-left" size={20} color={theme.onSurface} />
            </TouchableOpacity>

            <Text style={[styles.topBarTitle, { color: theme.onSurface }]}>Transaction Details</Text>

            <View style={styles.topBarActions}>
              <TouchableOpacity
                onPress={handleDeletePrompt}
                style={[styles.topIconBtn, { backgroundColor: theme.pillBg }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.error} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  onEdit(transaction);
                }}
                style={[styles.topIconBtn, { backgroundColor: theme.primaryContainer }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="pencil-outline" size={18} color={theme.onPrimaryContainer} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Amount & Category Card */}
          <View style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.divider }, M3Elevation.level1]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.typeBadge, { backgroundColor: typeContainerColor }]}>
                <MaterialCommunityIcons
                  name={
                    isExpense
                      ? 'arrow-down-circle'
                      : isIncome
                      ? 'arrow-up-circle'
                      : 'swap-horizontal-circle'
                  }
                  size={16}
                  color={typeColor}
                />
                <Text style={[styles.typeBadgeText, { color: onTypeContainerColor }]}>
                  {isExpense ? 'EXPENSE' : isIncome ? 'INCOME' : 'TRANSFER'}
                </Text>
              </View>

              {Boolean(linkedBill) && (
                <View style={[styles.recurringHeaderBadge, { backgroundColor: theme.primaryContainer }]}>
                  <MaterialCommunityIcons name="calendar-sync" size={13} color={theme.primary} />
                  <Text style={[styles.recurringHeaderBadgeText, { color: theme.onPrimaryContainer }]}>
                    RECURRING
                  </Text>
                </View>
              )}
            </View>

            <Text style={[styles.heroAmount, { color: typeColor }]}>
              {isExpense ? '-' : isIncome ? '+' : ''}
              {formatCurrency(transaction.amount, transaction.currency || baseCurrency)}
            </Text>

            {/* Category / Title pill */}
            <View style={styles.categoryPillRow}>
              <View
                style={[
                  styles.categoryDot,
                  { backgroundColor: isTransfer ? theme.tertiary : category?.color || theme.primary },
                ]}
              >
                <MaterialCommunityIcons
                  name={isTransfer ? 'swap-horizontal' : (category?.icon as any) || 'cash'}
                  size={18}
                  color="#FFFFFF"
                />
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text style={[styles.categoryPillName, { color: theme.onSurface }]} numberOfLines={1}>
                  {isTransfer ? 'Wallet Transfer' : category?.name || 'Uncategorized'}
                </Text>
                {subcategory && (
                  <Text style={[styles.subcategoryPillText, { color: theme.onSurfaceVariant }]} numberOfLines={1}>
                    Subcategory: {subcategory.name}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Details Section */}
          <View style={[styles.detailsSection, { backgroundColor: theme.surface, borderColor: theme.divider }, M3Elevation.level1]}>
            <Text style={[styles.sectionHeading, { color: theme.onSurfaceVariant }]}>TRANSACTION INFO</Text>

            {/* Wallet Row */}
            <View style={[styles.detailRow, { borderBottomColor: theme.divider }]}>
              <View style={[styles.detailIconCircle, { backgroundColor: theme.pillBg }]}>
                <MaterialCommunityIcons name={(wallet?.icon as any) || 'wallet'} size={18} color={wallet?.color || theme.primary} />
              </View>
              <View style={styles.detailCol}>
                <Text style={[styles.detailLabel, { color: theme.onSurfaceVariant }]}>
                  {isExpense ? 'Paid From' : isIncome ? 'Deposited To' : 'From Wallet'}
                </Text>
                <Text style={[styles.detailValue, { color: theme.onSurface }]}>
                  {wallet?.name || 'Unknown Wallet'}
                </Text>
              </View>
            </View>

            {/* To Wallet (If Transfer) */}
            {isTransfer && toWallet && (
              <View style={[styles.detailRow, { borderBottomColor: theme.divider }]}>
                <View style={[styles.detailIconCircle, { backgroundColor: theme.pillBg }]}>
                  <MaterialCommunityIcons name={(toWallet.icon as any) || 'wallet'} size={18} color={toWallet.color || theme.primary} />
                </View>
                <View style={styles.detailCol}>
                  <Text style={[styles.detailLabel, { color: theme.onSurfaceVariant }]}>Destination Wallet</Text>
                  <Text style={[styles.detailValue, { color: theme.onSurface }]}>{toWallet.name}</Text>
                </View>
              </View>
            )}

            {/* Date Row */}
            <View style={[styles.detailRow, { borderBottomColor: theme.divider }]}>
              <View style={[styles.detailIconCircle, { backgroundColor: theme.pillBg }]}>
                <MaterialCommunityIcons name="calendar-month-outline" size={18} color={theme.primary} />
              </View>
              <View style={styles.detailCol}>
                <Text style={[styles.detailLabel, { color: theme.onSurfaceVariant }]}>Date</Text>
                <Text style={[styles.detailValue, { color: theme.onSurface }]}>{formattedFullDate}</Text>
              </View>
            </View>

            {/* Time Row */}
            <View style={[styles.detailRow, { borderBottomColor: theme.divider }]}>
              <View style={[styles.detailIconCircle, { backgroundColor: theme.pillBg }]}>
                <MaterialCommunityIcons name="clock-outline" size={18} color={theme.secondary || theme.primary} />
              </View>
              <View style={styles.detailCol}>
                <Text style={[styles.detailLabel, { color: theme.onSurfaceVariant }]}>Time</Text>
                <Text style={[styles.detailValue, { color: theme.onSurface }]}>
                  {transaction.time || 'Not specified'}
                </Text>
              </View>
            </View>

            {/* Payment Status Row */}
            <View style={[styles.detailRow, { borderBottomColor: theme.divider }]}>
              <View style={[styles.detailIconCircle, { backgroundColor: theme.pillBg }]}>
                <MaterialCommunityIcons
                  name={transaction.is_paid !== false ? 'check-decagram-outline' : 'clock-alert-outline'}
                  size={18}
                  color={transaction.is_paid !== false ? theme.success : theme.error}
                />
              </View>
              <View style={styles.detailCol}>
                <Text style={[styles.detailLabel, { color: theme.onSurfaceVariant }]}>Payment Status</Text>
                <Text style={[styles.detailValue, { color: transaction.is_paid !== false ? theme.success : theme.error }]}>
                  {transaction.is_paid !== false ? 'Paid & Cleared' : 'Pending / Unpaid'}
                </Text>
              </View>
            </View>

            {/* Recurring Status Row */}
            {Boolean(linkedBill) && (
              <View style={[styles.detailRow, { borderBottomColor: transaction.note || transaction.media_uri ? theme.divider : 'transparent' }]}>
                <View style={[styles.detailIconCircle, { backgroundColor: theme.primaryContainer }]}>
                  <MaterialCommunityIcons name="calendar-sync" size={18} color={theme.primary} />
                </View>
                <View style={styles.detailCol}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.detailLabel, { color: theme.onSurfaceVariant }]}>Recurring Commitment</Text>
                    <View style={[styles.recurringBadge, { backgroundColor: theme.primaryContainer }]}>
                      <Text style={[styles.recurringBadgeText, { color: theme.onPrimaryContainer }]}>
                        {linkedBill!.frequency.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.detailValue, { color: theme.onSurface }]}>
                    {linkedBill!.frequency === 'weekly'
                      ? `Every week (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][linkedBill!.due_day % 7]})`
                      : linkedBill!.frequency === 'yearly'
                      ? `Every year (Day ${linkedBill!.due_day})`
                      : `Every month (Day ${linkedBill!.due_day})`}
                    {linkedBill!.end_type === 'after_occurrences'
                      ? ` • ${linkedBill!.occurrences_count || 0}/${linkedBill!.end_occurrences} paid`
                      : linkedBill!.end_type === 'on_date'
                      ? ` • Ends ${linkedBill!.end_date}`
                      : ' • Repeats indefinitely'}
                  </Text>
                  <Text style={[styles.recurringSubText, { color: theme.primary }]}>
                    Next Due: {linkedBill!.next_due_date} • {linkedBill!.reminder_enabled ? 'Reminder on' : 'No alert'}
                  </Text>
                </View>
              </View>
            )}

            {/* Note / Memo Row */}
            {Boolean(transaction.note) && (
              <View style={[styles.detailRow, { borderBottomColor: transaction.media_uri ? theme.divider : 'transparent' }]}>
                <View style={[styles.detailIconCircle, { backgroundColor: theme.pillBg }]}>
                  <MaterialCommunityIcons name="note-text-outline" size={18} color={theme.onSurfaceVariant} />
                </View>
                <View style={styles.detailCol}>
                  <Text style={[styles.detailLabel, { color: theme.onSurfaceVariant }]}>Note / Memo</Text>
                  <Text style={[styles.detailNoteValue, { color: theme.onSurface }]}>{transaction.note}</Text>
                </View>
              </View>
            )}

            {/* Receipt / Attachment Preview */}
            {Boolean(transaction.media_uri) && (
              <View style={[styles.detailRow, { borderBottomColor: 'transparent', flexDirection: 'column', alignItems: 'flex-start' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <View style={[styles.detailIconCircle, { backgroundColor: theme.pillBg }]}>
                    <MaterialCommunityIcons name="receipt" size={18} color={theme.primary} />
                  </View>
                  <Text style={[styles.detailLabel, { color: theme.onSurfaceVariant }]}>Attached Receipt</Text>
                </View>

                <TouchableOpacity
                  onPress={() => setPhotoPreviewVisible(true)}
                  style={[styles.receiptImageContainer, { borderColor: theme.divider }]}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: transaction.media_uri }} style={styles.receiptThumb} resizeMode="cover" />
                  <View style={styles.expandPill}>
                    <MaterialCommunityIcons name="magnify-plus-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.expandPillText}>Tap to enlarge</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Action Buttons Footer */}
        <View
          style={[
            styles.footerBar,
            {
              backgroundColor: theme.surface,
              borderTopColor: theme.divider,
              paddingBottom: bottomInset + 12,
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.deleteActionBtn, { borderColor: theme.error, backgroundColor: theme.pillBg }]}
            onPress={handleDeletePrompt}
            activeOpacity={0.7}
            accessibilityLabel="Delete Transaction"
          >
            <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.error} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.doneActionBtn, { backgroundColor: theme.primary }, M3Elevation.level2]}
            onPress={onClose}
            activeOpacity={0.85}
            accessibilityLabel="Done"
          >
            <MaterialCommunityIcons name="check" size={18} color={theme.onPrimary} />
            <Text style={[styles.doneActionBtnText, { color: theme.onPrimary }]}>Done</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.editActionBtn, { borderColor: theme.outlineVariant, backgroundColor: theme.pillBg }]}
            onPress={() => onEdit(transaction)}
            activeOpacity={0.7}
            accessibilityLabel="Edit Transaction"
          >
            <MaterialCommunityIcons name="pencil-outline" size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {/* FULLSCREEN PHOTO PREVIEW MODAL */}
        {photoPreviewVisible && Boolean(transaction.media_uri) && (
          <Modal visible={photoPreviewVisible} transparent animationType="fade" statusBarTranslucent={true} onRequestClose={() => setPhotoPreviewVisible(false)}>
            <View style={styles.photoOverlay}>
              <TouchableOpacity
                style={[styles.photoCloseBtn, { top: topInset + 12 }]}
                onPress={() => setPhotoPreviewVisible(false)}
              >
                <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Image source={{ uri: transaction.media_uri }} style={styles.photoFull} resizeMode="contain" />
            </View>
          </Modal>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topBarWrapper: {
    borderBottomWidth: 1,
  },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 24,
  },
  heroCard: {
    borderRadius: M3Shape.extraLarge,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  recurringHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  recurringHeaderBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  categoryPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: M3Shape.medium,
    maxWidth: '100%',
  },
  categoryDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryPillName: {
    fontSize: 16,
    fontWeight: '700',
  },
  subcategoryPillText: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  detailsSection: {
    borderRadius: M3Shape.large,
    padding: 16,
    borderWidth: 1,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  detailIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  detailCol: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  recurringBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  recurringBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  recurringSubText: {
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 2,
  },
  detailNoteValue: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  receiptImageContainer: {
    width: '100%',
    height: 180,
    borderRadius: M3Shape.medium,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  receiptThumb: {
    width: '100%',
    height: '100%',
  },
  expandPill: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  expandPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  deleteActionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneActionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  doneActionBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  editActionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoCloseBtn: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoFull: {
    width: '92%',
    height: '80%',
  },
});

