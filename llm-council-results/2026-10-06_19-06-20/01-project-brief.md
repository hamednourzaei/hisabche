# INTERNAL COUNCIL BRIEF: Hisabche

## Project Identity
Hisabche is a multi-client (Web, Desktop, Mobile Android) business management platform tailored for the Persian-speaking market (Iran/Afghanistan), including features for CRM, Inventory, Invoices, Manufacturing, Accounting, HR/Payroll, and Pos/Offline-first functionality.

## Current Architecture
- **Backend:** Fastify, Supabase (PostgreSQL), Drizzle ORM, Zod, Vitest. Relies heavily on Postgres RPCs, Views, and RLS for security and synchronization.
- **Frontend/Clients:** 
  - **Web:** Next.js 16 (App Router), React Query, Zustand.
  - **Desktop:** Electron + React Router wrapper.
  - **Mobile:** Expo / React Native.
- **Monorepo:** pnpm workspace with separated packages (`api`, `ui`, `ui-contract`, `store`, `formatting`, `validation`, `auth`, `sync`).
- **Sync/Offline:** Strong emphasis on offline-first operation, sync queues, idempotency, and outbox/event architectures.

## Main Product Areas
- Invoices & Sales
- Inventory & Stock Management
- Manufacturing
- Accounting (Bank, Cash, Till)
- HR, Payroll & Attendance
- CRM
- Dashboards & Reports
- Workspace/Tenant Isolation with Role-Based Access Control (RBAC).

## Implementation Stage
Actively in development but with many production-grade modules. Hundreds of migrations and verification SQL scripts exist. The repository enforces strict rules (e.g., no "fake completion", Postgres as source of truth, rigorous idempotent sync logic).

## Known Constraints
- Must function reliably in weak connectivity environments (offline-first).
- Must maintain data integrity and consistency across Web, Desktop, and Mobile.
- Strong reliance on Supabase/Postgres limits arbitrary mid-tier scaling but maximizes DB-level consistency.
- Deep Windows path constraints (`MAX_PATH`) requiring specific `virtualStoreDir` configurations.

## High-Risk Areas
- Offline sync conflicts and multi-device concurrency.
- Financial data integrity and idempotency.
- Feature parity across Web, Android, and Desktop.
- Complex migrations with legacy constraints (e.g., `virtualStoreDir` hacks).

## Evidence Sources Inspected
- `CLAUDE.md` and repository guidelines.
- Workspace definitions (`pnpm-workspace.yaml`, `apps/`, `packages/`).
- Extensive migration log (`docs/` containing numerous `VERIFY-*.sql` and `*-migration.sql` scripts).
