# HISABCHE — RED-TEAM EXECUTIVE DECISION

**Lead Product Intelligence Architect — Final Founder-Level Assessment**  
**Evaluation Date:** 2026-10-27  
**Target Market:** SMB Retail, Wholesale, and Services (Persian/Dari, Dual-Calendar, Offline-First)

> **Notice:** This document does not replace `docs/audit/UNIVERSAL-CORE-AUDIT-FINAL.md` (decision: NO — DO NOT FREEZE) or its open items.

---

## A. What is Definitely True About Hisabche? (Evidence-Backed)

1. **Uncompromising Financial Rigor:** Hisabche avoids floating-point rounding errors by enforcing integer minor units across all money paths (`packages/validation/src/schemas/costing.domain.ts`). It guarantees accounting balance through atomic Postgres RPCs (`ledger.postDocument`) and explicit costing domains (FIFO/AVCO) that strictly ban heuristic fallback pricing.
2. **Real Multi-Platform Offline Engine:** Hisabche has an authentic, functioning 56-table local SQLite database (`packages/app-bridge/src/local-schema.ts:1-1123`) and an in-process REST-compatible router (`packages/local-engine`) sharing one universal React UI across Web (Next.js), Windows Desktop (Electron), and Android (Expo).
3. **Flawless Regional Localization:** Native Dari (`af`), Persian (`fa`), and English (`en`) support with key parity across `packages/i18n/messages/{fa,af,en}/common.json`, Solar Hijri / Gregorian dual calendars, and native multi-currency trading without forced artificial conversions.

---

## B. What Was Wrong or Overstated in the Previous Analysis?

1. **Misclassified Gaps & Incomplete Tracing:**
   - Bank statement CSV upload was claimed missing, but `packages/ui/src/components/ui/bank/import-statement-panel.tsx` (247 lines) already exists and is rendered in `bank/bank-view.tsx:249`.
   - ESC/POS thermal printing exists in `apps/desktop/electron/main/services/printing.ts`, but was claimed completely verified without physical hardware testing (`NEEDS_PHYSICAL_VERIFICATION`).
   - Warehouse transfer service (`transfer.service.ts`) was falsely claimed to have a working ship/receive lifecycle; it has no such methods and is registered `WRITTEN_NOT_WIRED` in `unwired-capability.test.ts:435-439`.
   - Scheduled reports service (`scheduled-reports.service.ts`) was claimed implemented, but is registered `WRITTEN_NOT_WIRED` (`unwired-capability.test.ts:476-481`) with zero callers.
2. **Unsupported Market Statistics:** Claims like _"over 70% of B2B transactions rely on cheques"_ were presented as hard statistics without citations.
3. **Unsubstantiated Competitive Superiority:** Replaced broad assertions of "unquestionable superiority" with precise operational facts. Hisabche has a potentially differentiating advantage in offline-first, Persian/Dari and multi-device operation; a decisive market advantage still requires hands-on proof, customers and benchmarks.
4. **Test Counts:** Replaced vague "over 600 tests" with measured totals: `backend` unit alone has 319 test files and 4,651 passing tests (`cd backend && npx vitest run --project unit`).

---

## C. Product Opportunities & Classification

1. **P0 Data Integrity Gate (Part B):** Multi-Device Concurrent Offline Sync Scenarios A–H (`GAP-03`) — _Implemented & verified in client suites; PG suite prepared for Linux CI._
2. **P1 Local Engine Parity (Part C):** Offline Recipe BOM in SQLite (`GAP-02`) — _GATED by Phase 0 sync integrity (`GATED_BY_SYNC_INTEGRITY`)._
3. **P1 Regional Expansion (Validate First):** Cheque & Promissory Note Treasury Extension (`GAP-01`) — _Status: `NEEDS_CUSTOMER_VALIDATION` before schema design._
4. **P2 Dead-Code Decisions:** Wire-or-delete decisions for `transfer.service.ts` and `scheduled-reports.service.ts` (`NEEDS_OWNER_DECISION`).

---

## D. Explicit Rejections & Strategy Decisions (`OWNER_STRATEGY_OPINION`)

The following recommendations reflect owner product strategy and operational prioritization, rather than system defects:

