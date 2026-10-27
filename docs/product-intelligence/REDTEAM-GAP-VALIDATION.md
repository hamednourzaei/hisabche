# HISABCHE — RED-TEAM GAP VALIDATION (GAP-01 TO GAP-10)

**Auditor:** Independent Red-Team Lead Product Intelligence Architect  
**Evaluation Date:** 2026-10-27

Every gap proposed in the previous analysis (`FINAL-COMPETITIVE-GAP-REPORT.md`) has been systematically tested against the repository source code and actual target-customer requirements.

---

## GAP-01: Cheque / Promissory Note (چک و سفته) Lifecycle Engine

### Previous claim

"Over 70% of B2B transactions in Iran and Afghanistan rely on post-dated cheques... Hisabche currently models payments directly via cash/bank allocations and lacks a cheque lifecycle."

### Code reality

- Searched: `backend/src/routes`, `backend/src/services/accounting`, `packages/local-engine`, `packages/db-schema`.
- Result: No tables for `cheques` or `promissory_notes`, and no treasury status transitions exist.

### Is this a gap?

`TRUE_GAP`

### Classification & Verdict

`NEEDS_CUSTOMER_VALIDATION` (Do not design a schema yet).

### Mandatory Customer Validation Questions

Before drafting any table schema or writing code, interview 10 target wholesale distributors in Herat, Kabul, and Tehran with these precise questions:

1. **Scope of tracking:** Do you only need a digital register (cheque number, bank name, drawer, due date, amount, basic status: خزانه / در جریان وصول / وصول شده / برگشتی)?
2. **Regulatory integration:** Is automated Central Bank Sayad API verification an absolute blocker, or do your clerks verify Sayad manually on their phones and record the ID?
3. **Endorsement:** Do you endorse and transfer cheques to third-party suppliers (ظهرنویسی و خرج چک), requiring tracking of the chain of endorsers?
4. **Accounting depth:** Must status changes post automatic dual-entry journal vouchers to intermediary accounts (اسناد دریافتنی در جریان وصول), or is a simple payment record sufficient?

---

## GAP-02: Offline Recipe BOM / Light Production in Local Engine

### Previous claim

"Small bakeries, confectioneries, and workshops using offline POS cannot decrement ingredient stocks offline... backend has `manufacturing.service.ts`, but local engine lacks routes."

### Code reality

- `packages/local-engine/src/**` has zero routes for manufacturing or BOM.
- `packages/validation/src/schemas/offline-endpoint-matrix.ts` explicitly marks `/boms`, `/manufacturing/*`, and `/work-orders` as `online_required`.

### Is this a gap?

`TRUE_GAP` (Local Engine Parity Gap)

### Classification & Verdict

`P1_GATED` — Status: `GATED_BY_SYNC_INTEGRITY` (Plan prepared in Part C; implementation gated until Phase 0 sync integrity suite passes on real database).

---

## GAP-03: Multi-Device Sync Conflict Resolution Scenario Suite

### Previous claim

"Two offline registers selling the same last inventory item concurrently can cause phantom negative inventory. Live multi-device conflict resolution is unverified."

### Code reality

- `backend/src/services/sync.service.ts` had an application-side version check that did not include `AND version = expectedVersion` in the SQL `UPDATE` statement WHERE clause.
- Atomic concurrency update check fixed in `sync.service.ts:593-612`.
- Real multi-device concurrent conflict test suite (Scenarios A–H) built in `backend/src/__tests__/sync-scenarios.pg.test.ts` and client suites in `packages/app-shell` and `apps/mobile`.

### Is this a gap?

`TRUE_GAP` (P0 Pre-Launch Gate Blocker)

### Classification & Verdict

`BUILD_NOW` — Implemented in Phase 0 as the mandatory launch gate.

---

## GAP-04: Automated Bank Reconciliation & Statement Import (OFX/CSV)

### Previous claim

"Manual matching of journal entries against bank statements is tedious and error-prone... Hisabche currently requires manual payment matching."
"CSV bank-statement upload container must still be connected (backlog item 4, P2)."

### Code reality

- **Direct Refutation:** `backend/src/services/banking/reconciliation.domain.ts` (326 lines) contains the full candidate suggestion engine with confidence scoring and idempotency locks.
- **UI Container Exists:** `packages/ui/src/components/ui/bank/import-statement-panel.tsx` (247 lines) already exists and is actively rendered in `packages/ui/src/components/ui/bank/bank-view.tsx:249` (container `bank/containers/bank-container.tsx`).

### Is this a gap?

`FALSE_GAP` / `ALREADY_IMPLEMENTED`

### Classification & Verdict

`ALREADY_IMPLEMENTED`. Removed from backlog as a gap.

---

## GAP-05: Customer Portal & Digital Invoicing Links

### Previous claim

"Merchants must manually print or email PDFs rather than sending a self-service payment/statement link... UI experience is currently limited."

### Code reality

- **Direct Refutation:** `packages/ui/src/components/ui/customers/containers/public-portal-container.tsx` (197 lines) exists and is wired in `apps/web/app/[lang]/portal/[token]/page.tsx:41` and `packages/app-shell/src/features/public/public-portal-page.tsx:15`.

### Is this a gap?

`FALSE_GAP` / `ALREADY_IMPLEMENTED`

### Classification & Verdict

`ALREADY_IMPLEMENTED`. Removed from backlog.

---

## GAP-06: Custom Fields & Dynamic Document Metadata

### Previous claim

