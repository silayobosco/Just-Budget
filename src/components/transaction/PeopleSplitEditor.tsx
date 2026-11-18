import React from 'react';
import {
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
  } = form;

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
                {!forExpense && splitPeople.length <= 1 ? (
                  <TextInput
                    style={[
                      styles.taxInput,
                      {
                        color: theme.onSurface,
                        backgroundColor: theme.surface,
                        borderColor: theme.divider,
                        minWidth: 82,
                        paddingVertical: 4,
                        fontSize: 12.5,
                      },
                    ]}
                    placeholder={autoSingleMyShare > 0 ? autoSingleMyShare.toString() : 'Auto'}
                    placeholderTextColor={theme.onSurfaceVariant}
                    keyboardType={Platform.OS === 'android' ? 'numeric' : 'decimal-pad'}
                    value={iouMyShareStr}
                    onChangeText={(t) => setIouMyShareStr(formatTypingNumber(t))}
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
            return (
              <View
                key={p.name}
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
                        minWidth: 82,
                        paddingVertical: 4,
                        fontSize: 12.5,
                      },
                    ]}
                    placeholder={resolvedShare > 0 ? resolvedShare.toString() : '0'}
                    placeholderTextColor={theme.onSurfaceVariant}
                    keyboardType={Platform.OS === 'android' ? 'numeric' : 'decimal-pad'}
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
        {!forExpense && (
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
              const nextSheet =
                iouIncludeMyShare && !selectedCategoryId ? 'category' : null;
              setActiveSheet(nextSheet);
              if (!nextSheet) {
                setTimeout(focusAmountInput, 140);
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
        )}
      </View>
    </View>
  );
};
