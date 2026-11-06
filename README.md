# Just Budget (JB) 💰

A privacy-focused, offline-first mobile budget and savings planner built with **React Native**, **Expo (TypeScript)**, **SQLite**, and styled in **Material Design 3 Expressive**.

Designed to give you full financial clarity with an intuitive **"Available for Day"** allowance engine, custom pay cycles, multi-currency accounts, and zero cloud tracking.

---

## ✨ Key Features

### 📅 "Available for Day" Allowance Engine
- **Dynamic Daily Budget**:
  $$\text{Daily Allowance} = \frac{\text{Remaining Cycle Balance}}{\text{Remaining Days in Cycle}}$$
- **Smart Rollover**: Unspent daily allowance rolls over automatically to future days, compounding your savings.
- **Overspending Badges**: Visual color-coded status pills alert you if you are on track or exceeding daily pace.

### 💳 Multi-Currency Wallets & Transfers
- Create accounts for **Cash, Bank, Mobile Money, and Savings** across global currencies (default **TZS**, plus USD, EUR, GBP, KES, INR, etc.).
- Track live balances, record inter-wallet transfers, and view total net worth converted into your primary base currency.

### 🧮 Built-in Expressive Dial Pad & Calculator
- **Inline Math Support**: Perform basic math operations directly on the dial pad (`+`, `-`, `×`, `÷`, `=`) with live evaluated amount pills.
- **Smooth Numeric Entry**: Blinking cursor and quick category tagging without keyboard flickering or intrusive system overlays.

### 🔔 100% Offline Notifications & Smart Reminders
- **Bill Due Date Alerts**: Never miss a scheduled or recurring bill payment.
- **Morning Allowance Briefing**: Optional 8:30 AM summary of your daily disposable spending allowance.
- **Evening Expense Check-in**: Optional 8:30 PM reminder to log day-to-day cash expenses.
- **Instant Test Utility**: "Send Test Notification" in Settings to verify device sound and channel delivery.

### 🔒 Privacy-First Security & Biometrics
- **Biometric Fingerprint / Face Unlock & 6-Digit PIN**:
  - Cold app launch protection.
  - Zero interruptions during normal app use: recording, editing, and deleting transactions are completely auth-free.
  - Generous 15-minute background grace period for seamless multitasking.
- **Encrypted Local Backups**:
  - Export password-protected `.jbbackup` archives directly via Android/iOS share sheets (Google Drive, WhatsApp, local storage).
  - One-tap restore to migrate data seamlessly across devices.

### 📊 Interactive Calendar & Analytics
- **Visual Calendar Ledger**: Month-by-month grid with color-coded spend indicator dots and day-by-day itemized breakdowns.
- **Cycle Mode Flexibility**: Support for standard calendar months (1st to 31st) or custom salary/payday cycles (e.g. 25th to 24th).
- **Cash Flow Analytics**: Savings rate %, expense distribution by category, and daily average spend metrics.

### 🏷️ Customizable Categories & Subcategories
- Preconfigured with comprehensive defaults:
  - **Food & Dining**: *Breakfast, Lunch, Dinner, Drinks, Snacks, Groceries, Delivery, Restaurant*.
  - **Housing, Transportation, Shopping, Entertainment, Health, Education, Utilities, and Income*.
- Full customization: add custom icons, rename categories, reorder, or create new subcategories on the fly.

---

## 📱 Navigation & App Structure

