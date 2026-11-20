import React from 'react';
import {
  Alert,
  Keyboard,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { formatCurrency, formatTypingNumber, parseCleanNumber } from '../../utils/format';
import { M3Shape } from '../../theme';
import { transactionFormStyles as styles } from './styles';
import { TransactionFormState } from './useTransactionForm';
import { PeopleSplitEditor } from './PeopleSplitEditor';

interface WhoFieldProps {
  form: TransactionFormState;
  theme: any;
  isEditing?: boolean;
  initialTransactionId?: string;
}

export const WhoField: React.FC<WhoFieldProps> = ({
  form,
  theme,
  isEditing,
  initialTransactionId,
}) => {
  const {
    formKind,
    expenseSource,
    setExpenseSource,
    splitEnabled,
    setSplitEnabled,
    setSplitIncludeMe,
    splitPeople,
    splitPersonInput,
    splitSummary,
    existingLinkedDebts,
    settleIouEnabled,
    setSettleIouEnabled,
    selectedDebtId,
    setSelectedDebtId,
    openLentDebts,
    allOpenDebts,
    existingTxSettlements,
    undoTransactionDebtSettlements,
    amountStr,
    setAmountStr,
    currency,
    iouAction,
    iouPersonName,
    setIouPersonName,
    activeSheet,
    setActiveSheet,
    animateLayout,
    focusAmountInput,
  } = form;

  // 1. EXPENSE: Paid by (Me / They paid full / Me + others) + Split
  if (formKind === 'expense') {
    return (
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
        <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>PAID BY</Text>
        <View style={styles.iouActionRow}>
          {(
            [
              { key: 'wallet', label: 'Me', icon: 'wallet-outline' },
              { key: 'borrowed_full', label: 'They paid full', icon: 'account-cash-outline' },
              { key: 'borrowed_partial', label: 'Me + others', icon: 'call-split' },
            ] as const
          ).map((opt) => {
            const active = expenseSource === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.iouActionPill,
                  {
                    backgroundColor: active ? theme.primaryContainer : theme.pillBg,
                    borderColor: active ? theme.primary : theme.divider,
                  },
                ]}
                onPress={() => {
                  animateLayout();
                  setExpenseSource(opt.key);
                  if (opt.key === 'wallet') {
                    setSplitIncludeMe(true);
                  } else {
                    setSplitEnabled(false);
                    setSplitIncludeMe(opt.key === 'borrowed_partial');
                    setActiveSheet('iou');
                  }
                }}
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons
                  name={opt.icon as any}
                  size={14}
                  color={active ? theme.primary : theme.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.iouActionPillText,
                    {
                      color: active ? theme.onPrimaryContainer : theme.onSurfaceVariant,
                      fontWeight: active ? '800' : '600',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {expenseSource === 'wallet' ? (
          <View style={{ marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.divider }}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextCol}>
                <View style={styles.labelWithIcon}>
                  <MaterialCommunityIcons name="account-group-outline" size={18} color={theme.primary} />
                  <Text style={[styles.toggleTitle, { color: theme.onSurface }]}>Split Expense</Text>
                </View>
                <Text style={[styles.toggleSubtitle, { color: theme.onSurfaceVariant }]}>
                  Automatically create loans for other people's shares
                </Text>
              </View>
              <Switch
                value={splitEnabled}
                onValueChange={(val) => {
                  animateLayout();
                  setSplitEnabled(val);
                  if (val) setActiveSheet('iou');
                  else if (activeSheet === 'iou') setActiveSheet(null);
                }}
                trackColor={{ false: theme.outlineVariant, true: theme.primaryContainer }}
                thumbColor={splitEnabled ? theme.primary : '#f4f3f4'}
              />
            </View>

            {isEditing && existingLinkedDebts.length > 0 && (
              <View
                style={{
                  marginTop: 10,
                  padding: 10,
                  borderRadius: M3Shape.small,
                  backgroundColor: theme.pillBg,
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: theme.onSurfaceVariant }}>
                  EXISTING LOANS FROM THIS EXPENSE
                </Text>
                {existingLinkedDebts.map((d) => (
                  <Text key={d.id} style={{ fontSize: 12.5, fontWeight: '700', color: theme.onSurface }}>
                    • {d.person_name}: {formatCurrency(d.amount, d.currency || currency)} ({d.status})
                  </Text>
                ))}
              </View>
            )}

            {splitEnabled && (
              <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.divider, gap: 8 }}>
                <TouchableOpacity
                  style={styles.accordionHeader}
                  onPress={() => {
                    animateLayout();
                    const next = activeSheet === 'iou' ? null : 'iou';
                    if (next) Keyboard.dismiss();
                    setActiveSheet(next);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>
                    {splitPeople.length > 0
                      ? `SPLIT WITH: ${splitPeople.map((p) => p.name).join(', ')}`
                      : 'PEOPLE / SPLIT'}
                  </Text>
                  <MaterialCommunityIcons
                    name={activeSheet === 'iou' ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={theme.onSurfaceVariant}
                  />
                </TouchableOpacity>
                {activeSheet === 'iou' && (
                  <PeopleSplitEditor form={form} theme={theme} forExpense={true} />
                )}
              </View>
            )}
          </View>
        ) : (
          <View style={{ marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.divider, gap: 8 }}>
            <TouchableOpacity
              style={styles.accordionHeader}
              onPress={() => {
                animateLayout();
                const next = activeSheet === 'iou' ? null : 'iou';
                if (next) Keyboard.dismiss();
                setActiveSheet(next);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.accordionTitleCol}>
                <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>
                  WHO DO YOU OWE?
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: splitPeople.length > 0 ? theme.onSurface : theme.onSurfaceVariant }} numberOfLines={1}>
                  {splitPeople.length > 0
                    ? `${splitPeople.map((p) => p.name).join(', ')}${splitSummary.totalOwedByOthers > 0 ? `  •  ${formatCurrency(splitSummary.totalOwedByOthers, currency)}` : ''}`
                    : 'Tap to add person(s)'}
                </Text>
              </View>
              <MaterialCommunityIcons
                name={activeSheet === 'iou' ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={theme.onSurfaceVariant}
              />
            </TouchableOpacity>
            {activeSheet === 'iou' && (
              <PeopleSplitEditor form={form} theme={theme} forExpense={true} />
            )}
          </View>
        )}
      </View>
    );
  }

  // 2. INCOME: Settle an open loan (optional)
  if (formKind === 'income') {
    return (
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextCol}>
            <View style={styles.labelWithIcon}>
              <MaterialCommunityIcons name="handshake-outline" size={18} color={theme.success} />
              <Text style={[styles.toggleTitle, { color: theme.onSurface }]}>Settle Open Loan</Text>
            </View>
            <Text style={[styles.toggleSubtitle, { color: theme.onSurfaceVariant }]}>
              Apply this income to an open loan someone owes you
            </Text>
          </View>
          <Switch
            value={settleIouEnabled}
            onValueChange={(val) => {
              setSettleIouEnabled(val);
              if (val && !selectedDebtId && openLentDebts.length === 1) {
                const only = openLentDebts[0];
                setSelectedDebtId(only.id);
                const cur = parseCleanNumber(amountStr);
                if (isNaN(cur) || cur <= 0) {
                  const rem = Math.max(0, only.amount - (only.paid_amount || 0));
                  setAmountStr(formatTypingNumber(rem.toString()));
                }
              }
            }}
            trackColor={{ false: theme.outlineVariant, true: theme.successContainer }}
            thumbColor={settleIouEnabled ? theme.success : '#f4f3f4'}
          />
        </View>

        {isEditing && existingTxSettlements.length > 0 && (
          <View
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: M3Shape.small,
              backgroundColor: theme.successContainer,
              gap: 6,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: theme.onSuccessContainer }}>
                SETTLED LOAN(S) LINKED TO THIS TRANSACTION
              </Text>
              <TouchableOpacity
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 12,
                  backgroundColor: theme.errorContainer,
                }}
                onPress={() => {
                  if (!initialTransactionId) return;
                  Alert.alert(
                    'Undo Loan Settlement?',
                    'This will restore the settled debt balance back to open and remove any overpayment credit created from this transaction.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Undo',
                        style: 'destructive',
                        onPress: () => undoTransactionDebtSettlements(initialTransactionId),
                      },
                    ]
                  );
                }}
              >
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: theme.onErrorContainer }}>
                  Undo
                </Text>
              </TouchableOpacity>
            </View>
            {existingTxSettlements.map((s) => (
              <Text key={s.id} style={{ fontSize: 12.5, fontWeight: '700', color: theme.onSuccessContainer }}>
                • Settled {s.person_name}'s {formatCurrency(s.applied_amount, s.currency || currency)} debt
                {s.excess_amount > 0.009
                  ? ` (exceeded ${formatCurrency(s.excess_amount, s.currency || currency)} • ${
                      s.excess_mode === 'credit' ? 'Credit' : 'Tip'
                    })`
                  : ''}
              </Text>
            ))}
          </View>
        )}

        {settleIouEnabled &&
          (openLentDebts.length === 0 ? (
            <Text style={{ fontSize: 12.5, color: theme.onSurfaceVariant, marginTop: 10 }}>
              No open loans owed to you yet.
            </Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                gap: 8,
                marginTop: 12,
                paddingTop: 10,
                borderTopWidth: 1,
                borderTopColor: theme.divider,
              }}
            >
              {openLentDebts.map((d) => {
                const rem = Math.max(0, d.amount - (d.paid_amount || 0));
                const selected = selectedDebtId === d.id;
                return (
                  <TouchableOpacity
                    key={d.id}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: M3Shape.medium,
                      borderWidth: 1,
                      backgroundColor: selected ? theme.successContainer : theme.pillBg,
                      borderColor: selected ? theme.success : theme.divider,
                    }}
                    onPress={() => {
                      setSelectedDebtId(d.id);
                      const cur = parseCleanNumber(amountStr);
                      if (isNaN(cur) || cur <= 0) {
                        setAmountStr(formatTypingNumber(rem.toString()));
                      }
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12.5,
                        fontWeight: '700',
                        color: selected ? theme.onSuccessContainer : theme.onSurface,
                      }}
                    >
                      {d.person_name}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: selected ? theme.onSuccessContainer : theme.onSurfaceVariant,
                      }}
                    >
                      {formatCurrency(rem, d.currency || currency)} left
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ))}
      </View>
    );
  }

  // 3. LOAN: Person(s) and shares (Settle: pick open loan)
  if (formKind === 'loan') {
    const iouAccent = theme.primary;
    const iouContainer = theme.primaryContainer;
    const onIouContainer = theme.onPrimaryContainer;
    const selectedOpenDebt = allOpenDebts.find((d) => d.id === selectedDebtId);

    return (
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
        <TouchableOpacity
          style={styles.accordionHeader}
          onPress={() => {
            animateLayout();
            const next = activeSheet === 'iou' ? null : 'iou';
            if (next) Keyboard.dismiss();
            setActiveSheet(next);
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Toggle people sheet"
        >
          <View style={styles.accordionHeaderLeft}>
            <View style={[styles.catIconWrap, { backgroundColor: iouContainer }]}>
              <MaterialCommunityIcons
                name={iouAction === 'settle' ? 'handshake-outline' : 'account-group-outline'}
                size={18}
                color={iouAccent}
              />
            </View>
            <View style={styles.accordionTitleCol}>
              <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>
                {iouAction === 'settle' ? 'SELECT OPEN LOAN' : 'PEOPLE / SPLIT'}
              </Text>
              {iouAction === 'settle' ? (
                selectedOpenDebt ? (
                  <Text style={[styles.categoryBreadcrumbText, { color: theme.onSurface }]} numberOfLines={1}>
                    <Text style={{ fontWeight: '700' }}>{selectedOpenDebt.person_name}</Text>
                    <Text style={{ color: iouAccent, fontWeight: '600' }}>
                      {`  •  ${formatCurrency(
                        Math.max(0, selectedOpenDebt.amount - (selectedOpenDebt.paid_amount || 0)),
                        selectedOpenDebt.currency || currency
                      )} left`}
                    </Text>
                  </Text>
                ) : (
                  <Text style={[styles.categoryPlaceholderText, { color: theme.onSurfaceVariant }]}>
                    Tap to choose open loan
                  </Text>
                )
              ) : splitPeople.length > 0 || iouPersonName.trim() ? (
                <Text style={[styles.categoryBreadcrumbText, { color: theme.onSurface }]} numberOfLines={1}>
                  <Text style={{ fontWeight: '700' }}>
                    {splitPeople.length > 0
                      ? splitPeople.map((p) => p.name).join(', ')
                      : iouPersonName.trim()}
                  </Text>
                  {splitPeople.length > 0 && splitSummary.totalOwedByOthers > 0 && (
                    <Text style={{ color: iouAccent, fontWeight: '600' }}>
                      {`  •  ${formatCurrency(splitSummary.totalOwedByOthers, currency)}`}
                    </Text>
                  )}
                </Text>
              ) : (
                <Text style={[styles.categoryPlaceholderText, { color: theme.onSurfaceVariant }]}>
                  Tap to add person(s)
                </Text>
              )}
            </View>
          </View>

          <MaterialCommunityIcons
            name={activeSheet === 'iou' ? 'chevron-up' : 'chevron-down'}
            size={22}
            color={theme.onSurfaceVariant}
          />
        </TouchableOpacity>

        {activeSheet === 'iou' && (
          <View style={[styles.sheetListWrap, { borderTopColor: theme.divider }]}>
            {iouAction === 'settle' ? (
              allOpenDebts.length === 0 ? (
                <Text style={[styles.emptySheetText, { color: theme.onSurfaceVariant }]}>
                  No open loans to settle yet.
                </Text>
              ) : (
                allOpenDebts.map((debt) => {
                  const rem = Math.max(0, debt.amount - (debt.paid_amount || 0));
                  const isSel = debt.id === selectedDebtId;
                  return (
                    <TouchableOpacity
                      key={debt.id}
                      style={[
                        styles.walletSheetRow,
                        {
                          backgroundColor: isSel ? iouContainer : theme.pillBg,
                          borderColor: isSel ? iouAccent : 'transparent',
                        },
                      ]}
                      onPress={() => {
                        animateLayout();
                        setSelectedDebtId(debt.id);
                        setIouPersonName(debt.person_name);
                        const cur = parseCleanNumber(amountStr);
                        if (isNaN(cur) || cur <= 0) {
                          setAmountStr(formatTypingNumber(rem.toString()));
                        }
                        setActiveSheet(form.iouUseWallet && !form.selectedWalletId ? 'wallet' : null);
                      }}
                    >
                      <View style={styles.walletSheetLeft}>
                        <MaterialCommunityIcons
                          name={debt.type === 'lent' ? 'arrow-top-right' : 'arrow-bottom-left'}
                          size={18}
                          color={debt.type === 'lent' ? theme.success : theme.error}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.walletSheetName,
                              {
                                color: isSel ? onIouContainer : theme.onSurface,
                                fontWeight: isSel ? '800' : '600',
                              },
                            ]}
                          >
                            {debt.person_name}
                          </Text>
                          {!!debt.note && (
                            <Text
                              style={{ fontSize: 11, color: theme.onSurfaceVariant }}
                              numberOfLines={1}
                            >
                              {debt.note}
                            </Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.walletSheetRight}>
                        <Text
                          style={[
                            styles.walletSheetBal,
                            { color: isSel ? iouAccent : theme.onSurfaceVariant },
                          ]}
                        >
                          {formatCurrency(rem, debt.currency || currency)}
                        </Text>
                        {isSel && (
                          <MaterialCommunityIcons name="check-circle" size={17} color={iouAccent} />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )
            ) : (
              <PeopleSplitEditor form={form} theme={theme} forExpense={false} />
            )}
          </View>
        )}
      </View>
    );
  }

  return null;
};
