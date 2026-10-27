# HISABCHE — IMPLEMENTATION ROADMAP (DEPENDENCY-AWARE)

**Lead Product Intelligence Architect Roadmap**
**Version:** 1.0 | **Date:** 2026-10-26

---

## Phase 0: Pre-Launch Hardening & Live Verification (Weeks 1–4)

_Goal: Ensure absolute data integrity, sync correctness, and zero crash loops before real money flows._

### Item 0.1: Multi-Device Sync & Conflict Stress Verification

- **Gap ID:** GAP-03 (`P0_SECURITY_OR_DATA_INTEGRITY`)
- **User Problem:** Two offline registers selling the same last inventory item concurrently.
- **Measurable Metric:** 100% deterministic conflict resolution with zero phantom negative balances and zero lost ledger entries.
- **Repository Points:** `packages/sync`, `packages/local-engine/src/__tests__/offline-sync.test.ts`, `backend/src/services/sync.service.ts`.
- **Acceptance Criteria:** Simulated 10-device outbox replay test passes with valid vector clocks and zero stranded rows.

### Item 0.2: Hardware Peripheral & ESC/POS Direct Thermal Printing

- **Gap ID:** GAP-07 (`P1_CORE_WORKFLOW`)
- **User Problem:** Store cashiers cannot afford browser print dialogues on every sale; cash drawer must kick automatically.
- **Measurable Metric:** Print execution time < 300ms from sale completion; drawer kick pulse sent reliably.
- **Repository Points:** `apps/desktop/electron/main/services/`, `packages/ui/src/components/ui/pos/`.
- **Acceptance Criteria:** Direct ESC/POS byte-stream printing on 80mm and 58mm thermal printers over USB and LAN.

---

## Phase 1: Regional Commercial Essential Workflows (Weeks 5–10)

_Goal: Displace legacy desktop ERPs (Holoo/Sepidar) by supporting real-world commercial trading instruments._

### Item 1.1: Cheque & Promissory Note (چک و سفته) Lifecycle Engine

- **Gap ID:** GAP-01 (`P1_CORE_WORKFLOW`)
- **User Problem:** Merchant receives 3-month post-dated customer cheques; needs status transitions (خزانه، در جریان وصول، وصول شده، خرج شده، برگشتی).
- **Measurable Metric:** Complete ledger posting on each cheque status transition with exact party balance updates.
- **Repository Points:** `backend/src/services/accounting/`, `packages/local-engine/src/routes/accounting.ts`, `packages/ui/src/components/ui/treasury/`.
- **Acceptance Criteria:** Cheque registration -> bank collection -> ledger posting with full reversal support.

### Item 1.2: Offline Recipe BOM / Light Production Execution

- **Gap ID:** GAP-02 (`P2_CUSTOMER_VALUE`)
- **User Problem:** Confectionery / bakery POS selling finished goods cannot deduct raw materials while offline.
- **Measurable Metric:** Atomic inventory deduction of ingredients upon finished item POS sale in `packages/local-engine`.
- **Repository Points:** `packages/local-engine/src/routes/`, `packages/validation/src/schemas/business-capabilities.ts`.
- **Acceptance Criteria:** Parity between local SQLite engine and backend Fastify recipe consumption service.

---

## Phase 2: Workflow Depth & Customer Retention (Weeks 11–18)

_Goal: Boost merchant efficiency and recurring daily active usage._

### Item 2.1: Bank Statement CSV / OFX Reconciler

- **Gap ID:** GAP-04 (`P1_CORE_WORKFLOW`)
- **User Problem:** Hours spent at month-end cross-checking bank records with ledger entries.
- **Measurable Metric:** >80% automated rule-matching rate for imported bank transactions.
- **Repository Points:** `backend/src/services/accounting/`, `packages/ui/src/components/ui/accounting/`.
- **Acceptance Criteria:** Rule-based matching on amount, description, and date range with single-click reconciliation.

### Item 2.2: Scheduled PDF Closing Reports & Messaging Dispatch

- **Gap ID:** GAP-10 (`P3_DIFFERENTIATION`)
- **User Problem:** Business owner absent from store wants end-of-day revenue, cash balance, and margin summary.
- **Measurable Metric:** Automated PDF dispatch triggered nightly with zero manual cashier intervention.
- **Repository Points:** `backend/src/services/reporting/scheduled-reports.service.ts`, `backend/src/routes/invoice-pdf.routes.ts`.
- **Acceptance Criteria:** Nightly cron generates signed PDF summary and delivers via SMS/Webhook.

---

## Phase 3: Differentiation & Category Expansion (Weeks 19–26)

_Goal: Expand beyond traditional retail into multi-branch trade and diaspora cross-border business._

### Item 3.1: Inter-Branch Stock In-Transit Accounting

- **Gap ID:** GAP-09 (`P2_CUSTOMER_VALUE`)
- **User Problem:** Goods shipped between provincial warehouses must not vanish or instantly appear before physical receipt.
- **Measurable Metric:** Exact dual-entry in-transit asset ledger balancing until receiving warehouse confirms inspection.
- **Repository Points:** `backend/src/services/warehouse/`, `packages/local-engine/src/routes/warehouse.ts`.
- **Acceptance Criteria:** Transfer order dispatch -> In-transit inventory staging -> Receiver confirmation -> Perpetual inventory update.

---

## Deferred or Rejected Items (Explicit Stop Criteria)

1. **Full-scale Process Manufacturing (MRP II with Work Centers & Machine Routing):** Reject for now; customer segment is SMB retail/trade, not automotive factories.
2. **Third-Party App Store & Marketplace:** Defer until Hisabche achieves >1,000 active paid business workspaces.
3. **Automated Visual Workflow Canvas (Drag-and-drop Zapier clone):** Reject; too high maintenance burden for solo founder; replace with high-value pre-built triggers.
