import * as SQLite from 'expo-sqlite';
import { Wallet, Category, Subcategory, Transaction, BudgetCycle, AppSettings } from '../types';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export const getDB = (): SQLite.SQLiteDatabase => {
  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync('just_budget.db');
  }
  return dbInstance;
};

export const initDatabase = async () => {
  const db = getDB();

  // Create tables if they do not exist
  db.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS wallets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      currency TEXT NOT NULL,
      starting_balance REAL NOT NULL DEFAULT 0,
      current_balance REAL NOT NULL DEFAULT 0,
      color TEXT NOT NULL,
      icon TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL, -- 'expense' | 'income'
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS subcategories (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      wallet_id TEXT NOT NULL,
      category_id TEXT,
      subcategory_id TEXT,
      type TEXT NOT NULL, -- 'expense' | 'income' | 'transfer'
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      base_amount REAL NOT NULL,
      date TEXT NOT NULL, -- YYYY-MM-DD
      time TEXT,
      is_paid INTEGER DEFAULT 1,
      media_uri TEXT,
      note TEXT,
      to_wallet_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (wallet_id) REFERENCES wallets (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS budget_cycles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      target_budget REAL,
      target_income REAL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recurring_bills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      frequency TEXT NOT NULL, -- 'weekly' | 'monthly' | 'yearly'
      due_day INTEGER NOT NULL,
      next_due_date TEXT NOT NULL,
      category_id TEXT,
      wallet_id TEXT NOT NULL,
      reminder_enabled INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      end_type TEXT DEFAULT 'never', -- 'never' | 'after_occurrences' | 'on_date'
      end_occurrences INTEGER,
      end_date TEXT,
      occurrences_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (wallet_id) REFERENCES wallets (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL, -- 'overall' | 'category' | 'subcategory'
      category_id TEXT,
      subcategory_id TEXT,
      amount REAL NOT NULL,
      period TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE,
      FOREIGN KEY (subcategory_id) REFERENCES subcategories (id) ON DELETE CASCADE
    );
  `);

  // Safe migrations for table changes
  try {
    db.runSync(`ALTER TABLE budget_cycles ADD COLUMN target_income REAL`);
  } catch {
    // Column already exists
  }
  try {
    db.runSync(`ALTER TABLE transactions ADD COLUMN time TEXT`);
  } catch {}
  try {
    db.runSync(`ALTER TABLE transactions ADD COLUMN is_paid INTEGER DEFAULT 1`);
  } catch {}
  try {
    db.runSync(`ALTER TABLE transactions ADD COLUMN media_uri TEXT`);
  } catch {}
  try {
    db.runSync(`ALTER TABLE recurring_bills ADD COLUMN end_type TEXT DEFAULT 'never'`);
  } catch {}
  try {
    db.runSync(`ALTER TABLE recurring_bills ADD COLUMN end_occurrences INTEGER`);
  } catch {}
  try {
    db.runSync(`ALTER TABLE recurring_bills ADD COLUMN end_date TEXT`);
  } catch {}
  try {
    db.runSync(`ALTER TABLE recurring_bills ADD COLUMN occurrences_count INTEGER DEFAULT 0`);
  } catch {}

  // Run migrations & ensure defaults
  ensureDefaultIncomeCategories(db);
  const currSetting = db.getFirstSync<{ value: string }>(`SELECT value FROM settings WHERE key = 'base_currency'`);
  ensureDefaultWallets(db, currSetting?.value || 'USD');

  // Seed default data if database is empty
  seedInitialData(db);
};

export const DEFAULT_WALLETS = [
  { id: 'w-cash', name: 'Cash', color: '#10B981', icon: 'cash', is_default: 1 },
  { id: 'w-bank', name: 'Bank', color: '#3B82F6', icon: 'bank', is_default: 0 },
  { id: 'w-mobile', name: 'Mobile Money', color: '#F59E0B', icon: 'cellphone', is_default: 0 },
  { id: 'w-savings', name: 'Savings', color: '#8B5CF6', icon: 'piggy-bank', is_default: 0 },
];

export const DEFAULT_INCOME_CATEGORIES: {
  id: string;
  name: string;
  type: 'income';
  icon: string;
  color: string;
  subs: string[];
}[] = [
  {
    id: 'cat-salary',
    name: 'Salary',
    type: 'income',
    icon: 'briefcase-check',
    color: '#10B981',
    subs: ['Monthly Salary', 'Overtime', 'Bonus', 'Commission'],
  },
  {
    id: 'cat-investment',
    name: 'Investment',
    type: 'income',
    icon: 'trending-up',
    color: '#3B82F6',
    subs: ['Dividends', 'Capital Gains', 'Interest', 'Real Estate'],
  },
  {
    id: 'cat-rewards',
    name: 'Rewards',
    type: 'income',
    icon: 'trophy-outline',
    color: '#F59E0B',
    subs: ['Cashback', 'Points & Vouchers', 'Refunds', 'Contests'],
  },
  {
    id: 'cat-gifts',
    name: 'Gifts',
    type: 'income',
    icon: 'gift-outline',
    color: '#EC4899',
    subs: ['Family & Friends', 'Grants', 'Donations', 'Allowances'],
  },
  {
    id: 'cat-business',
    name: 'Business',
    type: 'income',
    icon: 'store-outline',
    color: '#8B5CF6',
    subs: ['Product Sales', 'Services & Freelance', 'Consulting', 'Royalties'],
  },
];

export const ensureDefaultWallets = (db: SQLite.SQLiteDatabase, currency: string = 'USD') => {
  try {
    const txCount = db.getFirstSync<{ count: number }>(`SELECT COUNT(*) as count FROM transactions`);
    const hasZeroTransactions = !txCount || txCount.count === 0;

    for (const w of DEFAULT_WALLETS) {
      const existing = db.getFirstSync<{ id: string }>(`SELECT id FROM wallets WHERE id = ?`, [w.id]);
      if (!existing) {
        db.runSync(
          `INSERT INTO wallets (id, name, currency, starting_balance, current_balance, color, icon, is_default) VALUES (?, ?, ?, 0, 0, ?, ?, ?)`,
          [w.id, w.name, currency, w.color, w.icon, w.is_default]
        );
      } else if (hasZeroTransactions) {
        // Reset starting & current balances to 0 if no transactions recorded yet
        db.runSync(
          `UPDATE wallets SET starting_balance = 0, current_balance = 0 WHERE id = ? AND (starting_balance != 0 OR current_balance != 0)`,
          [w.id]
        );
      }
    }
  } catch (err) {
    console.error('Error ensuring default wallets:', err);
  }
};

export const ensureDefaultIncomeCategories = (db: SQLite.SQLiteDatabase) => {
  try {
    // If legacy cat-income exists, migrate its transactions and remove it
    const legacyIncome = db.getFirstSync<{ id: string }>(`SELECT id FROM categories WHERE id = 'cat-income'`);
    if (legacyIncome) {
      db.runSync(`UPDATE transactions SET category_id = 'cat-salary' WHERE category_id = 'cat-income'`);
      db.runSync(`DELETE FROM subcategories WHERE category_id = 'cat-income'`);
      db.runSync(`DELETE FROM categories WHERE id = 'cat-income'`);
    }

    for (const cat of DEFAULT_INCOME_CATEGORIES) {
      db.runSync(
        `INSERT OR IGNORE INTO categories (id, name, type, icon, color, is_default) VALUES (?, ?, ?, ?, ?, 1)`,
        [cat.id, cat.name, cat.type, cat.icon, cat.color]
      );
      for (let i = 0; i < cat.subs.length; i++) {
        const subId = `${cat.id}-sub-${i + 1}`;
        db.runSync(
          `INSERT OR IGNORE INTO subcategories (id, category_id, name) VALUES (?, ?, ?)`,
          [subId, cat.id, cat.subs[i]]
        );
      }
    }
  } catch (err) {
    console.error('Error ensuring default income categories:', err);
  }
};

const seedInitialData = (db: SQLite.SQLiteDatabase) => {
  // Check if onboarding is completed
  const onboardingRow = db.getFirstSync<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'onboarding_completed'`
  );

  // If this is a fresh setup or onboarding was never explicitly marked completed:
  // Clean up any legacy dummy recurring bills or dummy budgets
  if (!onboardingRow || onboardingRow.value !== '1') {
    // Clean up dummy recurring bills
    db.runSync(`DELETE FROM recurring_bills WHERE id IN ('bill-1', 'bill-2')`);
    // Clean up dummy pre-seeded budgets
    db.runSync(`DELETE FROM budgets WHERE id IN ('b-food', 'b-food-groc', 'b-food-rest', 'b-housing', 'b-transport', 'b-shopping', 'b-entertainment')`);
    // Clean up dummy cycle targets
    db.runSync(`UPDATE budget_cycles SET target_budget = NULL, target_income = NULL WHERE target_budget = 2000`);

    if (!onboardingRow) {
      db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('onboarding_completed', '0')`);
      db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('theme_mode', 'light')`);
      db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('app_name', 'just budget')`);
    }
  }

  // Restore default wallets with 0 balance
  const curr = db.getFirstSync<{ value: string }>(`SELECT value FROM settings WHERE key = 'base_currency'`)?.value || 'USD';
  ensureDefaultWallets(db, curr);
  ensureDefaultIncomeCategories(db);

  // Check categories (Seed standard categories taxonomy if empty, without monetary amounts)
  const catCount = db.getFirstSync<{ count: number }>(`SELECT COUNT(*) as count FROM categories`);
  if (!catCount || catCount.count === 0) {
    const defaultCategories: {
      id: string;
      name: string;
      type: 'expense' | 'income';
      icon: string;
      color: string;
      subs: string[];
    }[] = [
      {
        id: 'cat-food',
        name: 'Food & Dining',
        type: 'expense',
        icon: 'silverware-fork-knife',
        color: '#FF6F61',
        subs: ['Groceries', 'Restaurants', 'Coffee & Tea', 'Snacks & Drinks', 'Delivery'],
      },
      {
        id: 'cat-housing',
        name: 'Housing & Bills',
        type: 'expense',
        icon: 'home-outline',
        color: '#3B82F6',
        subs: ['Rent / Mortgage', 'Electricity', 'Water', 'Internet / Wi-Fi', 'Repairs & Upkeep'],
      },
      {
        id: 'cat-transport',
        name: 'Transportation',
        type: 'expense',
        icon: 'car-outline',
        color: '#F59E0B',
        subs: ['Fuel & Gas', 'Public Transit', 'Taxi & Rideshare', 'Parking & Tolls', 'Vehicle Maintenance'],
      },
      {
        id: 'cat-shopping',
        name: 'Shopping & Goods',
        type: 'expense',
        icon: 'shopping-outline',
        color: '#8B5CF6',
        subs: ['Clothing & Shoes', 'Electronics', 'Home Goods', 'Personal Care', 'Gifts'],
      },
      {
        id: 'cat-entertainment',
        name: 'Fun & Leisure',
        type: 'expense',
        icon: 'gamepad-variant-outline',
        color: '#EC4899',
        subs: ['Subscriptions & Streaming', 'Cinema & Events', 'Hobbies', 'Travel & Outings'],
      },
      {
        id: 'cat-health',
        name: 'Health & Wellness',
        type: 'expense',
        icon: 'heart-pulse',
        color: '#06B6D4',
        subs: ['Doctor & Pharmacy', 'Fitness & Gym', 'Dental & Vision', 'Therapy'],
      },
      ...DEFAULT_INCOME_CATEGORIES,
    ];

    for (const cat of defaultCategories) {
      db.runSync(
        `INSERT INTO categories (id, name, type, icon, color, is_default) VALUES (?, ?, ?, ?, ?, 1)`,
        [cat.id, cat.name, cat.type, cat.icon, cat.color]
      );
      for (let i = 0; i < cat.subs.length; i++) {
        const subId = `${cat.id}-sub-${i + 1}`;
        db.runSync(
          `INSERT INTO subcategories (id, category_id, name) VALUES (?, ?, ?)`,
          [subId, cat.id, cat.subs[i]]
        );
      }
    }
  }

  // Note: No dummy wallets, no dummy recurring bills, and no dummy budgets are seeded.
  // The app invites the user to create their first wallet and budget cycle on onboarding.
};
