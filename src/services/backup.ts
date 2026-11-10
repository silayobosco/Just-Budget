import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getDB } from './db';
import { Wallet, Category, Subcategory, Transaction, BudgetCycle, RecurringBill, BudgetLimit } from '../types';
import { encryptBackupPayload, decryptBackupPayload } from './security';

export interface BackupData {
  app: string;
  version: number;
  exported_at: string;
  settings: Record<string, string>;
  wallets: Wallet[];
  categories: Category[];
  subcategories: Subcategory[];
  transactions: Transaction[];
  budget_cycles: BudgetCycle[];
  recurring_bills?: RecurringBill[];
  budgets?: BudgetLimit[];
}

export const exportBackupData = async (passphrase?: string): Promise<boolean> => {
  const db = getDB();

  // Read all tables
  const settingsRows = db.getAllSync<{ key: string; value: string }>(`SELECT key, value FROM settings`);
  const settings: Record<string, string> = {};
  settingsRows.forEach((r) => {
    settings[r.key] = r.value;
  });

  const wallets = db.getAllSync<Wallet>(`SELECT * FROM wallets`);
  const categories = db.getAllSync<Category>(`SELECT * FROM categories`);
  const subcategories = db.getAllSync<Subcategory>(`SELECT * FROM subcategories`);
  const transactions = db.getAllSync<Transaction>(`SELECT * FROM transactions`);
  const budget_cycles = db.getAllSync<BudgetCycle>(`SELECT * FROM budget_cycles`);
  const recurring_bills = db.getAllSync<RecurringBill>(`SELECT * FROM recurring_bills`);
  const budgets = db.getAllSync<BudgetLimit>(`SELECT * FROM budgets`);

  const backup: BackupData = {
    app: 'just budget',
    version: 1,
    exported_at: new Date().toISOString(),
    settings,
    wallets,
    categories,
    subcategories,
    transactions,
    budget_cycles,
    recurring_bills,
    budgets,
  };

  let fileData = JSON.stringify(backup, null, 2);
  const isEncrypted = Boolean(passphrase && passphrase.trim().length > 0);
  if (isEncrypted) {
    fileData = await encryptBackupPayload(fileData, passphrase!.trim());
  }

  const fileName = `just_budget_backup_${new Date().toISOString().slice(0, 10)}${isEncrypted ? '_encrypted' : ''}.jbbackup`;
  const filePath = `${FileSystem.cacheDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(filePath, fileData, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(filePath, {
      mimeType: 'application/json',
      dialogTitle: isEncrypted
        ? 'Save Encrypted "just budget" Backup'
        : 'Save "just budget" Backup to Google Drive / Files',
      UTI: 'public.json',
    });
    return true;
  }
  return false;
};

export const pickBackupFileAsync = async (): Promise<{
  canceled: boolean;
  content?: string;
  isEncrypted?: boolean;
  fileName?: string;
  error?: string;
}> => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['*/*'],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { canceled: true };
    }

    const asset = result.assets[0];
    const fileContent = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const isEncrypted = fileContent.includes('"encrypted":true') || fileContent.includes('"encrypted": true');

    return {
      canceled: false,
      content: fileContent,
      isEncrypted,
      fileName: asset.name,
    };
  } catch (err: any) {
    return {
      canceled: false,
      error: err.message || 'Failed to read the selected backup file.',
    };
  }
};

export const restoreFromBackupContentAsync = async (
  fileContent: string,
  passphrase?: string
): Promise<{
  success: boolean;
  message: string;
  requiresPassphrase?: boolean;
  incorrectPassphrase?: boolean;
}> => {
  try {
    let payloadStr = fileContent;

    // Check if the backup is encrypted
    if (payloadStr.includes('"encrypted":true') || payloadStr.includes('"encrypted": true')) {
      if (!passphrase || !passphrase.trim()) {
        return {
          success: false,
          requiresPassphrase: true,
          message: 'This backup is encrypted with a password. Please enter the password to restore.',
        };
      }
      try {
        payloadStr = await decryptBackupPayload(payloadStr, passphrase.trim());
      } catch (err: any) {
        return {
          success: false,
          incorrectPassphrase: true,
          message: 'Incorrect decryption password. Please check your password and try again.',
        };
      }
    }

    let parsed: BackupData;
    try {
      parsed = JSON.parse(payloadStr);
    } catch {
      return {
        success: false,
        incorrectPassphrase: true,
        message: 'Could not decrypt backup file. Incorrect password or corrupted data.',
      };
    }

    if (!parsed || parsed.app !== 'just budget' || !parsed.wallets || !parsed.categories) {
      return { success: false, message: 'Invalid backup file format for "just budget"' };
    }

    const db = getDB();

    // Run within a transaction
    db.withTransactionSync(() => {
      // Clear existing records
      db.runSync(`DELETE FROM transactions`);
      db.runSync(`DELETE FROM budgets`);
      db.runSync(`DELETE FROM recurring_bills`);
      db.runSync(`DELETE FROM subcategories`);
      db.runSync(`DELETE FROM categories`);
      db.runSync(`DELETE FROM wallets`);
      db.runSync(`DELETE FROM budget_cycles`);
      db.runSync(`DELETE FROM settings`);

      // Restore settings
      if (parsed.settings) {
        for (const [key, value] of Object.entries(parsed.settings)) {
          db.runSync(`INSERT INTO settings (key, value) VALUES (?, ?)`, [key, value]);
        }
      }

      // Restore wallets
      for (const w of parsed.wallets) {
        db.runSync(
          `INSERT INTO wallets (id, name, currency, starting_balance, current_balance, color, icon, is_default)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [w.id, w.name, w.currency, w.starting_balance, w.current_balance, w.color, w.icon, w.is_default ? 1 : 0]
        );
      }

      // Restore categories
      for (const c of parsed.categories) {
        db.runSync(
          `INSERT INTO categories (id, name, type, icon, color, is_default) VALUES (?, ?, ?, ?, ?, ?)`,
          [c.id, c.name, c.type, c.icon, c.color, c.is_default ? 1 : 0]
        );
      }

      // Restore subcategories
      if (parsed.subcategories) {
        for (const s of parsed.subcategories) {
          db.runSync(
            `INSERT INTO subcategories (id, category_id, name) VALUES (?, ?, ?)`,
            [s.id, s.category_id, s.name]
          );
        }
      }

      // Restore budget cycles
      for (const b of parsed.budget_cycles) {
        db.runSync(
          `INSERT OR REPLACE INTO budget_cycles (id, name, start_date, end_date, target_budget, target_income, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [b.id, b.name, b.start_date, b.end_date, b.target_budget ?? null, b.target_income ?? null, b.is_active ? 1 : 0]
        );
      }

      // Restore transactions
      for (const t of parsed.transactions) {
        db.runSync(
          `INSERT OR REPLACE INTO transactions (id, wallet_id, category_id, subcategory_id, type, amount, currency, base_amount, date, time, is_paid, media_uri, note, to_wallet_id, recurring_bill_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            t.id,
            t.wallet_id,
            t.category_id || null,
            t.subcategory_id || null,
            t.type,
            t.amount,
            t.currency,
            t.base_amount,
            t.date,
            t.time || null,
            t.is_paid !== undefined ? (t.is_paid ? 1 : 0) : 1,
            t.media_uri || null,
            t.note || null,
            t.to_wallet_id || null,
            t.recurring_bill_id || null,
            t.created_at || new Date().toISOString(),
            t.updated_at || null,
          ]
        );
      }

      // Restore recurring bills
      if (parsed.recurring_bills) {
        for (const b of parsed.recurring_bills) {
          db.runSync(
            `INSERT OR REPLACE INTO recurring_bills (id, name, amount, currency, frequency, type, due_day, next_due_date, category_id, wallet_id, reminder_enabled, is_active, end_type, end_occurrences, end_date, occurrences_count, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              b.id,
              b.name,
              b.amount,
              b.currency,
              b.frequency,
              b.type || 'expense',
              b.due_day,
              b.next_due_date,
              b.category_id || null,
              b.wallet_id,
              b.reminder_enabled ? 1 : 0,
              b.is_active ? 1 : 0,
              b.end_type || 'never',
              b.end_occurrences ?? null,
              b.end_date || null,
              b.occurrences_count ?? 0,
              b.created_at || new Date().toISOString(),
            ]
          );
        }
      }

      // Restore budgets
      if (parsed.budgets) {
        for (const b of parsed.budgets) {
          db.runSync(
            `INSERT INTO budgets (id, scope, category_id, subcategory_id, amount, period, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              b.id,
              b.scope,
              b.category_id || null,
              b.subcategory_id || null,
              b.amount,
              b.period,
              b.created_at || new Date().toISOString(),
            ]
          );
        }
      }
    });

    return { success: true, message: 'All data and sessions restored successfully!' };
  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to restore backup' };
  }
};

export const importBackupData = async (
  passphrase?: string
): Promise<{ success: boolean; message: string; requiresPassphrase?: boolean; incorrectPassphrase?: boolean }> => {
  const pick = await pickBackupFileAsync();
  if (pick.canceled || !pick.content) {
    return { success: false, message: 'Restore cancelled by user' };
  }
  if (pick.error) {
    return { success: false, message: pick.error };
  }
  return await restoreFromBackupContentAsync(pick.content, passphrase);
};