| Tab | Screen | Description |
| :--- | :--- | :--- |
| 🏠 | **Home** | Available for Day hero, live balance cards, dial pad & quick transaction recording |
| 🗓️ | **Calendar** | Cycle progress, daily spending ledger, itemized day view & recurring bill trackers |
| 💼 | **Wallets** | Cash/Bank/Mobile Money accounts, transfer modal & currency management |
| 📊 | **Analytics** | Expense breakdown charts, income vs. expense cash flow, savings rate |
| ⚙️ | **Settings** | Currency selection, theme (Light/Dark), notifications, security PIN, and backups |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or newer)
- [Android Studio](https://developer.android.com/studio) with Android SDK and CMake 4.1.2+ (for Android builds)
- [JDK 17](https://adoptium.net/) (Eclipse Adoptium / Temurin)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
```bash
npx expo start
```

### 3. Run on Connected Physical Phone (USB)
1. Enable **USB Debugging** in your Android Developer Options.
2. Connect your device via USB and run:
```bash
npx expo run:android
```
3. If Metro bundler shows an error screen on physical device, reverse port 8081:
```bash
adb reverse tcp:8081 tcp:8081
```

### 4. Run on Android Emulator
```bash
npx expo run:android
```

---

## 📦 Building for Release

### Standalone Release APK (For Direct Installation & Sharing)
Bakes the entire JavaScript bundle, assets, and icons into a self-contained offline APK:

```powershell
cd android
.\gradlew assembleRelease
```
*(On macOS/Linux: `./gradlew assembleRelease`)*

- **Generated APK location**:
  `android/app/build/outputs/apk/release/app-release.apk`

- **Install to connected physical phone**:
  ```powershell
  adb -d install -r android/app/build/outputs/apk/release/app-release.apk
  ```

### Google Play Store Bundle (`.aab`)
```powershell
cd android
.\gradlew bundleRelease
```
- **Generated AAB location**:
  `android/app/build/outputs/bundle/release/app-release.aab`

---

## 📁 Source Code Organization

```text
just-budget/
├── App.tsx                           # Main app entry, tab router & lock screen overlay
├── app.json                          # Expo configuration, plugins, icons & permissions
├── assets/                           # Launcher icons, adaptive icons & splash screens
├── android/                          # Native Android project (Gradle, CMake, Kotlin)
└── src/
    ├── components/
    │   ├── AppLockOverlay.tsx        # Biometric & PIN lock screen overlay
    │   ├── BottomTabs.tsx            # Material 3 expressive navigation bar
    │   ├── BudgetCycleModal.tsx      # Cycle dates and default budget settings
    │   ├── CategoryManagerModal.tsx  # Universal category and subcategory editor
    │   ├── CategoryPickerSheet.tsx   # Fast category selector bottom sheet
    │   ├── CycleModeSwitcherModal.tsx# Regular vs. Accumulated cycle switcher
    │   ├── DateRangePickerModal.tsx  # Custom calendar range selector
    │   ├── Header.tsx                # Dynamic top header with tab indicators
    │   ├── OnboardingModal.tsx       # First-launch currency and setup wizard
    │   ├── SecuritySetupModal.tsx    # PIN and biometrics configuration
    │   └── TransactionDetailsModal.tsx # Full transaction editor with smooth numeric entry
    ├── context/
    │   └── BudgetContext.tsx         # SQLite data store, balance math & reactive state
    ├── screens/
    │   ├── HomeScreen.tsx            # Hero dial pad, budget cap progress & wallets
    │   ├── CalendarScreen.tsx        # Visual calendar ledger & recurring bills
    │   ├── WalletsScreen.tsx         # Account balances & inter-wallet transfers
    │   ├── AnalyticsScreen.tsx       # Spending charts, savings rate & cash flow
    │   └── SettingsScreen.tsx        # Currency, notifications, security & backup
    ├── services/
    │   ├── db.ts                     # SQLite schema, tables & auto-migrations
    │   ├── backup.ts                 # Encrypted JSON backup export & restore
    │   ├── notifications.ts          # Local notification channels & reminders
    │   └── security.ts               # Biometrics (LocalAuthentication) & SHA-256 PIN
    ├── theme/
    │   └── index.ts                  # Material Design 3 Expressive tokens & color themes
    ├── types/
    │   └── index.ts                  # TypeScript interfaces (Wallet, Transaction, Cycle, etc.)
    └── utils/
        └── format.ts                 # Currency formatters, typing parsers & math helpers
```

---

## 💬 Contact & Suggestions

Have questions, suggestions, or feedback? Reach out directly:

- **WhatsApp**: [+255 616 003 937](https://wa.me/255616003937)
- **Email**: [juniorboss031@gmail.com](mailto:juniorboss031@gmail.com)

---

## 🛡️ License

This project is licensed under the [MIT License](LICENSE) — see the [LICENSE](LICENSE) file for details. Built with ❤️ for financial freedom.
