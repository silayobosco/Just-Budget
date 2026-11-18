import React from 'react';
import { Keyboard, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Wallet } from '../../types';
import { formatCurrency } from '../../utils/format';
import { transactionFormStyles as styles } from './styles';
import { TransactionFormState } from './useTransactionForm';

interface WalletFieldProps {
  form: TransactionFormState;
  wallets: Wallet[];
  baseCurrency: string;
  theme: any;
}

export const WalletField: React.FC<WalletFieldProps> = ({
  form,
  wallets,
  baseCurrency,
  theme,
}) => {
  const {
    formKind,
    expenseSource,
    activeSheet,
    setActiveSheet,
    selectedWallet,
    selectedToWallet,
    selectedWalletId,
    setSelectedWalletId,
    selectedToWalletId,
    setSelectedToWalletId,
    iouUseWallet,
    setIouUseWallet,
    animateLayout,
    focusAmountInput,
  } = form;

  // Requirement 9 & Fixed Field Order: hidden when Expense Paid by = They Paid Full
  if (formKind === 'expense' && expenseSource === 'borrowed_full') {
    return null;
  }

  const isTransfer = formKind === 'transfer';
  const isLoan = formKind === 'loan';
  const iouAccent = theme.primary;
  const iouContainer = theme.primaryContainer;
  const onIouContainer = theme.onPrimaryContainer;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
      <TouchableOpacity
        style={styles.accordionHeader}
        onPress={() => {
          animateLayout();
          const next = activeSheet === 'wallet' ? null : 'wallet';
          if (next) Keyboard.dismiss();
          setActiveSheet(next);
        }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Toggle wallet sheet"
      >
        <View style={styles.accordionHeaderLeft}>
          <View style={[styles.catIconWrap, { backgroundColor: theme.primaryContainer }]}>
            <MaterialCommunityIcons
              name={(selectedWallet?.icon as any) || 'wallet'}
              size={18}
              color={theme.primary}
            />
          </View>
          <View style={styles.accordionTitleCol}>
            {/* Requirement 4: always labeled WALLET */}
            <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>WALLET</Text>
            {isTransfer ? (
              <Text style={[styles.categoryBreadcrumbText, { color: theme.onSurface }]} numberOfLines={1}>
                <Text style={{ fontWeight: '700' }}>{selectedWallet?.name || 'From'}</Text>
                <Text style={{ color: theme.onSurfaceVariant }}>{'  →  '}</Text>
                <Text style={{ fontWeight: '700', color: theme.primary }}>
                  {selectedToWallet?.name || 'To'}
                </Text>
              </Text>
            ) : isLoan && !iouUseWallet ? (
              <Text style={[styles.categoryBreadcrumbText, { color: theme.onSurfaceVariant }]} numberOfLines={1}>
                No Wallet (Cashless / Off-wallet)
              </Text>
            ) : selectedWallet ? (
              <Text style={[styles.categoryBreadcrumbText, { color: theme.onSurface }]} numberOfLines={1}>
                <Text style={{ fontWeight: '700' }}>{selectedWallet.name}</Text>
                <Text style={{ color: theme.onSurfaceVariant, fontWeight: '500' }}>
                  {'  •  '}
                  {formatCurrency(selectedWallet.current_balance, selectedWallet.currency || baseCurrency)}
                </Text>
              </Text>
            ) : (
              <Text style={[styles.categoryPlaceholderText, { color: theme.onSurfaceVariant }]}>
                Tap to select wallet
              </Text>
            )}
          </View>
        </View>

        <MaterialCommunityIcons
          name={activeSheet === 'wallet' ? 'chevron-up' : 'chevron-down'}
          size={22}
          color={theme.onSurfaceVariant}
        />
      </TouchableOpacity>

      {activeSheet === 'wallet' && (
        <View style={[styles.sheetListWrap, { borderTopColor: theme.divider }]}>
          {isTransfer ? (
            <>
              <Text style={[styles.fieldSubLabel, { color: theme.onSurfaceVariant }]}>FROM</Text>
              {wallets
                .filter((w) => w.id !== selectedToWalletId)
                .map((w) => {
                  const isSelected = w.id === selectedWalletId;
                  return (
                    <TouchableOpacity
                      key={`from-${w.id}`}
                      style={[
                        styles.walletSheetRow,
                        {
                          backgroundColor: isSelected ? theme.primaryContainer : theme.pillBg,
                          borderColor: isSelected ? theme.primary : 'transparent',
                        },
                      ]}
                      onPress={() => {
                        setSelectedWalletId(w.id);
                        if (w.id === selectedToWalletId) {
                          const nextTo = wallets.find((o) => o.id !== w.id);
                          if (nextTo) setSelectedToWalletId(nextTo.id);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.walletSheetLeft}>
                        <MaterialCommunityIcons
                          name={(w.icon as any) || 'wallet'}
                          size={18}
                          color={isSelected ? theme.primary : theme.onSurfaceVariant}
                        />
                        <Text
                          style={[
                            styles.walletSheetName,
                            {
                              color: isSelected ? theme.onPrimaryContainer : theme.onSurface,
                              fontWeight: isSelected ? '800' : '600',
                            },
                          ]}
                        >
                          {w.name}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.walletSheetBal,
                          { color: isSelected ? theme.primary : theme.onSurfaceVariant },
                        ]}
                      >
                        {formatCurrency(w.current_balance, w.currency || baseCurrency)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

              <Text style={[styles.fieldSubLabel, { color: theme.onSurfaceVariant, marginTop: 8 }]}>
                TO
              </Text>
              {wallets
                .filter((w) => w.id !== selectedWalletId)
                .map((w) => {
                  const isSelected = w.id === selectedToWalletId;
                  return (
                    <TouchableOpacity
                      key={`to-${w.id}`}
                      style={[
                        styles.walletSheetRow,
                        {
                          backgroundColor: isSelected ? theme.primaryContainer : theme.pillBg,
                          borderColor: isSelected ? theme.primary : 'transparent',
                        },
                      ]}
                      onPress={() => {
                        animateLayout();
                        setSelectedToWalletId(w.id);
                        setActiveSheet(null);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.walletSheetLeft}>
                        <MaterialCommunityIcons
                          name={(w.icon as any) || 'bank-transfer-in'}
                          size={18}
                          color={isSelected ? theme.primary : theme.onSurfaceVariant}
                        />
                        <Text
                          style={[
                            styles.walletSheetName,
                            {
                              color: isSelected ? theme.onPrimaryContainer : theme.onSurface,
                              fontWeight: isSelected ? '800' : '600',
                            },
                          ]}
                        >
                          {w.name}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.walletSheetBal,
                          { color: isSelected ? theme.primary : theme.onSurfaceVariant },
                        ]}
                      >
                        {formatCurrency(w.current_balance, w.currency || baseCurrency)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </>
          ) : (
            <>
              {isLoan && (
                <TouchableOpacity
                  style={[
                    styles.walletSheetRow,
                    {
                      backgroundColor: !iouUseWallet ? iouContainer : theme.pillBg,
                      borderColor: !iouUseWallet ? iouAccent : 'transparent',
                    },
                  ]}
                  onPress={() => {
                    animateLayout();
                    setIouUseWallet(false);
                    setActiveSheet('iou');
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.walletSheetLeft}>
                    <MaterialCommunityIcons
                      name="wallet-outline"
                      size={18}
                      color={!iouUseWallet ? iouAccent : theme.onSurfaceVariant}
                    />
                    <Text
                      style={[
                        styles.walletSheetName,
                        {
                          color: !iouUseWallet ? onIouContainer : theme.onSurface,
                          fontWeight: !iouUseWallet ? '800' : '600',
                        },
                      ]}
                    >
                      No Wallet (Cashless / Off-wallet)
                    </Text>
                  </View>
                  {!iouUseWallet && (
                    <MaterialCommunityIcons name="check-circle" size={17} color={iouAccent} />
                  )}
                </TouchableOpacity>
              )}

              {wallets.map((w) => {
                const isSelected = (!isLoan || iouUseWallet) && w.id === selectedWalletId;
                return (
                  <TouchableOpacity
                    key={w.id}
                    style={[
                      styles.walletSheetRow,
                      {
                        backgroundColor: isSelected ? theme.primaryContainer : theme.pillBg,
                        borderColor: isSelected ? theme.primary : 'transparent',
                      },
                    ]}
                    onPress={() => {
                      animateLayout();
                      setIouUseWallet(true);
                      setSelectedWalletId(w.id);
                      const needsCategory =
                        formKind === 'expense' || formKind === 'income'
                          ? !form.selectedCategoryId
                          : formKind === 'loan' && form.iouAction !== 'settle' && form.iouIncludeMyShare && !form.selectedCategoryId;
                      setActiveSheet(needsCategory ? 'category' : null);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.walletSheetLeft}>
                      <MaterialCommunityIcons
                        name={(w.icon as any) || 'wallet'}
                        size={18}
                        color={isSelected ? theme.primary : theme.onSurfaceVariant}
                      />
                      <Text
                        style={[
                          styles.walletSheetName,
                          {
                            color: isSelected ? theme.onPrimaryContainer : theme.onSurface,
                            fontWeight: isSelected ? '800' : '600',
                          },
                        ]}
                      >
                        {w.name}
                      </Text>
                    </View>
                    <View style={styles.walletSheetRight}>
                      <Text
                        style={[
                          styles.walletSheetBal,
                          { color: isSelected ? theme.primary : theme.onSurfaceVariant },
                        ]}
                      >
                        {formatCurrency(w.current_balance, w.currency || baseCurrency)}
                      </Text>
                      {isSelected && (
                        <MaterialCommunityIcons name="check-circle" size={17} color={theme.primary} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </View>
      )}
    </View>
  );
};
