import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBudget } from '../context/BudgetContext';
import { lightTheme, darkTheme, M3Shape, M3Elevation } from '../theme';
import { Wallet, Transaction } from '../types';
import { formatCurrency, formatTypingNumber, parseCleanNumber } from '../utils/format';
import { TransactionDetailModal } from '../components/TransactionDetailModal';

export const WalletsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    wallets,
    totalConvertedBalance,
    settings,
    addWallet,
    updateWallet,
    deleteWallet,
    transferBetweenWallets,
    transactions,
    categories,
    deleteTransaction,
  } = useBudget();

  const theme = settings.theme_mode === 'dark' ? darkTheme : lightTheme;

  // Modals
  const [walletModalVisible, setWalletModalVisible] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);

  // Selected Wallet Detail & Transaction Viewer States
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null);

  const currentSelectedWallet = wallets.find((w) => w.id === selectedWallet?.id) || selectedWallet;

  // Transactions belonging to the currently viewed wallet
  const walletTransactions = useMemo(() => {
    if (!currentSelectedWallet) return [];
    return transactions
      .filter((t) => t.wallet_id === currentSelectedWallet.id)
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        const timeA = a.time || '';
        const timeB = b.time || '';
        return timeB.localeCompare(timeA);
      });
  }, [transactions, currentSelectedWallet]);

  // Wallet stats: total inflow, total outflow, net activity
  const walletStats = useMemo(() => {
    if (!currentSelectedWallet) return { inflow: 0, outflow: 0, net: 0 };
    let inflow = 0;
    let outflow = 0;
    for (const t of walletTransactions) {
      const amt = t.amount || t.base_amount || 0;
      if (t.type === 'income') {
        inflow += amt;
      } else if (t.type === 'expense' || t.type === 'transfer') {
        outflow += amt;
      }
    }
    return {
      inflow,
      outflow,
      net: inflow - outflow,
    };
  }, [walletTransactions, currentSelectedWallet]);

  // Grouped wallet transactions by date
  const groupedWalletTransactions = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    walletTransactions.forEach((tx) => {
      const d = tx.date;
      if (!map.has(d)) {
        map.set(d, []);
      }
      map.get(d)!.push(tx);
    });

    const groups: {
      date: string;
      displayDate: string;
      totalSpent: number;
      totalIncome: number;
      items: Transaction[];
    }[] = [];

    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .forEach(([d, items]) => {
        let displayDate = d;
        if (d === todayStr) displayDate = 'Today';
        else if (d === yesterdayStr) displayDate = 'Yesterday';

        const daySpent = items
          .filter((t) => t.type === 'expense' || t.type === 'transfer')
          .reduce((sum, t) => sum + (t.amount || t.base_amount || 0), 0);
        const dayIncome = items
          .filter((t) => t.type === 'income')
          .reduce((sum, t) => sum + (t.amount || t.base_amount || 0), 0);

        groups.push({
          date: d,
          displayDate,
          totalSpent: daySpent,
          totalIncome: dayIncome,
          items,
        });
      });

    return groups;
  }, [walletTransactions]);

  // New / Edit Wallet form states
  const [walletName, setWalletName] = useState('');
  const [walletCurrency, setWalletCurrency] = useState('USD');
  const [walletStartingBalance, setWalletStartingBalance] = useState('');
  const [walletCurrentBalance, setWalletCurrentBalance] = useState('');
  const [walletColor, setWalletColor] = useState('#10B981');
  const [walletIcon, setWalletIcon] = useState('wallet');

  // Transfer form states
  const [fromWalletId, setFromWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');

  const colors = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4', '#6366F1'];
  const icons: (keyof typeof MaterialCommunityIcons.glyphMap)[] = [
    'wallet', 'bank', 'cash', 'piggy-bank', 'credit-card-outline', 'cellphone', 'safe',
  ];

  const handleOpenAddWallet = () => {
    setEditingWallet(null);
    setWalletName('');
    setWalletCurrency(settings.base_currency);
    setWalletStartingBalance('0');
    setWalletCurrentBalance('0');
    setWalletColor(colors[Math.floor(Math.random() * colors.length)]);
    setWalletIcon('wallet');
    setWalletModalVisible(true);
  };

  const handleOpenEditWallet = (w: Wallet) => {
    setEditingWallet(w);
    setWalletName(w.name);
    setWalletCurrency(w.currency);
    setWalletStartingBalance(formatTypingNumber(w.starting_balance.toString()));
    setWalletCurrentBalance(formatTypingNumber(w.current_balance.toString()));
    setWalletColor(w.color);
    setWalletIcon(w.icon as any);
    setWalletModalVisible(true);
  };

  const handleSaveWallet = async () => {
    if (!walletName.trim()) return;
    const startBal = parseCleanNumber(walletStartingBalance);
    const currBal = parseCleanNumber(walletCurrentBalance);

    if (editingWallet) {
      await updateWallet({
        ...editingWallet,
        name: walletName.trim(),
        currency: walletCurrency,
        current_balance: currBal,
        color: walletColor,
        icon: walletIcon,
      });
    } else {
      await addWallet({
        name: walletName.trim(),
        currency: walletCurrency,
        starting_balance: startBal,
        color: walletColor,
        icon: walletIcon,
      });
    }
    setWalletModalVisible(false);
  };

  const handleOpenTransfer = (defaultFromId?: string) => {
    if (wallets.length < 2) {
      Alert.alert('Transfer requires at least 2 wallets', 'Please add another wallet first.');
      return;
    }
    const from = defaultFromId || wallets[0].id;
    const to = wallets.find((w) => w.id !== from)?.id || wallets[1].id;
    setFromWalletId(from);
    setToWalletId(to);
    setTransferAmount('');
    setTransferNote('');
    setTransferModalVisible(true);
  };

  const handleExecuteTransfer = async () => {
    const amt = parseCleanNumber(transferAmount);
    if (amt <= 0) return;
    if (fromWalletId === toWalletId) return;

    await transferBetweenWallets({
      from_wallet_id: fromWalletId,
      to_wallet_id: toWalletId,
      amount: amt,
      date: new Date().toISOString().slice(0, 10),
      note: transferNote || undefined,
    });

    setTransferModalVisible(false);
  };

  // Calculate transfer preview
  const calculateTransferPreview = () => {
    const amt = parseCleanNumber(transferAmount);
    if (amt <= 0) return null;
    return formatCurrency(amt, settings.base_currency);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* TOTAL NET WORTH HERO CARD */}
        <View style={[styles.totalCard, { backgroundColor: theme.primaryContainer }, M3Elevation.level2]}>
          <Text style={[styles.totalLabel, { color: theme.onPrimaryContainer }]}>TOTAL NET WORTH</Text>
          <Text style={[styles.totalAmount, { color: theme.onPrimaryContainer }]}>
            {formatCurrency(totalConvertedBalance, settings.base_currency)}
          </Text>
          <Text style={[styles.totalSub, { color: theme.onPrimaryContainer }]}>
            Combined balance across {wallets.length} active wallets
          </Text>
        </View>

        {/* WALLET ACTIONS BAR */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.primary }]}
            onPress={handleOpenAddWallet}
          >
            <MaterialCommunityIcons name="wallet-plus" size={18} color={theme.onPrimary} />
            <Text style={[styles.actionBtnText, { color: theme.onPrimary }]}>New Wallet</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.cardBg, borderColor: theme.primary, borderWidth: 1 }]}
            onPress={() => handleOpenTransfer()}
          >
            <MaterialCommunityIcons name="swap-horizontal" size={18} color={theme.primary} />
            <Text style={[styles.actionBtnText, { color: theme.primary }]}>Transfer Funds</Text>
          </TouchableOpacity>
        </View>

        {/* WALLETS LIST */}
        <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>My Wallets & Accounts</Text>

        {wallets.length === 0 ? (
          <View style={[styles.emptyWalletCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}>
            <View style={[styles.emptyWalletIconCircle, { backgroundColor: theme.primaryContainer }]}>
              <MaterialCommunityIcons name="wallet-plus" size={32} color={theme.primary} />
            </View>
            <Text style={[styles.emptyWalletTitle, { color: theme.onSurface }]}>No Wallets Registered Yet</Text>
            <Text style={[styles.emptyWalletSub, { color: theme.onSurfaceVariant }]}>
              Register your first wallet (like Cash, Bank Account, or Mobile Money) to start tracking balances and recording transactions.
            </Text>
            <TouchableOpacity
              style={[styles.emptyAddBtn, { backgroundColor: theme.primary }]}
              onPress={handleOpenAddWallet}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="plus" size={18} color={theme.onPrimary} />
              <Text style={[styles.emptyAddBtnText, { color: theme.onPrimary }]}>Register Your First Wallet</Text>
            </TouchableOpacity>
          </View>
        ) : (
          wallets.map((w) => {
            return (
              <TouchableOpacity
                key={w.id}
                style={[styles.walletCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}
                onPress={() => setSelectedWallet(w)}
                activeOpacity={0.7}
              >
                <View style={styles.walletCardTop}>
                  <View style={[styles.walletIconCircle, { backgroundColor: w.color }]}>
                    <MaterialCommunityIcons name={w.icon as any} size={22} color="#FFFFFF" />
                  </View>

                  <View style={styles.walletDetails}>
                    <Text style={[styles.walletName, { color: theme.onSurface }]}>{w.name}</Text>
                    <Text style={[styles.walletCurrencyBadge, { color: theme.onSurfaceVariant }]}>
                      {settings.base_currency} Account
                    </Text>
                  </View>

                  <View style={styles.cardChevronWrap}>
                    <MaterialCommunityIcons name="chevron-right" size={24} color={theme.onSurfaceVariant} />
                  </View>
                </View>

                <View style={[styles.dividerLine, { backgroundColor: theme.divider }]} />

                <View style={styles.balanceGrid}>
                  <View style={styles.balCol}>
                    <Text style={[styles.balLabel, { color: theme.onSurfaceVariant }]}>STARTING</Text>
                    <Text style={[styles.balValue, { color: theme.onSurfaceVariant }]}>
                      {formatCurrency(w.starting_balance, w.currency)}
                    </Text>
                  </View>

                  <View style={styles.balCol}>
                    <Text style={[styles.balLabel, { color: theme.primary }]}>REMAINING BALANCE</Text>
                    <Text
                      style={[
                        styles.balCurrent,
                        { color: w.current_balance < 0 ? theme.error : theme.onSurface },
                      ]}
                    >
                      {formatCurrency(w.current_balance, settings.base_currency)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* ADD / EDIT WALLET MODAL */}
      <Modal visible={walletModalVisible} transparent animationType="slide" onRequestClose={() => setWalletModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.onSurface }]}>
                {editingWallet ? 'Edit Wallet' : 'New Wallet'}
              </Text>
              <TouchableOpacity onPress={() => setWalletModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={theme.onSurface} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>Wallet Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                placeholder="e.g. Cash, M-Pesa, Barclay's Bank"
                placeholderTextColor={theme.onSurfaceVariant}
                value={walletName}
                onChangeText={setWalletName}
              />

              {!editingWallet && (
                <>
                  <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>
                    Starting Balance ({settings.base_currency})
                  </Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                    keyboardType="decimal-pad"
                    value={walletStartingBalance}
                    onChangeText={(t) => setWalletStartingBalance(formatTypingNumber(t))}
                  />
                </>
              )}

              {editingWallet && (
                <>
                  <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>
                    Adjust Current Balance ({settings.base_currency})
                  </Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                    keyboardType="decimal-pad"
                    value={walletCurrentBalance}
                    onChangeText={(t) => setWalletCurrentBalance(formatTypingNumber(t))}
                  />
                </>
              )}

              <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>Color</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                {colors.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c },
                      walletColor === c && { borderWidth: 3, borderColor: theme.onSurface },
                    ]}
                    onPress={() => setWalletColor(c)}
                  />
                ))}
              </ScrollView>

              <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>Icon</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                {icons.map((ic) => (
                  <TouchableOpacity
                    key={ic}
                    style={[
                      styles.iconCircle,
                      { backgroundColor: walletIcon === ic ? walletColor : theme.pillBg },
                    ]}
                    onPress={() => setWalletIcon(ic)}
                  >
                    <MaterialCommunityIcons
                      name={ic}
                      size={20}
                      color={walletIcon === ic ? '#FFFFFF' : theme.onSurface}
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: theme.pillBg }]}
                onPress={() => setWalletModalVisible(false)}
              >
                <Text style={[styles.btnText, { color: theme.onSurface }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                onPress={handleSaveWallet}
              >
                <Text style={[styles.btnText, { color: theme.onPrimary }]}>
                  {editingWallet ? 'Save Changes' : 'Create Wallet'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* TRANSFER MODAL */}
      <Modal visible={transferModalVisible} transparent animationType="slide" onRequestClose={() => setTransferModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.onSurface }]}>Transfer Between Wallets</Text>
              <TouchableOpacity onPress={() => setTransferModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={theme.onSurface} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>From Wallet</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              {wallets.map((w) => (
                <TouchableOpacity
                  key={w.id}
                  style={[
                    styles.pillChoice,
                    { backgroundColor: fromWalletId === w.id ? theme.primary : theme.pillBg },
                  ]}
                  onPress={() => setFromWalletId(w.id)}
                >
                  <Text
                    style={[
                      styles.pillChoiceText,
                      { color: fromWalletId === w.id ? theme.onPrimary : theme.onSurface },
                    ]}
                  >
                    {w.name} ({w.currency})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>To Wallet</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              {wallets
                .filter((w) => w.id !== fromWalletId)
                .map((w) => (
                  <TouchableOpacity
                    key={w.id}
                    style={[
                      styles.pillChoice,
                      { backgroundColor: toWalletId === w.id ? theme.primary : theme.pillBg },
                    ]}
                    onPress={() => setToWalletId(w.id)}
                  >
                    <Text
                      style={[
                        styles.pillChoiceText,
                        { color: toWalletId === w.id ? theme.onPrimary : theme.onSurface },
                      ]}
                    >
                      {w.name} ({w.currency})
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>

            <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>
              Amount to Transfer ({wallets.find((w) => w.id === fromWalletId)?.currency})
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={theme.onSurfaceVariant}
              value={transferAmount}
              onChangeText={(t) => setTransferAmount(formatTypingNumber(t))}
            />

            {calculateTransferPreview() && (
              <View style={[styles.previewBox, { backgroundColor: theme.secondaryContainer }]}>
                <MaterialCommunityIcons name="calculator" size={18} color={theme.onSecondaryContainer} />
                <Text style={[styles.previewText, { color: theme.onSecondaryContainer }]}>
                  Destination receives: {calculateTransferPreview()}
                </Text>
              </View>
            )}

            <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>Note (Optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
              placeholder="e.g. ATM withdrawal, mobile top-up"
              placeholderTextColor={theme.onSurfaceVariant}
              value={transferNote}
              onChangeText={setTransferNote}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: theme.pillBg }]}
                onPress={() => setTransferModalVisible(false)}
              >
                <Text style={[styles.btnText, { color: theme.onSurface }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                onPress={handleExecuteTransfer}
              >
                <Text style={[styles.btnText, { color: theme.onPrimary }]}>Execute Transfer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* WALLET DETAIL MODAL */}
      <Modal
        visible={Boolean(selectedWallet)}
        animationType="slide"
        onRequestClose={() => setSelectedWallet(null)}
      >
        <View style={[styles.detailContainer, { backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          {/* TOP NAV BAR */}
          <View style={[styles.detailNavBar, { borderBottomColor: theme.divider, backgroundColor: theme.surface }]}>
            <TouchableOpacity
              style={styles.detailNavBackBtn}
              onPress={() => setSelectedWallet(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color={theme.onSurface} />
            </TouchableOpacity>

            <View style={styles.detailNavTitleWrap}>
              <Text style={[styles.detailNavTitle, { color: theme.onSurface }]} numberOfLines={1}>
                {currentSelectedWallet?.name || 'Wallet Details'}
              </Text>
              <Text style={[styles.detailNavSubtitle, { color: theme.onSurfaceVariant }]}>
                {settings.base_currency} Account
              </Text>
            </View>

            <View style={styles.detailNavActions}>
              {/* EDIT BUTTON MOVED HERE */}
              <TouchableOpacity
                style={[styles.detailActionBtn, { backgroundColor: theme.pillBg }]}
                onPress={() => {
                  if (currentSelectedWallet) {
                    handleOpenEditWallet(currentSelectedWallet);
                  }
                }}
                accessibilityLabel="Edit Wallet"
              >
                <MaterialCommunityIcons name="pencil-outline" size={18} color={theme.onSurface} />
              </TouchableOpacity>

              {/* DELETE BUTTON MOVED HERE */}
              {wallets.length > 1 && (
                <TouchableOpacity
                  style={[styles.detailActionBtn, { backgroundColor: theme.errorContainer }]}
                  onPress={() => {
                    if (!currentSelectedWallet) return;
                    Alert.alert(
                      'Delete Wallet',
                      `Are you sure you want to delete "${currentSelectedWallet.name}"? Transactions associated with this wallet will be removed.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: async () => {
                            await deleteWallet(currentSelectedWallet.id);
                            setSelectedWallet(null);
                          },
                        },
                      ]
                    );
                  }}
                  accessibilityLabel="Delete Wallet"
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.onErrorContainer} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailScrollContent}>
            {/* HERO WALLET CARD */}
            {currentSelectedWallet && (
              <View style={[styles.detailHeroCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level2]}>
                <View style={styles.detailHeroTop}>
                  <View style={[styles.detailIconCircle, { backgroundColor: currentSelectedWallet.color }]}>
                    <MaterialCommunityIcons name={currentSelectedWallet.icon as any} size={28} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.detailHeroName, { color: theme.onSurface }]}>
                      {currentSelectedWallet.name}
                    </Text>
                    <Text style={[styles.detailHeroCurrency, { color: theme.onSurfaceVariant }]}>
                      Starting: {formatCurrency(currentSelectedWallet.starting_balance, settings.base_currency)}
                    </Text>
                  </View>
                </View>

                {/* CURRENT BALANCE */}
                <View style={styles.detailBalanceWrap}>
                  <Text style={[styles.detailBalanceLabel, { color: theme.onSurfaceVariant }]}>
                    CURRENT BALANCE
                  </Text>
                  <Text
                    style={[
                      styles.detailBalanceAmount,
                      { color: currentSelectedWallet.current_balance < 0 ? theme.error : theme.primary },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {formatCurrency(currentSelectedWallet.current_balance, settings.base_currency)}
                  </Text>
                </View>

                {/* STATS TILES (INFLOW, OUTFLOW, NET) */}
                <View style={[styles.detailStatsGrid, { borderTopColor: theme.divider }]}>
                  <View style={styles.detailStatTile}>
                    <View style={styles.detailStatHeader}>
                      <MaterialCommunityIcons name="arrow-bottom-left" size={14} color={theme.success} />
                      <Text style={[styles.detailStatLabel, { color: theme.onSurfaceVariant }]}>INFLOW</Text>
                    </View>
                    <Text style={[styles.detailStatValue, { color: theme.success }]} numberOfLines={1}>
                      +{formatCurrency(walletStats.inflow, settings.base_currency)}
                    </Text>
                  </View>

                  <View style={[styles.detailStatDivider, { backgroundColor: theme.divider }]} />

                  <View style={styles.detailStatTile}>
                    <View style={styles.detailStatHeader}>
                      <MaterialCommunityIcons name="arrow-top-right" size={14} color={theme.error} />
                      <Text style={[styles.detailStatLabel, { color: theme.onSurfaceVariant }]}>OUTFLOW</Text>
                    </View>
                    <Text style={[styles.detailStatValue, { color: theme.error }]} numberOfLines={1}>
                      -{formatCurrency(walletStats.outflow, settings.base_currency)}
                    </Text>
                  </View>

                  <View style={[styles.detailStatDivider, { backgroundColor: theme.divider }]} />

                  <View style={styles.detailStatTile}>
                    <View style={styles.detailStatHeader}>
                      <MaterialCommunityIcons
                        name={walletStats.net >= 0 ? 'trending-up' : 'trending-down'}
                        size={14}
                        color={walletStats.net >= 0 ? theme.success : theme.error}
                      />
                      <Text style={[styles.detailStatLabel, { color: theme.onSurfaceVariant }]}>NET</Text>
                    </View>
                    <Text
                      style={[
                        styles.detailStatValue,
                        { color: walletStats.net >= 0 ? theme.success : theme.error },
                      ]}
                      numberOfLines={1}
                    >
                      {walletStats.net >= 0 ? '+' : ''}{formatCurrency(walletStats.net, settings.base_currency)}
                    </Text>
                  </View>
                </View>

                {/* TRANSFER ACTION PILL */}
                <TouchableOpacity
                  style={[styles.detailTransferBtn, { backgroundColor: theme.pillBg }]}
                  onPress={() => handleOpenTransfer(currentSelectedWallet.id)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="swap-horizontal" size={18} color={theme.primary} />
                  <Text style={[styles.detailTransferBtnText, { color: theme.primary }]}>
                    Transfer Funds From This Wallet
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* TRANSACTIONS SECTION */}
            <View style={styles.detailTxHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name="history" size={18} color={theme.primary} />
                <Text style={[styles.detailTxSectionTitle, { color: theme.onSurface }]}>
                  Transactions ({walletTransactions.length})
                </Text>
              </View>
            </View>

            {walletTransactions.length === 0 ? (
              <View style={[styles.detailEmptyBox, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}>
                <MaterialCommunityIcons name="receipt-text-outline" size={36} color={theme.onSurfaceVariant} style={{ opacity: 0.5, marginBottom: 8 }} />
                <Text style={[styles.detailEmptyTitle, { color: theme.onSurface }]}>
                  No Transactions Found
                </Text>
                <Text style={[styles.detailEmptySub, { color: theme.onSurfaceVariant }]}>
                  Transactions recorded with this wallet will appear here.
                </Text>
              </View>
            ) : (
              groupedWalletTransactions.map((group) => (
                <View key={group.date} style={styles.detailDateGroup}>
                  <View style={[styles.detailDateHeaderRow, { borderBottomColor: theme.divider }]}>
                    <Text style={[styles.detailDateTitle, { color: theme.onSurfaceVariant }]}>
                      {group.displayDate.toUpperCase()}
                    </Text>
                    <View style={styles.detailDateTotalsRow}>
                      {group.totalSpent > 0 && (
                        <Text style={[styles.detailDateSpent, { color: theme.error }]}>
                          -{formatCurrency(group.totalSpent, settings.base_currency)}
                        </Text>
                      )}
                      {group.totalIncome > 0 && (
                        <Text style={[styles.detailDateIncome, { color: theme.success }]}>
                          +{formatCurrency(group.totalIncome, settings.base_currency)}
                        </Text>
                      )}
                    </View>
                  </View>

                  {group.items.map((tx) => {
                    const cat = categories.find((c) => c.id === tx.category_id);
                    const sub = cat?.subcategories?.find((s) => s.id === tx.subcategory_id);
                    const isExp = tx.type === 'expense';
                    const isTransfer = tx.type === 'transfer';

                    const mainTitle = isTransfer
                      ? 'Transfer'
                      : sub?.name || cat?.name || 'Activity';

                    const subtitle = [
                      sub ? cat?.name : null,
                      tx.time || null,
                      tx.note || null,
                    ]
                      .filter(Boolean)
                      .join(' • ');

                    return (
                      <TouchableOpacity
                        key={tx.id}
                        style={[styles.detailTxItem, { backgroundColor: theme.cardBg, borderColor: theme.divider }]}
                        onPress={() => setViewingTransaction(tx)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.detailTxIconCircle,
                            { backgroundColor: isTransfer ? theme.primary : (cat?.color || (isExp ? '#EF4444' : '#10B981')) },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={isTransfer ? 'swap-horizontal' : ((cat?.icon as any) || 'tag-outline')}
                            size={18}
                            color="#FFFFFF"
                          />
                        </View>

                        <View style={styles.detailTxInfo}>
                          <Text style={[styles.detailTxMainTitle, { color: theme.onSurface }]} numberOfLines={1}>
                            {mainTitle}
                          </Text>
                          {subtitle ? (
                            <Text style={[styles.detailTxSubtitle, { color: theme.onSurfaceVariant }]}>
                              {subtitle}
                            </Text>
                          ) : null}
                        </View>

                        <Text
                          style={[
                            styles.detailTxAmount,
                            { color: isExp ? theme.error : theme.success },
                          ]}
                        >
                          {isExp ? '-' : '+'}{formatCurrency(tx.amount || tx.base_amount || 0, settings.base_currency)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* TRANSACTION FULL DETAILS MODAL */}
      <TransactionDetailModal
        visible={Boolean(viewingTransaction)}
        transaction={viewingTransaction}
        categories={categories}
        wallets={wallets}
        theme={theme}
        baseCurrency={settings.base_currency}
        onClose={() => setViewingTransaction(null)}
        onEdit={() => {
          setViewingTransaction(null);
        }}
        onDelete={async (id) => {
          await deleteTransaction(id);
          setViewingTransaction(null);
        }}
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
  totalCard: {
    borderRadius: M3Shape.extraLarge,
    padding: 22,
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  totalSub: {
    fontSize: 12,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 46,
    borderRadius: M3Shape.full,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  walletCard: {
    borderWidth: 1,
    borderRadius: M3Shape.extraLarge,
    padding: 16,
    marginBottom: 12,
  },
  walletCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletDetails: {
    flex: 1,
    marginLeft: 12,
  },
  walletName: {
    fontSize: 16,
    fontWeight: '700',
  },
  walletCurrencyBadge: {
    fontSize: 12,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 6,
  },
  cardActionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerLine: {
    height: 1,
    marginVertical: 12,
  },
  balanceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  balCol: {
    flex: 1,
  },
  balLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  balValue: {
    fontSize: 13,
  },
  balCurrent: {
    fontSize: 18,
    fontWeight: '800',
  },
  convertedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: M3Shape.medium,
    marginTop: 10,
    gap: 6,
  },
  convertedText: {
    fontSize: 11,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    borderRadius: M3Shape.extraLarge,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    height: 42,
    borderRadius: M3Shape.medium,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  horizontalScroll: {
    marginBottom: 6,
  },
  pillChoice: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: M3Shape.full,
    marginRight: 8,
  },
  pillChoiceText: {
    fontSize: 12,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  previewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: M3Shape.medium,
    marginTop: 8,
    gap: 8,
  },
  previewText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: M3Shape.full,
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: M3Shape.full,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyWalletCard: {
    borderWidth: 1,
    borderRadius: M3Shape.extraLarge,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    gap: 10,
  },
  emptyWalletIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyWalletTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyWalletSub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 12,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: M3Shape.full,
    marginTop: 6,
  },
  emptyAddBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  cardChevronWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
  },
  detailContainer: {
    flex: 1,
  },
  detailNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  detailNavBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailNavTitleWrap: {
    flex: 1,
  },
  detailNavTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  detailNavSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  detailNavActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  detailHeroCard: {
    borderWidth: 1,
    borderRadius: M3Shape.extraLarge,
    padding: 20,
    marginBottom: 20,
  },
  detailHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailHeroName: {
    fontSize: 18,
    fontWeight: '800',
  },
  detailHeroCurrency: {
    fontSize: 12,
    marginTop: 2,
  },
  detailBalanceWrap: {
    marginVertical: 16,
  },
  detailBalanceLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  detailBalanceAmount: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  detailStatsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 14,
    marginBottom: 16,
  },
  detailStatTile: {
    flex: 1,
  },
  detailStatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  detailStatLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  detailStatValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  detailStatDivider: {
    width: 1,
    height: 28,
    marginHorizontal: 8,
  },
  detailTransferBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: M3Shape.full,
  },
  detailTransferBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  detailTxHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailTxSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  detailEmptyBox: {
    borderWidth: 1,
    borderRadius: M3Shape.extraLarge,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailEmptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  detailEmptySub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  detailDateGroup: {
    marginBottom: 16,
  },
  detailDateHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 6,
    marginBottom: 8,
    borderBottomWidth: 1,
  },
  detailDateTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  detailDateTotalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailDateSpent: {
    fontSize: 11,
    fontWeight: '700',
  },
  detailDateIncome: {
    fontSize: 11,
    fontWeight: '700',
  },
  detailTxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: M3Shape.large,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  detailTxIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTxInfo: {
    flex: 1,
  },
  detailTxMainTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  detailTxSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  detailTxAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
});
