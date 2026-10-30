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

  // Seed default data if database is empty
  seedInitialData(db);
};

const seedInitialData = (db: SQLite.SQLiteDatabase) => {
  // Check if onboarding is completed
  const onboardingRow = db.getFirstSync<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'onboarding_completed'`
  );

  // If this is a fresh setup or onboarding was never explicitly marked completed:
  // Clean up any legacy dummy seed data (dummy wallets with fake balances, dummy recurring bills, dummy budgets)
  if (!onboardingRow || onboardingRow.value !== '1') {
    // Clean up dummy seed wallets
    db.runSync(`DELETE FROM wallets WHERE id IN ('w-cash', 'w-bank', 'w-savings')`);
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
      {
        id: 'cat-income',
        name: 'Income & Inflow',
        type: 'income',
        icon: 'cash-plus',
        color: '#10B981',
        subs: ['Salary / Paycheck', 'Freelance & Side Hustle', 'Investments & Dividends', 'Bonus & Gifts'],
      },
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
