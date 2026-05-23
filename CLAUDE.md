# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
npm run ios            # Build and run on iOS simulator
npm run android        # Build and run on Android emulator
npm run postinstall    # Apply patches (runs automatically after npm install)
```

No test or lint commands are configured.

## Architecture

This is a React Native (Expo) expense tracking app written in TypeScript with a **Rust native backend**.

### Data Flow

UI (Screens/Components) → Zustand Store → Services → Native Bridge (`services/api.ts`) → Rust SDK (`sdk/`) → SQLite

Cloud sync and auth go through Supabase (`services/Supabase.ts`).

### Key Layers

- **Entry**: `App.tsx` — auth state, font loading, notifications, data init
- **Navigation**: `screens/AppNavigator.tsx` (5-tab bottom nav: Banks, Balances, Transactions, Statistics, Settings) and `screens/AuthNavigator.tsx`
- **State**: Zustand store in `store/store.ts` — normalized state with ID-based lookups for accounts, categories, transactions, appconstants, user balances
- **Contexts**: `contexts/ThemeContext.tsx` (light/dark mode), `contexts/ReloadContext.tsx` (data refresh triggers)
- **Native Bridge**: `services/api.ts` wraps `NativeModules.Bindings` to call Rust backend. Actions are defined as enums in `types/actions/actions.ts`
- **Rust Backend**: `sdk/` — staticlib compiled to iOS/Android, uses SQLite. Entry at `sdk/src/lib.rs`, routing in `sdk/src/api/`, business logic in `sdk/src/services/`
- **Styles**: Theme-aware style factory functions in `styles/` directory

### Backend Communication Pattern

All backend calls go through `invokeBackend(action, payload)` in `services/api.ts`. The action enum (`types/actions/actions.ts`) defines 23+ operations. The Rust SDK routes these to appropriate service handlers.

### Feature Areas

- **Transactions**: CRUD, filtering, sorting, CSV import
- **Banking**: Account management, balance tracking
- **Splits**: Friend expense splitting with ledger tracking (`services/Splits.ts`, `sdk/src/services/split/`)
- **Reports**: PDF generation (`services/PdfGenerator.ts`), monthly report scheduling
- **Sync**: Background sync service (`services/BackgroundSync.ts`) for offline→online data sync

### Constants & Types

- `constants/theme.ts` — color palettes, fonts, sizes for light/dark modes
- `constants/category.ts` — expense category definitions
- `types/entity/` — domain types (Account, Transaction, Category, etc.)
- `types/actions/` — backend action enums and payload interfaces

### Config

- Expo config: `app.config.js` (reads Supabase creds from `.env`)
- iOS bundle: `com.finance.expensify`, Android package: `com.Finance.Expensify`
- TypeScript extends `expo/tsconfig.base`
- Patches applied via `patch-package` (see `patches/`)