"Businesses have unique data points not covered by static schemas... Hisabche schemas are strictly static."

### Code reality

- **Direct Refutation:** `backend/src/routes/custom-fields.routes.ts` (152 lines) and `backend/src/services/extensions/custom-fields.service.ts` (341 lines) implement custom fields on customers, suppliers, and products with formula parsing, active toggles, and strict validation.

### Is this a gap?

`FALSE_GAP` / `ALREADY_IMPLEMENTED`

### Classification & Verdict

`ALREADY_IMPLEMENTED`. Removed from backlog.

---

## GAP-07: Offline Receipt Printing & Hardware Peripheral Drivers

### Previous claim

"Desktop and Android POS terminals need direct ESC/POS thermal printing and cash-drawer kicking without browser print dialogs... needs verification."

### Code reality

- Code exists: `apps/desktop/electron/main/services/printing.ts` (152 lines) sends raw ESC/POS jobs to the OS spooler; bytes are pre-encoded by the renderer (header lines 5–6).
- However, no physical printer run has ever been executed in this environment.

### Is this a gap?

`EXISTS_UNVERIFIED`

### Classification & Verdict

`NEEDS_PHYSICAL_VERIFICATION` (Operational P1 check before store rollout).

---

## GAP-08: Payroll Tax & Social Security Calculation (Regional Formats)

### Previous claim

"Mid-sized businesses require diskette exports for social security (بیمه تامین اجتماعی) and salary withholding tax... Hisabche HR is currently limited to gross salaries."

### Code reality & Strategy

- `backend/src/__tests__/payroll-ledger.test.ts` tests gross salary posting to the general ledger.
- Target SMB retailers in Afghanistan/Iran outsource payroll tax filing to external accounting bureaus.
- Rejecting complex in-house diskette generation is an owner product strategy decision.

### Classification & Verdict

`OWNER_STRATEGY_OPINION` — Defer / Partner. Clean CSV exports suffice.

---

## GAP-09: Multi-Branch Stock In-Transit Lifecycle

### Previous claim

"Inter-branch stock in-transit accounting is missing / Already exists with ship and receive."

### Code reality

- `backend/src/services/warehouse/transfer.service.ts` (294 lines) has **no** `ship` or `receive` methods (grep `async ship|async receive` returns null).
- It is registered as `WRITTEN_NOT_WIRED` in `backend/src/__tests__/unwired-capability.test.ts:435-439` ("No route imports it; transfers run through the SQL function warehouse_transfer_stock_keyed").
- No two-stage in-transit transfer state is reachable.

### Is this a gap?

`REAL_GAP_NEEDS_VALIDATION` (Two-step transfer with in-transit state does not exist as a reachable feature. Do not implement now; add to `OWNER-DECISIONS.md`).

---

## GAP-10: Automated Scheduled Reports & PDF Dispatch

### Previous claim

"Scheduled reports exist and are fully implemented in backend/src/services/reporting/scheduled-reports.service.ts."

### Code reality

- `backend/src/services/reporting/scheduled-reports.service.ts` (65 lines) is registered `WRITTEN_NOT_WIRED` in `backend/src/__tests__/unwired-capability.test.ts:476-481` ("NOTHING_REACHES_IT").
- No route, worker, or scheduler imports or calls this service. It is dead code.

### Is this a gap?

`REAL_GAP_DEAD_CODE`

### Classification & Verdict

`NEEDS_OWNER_DECISION`: Add to `OWNER-DECISIONS.md`: wire it into an existing reporting hub/route or delete it per rule §14 ("no dead code").

---

## Summary of the 10-Gap Triage

| Gap ID     | Title                                  | Verified Code Reality                                   | Final Status                              |
| :--------- | :------------------------------------- | :------------------------------------------------------ | :---------------------------------------- |
| **GAP-01** | Cheque / Promissory Lifecycle          | Zero cheque tables/statuses                             | `NEEDS_CUSTOMER_VALIDATION`               |
| **GAP-02** | Offline BOM / Light Production         | Local engine lacks routes                               | `P1_GATED` (`GATED_BY_SYNC_INTEGRITY`)    |
| **GAP-03** | Multi-Device Sync Scenarios            | Concurrency weak point resolved; scenarios A–H built    | `IMPLEMENTED_NOT_LIVE_VERIFIED` (P0 Gate) |
| **GAP-04** | Bank Reconciliation & Statement Upload | Domain and UI panel already exist (`bank-view.tsx:249`) | `ALREADY_IMPLEMENTED`                     |
| **GAP-05** | Public Customer Portal                 | Container and routes exist and wired                    | `ALREADY_IMPLEMENTED`                     |
| **GAP-06** | Custom Fields & Dynamic Metadata       | Full service and routes exist                           | `ALREADY_IMPLEMENTED`                     |
| **GAP-07** | Thermal Printing & ESC/POS             | Desktop spooler code exists, no physical hardware run   | `NEEDS_PHYSICAL_VERIFICATION`             |
| **GAP-08** | Payroll Tax Diskette Export            | SMBs outsource filing; opinion-based rejection          | `OWNER_STRATEGY_OPINION`                  |
| **GAP-09** | Stock In-Transit Lifecycle             | Transfer service has no ship/receive; unwired           | `REAL_GAP_NEEDS_VALIDATION`               |
| **GAP-10** | Scheduled Report Delivery              | ScheduledReportsService is unwired dead code            | `NEEDS_OWNER_DECISION` (Wire or Delete)   |
