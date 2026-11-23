export type FormKind = 'expense' | 'income' | 'transfer' | 'loan';

export type FormSlotKey = 'amount' | 'fee' | 'who' | 'wallet' | 'what' | 'when' | 'more';

export type ExpensePaidBy = 'wallet' | 'borrowed_full' | 'borrowed_partial';

export type IouAction = 'lent' | 'borrowed' | 'settle';

export type ActiveSheet = 'category' | 'wallet' | 'iou' | null;

/**
 * Fixed field order per form kind. Slots never move between forms;
 * inapplicable slots are omitted for that formKind.
 */
export const FORM_FIELDS: Record<FormKind, readonly FormSlotKey[]> = {
  expense: ['amount', 'who', 'wallet', 'what', 'when', 'more'],
  income: ['amount', 'who', 'wallet', 'what', 'when', 'more'],
  transfer: ['amount', 'wallet', 'when', 'more'],
  loan: ['amount', 'who', 'wallet', 'what', 'when', 'more'],
};

export interface ValidationContext {
  parsedAmount: number;
  expenseSource: ExpensePaidBy;
  splitEnabled: boolean;
  splitPeopleCount: number;
  splitPersonInput: string;
  splitTotalOwedByOthers: number;
  settleIouEnabled: boolean;
  selectedDebtId: string;
  selectedWalletId: string;
  selectedToWalletId: string;
  selectedCategoryId: string;
  iouAction: IouAction;
  iouUseWallet: boolean;
  iouPersonName: string;
}

export interface ValidationError {
  title: string;
  message: string;
  focusSheet?: ActiveSheet;
  focusAmount?: boolean;
}

type ValidationRule = (ctx: ValidationContext) => ValidationError | null;

const validateAmount: ValidationRule = (ctx) => {
  if (isNaN(ctx.parsedAmount) || ctx.parsedAmount <= 0) {
    return {
      title: 'Invalid Amount',
      message: 'Please enter an amount greater than 0.',
      focusAmount: true,
    };
  }
  return null;
};

/**
 * Single validation table keyed by FormKind so every form presents
 * consistent errors and focuses the missing field.
 */
export const FORM_VALIDATION: Record<FormKind, readonly ValidationRule[]> = {
  expense: [
    validateAmount,
    (ctx) => {
      if (ctx.settleIouEnabled && !ctx.selectedDebtId) {
        return {
          title: 'Select a Loan',
          message: 'Choose which borrowed loan this expense is repaying, or turn off Settle Borrowed Loan.',
        };
      }
      return null;
    },
    (ctx) => {
      if (ctx.expenseSource !== 'wallet') {
        if (ctx.splitPeopleCount === 0 && !ctx.splitPersonInput.trim()) {
          return {
            title: 'Select Who You Owe',
            message: 'Add at least one person who paid for this expense.',
            focusSheet: 'iou',
          };
        }
        if (ctx.splitTotalOwedByOthers > ctx.parsedAmount + 0.01) {
          return {
            title: 'Loan Exceeds Total',
            message: 'The sum of loan shares cannot exceed the total expense amount.',
            focusSheet: 'iou',
          };
        }
      } else if (ctx.splitEnabled) {
        if (ctx.splitPeopleCount === 0) {
          return {
            title: 'Add Participants',
            message: 'Add at least one person to split this expense with, or turn off Split Expense.',
          };
        }
        if (ctx.splitTotalOwedByOthers > ctx.parsedAmount + 0.01) {
          return {
            title: 'Split Exceeds Total',
            message: 'The sum of split shares cannot exceed the total expense amount.',
          };
        }
      }
      return null;
    },
    (ctx) => {
      if (ctx.expenseSource !== 'borrowed_full' && !ctx.selectedWalletId) {
        return {
          title: 'Select Wallet',
          message: 'Please select a wallet.',
          focusSheet: 'wallet',
        };
      }
      return null;
    },
    (ctx) => {
      if (!ctx.selectedCategoryId) {
        return {
          title: 'Select Category',
          message: 'Please select a category for this expense.',
          focusSheet: 'category',
        };
      }
      return null;
    },
  ],
  income: [
    validateAmount,
    (ctx) => {
      if (ctx.settleIouEnabled && !ctx.selectedDebtId) {
        return {
          title: 'Select a Loan',
          message: 'Choose which open loan this income is repaying, or turn off Settle Open Loan.',
        };
      }
      return null;
    },
    (ctx) => {
      if (!ctx.selectedWalletId) {
        return {
          title: 'Select Wallet',
          message: 'Please select a wallet.',
          focusSheet: 'wallet',
        };
      }
      return null;
    },
    (ctx) => {
      if (!ctx.selectedCategoryId) {
        return {
          title: 'Select Category',
          message: 'Please select a category for this income.',
          focusSheet: 'category',
        };
      }
      return null;
    },
  ],
  transfer: [
    validateAmount,
    (ctx) => {
      if (!ctx.selectedWalletId) {
        return {
          title: 'Select Wallet',
          message: 'Please select a source wallet.',
          focusSheet: 'wallet',
        };
      }
      if (!ctx.selectedToWalletId) {
        return {
          title: 'Select Destination',
          message: 'Please select a destination wallet to transfer to.',
          focusSheet: 'wallet',
        };
      }
      if (ctx.selectedWalletId === ctx.selectedToWalletId) {
        return {
          title: 'Invalid Destination',
          message: 'Source and destination wallets must be different.',
          focusSheet: 'wallet',
        };
      }
      return null;
    },
  ],
  loan: [
    validateAmount,
    (ctx) => {
      if (ctx.iouAction === 'settle') {
        if (!ctx.selectedDebtId) {
          return {
            title: 'Select an Open Loan',
            message: 'Tap to choose which open loan is being settled.',
            focusSheet: 'iou',
          };
        }
      } else {
        const hasPerson =
          ctx.splitPeopleCount > 0 ||
          Boolean(ctx.splitPersonInput.trim()) ||
          Boolean(ctx.iouPersonName.trim());
        if (!hasPerson) {
          return {
            title: 'Enter Person',
            message: 'Add at least one person for this loan.',
            focusSheet: 'iou',
          };
        }
        if (ctx.splitPeopleCount > 0 && ctx.splitTotalOwedByOthers > ctx.parsedAmount + 0.01) {
          return {
            title: 'Split Exceeds Total',
            message: 'The sum of split shares cannot exceed the total amount.',
            focusSheet: 'iou',
          };
        }
      }
      return null;
    },
    (ctx) => {
      if (ctx.iouUseWallet && !ctx.selectedWalletId) {
        return {
          title: 'Select Wallet',
          message: 'Please select a wallet or switch to Off-wallet.',
          focusSheet: 'wallet',
        };
      }
      return null;
    },
  ],
};

export function validateForm(kind: FormKind, ctx: ValidationContext): ValidationError | null {
  for (const rule of FORM_VALIDATION[kind]) {
    const err = rule(ctx);
    if (err) return err;
  }
  return null;
}
