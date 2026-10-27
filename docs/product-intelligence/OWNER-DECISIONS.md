# HISABCHE — OWNER DECISIONS & GOVERNANCE

**Lead Product Intelligence Architect — Strategic Governance for Product Owner**  
**Evaluation Date:** 2026-10-27

The following architectural and commercial decisions must be formally decided by the founder before commercial release:

---

### Decision 1: Cheque / Promissory Note (چک و سفته) Customer Validation Scope (`GAP-01`)

- **Context:** Promissory paper instruments are prevalent in regional B2B wholesale trade, but require customer cohort validation before drafting schema or code.
- **Validation Question List for Merchant Interviews (10 wholesale distributors in Herat, Kabul, Tehran):**
  1. _Register Only vs Full Lifecycle:_ Do you only need a basic ledger (cheque number, bank name, drawer, due date, amount, basic status: خزانه / در جریان وصول / وصول شده / برگشتی)?
  2. _Sayad Regulatory Integration:_ Is official Central Bank Sayad API connection mandatory, or do clerks verify Sayad on their phones and merely record the ID in Hisabche?
  3. _Endorsement Tracking:_ Do you endorse cheques to suppliers (ظهرنویسی و خرج چک), requiring tracking of third-party endorsers?
  4. _Accounting Depth:_ Must status transitions post dual-entry journal vouchers to interim accounts (اسناد دریافتنی در جریان وصول), or does cash/bank allocation upon clearance suffice?
- **Owner Action:** Authorize structured customer interviews based on the 4 questions above before building schema.

---

### Decision 2: Warehouse Transfer Service — Wire or Delete? (`GAP-09`)

- **Context:** `backend/src/services/warehouse/transfer.service.ts` (294 lines) has no `ship` or `receive` methods and is registered `WRITTEN_NOT_WIRED` in `backend/src/__tests__/unwired-capability.test.ts:435-439`. Transfers currently execute through the Postgres function `warehouse_transfer_stock_keyed`.
- **Options:**
  1. _Option A (Wire):_ Expose transfer service via existing warehouse routes (extend existing hub, never a new route per CLAUDE.md §0.6) and implement two-stage in-transit tracking.
  2. _Option B (Delete):_ Delete `transfer.service.ts` to satisfy rule §14 ("no dead code in codebase").
- **Owner Action:** Decide whether two-stage in-transit transfer is a launch requirement (Wire) or dead code to purge (Delete).

---

### Decision 3: Scheduled Reports Service — Wire or Delete? (`GAP-10`)

- **Context:** `backend/src/services/reporting/scheduled-reports.service.ts` (65 lines) is registered `WRITTEN_NOT_WIRED` in `backend/src/__tests__/unwired-capability.test.ts:476-481` ("NOTHING_REACHES_IT"). No route, job, or worker invokes it.
- **Options:**
  1. _Option A (Wire):_ Wire scheduled report dispatch into an existing reporting route/cron worker.
  2. _Option B (Delete):_ Delete `scheduled-reports.service.ts` per rule §14.
- **Owner Action:** Choose to wire into existing reports hub or delete.

---

### Decision 4: Offline BOM Execution — Go / No-Go After Part B (`GAP-02`)

- **Context:** `docs/product-intelligence/OFFLINE-BOM-PLAN.md` specifies the minimal finished-product-to-component stock decrement engine in `packages/local-engine`.
- **Policy:** Gated by Phase 0 sync integrity suite passing on a real database (`GATED_BY_SYNC_INTEGRITY`).
- **Owner Action:** Confirm Go / No-Go for Offline BOM implementation once Part B is live-verified on Linux.

---

### Decision 5: Accounting Integrity — Tax-Return vs Ledger Tie-Out (N-37)

- **Context:** N-37 in `docs/audit/UNIVERSAL-CORE-GAP-LEDGER.md` remains `NOT_IMPLEMENTED` awaiting founder accounting policy guidance on how tax return filings tie out to general ledger tax liability accounts.
- **Owner Action:** Define standard closing journal voucher entry for tax return filings.
