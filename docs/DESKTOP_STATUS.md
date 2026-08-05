# Desktop Status

**Complete.** Type-check clean (renderer + main), 18 tests passing, `electron-vite build` succeeds.

## Architecture

- **Stack**: Electron 31 + electron-vite + React 19 + TypeScript strict. No Next.js.
- **Process split**: `electron/main` (windows, SQLite, printing, updater, secure storage),
  `electron/preload` (contextBridge), `src/` (renderer, zero Node access).

## Reused from the platform

| Package | Desktop use |
|---|---|
| `@hisabche/api` | Every server call. Storage adapter registered with the OS keychain. |
| `@hisabche/validation` | Login form, invoice payloads, IPC table/currency enums. |
| `@hisabche/auth-core` | `Session`, `SessionStore`, capability checks. |
| `@hisabche/i18n` | Locale bundles + a `desktop` namespace. |
| `@hisabche/ui` | `globals.css` tokens and `tailwind.config` imported directly. |

`@hisabche/ui` **components**: 29 of 185 files import `next/*`. `vite.config` aliases
`next/link`, `next/navigation` and `next/image` to shims backed by react-router. Desktop shells
(sidebar, dense tables, toolbars, command palette) are built locally — mobile layouts are not copied.

## Security

`nodeIntegration=false`, `contextIsolation=true`, `sandbox=true`, CSP applied when packaged,
`will-navigate` locked to the app origin, external links go to the system browser.
Every IPC payload is parsed by a Zod schema in main before it touches the DB or OS — six tests
cover the rejection paths (unknown table, oversized page, path-traversal key, unknown window action).

## Features

| Phase | Delivered |
|---|---|
| 1 Foundation | Auth (keychain session), theme + RTL, sidebar, `Ctrl+N/S/F/P/K` shortcuts |
| 2 Dashboard | KPI tiles, Recharts area chart, quick actions, low-stock alert |
| 3 Sales | Virtualized invoice table, create (barcode + keyboard), detail, A4 + ESC/POS printing |
| 4 Inventory | Product table, stock filters, USB scanner, Excel/CSV import + export |
| 5 CRM | Customer table, balance filters, ledger detail |
| 6 Accounting | Transactions, trial balance, profit/loss, balance sheet, export |
| 7 Offline | SQLite (7 tables + queue + cursors), bidirectional sync, conflict handling, sync centre |
| 8 Release | Jest + RTL, Playwright Electron, electron-builder (NSIS/DMG/AppImage), CI matrix |

## Performance

Code-split per route: the largest page chunk is 792 KB (dashboard, carries Recharts);
`spreadsheet` (839 KB, SheetJS) and `realtime` (713 KB, supabase-js) load only when used.
Tables are virtualized with `@tanstack/react-virtual` — 40px rows, only visible rows mounted.

## Risks

1. **better-sqlite3 is native and optional.** It does not compile on machines without build tools
   (this dev box included), so it sits in `optionalDependencies` and `database.ts` degrades to
   online-only when the binding is missing. CI runs `rebuild:native` per OS before packaging.
2. **Code signing.** Windows/macOS releases need certificates in repository secrets;
   `CSC_IDENTITY_AUTO_DISCOVERY: false` produces unsigned builds until then.
3. **`--legacy-peer-deps` required** — root pins react 19 while RN 0.74 peers 18.
4. **ESC/POS text encoding.** Persian/Dari receipts assume a printer with a UTF-8 or Arabic
   codepage; older thermal units may need an image-rendered fallback.
5. **Playwright E2E is not run in CI yet** — it needs a display server (`xvfb`) on Linux runners.
