import React from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBudget } from '../../context/BudgetContext';
import { formatCurrency, formatTypingNumber, parseCleanNumber } from '../../utils/format';
import { transactionFormStyles as styles } from './styles';
import { TransactionFormState } from './useTransactionForm';

interface PeopleSplitEditorProps {
  form: TransactionFormState;
  theme: any;
  forExpense?: boolean;
}

export const PeopleSplitEditor: React.FC<PeopleSplitEditorProps> = ({
  form,
  theme,
  forExpense = false,
}) => {
  const {
    amountStr,
    currency,
    iouAction,
    iouIncludeMyShare,
    setIouIncludeMyShare,
    iouMyShareStr,
    setIouMyShareStr,
    splitIncludeMe,
    setSplitIncludeMe,
    splitPeople,
    setSplitPeople,
    splitPersonInput,
    setSplitPersonInput,
    setIouPersonName,
    splitSummary,
    knownDebtPeople,
    selectedCategoryId,
    setActiveSheet,
    handleAddSplitPerson,
    handlePickFromContacts,
    animateLayout,
    focusAmountInput,
    autoOffsetOnSave,
    setAutoOffsetOnSave,
    offsetTargetDebtId,
    setOffsetTargetDebtId,
  } = form;

  const { debts } = useBudget();
  const iouAccent = theme.primary;
  const iouContainer = theme.primaryContainer;
  const onIouContainer = theme.onPrimaryContainer;

  const totalAmt = parseCleanNumber(amountStr) || 0;
  const includeMe = forExpense ? splitIncludeMe : iouIncludeMyShare;
  const accent = forExpense ? theme.primary : iouAccent;
  const container = forExpense ? theme.primaryContainer : iouContainer;
  const onContainer = forExpense ? theme.onPrimaryContainer : onIouContainer;

  const autoSingleMyShare =
    !forExpense && iouAction === 'borrowed'
      ? totalAmt
      : Math.round((totalAmt / 2) * 100) / 100;
  const singleMyShareVal =
    !forExpense && splitPeople.length <= 1 && includeMe
      ? iouMyShareStr.trim()
        ? parseCleanNumber(iouMyShareStr)
        : autoSingleMyShare
      : splitSummary.yourShare;

  return (
    <View style={{ gap: 8 }}>
      <View
        style={[
          styles.iouSplitToggleBox,
          {
            borderTopWidth: 0,
            paddingTop: 0,
            paddingBottom: 8,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.divider,
          },
        ]}
      >
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextCol}>
            <Text style={[styles.toggleTitle, { color: theme.onSurface, fontSize: 13 }]}>
              {forExpense ? 'Include me in split' : 'Include my share as Expense'}
            </Text>
            <Text style={[styles.toggleSubtitle, { color: theme.onSurfaceVariant }]}>
              {forExpense
                ? includeMe
                  ? 'Your share stays in expense analytics; others become open loans'
                  : 'Paid 100% for others — full amount becomes open loans'
                : iouAction === 'borrowed'
                  ? 'Categorize your expense (e.g. someone paid for your lunch)'
                  : 'Categorize your part of a shared bill without inflating analytics'}
            </Text>
          </View>
          <Switch
            value={includeMe}
            onValueChange={(val) => {
              animateLayout();
              if (forExpense) {
                setSplitIncludeMe(val);
              } else {
                setIouIncludeMyShare(val);
                setSplitIncludeMe(val);
                if (val && !selectedCategoryId) {
                  setActiveSheet('category');
                }
              }
            }}
            trackColor={{ false: theme.outlineVariant, true: container }}
            thumbColor={includeMe ? accent : '#f4f3f4'}
          />
        </View>
      </View>

      {(splitPeople.length > 0 || includeMe) && (
        <View style={{ gap: 6 }}>
          {includeMe && (
            <View
              style={[
                styles.walletSheetRow,
                {
                  backgroundColor: theme.primaryContainer,
                  borderColor: theme.primary,
                  paddingVertical: 7,
                },
              ]}
            >
              <View style={styles.walletSheetLeft}>
                <MaterialCommunityIcons
                  name="account-star-outline"
                  size={16}
                  color={theme.primary}
                />
                <Text
                  style={[
                    styles.walletSheetName,
                    { color: theme.onPrimaryContainer, fontWeight: '700' },
                  ]}
                  numberOfLines={1}
                >
                  Me (Your Share)
                </Text>
              </View>
              <View style={styles.walletSheetRight}>
                {splitPeople.length <= 1 ? (
                  <TextInput
                    style={[
                      styles.taxInput,
                      {
                        color: theme.onSurface,
                        backgroundColor: theme.surface,
                        borderColor: theme.divider,
                        minWidth: 96,
                        paddingVertical: 6,
                        fontSize: 12.5,
                      },
                    ]}
                    placeholder={
                      autoSingleMyShare > 0
                        ? formatTypingNumber(autoSingleMyShare.toString())
                        : 'Auto'
                    }
                    placeholderTextColor={theme.onSurfaceVariant}
                    keyboardType={Platform.OS === 'android' ? 'numeric' : 'decimal-pad'}
                    editable={true}
                    value={
                      forExpense
                        ? splitPeople.length === 1 && splitPeople[0].customAmount?.trim()
                          ? formatTypingNumber(singleMyShareVal.toString())
                          : ''
                        : iouMyShareStr
                    }
                    onChangeText={(t) => {
                      const formatted = formatTypingNumber(t);
                      if (forExpense && splitPeople.length === 1) {
                        const myVal = formatted.trim() ? parseCleanNumber(formatted) : NaN;
                        if (!isNaN(myVal) && totalAmt > 0) {
                          const otherVal = Math.max(0, Math.round((totalAmt - myVal) * 100) / 100);
                          setSplitPeople((prev) =>
                            prev.map((item, i) =>
                              i === 0 ? { ...item, customAmount: formatTypingNumber(otherVal.toString()) } : item
                            )
                          );
                        } else {
                          setSplitPeople((prev) =>
                            prev.map((item, i) => (i === 0 ? { ...item, customAmount: '' } : item))
                          );
                        }
                      } else {
                        setIouMyShareStr(formatted);
                      }
                    }}
                  />
                ) : (
                  <View
                    style={[
                      styles.taxInput,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.divider,
                        minWidth: 82,
                        paddingVertical: 5,
                        alignItems: 'flex-end',
                      },
                    ]}
                  >
                    <Text style={{ color: theme.onSurface, fontSize: 12.5, fontWeight: '700' }}>
                      {formatCurrency(singleMyShareVal, currency)}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  onPress={() => {
                    animateLayout();
                    if (!forExpense) setIouIncludeMyShare(false);
                    setSplitIncludeMe(false);
                  }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  accessibilityLabel="Remove my share"
                >
                  <MaterialCommunityIcons name="close-circle" size={18} color={theme.error} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {splitPeople.map((p, idx) => {
            const resolvedShare =
              !forExpense &&
              splitPeople.length === 1 &&
              iouAction === 'lent' &&
              includeMe &&
              !p.customAmount?.trim()
                ? Math.max(0, Math.round((totalAmt - singleMyShareVal) * 100) / 100)
                : splitSummary.resolved[idx]?.share || 0;
            const oppositeType = forExpense
              ? (includeMe || splitIncludeMe ? 'borrowed' : 'lent')
              : (iouAction === 'borrowed' ? 'lent' : 'borrowed');
            const pKey = p.name.trim().toLowerCase();
            const matchingDebts = pKey
              ? debts.filter(
                  (d) =>
                    d.status === 'open' &&
                    d.type === oppositeType &&
                    d.person_name.trim().toLowerCase() === pKey
                )
              : [];
            const oppTotal = matchingDebts.reduce(
              (s, d) => s + Math.max(0, d.amount - (d.paid_amount || 0)),
              0
            );

            return (
              <View key={p.name} style={{ gap: 6 }}>
                <View
                  style={[
                    styles.walletSheetRow,
                    {
                      backgroundColor: container,
                      borderColor: accent,
                      paddingVertical: 7,
                    },
                  ]}
                >
                  <View style={styles.walletSheetLeft}>
                    <MaterialCommunityIcons
                      name="account-check-outline"
                      size={16}
                      color={accent}
                    />
                    <Text
                      style={[
                        styles.walletSheetName,
                        { color: onContainer, fontWeight: '700' },
                      ]}
                      numberOfLines={1}
                    >
                      {p.name}
                    </Text>
                  </View>
                  <View style={styles.walletSheetRight}>
                    <TextInput
                      style={[
                        styles.taxInput,
                        {
                          color: theme.onSurface,
                          backgroundColor: theme.surface,
                          borderColor: theme.divider,
                          minWidth: 96,
                          paddingVertical: 6,
                          fontSize: 12.5,
                        },
                      ]}
                      placeholder={
                        resolvedShare > 0
                          ? formatTypingNumber(resolvedShare.toString())
                          : '0'
                      }
                      placeholderTextColor={theme.onSurfaceVariant}
                      keyboardType={Platform.OS === 'android' ? 'numeric' : 'decimal-pad'}
                      editable={true}
                      value={p.customAmount || ''}
                      onChangeText={(txt) => {
                        const val = formatTypingNumber(txt);
                        setSplitPeople((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, customAmount: val } : item))
                        );
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        animateLayout();
                        setSplitPeople((prev) => prev.filter((_, i) => i !== idx));
                      }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      accessibilityLabel={`Remove ${p.name}`}
                    >
                      <MaterialCommunityIcons name="close-circle" size={18} color={theme.error} />
                    </TouchableOpacity>
                  </View>
                </View>

                {oppTotal > 0 && (
                  <View
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: autoOffsetOnSave ? theme.primary : theme.divider,
                      backgroundColor: autoOffsetOnSave ? theme.primaryContainer : theme.pillBg,
                      gap: 8,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <MaterialCommunityIcons name="handshake-outline" size={16} color={theme.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: autoOffsetOnSave ? theme.onPrimaryContainer : theme.onSurface }}>
                          {oppositeType === 'lent'
                            ? `${p.name} owes you ${formatCurrency(oppTotal, currency)}`
                            : `You owe ${p.name} ${formatCurrency(oppTotal, currency)}`}
                        </Text>
                        <Text style={{ fontSize: 10.5, fontWeight: '600', color: autoOffsetOnSave ? theme.onPrimaryContainer : theme.onSurfaceVariant }}>
                          {autoOffsetOnSave
                            ? 'Will offset against selected loan on save'
                            : 'Tap a loan or toggle on to offset'}
                        </Text>
                      </View>
                      <Switch
                        value={autoOffsetOnSave}
                        onValueChange={setAutoOffsetOnSave}
                        trackColor={{ false: theme.outlineVariant, true: theme.primary }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {matchingDebts.map((d) => {
                        const rem = Math.max(0, d.amount - (d.paid_amount || 0));
                        const isPicked = autoOffsetOnSave && offsetTargetDebtId === d.id;
                        return (
                          <TouchableOpacity
                            key={d.id}
                            activeOpacity={0.75}
                            onPress={() => {
                              if (isPicked) {
                                setOffsetTargetDebtId(null);
                              } else {
                                setOffsetTargetDebtId(d.id);
                                setAutoOffsetOnSave(true);
                              }
                            }}
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 8,
                              backgroundColor: isPicked ? theme.primary : theme.surface,
                              borderWidth: 1,
                              borderColor: isPicked ? theme.primary : theme.divider,
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: isPicked ? theme.onPrimary : theme.onSurface }}>
                              {formatCurrency(rem, d.currency || currency)}
                            </Text>
                            <Text style={{ fontSize: 10, color: isPicked ? theme.onPrimary : theme.onSurfaceVariant, opacity: isPicked ? 0.9 : 1 }}>
                              {d.date}{d.note ? ` • ${d.note}` : ''}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
            );
          })}

          {totalAmt > 0 && splitPeople.length > 0 && (
            <Text style={{ fontSize: 11.5, color: theme.onSurfaceVariant, fontWeight: '600' }}>
              Loan total:{' '}
              {formatCurrency(
                !forExpense &&
                  splitPeople.length === 1 &&
                  iouAction === 'lent' &&
                  includeMe &&
                  !splitPeople[0].customAmount?.trim()
                  ? Math.max(0, Math.round((totalAmt - singleMyShareVal) * 100) / 100)
                  : splitSummary.totalOwedByOthers,
                currency
              )}
              {includeMe ? `  •  My share: ${formatCurrency(singleMyShareVal, currency)}` : ''}
            </Text>
          )}
        </View>
      )}

      {knownDebtPeople.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScrollRow}
        >
          {knownDebtPeople.map((person) => (
            <TouchableOpacity
              key={person}
              style={[
                styles.walletChip,
                {
                  backgroundColor: theme.pillBg,
                  borderColor: theme.divider,
                },
              ]}
              onPress={() => {
                animateLayout();
                handleAddSplitPerson(person);
              }}
            >
              <MaterialCommunityIcons
                name="account-plus-outline"
                size={14}
                color={accent}
              />
              <Text
                style={[
                  styles.walletChipText,
                  { color: theme.onSurface, fontWeight: '600' },
                ]}
              >
                {person}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {(() => {
        const typedName = splitPersonInput.trim();
        if (!typedName) return null;
        const alreadyInList = splitPeople.some(
          (p) => p.name.trim().toLowerCase() === typedName.toLowerCase()
        );
        if (alreadyInList) return null;
        const oppositeType = forExpense
          ? (includeMe || splitIncludeMe ? 'borrowed' : 'lent')
          : (iouAction === 'borrowed' ? 'lent' : 'borrowed');
        const key = typedName.toLowerCase();
        const matchingDebts = debts.filter(
          (d) =>
            d.status === 'open' &&
            d.type === oppositeType &&
            d.person_name.trim().toLowerCase() === key
        );
        const oppTotal = matchingDebts.reduce(
          (s, d) => s + Math.max(0, d.amount - (d.paid_amount || 0)),
          0
        );
        if (oppTotal <= 0) return null;
        return (
          <View
            style={{
              marginTop: 8,
              marginBottom: 4,
              padding: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: autoOffsetOnSave ? theme.primary : theme.divider,
              backgroundColor: autoOffsetOnSave ? theme.primaryContainer : theme.pillBg,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialCommunityIcons name="handshake-outline" size={16} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: autoOffsetOnSave ? theme.onPrimaryContainer : theme.onSurface }}>
                  {oppositeType === 'lent'
                    ? `${typedName} owes you ${formatCurrency(oppTotal, currency)}`
                    : `You owe ${typedName} ${formatCurrency(oppTotal, currency)}`}
                </Text>
                <Text style={{ fontSize: 10.5, fontWeight: '600', color: autoOffsetOnSave ? theme.onPrimaryContainer : theme.onSurfaceVariant }}>
                  {autoOffsetOnSave
                    ? 'Will offset against selected loan on save'
                    : 'Tap a loan or toggle on to offset'}
                </Text>
              </View>
              <Switch
                value={autoOffsetOnSave}
                onValueChange={setAutoOffsetOnSave}
                trackColor={{ false: theme.outlineVariant, true: theme.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {matchingDebts.map((d) => {
                const rem = Math.max(0, d.amount - (d.paid_amount || 0));
                const isPicked = autoOffsetOnSave && offsetTargetDebtId === d.id;
                return (
                  <TouchableOpacity
                    key={d.id}
                    activeOpacity={0.75}
                    onPress={() => {
                      if (isPicked) {
                        setOffsetTargetDebtId(null);
                      } else {
                        setOffsetTargetDebtId(d.id);
                        setAutoOffsetOnSave(true);
                      }
                    }}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 8,
                      backgroundColor: isPicked ? theme.primary : theme.surface,
                      borderWidth: 1,
                      borderColor: isPicked ? theme.primary : theme.divider,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isPicked ? theme.onPrimary : theme.onSurface }}>
                      {formatCurrency(rem, d.currency || currency)}
                    </Text>
                    <Text style={{ fontSize: 10, color: isPicked ? theme.onPrimary : theme.onSurfaceVariant, opacity: isPicked ? 0.9 : 1 }}>
                      {d.date}{d.note ? ` • ${d.note}` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        );
      })()}

      <View style={styles.iouPersonInputRow}>
        <TouchableOpacity
          style={[
            styles.iouPersonNextBtn,
            {
              backgroundColor: theme.pillBg,
              borderWidth: 1,
              borderColor: theme.divider,
              paddingHorizontal: 10,
            },
          ]}
          onPress={handlePickFromContacts}
          accessibilityRole="button"
          accessibilityLabel="Pick from contacts"
        >
          <MaterialCommunityIcons
            name="account-box-outline"
            size={18}
            color={accent}
          />
        </TouchableOpacity>
        <TextInput
          style={[
            styles.iouPersonInput,
            {
              backgroundColor: theme.pillBg,
              color: theme.onSurface,
              borderColor: theme.divider,
            },
          ]}
          placeholder="Add person (e.g. James)"
          placeholderTextColor={theme.onSurfaceVariant}
          value={splitPersonInput}
          onChangeText={(txt) => {
            setSplitPersonInput(txt);
            if (!forExpense) setIouPersonName(txt);
          }}
          returnKeyType="done"
          onSubmitEditing={() => handleAddSplitPerson()}
        />
        <TouchableOpacity
          style={[
            styles.iouPersonNextBtn,
            {
              backgroundColor: theme.pillBg,
              borderWidth: 1,
              borderColor: splitPersonInput.trim() ? accent : theme.divider,
            },
          ]}
          disabled={!splitPersonInput.trim()}
          onPress={() => handleAddSplitPerson()}
        >
          <Text
            style={{
              color: splitPersonInput.trim() ? accent : theme.onSurfaceVariant,
              fontWeight: '700',
              fontSize: 12.5,
            }}
          >
            + Add
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.iouPersonNextBtn,
            {
              backgroundColor:
                splitPeople.length > 0 || splitPersonInput.trim()
                  ? accent
                  : theme.pillBg,
            },
          ]}
          disabled={splitPeople.length === 0 && !splitPersonInput.trim()}
          onPress={() => {
            if (splitPersonInput.trim()) {
              handleAddSplitPerson();
            }
            animateLayout();
            const needsWallet = forExpense
              ? form.expenseSource === 'borrowed_partial' && !form.selectedWalletId
              : form.iouUseWallet && !form.selectedWalletId;
            const needsCategory = forExpense
              ? !selectedCategoryId
              : iouIncludeMyShare && !selectedCategoryId;
            const nextSheet = needsWallet ? 'wallet' : needsCategory ? 'category' : null;
            setActiveSheet(nextSheet);
            if (!nextSheet) {
              Keyboard.dismiss();
            }
          }}
        >
          <Text
            style={{
              color:
                splitPeople.length > 0 || splitPersonInput.trim()
                  ? '#FFFFFF'
                  : theme.onSurfaceVariant,
              fontWeight: '700',
              fontSize: 12.5,
            }}
          >
            Next
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
