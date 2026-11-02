# 19 — CROSS-PLATFORM VERIFICATION SPECIFICATION

**Document Version**: 1.0.0  
**Status**: APPROVED SPECIFICATION  
**Location**: `docs/architecture/universal-business-core/19-PLATFORM-VERIFICATION.md`

---

## 1. Platform Compatibility Matrix

| Platform            | Runtime Environment             | Shared UI Host               | Local DB Adapter                | Verification Method                | Live Verification Status                                |
| :------------------ | :------------------------------ | :--------------------------- | :------------------------------ | :--------------------------------- | :------------------------------------------------------ |
| **Web Client**      | Next.js 15 (Node / Browser)     | `packages/ui`                | Server Direct / In-Memory Cache | Playwright E2E + Unit Tests        | `VERIFIED_COMPLETE` (in test harnesses)                 |
| **Windows Desktop** | Electron 31 (Windows x64)       | `packages/ui` via App Shell  | `better-sqlite3` native         | Jest Suites + NSIS Installer Hooks | `VERIFIED_COMPLETE` (installer & tests verified)        |
| **Android Mobile**  | Expo SDK 51 / React Native 0.74 | `packages/ui` inside WebView | Native SQLite Bridge            | Expo Jest Suites + ADB Bridge      | `NOT_LIVE_VERIFIED` (Requires physical device emulator) |

---

## 2. Shared UI Constraint Protocols

1. **Zero Financial Logic in UI**:
   The UI components in `packages/ui` only render forms, tables, and status pills. All totals, taxes, and discounts are computed by importing pure functions from `@hisabche/validation`.
2. **RTL & Logical CSS Discipline**:
   All components must use logical CSS properties (`ms-`, `me-`, `ps-`, `pe-`, `text-start`, `text-end`). Hardcoded `left` or `right` styles are prohibited.
3. **Locale Completeness**:
   Every user-facing label must exist across all three active locales: `fa` (Farsi), `af` (Dari), and `en` (English).
