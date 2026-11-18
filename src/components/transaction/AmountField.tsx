import React from 'react';
import { Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { formatTypingNumber, parseCleanNumber } from '../../utils/format';
import { transactionFormStyles as styles } from './styles';
import { TransactionFormState } from './useTransactionForm';

interface AmountFieldProps {
  form: TransactionFormState;
  theme: any;
}

export const AmountField: React.FC<AmountFieldProps> = ({ form, theme }) => {
  const {
    currency,
    setCurrencyPickerVisible,
    amountInputRef,
    taxInputRef,
    noteInputRef,
    amountStr,
    setAmountStr,
    taxAmountStr,
    setTaxAmountStr,
    isPaid,
    setIsPaid,
    formKind,
  } = form;

  const hasFeeSlot = formKind === 'expense' || formKind === 'transfer';

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
      <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>AMOUNT</Text>
      <View style={styles.amountInputRow}>
        <TouchableOpacity
          style={[styles.currencyChip, { backgroundColor: theme.pillBg, borderColor: theme.divider }]}
          onPress={() => setCurrencyPickerVisible(true)}
        >
          <Text style={[styles.currencyText, { color: theme.primary }]}>{currency}</Text>
          <MaterialCommunityIcons name="menu-down" size={16} color={theme.onSurfaceVariant} />
        </TouchableOpacity>

        <TextInput
          ref={amountInputRef}
          style={[styles.amountInput, { color: theme.onSurface }]}
          placeholder="0.00"
          placeholderTextColor={theme.onSurfaceVariant}
          keyboardType={Platform.OS === 'android' ? 'numeric' : 'decimal-pad'}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => {
            if (hasFeeSlot) taxInputRef.current?.focus();
            else noteInputRef.current?.focus();
          }}
          value={amountStr}
          onChangeText={(text) => setAmountStr(formatTypingNumber(text))}
          selectTextOnFocus={false}
        />

        <TouchableOpacity
          style={[
            styles.paidChip,
            {
              backgroundColor: isPaid ? theme.successContainer : theme.pillBg,
              borderColor: isPaid ? theme.success : theme.divider,
            },
          ]}
          onPress={() => setIsPaid((prev) => !prev)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Status: ${isPaid ? 'Paid' : 'Unpaid'}. Tap to toggle.`}
        >
          <MaterialCommunityIcons
            name={isPaid ? 'check-circle' : 'clock-outline'}
            size={15}
            color={isPaid ? theme.success : theme.onSurfaceVariant}
          />
          <Text
            style={[
              styles.paidChipText,
              {
                color: isPaid ? theme.onSuccessContainer : theme.onSurfaceVariant,
              },
            ]}
          >
            {isPaid ? 'Paid' : 'Unpaid'}
          </Text>
        </TouchableOpacity>
      </View>

      {hasFeeSlot && (
        <View style={[styles.taxRow, { borderTopColor: theme.divider }]}>
          <MaterialCommunityIcons
            name="receipt-text-outline"
            size={16}
            color={theme.onSurfaceVariant}
          />
          <Text style={[styles.taxLabel, { color: theme.onSurfaceVariant }]}>
            {formKind === 'transfer' ? 'Transfer Fee' : 'Add Tax'}
          </Text>
          <TextInput
            ref={taxInputRef}
            style={[
              styles.taxInput,
              {
                color: theme.onSurface,
                backgroundColor: theme.pillBg,
                borderColor: theme.divider,
              },
            ]}
            placeholder="0"
            placeholderTextColor={theme.onSurfaceVariant}
            keyboardType={Platform.OS === 'android' ? 'numeric' : 'decimal-pad'}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => noteInputRef.current?.focus()}
            value={taxAmountStr}
            onChangeText={(text) => {
              const formatted = formatTypingNumber(text);
              const prevTax = taxAmountStr.trim() ? parseCleanNumber(taxAmountStr) : 0;
              const nextTax = formatted.trim() ? parseCleanNumber(formatted) : 0;
              const currentTotal = amountStr.trim() ? parseCleanNumber(amountStr) : 0;
              const safePrevTax = !isNaN(prevTax) && prevTax > 0 ? prevTax : 0;
              const safeNextTax = !isNaN(nextTax) && nextTax > 0 ? nextTax : 0;
              const safeTotal = !isNaN(currentTotal) && currentTotal > 0 ? currentTotal : 0;
              const baseAmount = Math.max(0, safeTotal - safePrevTax);
              const updatedTotal = Math.round((baseAmount + safeNextTax) * 100) / 100;
              setTaxAmountStr(formatted);
              setAmountStr(updatedTotal > 0 ? formatTypingNumber(updatedTotal.toString()) : '');
            }}
          />
          {(() => {
            const totalVal = parseCleanNumber(amountStr);
            const taxVal = taxAmountStr.trim() ? parseCleanNumber(taxAmountStr) : 0;
            if (!isNaN(totalVal) && !isNaN(taxVal) && taxVal > 0 && totalVal >= taxVal) {
              return (
                <View style={[styles.taxNetBadge, { backgroundColor: theme.primaryContainer }]}>
                  <Text style={[styles.taxNetText, { color: theme.onPrimaryContainer }]}>
                    Base {(totalVal - taxVal).toLocaleString()}
                  </Text>
                </View>
              );
            }
            return null;
          })()}
        </View>
      )}
    </View>
  );
};
