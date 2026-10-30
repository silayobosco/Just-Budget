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

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats a cycle date range nicely, e.g. "27 Oct – 28 Nov '26" or "1 – 31 Oct '26"
 */
export const formatCycleDateRange = (startDateStr?: string, endDateStr?: string): string => {
  if (!startDateStr || !endDateStr) return 'Active Cycle';

  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const [ey, em, ed] = endDateStr.split('-').map(Number);

  if (!sy || !sm || !sd || !ey || !em || !ed) return `${startDateStr} – ${endDateStr}`;

  const startMonthName = SHORT_MONTHS[sm - 1] || `${sm}`;
  const endMonthName = SHORT_MONTHS[em - 1] || `${em}`;
  const startYrShort = String(sy).slice(-2);
  const endYrShort = String(ey).slice(-2);

  // Same year & same month: e.g. "1 – 31 Oct '26"
  if (sy === ey && sm === em) {
    return `${sd} – ${ed} ${startMonthName} '${startYrShort}`;
  }

  // Same year, different month: e.g. "27 Oct – 28 Nov '26"
  if (sy === ey) {
    return `${sd} ${startMonthName} – ${ed} ${endMonthName} '${startYrShort}`;
  }

  // Different years: e.g. "27 Dec '25 – 28 Jan '26"
  return `${sd} ${startMonthName} '${startYrShort} – ${ed} ${endMonthName} '${endYrShort}`;
};

/**
 * Calculates start and end dates for a regular monthly cycle given a month start day (1-31).
 */
export const getRegularCycleDates = (
  monthStartDay = 1,
  refDate: Date = new Date()
): { startDate: string; endDate: string; name: string } => {
  const year = refDate.getFullYear();
  const month = refDate.getMonth(); // 0-indexed
  const day = refDate.getDate();

  const boundedStartDay = Math.min(31, Math.max(1, monthStartDay));

  let startYear = year;
  let startMonth = month; // 0-indexed
  let endYear = year;
  let endMonth = month; // 0-indexed

  if (boundedStartDay === 1) {
    // Normal calendar month: 1st to last day of current month
    const maxDay = new Date(year, month + 1, 0).getDate();
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(maxDay).padStart(2, '0')}`;
    return {
      startDate,
      endDate,
      name: formatCycleDateRange(startDate, endDate),
    };
  }

  if (day >= boundedStartDay) {
    // Current cycle started this month on boundedStartDay
    startYear = year;
    startMonth = month;

    // Ends next month on day before boundedStartDay
    endMonth = month + 1;
    if (endMonth > 11) {
      endMonth = 0;
      endYear = year + 1;
    }
  } else {
    // Current cycle started last month on boundedStartDay
    startMonth = month - 1;
    if (startMonth < 0) {
      startMonth = 11;
      startYear = year - 1;
    }

    // Ends this month on day before boundedStartDay
    endYear = year;
    endMonth = month;
  }

  const maxStartDay = new Date(startYear, startMonth + 1, 0).getDate();
  const actualStartDay = Math.min(boundedStartDay, maxStartDay);

  // End day is day before boundedStartDay in end month
  const targetEndDay = boundedStartDay - 1 === 0 ? new Date(endYear, endMonth, 0).getDate() : boundedStartDay - 1;
  const maxEndDay = new Date(endYear, endMonth + 1, 0).getDate();
  const actualEndDay = Math.min(targetEndDay, maxEndDay);

  const startDate = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(actualStartDay).padStart(2, '0')}`;
  const endDate = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-${String(actualEndDay).padStart(2, '0')}`;

  return {
    startDate,
    endDate,
    name: formatCycleDateRange(startDate, endDate),
  };
};