- **Enterprise MRP II / Process Manufacturing:** Reject; excessive complexity for small trade and light artisanal assembly.
- **Drag-and-Drop Visual Workflow Canvas:** Reject; high maintenance burden for a solo founder.
- **Third-Party App Store / Marketplace:** Defer until >2,000 active paying workspaces exist.
- **In-House Social Security Tax Diskette Generator:** Defer; target SMBs in Afghanistan and Iran outsource tax filing to external accounting bureaus. Clean CSV export satisfies this workflow.

---

## E. Pre-Launch Gate Verdict: `REQUIRES_REMEDIATION`

Hisabche is currently **NOT READY for unconstrained commercial release**. Release is gated by two strict tiers:

### Tier 1: P0 Launch Blockers (Must all be resolved and verified)

1. **Sync Integrity & Concurrency (Part B):**
   - Application-side race condition in `sync.service.ts:593-612` resolved with atomic `.eq('version', expectedVersion)` WHERE check.
   - Client scenario suite passing in `packages/app-shell` (Jest) and `apps/mobile` (Jest).
   - Postgres scenario suite `backend/src/__tests__/sync-scenarios.pg.test.ts` (Scenarios A–H) written and awaiting Linux CI run (`BLOCKED_EXTERNAL` on Windows).
2. **Tenant Isolation & Authorization:**
   - Open items in `docs/audit/UNIVERSAL-CORE-AUDIT-FINAL.md` §2–3.
   - Two-token cross-workspace negative HTTP injection tests.
3. **Accounting Integrity:**
   - N-37 owner decision (tax-return vs ledger tie-out) currently `NOT_IMPLEMENTED` awaiting founder decision.
4. **Inventory & Costing Integrity:**
   - AVCO/FIFO consumption locking verified without un-audited fallback pricing.
5. **Database Migrations & Verification:**
   - Pending migrations applied and verified in exact order by owner:
     1. `docs/universal-core-migration.sql`
     2. `docs/invoice-return-01-migration.sql`
     3. `docs/sync-commit-horizon-migration.sql`
   - Run the 81 `*.pg.test.ts` suites on Linux.
6. **Disaster Recovery & Credentials:**
   - Cold backup and actual database restore drill verified.
   - Production secrets and database password rotation.

### Tier 2: P1 Operational Checks (Required before general retail rollout)

1. **Physical Thermal Printer Verification:**
   - Run `apps/desktop/electron/main/services/printing.ts` against physical ESC/POS hardware (`NEEDS_PHYSICAL_VERIFICATION`).
2. **Offline BOM Execution:**
   - Execute the offline BOM plan (`docs/product-intelligence/OFFLINE-BOM-PLAN.md`) once P0 sync integrity is live verified.
3. **Operational UX & Rollback Monitoring:**
   - Live telemetry and error monitoring for sync outbox rejections.

### Tier 3: P2 Governance Decisions (`NEEDS_OWNER_DECISION`)

1. Decide whether to wire or delete `transfer.service.ts` (GAP-09).
2. Decide whether to wire or delete `scheduled-reports.service.ts` (GAP-10).
3. Validate cheque management questions with target merchants (GAP-01).

---

## F. Realistic Differentiating Positioning

**Modern, Dongle-Free, Multi-Device Offline-First Business Operating System for Persian/Dari Trade.**

- **Versus Legacy Desktop (Sepidar, Holoo):** Eliminates fragile physical USB hardware dongles, runs natively on Windows, Web, and Android with local SQLite, and enables real-time cloud sync when connected.
- **Versus Global Cloud SaaS (QuickBooks, Xero):** QuickBooks Online and Xero rely on continuous high-speed internet connectivity (as documented in Intuit and Xero system requirements) and lack native Solar Hijri calendars and Dari/Persian RTL language support. Hisabche provides uninterrupted offline POS checkout and multi-currency cash handling tailored to regional bazaar commerce.

---

## G. Strategic Kill Risks

1. **Sync Inconsistency:** Any silent inventory drift or lost transaction during offline sync will destroy word-of-mouth trust.
2. **Premature Enterprise Scope Creep:** Attempting enterprise MRP or workflow builders before mastering basic retail/wholesale checkout.
3. **Unverified Launch:** Releasing commercially before verifying the 81 `*.pg.test.ts` suites and completing the disaster recovery restore drill.
