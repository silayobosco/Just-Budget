/**
 * Formats a raw number string while typing, adding commas every 3 digits
 * and preserving trailing dots and decimal digits (e.g. "1000000" -> "1,000,000", "1250." -> "1,250.")
 */
export const formatTypingNumber = (raw: string): string => {
  if (!raw || raw === '0') return '0';

  const parts = raw.split('.');
  const integerPart = parts[0] || '0';
  const decimalPart = parts.length > 1 ? parts[1] : null;

  // Insert comma every 3 digits
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  if (decimalPart !== null) {
    return `${formattedInteger}.${decimalPart}`;
  }
  return formattedInteger;
};

/**
 * Formats a numeric value with commas separating every 3 digits and 2 decimal places.
 * e.g. 1250000 -> "1,250,000.00"
 * With currency: formatCurrency(1250000, "TZS") -> "TZS 1,250,000.00"
 */
export const formatCurrency = (amount: number, currency?: string): string => {
  const val = isNaN(amount) || amount === null || amount === undefined ? 0 : amount;
  const isNegative = val < 0;
  const absVal = Math.abs(val);

  const parts = absVal.toFixed(2).split('.');
  const integerWithCommas = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const result = `${isNegative ? '-' : ''}${integerWithCommas}.${parts[1]}`;

  return currency ? `${currency} ${result}` : result;
};

/**
 * Formats a number with commas, omitting the currency symbol.
 * e.g. 700000 -> "700,000" (or with 2 decimals if specified)
 */
export const formatNumberOnly = (amount: number, includeDecimals = false): string => {
  const val = isNaN(amount) || amount === null || amount === undefined ? 0 : amount;
  const isNegative = val < 0;
  const absVal = Math.abs(val);

  if (includeDecimals) {
    const parts = absVal.toFixed(2).split('.');
    const integerWithCommas = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${isNegative ? '-' : ''}${integerWithCommas}.${parts[1]}`;
  }

  const integerStr = Math.round(absVal).toString();
  const integerWithCommas = integerStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${isNegative ? '-' : ''}${integerWithCommas}`;
};
