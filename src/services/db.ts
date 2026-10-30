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
  // Check if settings exists
  const baseCurrencyRow = db.getFirstSync<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'base_currency'`
  );

  if (!baseCurrencyRow) {
    db.runSync(`INSERT INTO settings (key, value) VALUES ('base_currency', 'USD')`);
    db.runSync(`INSERT INTO settings (key, value) VALUES ('theme_mode', 'light')`);
    db.runSync(`INSERT INTO settings (key, value) VALUES ('app_name', 'just budget')`);
  }

  // Check wallets
  const walletCount = db.getFirstSync<{ count: number }>(`SELECT COUNT(*) as count FROM wallets`);
  if (!walletCount || walletCount.count === 0) {
    db.runSync(
      `INSERT INTO wallets (id, name, currency, starting_balance, current_balance, color, icon, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['w-cash', 'Cash Wallet', 'USD', 500, 500, '#10B981', 'cash', 1]
    );
    db.runSync(
      `INSERT INTO wallets (id, name, currency, starting_balance, current_balance, color, icon, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['w-bank', 'Bank Account', 'USD', 2500, 2500, '#3B82F6', 'bank', 0]
    );
    db.runSync(
      `INSERT INTO wallets (id, name, currency, starting_balance, current_balance, color, icon, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['w-savings', 'Savings / Reserve', 'USD', 1200, 1200, '#8B5CF6', 'piggy-bank', 0]
    );
  }

  // Check categories
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

  // Check budget cycles
  const cycleCount = db.getFirstSync<{ count: number }>(`SELECT COUNT(*) as count FROM budget_cycles`);
  if (!cycleCount || cycleCount.count === 0) {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-indexed
    const monthStr = String(month + 1).padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    db.runSync(
      `INSERT INTO budget_cycles (id, name, start_date, end_date, target_budget, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [`cycle-${year}-${month + 1}`, `${monthNames[month]} ${year}`, startDate, endDate, 2000]
    );
  }

  // Check recurring bills
  const billCount = db.getFirstSync<{ count: number }>(`SELECT COUNT(*) as count FROM recurring_bills`);
  if (!billCount || billCount.count === 0) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');

    db.runSync(
      `INSERT INTO recurring_bills (id, name, amount, currency, frequency, due_day, next_due_date, category_id, wallet_id, reminder_enabled, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['bill-1', 'Netflix Subscription', 15.0, 'USD', 'monthly', 15, `${year}-${month}-15`, 'cat-entertainment', 'w-bank', 1, 1]
    );
    db.runSync(
      `INSERT INTO recurring_bills (id, name, amount, currency, frequency, due_day, next_due_date, category_id, wallet_id, reminder_enabled, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['bill-2', 'Home Wi-Fi Internet', 50.0, 'USD', 'monthly', 1, `${year}-${month}-01`, 'cat-housing', 'w-bank', 1, 1]
    );
  }

  // Check budgets (Category & Subcategory budgets)
  const budgetCount = db.getFirstSync<{ count: number }>(`SELECT COUNT(*) as count FROM budgets`);
  if (!budgetCount || budgetCount.count === 0) {
    const today = new Date();
    const period = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const defaultBudgets: [string, string, string | null, string | null, number][] = [
      ['b-food', 'category', 'cat-food', null, 500],
      ['b-food-groc', 'subcategory', 'cat-food', 'cat-food-sub-1', 300],
      ['b-food-rest', 'subcategory', 'cat-food', 'cat-food-sub-2', 200],
      ['b-housing', 'category', 'cat-housing', null, 700],
      ['b-transport', 'category', 'cat-transport', null, 250],
      ['b-shopping', 'category', 'cat-shopping', null, 200],
      ['b-entertainment', 'category', 'cat-entertainment', null, 150],
    ];

    for (const [bId, scope, catId, subId, amount] of defaultBudgets) {
      db.runSync(
        `INSERT INTO budgets (id, scope, category_id, subcategory_id, amount, period)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [bId, scope, catId, subId, amount, period]
      );
    }
  }
};
