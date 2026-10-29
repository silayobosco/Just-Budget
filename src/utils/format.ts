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
 * Formats a numeric value with commas separating every 3 digits.
 * If includeDecimals is true (or decimal value is non-zero), displays decimals;
 * otherwise omits trailing ".00" for a clean look.
 * e.g. 1250000 -> "1,250,000"
 * With currency: formatCurrency(1250000, "TZS") -> "TZS 1,250,000"
 */
export const formatCurrency = (amount: number, currency?: string, forceDecimals = false): string => {
  const val = isNaN(amount) || amount === null || amount === undefined ? 0 : amount;
  const isNegative = val < 0;
  const absVal = Math.abs(val);

  // If forceDecimals is false and amount has no fractional part, omit decimals completely
  const hasDecimals = forceDecimals || (absVal % 1 !== 0);

  let formattedNumber: string;
  if (hasDecimals) {
    const parts = absVal.toFixed(2).split('.');
    const integerWithCommas = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    // Strip trailing zeros if .x0 -> .x
    const decimalPart = parts[1];
    formattedNumber = `${integerWithCommas}.${decimalPart}`;
  } else {
    const integerStr = Math.round(absVal).toString();
    formattedNumber = integerStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  const result = `${isNegative ? '-' : ''}${formattedNumber}`;
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
