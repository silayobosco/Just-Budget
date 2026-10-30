import React, { useState } from 'react';
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBudget } from '../context/BudgetContext';
import { lightTheme, darkTheme, M3Shape, M3Elevation } from '../theme';
import { Wallet } from '../types';
import { formatCurrency } from '../utils/format';

export const WalletsScreen: React.FC = () => {
  const {
    wallets,
    totalConvertedBalance,
    settings,
    addWallet,
    updateWallet,
    deleteWallet,
    transferBetweenWallets,
  } = useBudget();

  const theme = settings.theme_mode === 'dark' ? darkTheme : lightTheme;

  // Modals
  const [walletModalVisible, setWalletModalVisible] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);

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

  const currencies = ['USD', 'EUR', 'GBP', 'TZS', 'KES', 'INR', 'CAD', 'AUD', 'JPY', 'CNY', 'ZAR', 'AED'];
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
    setWalletStartingBalance(w.starting_balance.toString());
    setWalletCurrentBalance(w.current_balance.toString());
    setWalletColor(w.color);
    setWalletIcon(w.icon as any);
    setWalletModalVisible(true);
  };

  const handleSaveWallet = async () => {
    if (!walletName.trim()) return;
    const startBal = parseFloat(walletStartingBalance) || 0;
    const currBal = parseFloat(walletCurrentBalance) || 0;

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
    const amt = parseFloat(transferAmount);
    if (isNaN(amt) || amt <= 0) return;
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
    const amt = parseFloat(transferAmount);
    if (isNaN(amt) || amt <= 0) return null;
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
              <View
                key={w.id}
                style={[styles.walletCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }, M3Elevation.level1]}
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

                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={[styles.cardActionIcon, { backgroundColor: theme.pillBg }]}
                      onPress={() => handleOpenTransfer(w.id)}
                    >
                      <MaterialCommunityIcons name="swap-horizontal" size={16} color={theme.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.cardActionIcon, { backgroundColor: theme.pillBg }]}
                      onPress={() => handleOpenEditWallet(w)}
                    >
                      <MaterialCommunityIcons name="pencil-outline" size={16} color={theme.onSurface} />
                    </TouchableOpacity>
                    {wallets.length > 1 && (
                      <TouchableOpacity
                        style={[styles.cardActionIcon, { backgroundColor: theme.errorContainer }]}
                        onPress={() => deleteWallet(w.id)}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={16} color={theme.onErrorContainer} />
                      </TouchableOpacity>
                    )}
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
              </View>
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
                {editingWallet ? 'Edit Wallet' : 'New Multi-Currency Wallet'}
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

              <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>Currency</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                {currencies.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.pillChoice,
                      {
                        backgroundColor: walletCurrency === c ? theme.primary : theme.pillBg,
                      },
                    ]}
                    onPress={() => setWalletCurrency(c)}
                  >
                    <Text
                      style={[
                        styles.pillChoiceText,
                        {
                          color: walletCurrency === c ? theme.onPrimary : theme.onSurface,
                          fontWeight: walletCurrency === c ? '700' : '500',
                        },
                      ]}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {!editingWallet && (
                <>
                  <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>
                    Starting Balance ({walletCurrency})
                  </Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                    keyboardType="decimal-pad"
                    value={walletStartingBalance}
                    onChangeText={setWalletStartingBalance}
                  />
                </>
              )}

              {editingWallet && (
                <>
                  <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>
                    Adjust Current Balance ({walletCurrency})
                  </Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                    keyboardType="decimal-pad"
                    value={walletCurrentBalance}
                    onChangeText={setWalletCurrentBalance}
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
              onChangeText={setTransferAmount}
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
});
