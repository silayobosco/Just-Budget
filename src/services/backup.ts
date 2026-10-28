import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getDB } from './db';
import { Wallet, Category, Subcategory, Transaction, BudgetCycle, RecurringBill, BudgetLimit } from '../types';

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

export const exportBackupData = async (): Promise<boolean> => {
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

  const jsonString = JSON.stringify(backup, null, 2);
  const fileName = `just_budget_backup_${new Date().toISOString().slice(0, 10)}.jbbackup`;
  const filePath = `${FileSystem.cacheDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(filePath, jsonString, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(filePath, {
      mimeType: 'application/json',
      dialogTitle: 'Save "just budget" Backup to Google Drive / Files',
      UTI: 'public.json',
    });
    return true;
  }
  return false;
};

export const importBackupData = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['*/*'],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { success: false, message: 'Restore cancelled by user' };
    }

    const fileUri = result.assets[0].uri;
    const fileContent = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const parsed: BackupData = JSON.parse(fileContent);

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
          `INSERT INTO budget_cycles (id, name, start_date, end_date, target_budget, is_active)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [b.id, b.name, b.start_date, b.end_date, b.target_budget || null, b.is_active ? 1 : 0]
        );
      }

      // Restore transactions
      for (const t of parsed.transactions) {
        db.runSync(
          `INSERT INTO transactions (id, wallet_id, category_id, subcategory_id, type, amount, currency, base_amount, date, note, to_wallet_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            t.note || null,
            t.to_wallet_id || null,
            t.created_at || new Date().toISOString(),
          ]
        );
      }

      // Restore recurring bills
      if (parsed.recurring_bills) {
        for (const b of parsed.recurring_bills) {
          db.runSync(
            `INSERT INTO recurring_bills (id, name, amount, currency, frequency, due_day, next_due_date, category_id, wallet_id, reminder_enabled, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              b.id,
              b.name,
              b.amount,
              b.currency,
              b.frequency,
              b.due_day,
              b.next_due_date,
              b.category_id || null,
              b.wallet_id,
              b.reminder_enabled ? 1 : 0,
              b.is_active ? 1 : 0,
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
