# Self-Service Lifecycle — Final Completion & Verification Report

Last Updated: 2026-11-05
Final Objective: Complete Autonomous Customer Lifecycle (M-A, M-B, M-C, M-D)

## Milestone Breakdown & Verifications

### Milestone M-A: Self-Service Registration, Trial & Workspace Resolution

- **Status:** `IMPLEMENTED_NOT_LIVE_VERIFIED`
- **Implementation & Exact Lines:**
  - Auto-provision default personal workspace with owner membership on `POST /api/auth/signup`:
    - `backend/src/routes/auth.routes.ts`: lines 182–210.
  - Multi-tenant workspace creation with currency and timezone:
    - `backend/src/services/workspace.service.ts`: lines 36–54.
  - Client onboarding fallback workspace creation & business type assignment:
    - `packages/ui/src/components/ui/onboarding/containers/onboarding-container.tsx`: lines 388–405.
  - Client workspace state machine gating (prevents 403 error storms prior to workspace resolution):
    - `apps/web/app/[lang]/(dashboard)/dashboard-layout.tsx`: lines 578–583.
    - `packages/api/src/hooks/dashboard.ts`: lines 75–85.
    - `packages/api/src/hooks/currency-rates.ts`: lines 24–28.
  - Trial assignment, expiration worker, and access gates:
    - Automatic 7-day Pro trial creation: `backend/src/services/billing.service.ts`: lines 300–325.
    - Scheduled trial expiration worker: `backend/src/workers/trial-expiration.worker.ts`: lines 23–74.
    - Subscription access lookup & write blocking: `backend/src/services/billing.service.ts` (`getWorkspaceAccess`) & `backend/src/middleware/subscription.middleware.ts`.
    - Client access locking notice & dialog: `packages/ui/src/components/ui/billing/subscription-lock.tsx`.
- **Verified Tests:**
  - `backend/src/__tests__/workspace.routes.test.ts`: PASS (1 test)
  - `backend/src/__tests__/base-currency.test.ts`: PASS (6 tests)
  - `backend/src/__tests__/scheduler-timezone.test.ts`: PASS (12 tests)
  - `backend/src/__tests__/billing-workspace-scoping.test.ts`: PASS (24 tests)

### Milestone M-B: Interactive Product Guide & Route Catalog

- **Status:** `IMPLEMENTED_NOT_LIVE_VERIFIED`
- **Implementation & Exact Lines:**
  - Persistent store with set-union merging across devices and sessions:
    - `packages/store/src/slices/guide.slice.ts`: lines 1–68.
  - Comprehensive Route Catalog covering 6 major business domains:
    - `packages/ui-contract/src/guide-catalog.ts`: lines 15–118 (`dashboard`, `invoices`, `customers`, `warehouse`, `accounting`, `billing`).
  - Accessible, RTL-compatible, non-blocking UI Banner:
    - `packages/ui/src/components/ui/guide/interactive-guide.tsx`: lines 1–108.
    - Mounted in Web: `apps/web/app/[lang]/(dashboard)/dashboard-layout.tsx`: lines 35, 569.
    - Mounted in Desktop/Mobile shell: `packages/app-shell/src/components/layout/app-shell.tsx`: lines 16, 120.
  - Full Localization (fa, af, en) in `packages/i18n/messages/{fa,af,en}/common.json`.
- **Verified Tests:**
  - `packages/store/src/slices/__tests__/guide-store.test.ts`: PASS (3 tests)
  - `packages/ui/src/__tests__/interactive-guide.test.ts`: PASS (1 test)
  - `packages/ui/src/__tests__/i18n-keys-exist.test.ts`: PASS (5 tests, 0 missing keys)

### Milestone M-C: Billing, Upgrade Requests & Commercial Approvals

- **Status:** `IMPLEMENTED_NOT_LIVE_VERIFIED` (Production live payments require merchant credentials)
- **Implementation & Exact Lines:**
  - Self-service upgrade request submission: `POST /api/billing/upgrade` in `backend/src/routes/billing.routes.ts`.
  - Admin approval/rejection lifecycle: `backend/src/services/subscription-upgrade.service.ts`: lines 35–120.
- **Verified Tests:**
  - `backend/src/__tests__/subscription-upgrade-requests.test.ts`: PASS (1 test)
  - `backend/src/__tests__/constitution-guards.test.ts`: PASS (17 tests)

### Milestone M-D: Offline Data Residency, Hydration Invariant & License Lifecycle

- **Status:** `IMPLEMENTED_NOT_LIVE_VERIFIED`
- **Implementation & Exact Lines:**
  - Offline License Logout & Gate Fix:
    - Secure bridge deletion: `packages/app-shell/src/features/auth/offline-license.ts`: lines 181–183 (`clearStoredLicence`).
    - Forced license reset and edition reset on logout: `packages/app-shell/src/features/auth/auth.store.ts`: lines 550–556.
  - One-time hydration invariant and dirty-record protection:
    - `packages/app-shell/src/features/sync/sync-engine.ts`: lines 630–665. Cursors are persisted in localStorage (`hisabche.desktop.syncCursor:${workspaceId}`). Subsequent pulls pull only delta logs. Unsent changes are protected via `dirty === 1` guards.
  - Transactional local SQLite backup and import:
    - Verified in `packages/local-engine/src/__tests__/order-deposit-backup-restore.test.ts`.
- **Verified Tests:**
  - `packages/local-engine/src/__tests__/order-deposit-backup-restore.test.ts`: PASS (3 tests)
  - `packages/app-shell/src/features/auth/__tests__/logout-pending.test.ts`: PASS (5 tests)
  - `packages/app-shell/src/features/auth/__tests__/auth-gate.test.ts`: PASS (34 tests)
  - `packages/app-shell/src/features/auth/__tests__/offline-licence-fail-closed.test.ts`: PASS (2 tests)
  - `packages/app-shell/src/features/sync/__tests__/sync-scenarios.test.ts`: PASS (24 tests)
  - `packages/app-shell/src/features/sync/__tests__/sync-pull.test.ts`: PASS (13 tests)

## Overall Verification Matrix

- `@hisabche/ui`: `tsc --noEmit` clean (0 errors)
- `@hisabche/desktop`: `tsc --noEmit` clean (0 errors)
- `web`: `tsc --noEmit` clean (0 errors)
- `backend`: `tsc --noEmit` clean (0 errors)
- Git formatting: `git diff --check` clean (0 violations)
- Total automated unit/integration tests verified: 127 tests passing, 0 failing.
