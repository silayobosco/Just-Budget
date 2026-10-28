# just budget (JB) 💰

A privacy-focused, offline-first mobile budget and savings planner built with **React Native**, **Expo (TypeScript)**, **SQLite**, and styled in **Material 3 Expressive**. Inspired by **Budge**.

---

## ✨ Features

- **"Available for Day" Daily Allowance**:
  - Automatically calculates your daily disposable income:
    $$\text{Daily Allowance} = \frac{\text{Remaining Cycle Balance}}{\text{Remaining Days in Cycle}}$$
  - Real-time live tracking of today's spending vs. daily allowance with dynamic warning & on-track badges.
  - Automatically rolls over unspent amounts to subsequent days.
- **Multi-Currency Wallets**:
  - Create and manage distinct accounts (Cash, Bank, Mobile Money, Savings) in different currencies (USD, EUR, GBP, TZS, KES, INR, etc.).
  - Set starting balances and track live remaining balances.
  - Inter-wallet transfers with automatic offline currency exchange conversions.
  - Global net worth converted to your primary base currency.
- **Custom Budget Cycles**:
  - Flexible start and end dates (e.g. 25th of month to 24th, or 1st to 31st).
  - Target budget cap with live tracking of total spent and remaining balance.
- **Interactive Calendar Ledger**:
  - Month-by-month calendar view with spend indicator dots.
  - Tap any day to inspect itemized transactions.
- **Editable Universal Categories & Subcategories**:
  - Preloaded with standard expense & income categories (Food & Dining, Housing, Transportation, Shopping, Fun, Health, Income).
  - Fully editable: create, rename, change colors, icons, add subcategories, or remove.
- **Income & Expense Dashboards**:
  - Visual cash flow comparison, savings rate %, and category breakdown bars.
  - Daily average spending metric.
- **100% Offline with Google Drive & Cloud Backup / Restore**:
  - Export portable `.jbbackup` archives directly to Google Drive, WhatsApp, or local Files via the system share sheet.
  - Restore sessions seamlessly on any other Android or iOS device via Document Picker.
- **Material 3 Expressive Aesthetic**:
  - Tactile numeric keypad for rapid transaction logging.
  - Expressive pill tabs, rounded cards, and light/dark theme support.

---

## 🚀 Running the App

### 1. Start the Expo Development Server

```bash
cd just-budget
npx expo start
```

### 2. Run on Device or Emulator

- **Android Device / Emulator**: Press `a` in the terminal or run `npx expo run:android`
- **iOS Simulator**: Press `i` in the terminal or run `npx expo run:ios` (macOS required)
- **Expo Go App**: Scan the QR code shown in the terminal with the Expo Go app on Android or Camera app on iOS.

---

## 📁 Project Structure

```
just-budget/
├── App.tsx                     # Main application entry point & navigation
├── src/
│   ├── types/index.ts          # Core data models (Wallet, Category, Transaction, etc.)
│   ├── theme/index.ts          # Material 3 Expressive tokens & color palettes
│   ├── services/
│   │   ├── db.ts               # SQLite tables initialization & default seeding
│   │   └── backup.ts           # Google Drive / Share sheet export & import
│   ├── context/
│   │   └── BudgetContext.tsx   # Central reactive state engine & calculations
│   ├── screens/
│   │   ├── HomeScreen.tsx      # Available for Day hero & recent activity
│   │   ├── CalendarScreen.tsx  # Cycle start/end dates & day-by-day calendar
│   │   ├── WalletsScreen.tsx   # Multi-currency balances & wallet transfers
│   │   └── AnalyticsScreen.tsx # Cash flow dashboard & category spending
│   └── components/
│       ├── Header.tsx          # Brand header & quick modal actions
│       ├── BottomTabs.tsx      # 4-tab M3 expressive navigation bar
│       ├── AddTransactionModal.tsx # Tactile numeric keypad & quick logging
│       ├── CategoryManagerModal.tsx# Universal category & subcategory manager
│       └── SettingsModal.tsx   # Google Drive backup, exchange rates & themes
```
