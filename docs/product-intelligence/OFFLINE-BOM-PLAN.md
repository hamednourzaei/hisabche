# HISABCHE — OFFLINE RECIPE BOM & LIGHT PRODUCTION PLAN (GATED)

**Target Subsystem:** Local SQLite Engine & Offline Point-of-Sale  
**Status:** `GATED_BY_SYNC_INTEGRITY`  
**Gate Condition:** Mandatory Phase 0 sync integrity suite (`backend/src/__tests__/sync-scenarios.pg.test.ts`) must pass with 100% green assertions on a real Linux PostgreSQL database before this implementation begins.

---

## 1. Architectural Scope & Principles (Smallest Viable Slice)

### 1.1 Objective

Enable offline POS terminals (e.g. bakeries, confectioneries, cafes, custom assembly shops) to sell composite items while the local SQLite engine atomically decrements raw material component stocks and calculates unit production costs without requiring active cloud connectivity.

### 1.2 Absolute Core Invariant: One Cost Engine

- **No Second Arithmetic:** Do NOT create an offline-specific costing algorithm. Local production MUST import and reuse:
  - `computeProductionCost` from `packages/validation/src/schemas/manufacturing-cost.ts`
  - `productionMoneyContext` 4-digit fractional currency rounding (preserving fractions so small grams do not round to zero; BUG-094)
  - `version-on-use` BOM definition snapshots (a sale or production run stamps the exact revision of the recipe used, so later formula changes never retroactively re-cost historical runs)
- **Accounting Boundary Rule:**
  > `"production posts no ledger entry today (ONLINE_ONLY, CLAUDE.md)"`
  > In accordance with repository design, offline production generates inventory stock decrement/increment movements in SQLite; financial ledger journal entries remain strictly an online cloud posting capability.

### 1.3 What is Explicitly Excluded (Do Not Build)

- **NO Enterprise MRP II:** No automated master production schedules.
- **NO Capacity / Work Center Routing:** No machine runtime, queue time, or labor bottleneck modeling.
- **NO Material Demand Forecasting:** No predictive procurement orders.
- **NO Floor Optimization:** No multi-level shop floor scheduling.

---

## 2. Monorepo Integration Specifications

### 2.1 Database Schema Extensions (`packages/app-bridge`)

Add three lightweight tables in `packages/app-bridge/src/local-schema.ts` and define migration step `v10` in `packages/app-bridge/src/local-migrations.ts`:

1. `local_boms`:
   - `id TEXT PRIMARY KEY`
   - `workspace_id TEXT NOT NULL`
   - `product_id TEXT NOT NULL` (Finished good SKU)
   - `name TEXT NOT NULL`
   - `output_quantity REAL NOT NULL DEFAULT 1.0`
   - `labor_cost_minor INTEGER NOT NULL DEFAULT 0`
   - `other_cost_minor INTEGER NOT NULL DEFAULT 0`
   - `version INTEGER NOT NULL DEFAULT 1`
   - `created_at TEXT NOT NULL`, `updated_at TEXT NOT NULL`
2. `local_bom_components`:
   - `id TEXT PRIMARY KEY`
   - `bom_id TEXT NOT NULL REFERENCES local_boms(id) ON DELETE CASCADE`
   - `component_product_id TEXT NOT NULL` (Raw ingredient SKU)
   - `quantity REAL NOT NULL` (e.g. 0.25 kg)
   - `unit_of_measure TEXT`
   - `unit_cost_minor INTEGER NOT NULL DEFAULT 0`
3. `local_manufacturing_runs`:
   - `id TEXT PRIMARY KEY`
   - `workspace_id TEXT NOT NULL`
   - `bom_id TEXT NOT NULL`
   - `output_product_id TEXT NOT NULL`
   - `quantity_produced REAL NOT NULL`
   - `total_cost_minor INTEGER NOT NULL`
   - `run_date TEXT NOT NULL`
   - `status TEXT NOT NULL DEFAULT 'completed'`
   - `synced INTEGER NOT NULL DEFAULT 0`

### 2.2 Local Router Wiring (`packages/local-engine`)

Create `packages/local-engine/src/routes/manufacturing.ts`:

- `GET /api/boms`: List active recipe definitions for the active workspace.
- `GET /api/manufacturing/definitions/:productId`: Return active BOM and component items for a finished product.
- `PUT /api/manufacturing/definitions`: Save/update recipe definition using `ManufacturingService.saveDefinition` semantics.
- `POST /api/manufacturing/produce`:
  - Validates payload against `manufacturingProduceSchema`.
  - Atomically inside SQLite transaction:
    1. Reads component quantities from BOM.
    2. Decrements stock for each ingredient in `local_products`.
    3. Increments finished good stock in `local_products`.
    4. Computes total cost via `computeProductionCost`.
    5. Inserts audit record into `local_manufacturing_runs`.
    6. Enqueues stock movements into `local_stock_movements`.

### 2.3 Endpoint Matrix & Guard Updates

Flip the following rows in `packages/validation/src/schemas/offline-endpoint-matrix.ts` from `online_required` to `offline_available`:

- `GET /boms`: `['manufacturing.bom', 'offline_available']`
- `GET /manufacturing/definitions/:x`: `['manufacturing.definition', 'offline_available']`
- `PUT /manufacturing/definitions`: `['manufacturing.definition', 'offline_available']`
- `POST /manufacturing/produce`: `['manufacturing.produce', 'offline_available']`

Update matrix assertions in:

- `packages/validation/src/__tests__/offline-matrix-guard.test.ts`
- `packages/local-engine/src/__tests__/offline-matrix-consistency.test.ts`
- `docs/architecture/capability-matrix.csv`

---

## 3. Cloud Synchronization Model

### 3.1 Sync Pathway Analysis (From Code)

In the current monorepo:

1. `backend/src/routes/manufacturing.routes.ts` exposes `POST /api/manufacturing/produce`.
2. `packages/app-shell/src/features/sync/sync-engine.ts` routes domain entity outbox items via `pushDomain`.
3. When internet reconnects:
   - The client outbox sends the production run to `POST /api/manufacturing/produce` with an `Idempotency-Key` header.
   - The backend authoritative service processes the run, updates cloud inventory layers, and records the `sync_change_log` entry.
   - If offline edition only (standalone desktop without cloud subscription), the local SQLite decrements remain self-contained.

---

## 4. Verification Suite (To Be Written Upon Un-Gating)

1. **Local Migration Test (`migration-v10.test.ts`):**
   - Asserts v9 SQLite database cleanly upgrades to v10 adding `local_boms`, `local_bom_components`, and `local_manufacturing_runs` without data loss.
2. **Local Production Transaction Test (`local-manufacturing.test.ts`):**
   - Recipe: 1 Bread Loaf = 0.5 kg Flour + 0.01 kg Yeast.
   - Initial stock: Flour = 100 kg, Yeast = 5 kg, Bread = 0.
   - Action: `POST /api/manufacturing/produce` (Quantity = 10).
   - Assert: Flour = 95 kg, Yeast = 4.9 kg, Bread = 10 loaves.
   - Assert: Cost matches `computeProductionCost` exactly.
3. **Atomic Rollback on Insufficient Stock (if strict stock policy enabled):**
   - Verifies SQLite transaction rolls back completely if any ingredient deduction fails.
