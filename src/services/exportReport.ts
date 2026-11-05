import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Transaction, Category, Wallet, BudgetCycle } from '../types';
import { formatCurrency } from '../utils/format';

interface AnalyticsExportData {
  timeframe: string;
  totalExpense: number;
  totalIncome: number;
  netSavings: number;
  savingsRate: number;
  dailyAverageSpend: number;
  budgetCap?: number;
  incomeGoal?: number;
  baseCurrency: string;
  categorySpending: { categoryName: string; amount: number; count: number }[];
  categoryIncome: { categoryName: string; amount: number; count: number }[];
  transactions: Transaction[];
  categories: Category[];
  wallets: Wallet[];
}

/**
 * Generate formatted text report
 */
export const buildAnalyticsSummaryText = (data: AnalyticsExportData): string => {
  const curr = data.baseCurrency;
  const separator = '------------------------------------------------';
  const lines: string[] = [
    '================================================',
    '             JUST BUDGET FINANCIAL REPORT       ',
    '================================================',
    `Report Period: ${data.timeframe}`,
    `Generated On:  ${new Date().toLocaleString()}`,
    `Base Currency: ${curr}`,
    separator,
    'EXECUTIVE SUMMARY',
    separator,
    `Total Income:       +${formatCurrency(data.totalIncome, curr)}`,
    `Total Expenses:     -${formatCurrency(data.totalExpense, curr)}`,
    `Net Savings:        ${data.netSavings >= 0 ? '+' : ''}${formatCurrency(data.netSavings, curr)}`,
    `Savings Rate:       ${data.savingsRate}%`,
    `Daily Average Spend: ${formatCurrency(data.dailyAverageSpend, curr)}/day`,
  ];

  if (data.budgetCap && data.budgetCap > 0) {
    const budgetPct = Math.round((data.totalExpense / data.budgetCap) * 100);
    const remainingBudget = Math.max(0, data.budgetCap - data.totalExpense);
    lines.push(
      `Budget Cap:         ${formatCurrency(data.budgetCap, curr)} (${budgetPct}% spent)`,
      `Remaining Cap:      ${formatCurrency(remainingBudget, curr)}`
    );
  }

  if (data.incomeGoal && data.incomeGoal > 0) {
    const goalPct = Math.round((data.totalIncome / data.incomeGoal) * 100);
    lines.push(
      `Income Goal:        ${formatCurrency(data.incomeGoal, curr)} (${goalPct}% reached)`
    );
  }

  lines.push(separator, 'EXPENSE BREAKDOWN BY CATEGORY', separator);
  if (data.categorySpending.length === 0) {
    lines.push('No expense transactions recorded in this period.');
  } else {
    data.categorySpending.forEach((cat, index) => {
      const share = data.totalExpense > 0 ? ((cat.amount / data.totalExpense) * 100).toFixed(1) : '0';
      lines.push(
        `${index + 1}. ${cat.categoryName.padEnd(24)} ${formatCurrency(cat.amount, curr).padStart(12)} (${share}%, ${cat.count} tx)`
      );
    });
  }

  lines.push(separator, 'INCOME BREAKDOWN BY CATEGORY', separator);
  if (data.categoryIncome.length === 0) {
    lines.push('No income transactions recorded in this period.');
  } else {
    data.categoryIncome.forEach((cat, index) => {
      const share = data.totalIncome > 0 ? ((cat.amount / data.totalIncome) * 100).toFixed(1) : '0';
      lines.push(
        `${index + 1}. ${cat.categoryName.padEnd(24)} ${formatCurrency(cat.amount, curr).padStart(12)} (${share}%, ${cat.count} tx)`
      );
    });
  }

  lines.push(
    separator,
    'Exported offline from Just Budget (No accounts, 100% private).',
    '================================================'
  );

  return lines.join('\n');
};

/**
 * Share Analytics Summary Report (.txt)
 */
export const exportAnalyticsSummaryReport = async (data: AnalyticsExportData): Promise<boolean> => {
  const reportText = buildAnalyticsSummaryText(data);
  const cleanTime = data.timeframe.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
  const fileName = `JustBudget_Report_${cleanTime}_${new Date().toISOString().slice(0, 10)}.txt`;
  const filePath = `${FileSystem.cacheDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(filePath, reportText, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(filePath, {
      mimeType: 'text/plain',
      dialogTitle: 'Share Financial Analytics Report',
      UTI: 'public.plain-text',
    });
    return true;
  }
  return false;
};

/**
 * Export Detailed Transactions to CSV
 */
export const exportTransactionsCSV = async (data: AnalyticsExportData): Promise<boolean> => {
  const headers = ['Date', 'Time', 'Type', 'Category', 'Subcategory', 'Amount', 'Currency', 'Base Amount', 'Wallet', 'Note', 'Status'];
  const rows: string[] = [headers.join(',')];

  data.transactions.forEach((tx) => {
    const cat = data.categories.find((c) => c.id === tx.category_id);
    const sub = cat?.subcategories?.find((s) => s.id === tx.subcategory_id);
    const w = data.wallets.find((item) => item.id === tx.wallet_id);

    const escapeCsv = (val?: string | number | null) => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    rows.push(
      [
        escapeCsv(tx.date),
        escapeCsv(tx.time || ''),
        escapeCsv(tx.type),
        escapeCsv(cat?.name || 'Uncategorized'),
        escapeCsv(sub?.name || ''),
        escapeCsv(tx.amount || tx.base_amount || 0),
        escapeCsv(tx.currency || data.baseCurrency),
        escapeCsv(tx.base_amount || tx.amount || 0),
        escapeCsv(w?.name || 'Default Wallet'),
        escapeCsv(tx.note || ''),
        escapeCsv(tx.is_paid !== false ? 'Completed' : 'Pending'),
      ].join(',')
    );
  });

  const csvContent = rows.join('\n');
  const cleanTime = data.timeframe.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
  const fileName = `JustBudget_Transactions_${cleanTime}_${new Date().toISOString().slice(0, 10)}.csv`;
  const filePath = `${FileSystem.cacheDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(filePath, csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(filePath, {
      mimeType: 'text/csv',
      dialogTitle: 'Export Analytics Transactions CSV',
      UTI: 'public.comma-separated-values-text',
    });
    return true;
  }
  return false;
};
