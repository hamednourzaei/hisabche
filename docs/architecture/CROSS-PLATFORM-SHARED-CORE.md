# HISABCHE CROSS-PLATFORM SHARED CORE ARCHITECTURE

**Date:** 2026-11-04  
**Scope:** Online Backend, Offline Local Engine, Web, Windows Desktop, Android Mobile

---

## 1. Shared Package Contract Inventory

| Package                     | Role                                 | Canonical Exports                                                                          | Platform Consumers         |
| :-------------------------- | :----------------------------------- | :----------------------------------------------------------------------------------------- | :------------------------- |
| **`packages/validation`**   | Pure Business Rules & Schemas        | `business-capabilities.ts`, `operational-dna.ts`, `costing.domain.ts`, `invoice.schema.ts` | All Platforms              |
| **`packages/api`**          | React Query Hooks & Client Transport | 89 endpoint hooks, query keys, cache invalidators, `offline-queue.ts`                      | Web, Desktop, Mobile       |
| **`packages/app-bridge`**   | SQLite Schema & Platform Bridge      | 56 local tables, migration runner, local query adapter                                     | Desktop, Mobile            |
| **`packages/local-engine`** | Offline REST-Compatible Router       | Routes for invoices, products, customers, till, tax, order deposits                        | Desktop, Mobile            |
| **`packages/sync`**         | Bi-directional Sync Protocol         | Outbox queue, commit horizon, push allow-list, delta pull registry                         | Desktop, Mobile, Backend   |
| **`packages/ui`**           | Reusable Component Hubs              | Data grids, KPI cards, PageHub, Modal dialogs, RTL tokens                                  | Web, Desktop, Mobile Shell |
| **`packages/formatting`**   | Currency, Digits, Calendar           | `formatMoney`, `useDateFormat` (Solar Hijri & Gregorian)                                   | All Platforms              |
| **`packages/i18n`**         | Trilingual Translations              | `messages/{fa,af,en}/common.json` (100% key parity)                                        | All Platforms              |

---

## 2. Platform Adaptation Layer (No Business Logic Duplication)

### 2.1 Online Backend (`backend/`)

- **Runtime:** Node.js + Fastify.
- **Persistence:** Supabase PostgreSQL 16 with Row-Level Security (RLS) on `workspace_id`.
- **Ledger Posting:** Atomic PostgreSQL functions (`ledger.postDocument`, `order_deposit_apply`).
- **Authorization:** `requireWorkspaceContext` + `requireCapability`.

### 2.2 Offline Local Engine (`packages/local-engine/`)

- **Runtime:** Headless HTTP-like router executing against embedded SQLite.
- **Transactions:** Local SQLite transactions (`BEGIN IMMEDIATE` / `COMMIT`).
- **Parity Rules:** Must reject any transaction that the server would reject.
- **Gap Identified in Audit:** Appointments currently exist only in backend (`backend/src/routes/appointment.routes.ts`) and must be ported to `packages/local-engine/src/routes/appointments.ts` to support offline appointment creation.

### 2.3 Windows Desktop (`apps/desktop/`)

- **Runtime:** Electron 29+.
- **Database:** `better-sqlite3` executing against local file in `%APPDATA%/Hisabche/`.
- **Peripherals:** Direct raw ESC/POS thermal printing via Windows spooler (`printing.ts`).

### 2.4 Android Mobile (`apps/mobile/`)

- **Runtime:** Expo SDK 51 / React Native 0.74 (strictly preserved, no architecture upgrade).
- **Database:** `expo-sqlite` storing local SQLite database.
- **Offline Sync:** `apps/mobile/src/features/offline/sync-runner.ts` draining the local outbox.

### 2.5 Web (`apps/web/`)

- **Runtime:** Next.js App Router.
- **Data Access:** Direct REST communication via `@hisabche/api` to Backend.
- **Storage:** Browser localStorage / IndexedDB for React Query client cache.
