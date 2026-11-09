import { TransactionType } from '../types';
import { TabType } from '../components/BottomTabs';
import { parseCleanNumber } from '../utils/format';

export interface DeepLinkTransaction {
  type: TransactionType;
  amount?: number;
  categoryNameOrId?: string;
  note?: string;
  walletNameOrId?: string;
  date?: string;
}

export interface ParsedDeepLink {
  action: 'transaction' | 'tab';
  tab?: TabType;
  transaction?: DeepLinkTransaction;
}

/**
 * Parses incoming deep links such as:
 * - justbudget://new-transaction?type=expense&amount=25.50&category=Food&note=Lunch
 * - justbudget://add-expense?amount=10
 * - justbudget://add-income?amount=500
 * - justbudget://analytics
 * - justbudget://calendar
 * - justbudget://wallets
 * - justbudget://settings
 */
export function parseDeepLinkUrl(rawUrl?: string | null): ParsedDeepLink | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  try {
    // Normalise scheme
    const trimmed = rawUrl.trim();
    if (!trimmed.toLowerCase().startsWith('justbudget://')) {
      return null;
    }

    // Replace justbudget:// with http://dummy/ so standard URL parser can parse path and search params
    const normalized = trimmed.replace(/^justbudget:\/\/?/i, 'http://dummy/');
    const url = new URL(normalized);

    const pathOrHost = (url.pathname.replace(/^\//, '') || url.host).toLowerCase();
    const searchParams = url.searchParams;

    // Check for tab navigation
    if (['analytics', 'reports'].includes(pathOrHost)) {
      return { action: 'tab', tab: 'analytics' };
    }
    if (pathOrHost === 'calendar') {
      return { action: 'tab', tab: 'calendar' };
    }
    if (pathOrHost === 'wallets') {
      return { action: 'tab', tab: 'wallets' };
    }
    if (pathOrHost === 'settings') {
      return { action: 'tab', tab: 'settings' };
    }

    // Check for transaction entry
    if (
      pathOrHost === 'new-transaction' ||
      pathOrHost === 'transaction' ||
      pathOrHost === 'add-expense' ||
      pathOrHost === 'add-income' ||
      pathOrHost === ''
    ) {
      let type: TransactionType = 'expense';
      const rawType = (searchParams.get('type') || '').toLowerCase();
      if (rawType === 'income' || pathOrHost === 'add-income') {
        type = 'income';
      }

      const rawAmount = searchParams.get('amount') || '';
      let amount: number | undefined;
      if (rawAmount) {
        const parsed = parseCleanNumber(rawAmount);
        if (!isNaN(parsed) && parsed > 0) {
          amount = parsed;
        }
      }

      const category = searchParams.get('category') || searchParams.get('recipient') || undefined;
      const note = searchParams.get('note') || searchParams.get('description') || undefined;
      const wallet = searchParams.get('wallet') || undefined;
      const date = searchParams.get('date') || undefined;

      return {
        action: 'transaction',
        transaction: {
          type,
          amount,
          categoryNameOrId: category,
          note,
          walletNameOrId: wallet,
          date,
        },
      };
    }

    return null;
  } catch (err) {
    console.warn('Failed to parse deep link URL:', rawUrl, err);
    return null;
  }
}
