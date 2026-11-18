import React from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { formatTypingNumber, parseCleanNumber } from '../../utils/format';
import { transactionFormStyles as styles } from './styles';
import { TransactionFormState } from './useTransactionForm';

interface FeeFieldProps {
  form: TransactionFormState;
  theme: any;
}

export const FeeField: React.FC<FeeFieldProps> = ({ form, theme }) => {
  const {
    formKind,
    taxInputRef,
    noteInputRef,
    taxAmountStr,
    setTaxAmountStr,
    amountStr,
    setAmountStr,
  } = form;

  const isTransfer = formKind === 'transfer';
  const label = isTransfer ? 'Transfer Fee' : 'Add Tax';

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
      <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>
        {isTransfer ? 'FEE' : 'TAX'}
      </Text>
      <View style={[styles.taxRow, { borderTopColor: 'transparent', marginTop: 0, paddingTop: 0 }]}>
        <MaterialCommunityIcons
          name="receipt-text-outline"
          size={16}
          color={theme.onSurfaceVariant}
        />
        <Text style={[styles.taxLabel, { color: theme.onSurfaceVariant }]}>{label}</Text>
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
    </View>
  );
};
