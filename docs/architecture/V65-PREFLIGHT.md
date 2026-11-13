# V65 — Pre-flight (measured at this HEAD, not remembered)

`docs/architecture/V64-PROMPT.md` is the contract. This file implements nothing; it only
records what the repository was actually like before V65 touched it.

- **Branch** `main`
- **HEAD** `fa4fd32f9f75307015de1988dc8f4c927870f165` (`fixed ci 19`)
- **Measured** 13 Nov 2026
- **Working tree at start** only untracked scratch files (`?? .tmp-*.mjs`)

> ⚠️ No number below is copied from a V59–V63 report. Every line is the output of the command
> beside it, run against this HEAD. Where a previous report claimed something this file did not
> re-measure, it says so instead of repeating it.

---

## 1. Commands and their real output

| Command                                                     | Output                                                                                                              |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `git rev-parse HEAD`                                        | `fa4fd32f9f75307015de1988dc8f4c927870f165`                                                                          |
| `node scripts/capability/wiring-matrix.mjs`                 | `20 engines (available=1 not_verified=1 partial=15 unwired=3) · 38 capabilities (available=3 partial=30 planned=5)` |
| `node scripts/industry/generate-sellable.mjs --check`       | `OK: 67 registered · 37 profiled · 13 workflow-verified · 0 sellable`                                               |
| `node scripts/industry/generate-coverage-table.mjs --check` | `OK: 118 rows match the repository.`                                                                                |
| `npx vitest run` in `packages/validation` (before V65)      | `80` files · `1024` tests passed                                                                                    |
| `npx tsc --noEmit` in `packages/validation`                 | clean                                                                                                               |
| `npx tsc --noEmit` in `packages/ui`                         | clean                                                                                                               |

---

## 2. The registry, measured

### 2.1 Engines — 20 declared, wiring read from disk

| Wiring status  | Engines | Which                                                                                                                                                                                                                                                                                                   |
| -------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `available`    | 1       | `sales_invoice`                                                                                                                                                                                                                                                                                         |
| `partial`      | 15      | `sales_orders`, `appointments_resources`, `work_orders_repair`, `projects_time`, `production_bom`, `procurement`, `delivery_logistics`, `quality_claims`, `costing_ledger`, `forecast_insights`, `inventory_catalog`, `pricing_rates`, `deposits_installments`, `package_credits`, `approvals_workflow` |
| `unwired`      | 3       | `contracts_recurring`, `assets_rental`, `agriculture_livestock`                                                                                                                                                                                                                                         |
| `not_verified` | 1       | `workforce_payroll`                                                                                                                                                                                                                                                                                     |

`unwired` here means exactly what it says: **no backend route imports the engine's service and
the engine declares no local-engine route**. Measured: `contracts_recurring` and `assets_rental`
have a service file and a UI host but nothing that executes; `agriculture_livestock` has no
service, no UI host and no client hook at all.

### 2.2 Capabilities — 38 declared

| Status      | Count | Note                                                                                                 |
| ----------- | ----- | ---------------------------------------------------------------------------------------------------- |
| `available` | 3     | `measurement`, `weight_pricing`, `multi_unit` — all on `sales_invoice`, which is `available` offline |
| `partial`   | 30    | each carries ≥ 1 limitation code                                                                     |
| `planned`   | 5     | `table_service`, `asset_rental`, `livestock_register`, `crop_cycle`, `room_nights`                   |

25 distinct limitation codes, translated in `fa` / `af` / `en`.

### 2.3 Backend surface used by the matrix

| Measurement                                                                  | Value  |
| ---------------------------------------------------------------------------- | ------ |
| Files in `backend/src/routes`                                                | 125    |
| `server.register(...)` calls in `backend/src/index.ts`                       | 130    |
| Files in `packages/local-engine/src/routes`                                  | 49     |
| Exported hooks in `packages/api/src/hooks`                                   | 685    |
| Hooks with no consumer anywhere (measured by `scripts/api/unused-hooks.mjs`) | **53** |

---

## 3. Claims the code contradicts — found by reading the code, not by trust

### 3.1 `serialized_items` said serials cannot be recorded offline

The registry carried `limitations: ['OFFLINE_SERIAL_IDENTITY_MISSING']`, and
`packages/i18n/messages/en/common.json` told the customer
«Serial numbers cannot be recorded offline.»

Both are false, measured on this HEAD:

- `packages/validation/src/schemas/offline-endpoint-matrix.ts:238` —
  `'GET /operations/serials': ['inventory.serial_items', 'available']`
- `…:578` — `'POST /operations/serials': ['inventory.serial_items', 'available']`
- `…:580` — `'POST /operations/serials/issue': ['inventory.serial_items', 'available']`
- `packages/local-engine/src/routes/serials.ts:75,100,164` implements all three.

The two endpoints that really are online-only are the **hold** and the **return**:

- `…:376-378` — `inventory.serial_holds` → `online_required` (3 endpoints)
- `…:379` — `inventory.serial_returns` → `online_required`

V65 replaced the false code with `SERIAL_HOLDS_AND_RETURNS_ONLINE_ONLY` and removed the false
sentence from the three catalogues. This is the exact defect class V64 §4 phase 1 exists for.

### 3.2 The «profiled» column was a hand-written list

`scripts/industry/generate-coverage-table.mjs` derived the `profiled` column from a **hand-typed
array of 24 trade names** sitting beside the derivation. It named `hotel`, which is not a
registry key, and agreed with the code only by luck. V65 derives it from
`operational-dna.ts` + `industry-profiles.ts` and filters to `INDUSTRY_KEYS`.

Result after the change: **37 of 67** — the same number, now reproducible from source.

---

## 4. Gaps confirmed, and what V65 does with each

| Gap                                                                                                                           | Measured                                          | V65                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Multi-activity onboarding inferred DNA from the primary trade only                                                            | `inferOperationalDna({ tradeKey })`, one activity | **fixed** — `tradeKeys` union                                                                                                                                                           |
| First Value Checklist switched on `archetypeHint`, fell through to Retail                                                     | `first-value-checklist.tsx` archetype switch      | **fixed** — derived from DNA + active modules                                                                                                                                           |
| `locations` asked one question for two facts                                                                                  | `OperatingQuestion = … \| 'locations'`            | **fixed** — `branches` + `warehouses`, legacy read                                                                                                                                      |
| Serial offline claim false                                                                                                    | §3.1                                              | **fixed**                                                                                                                                                                               |
| Engine wiring was not recorded anywhere                                                                                       | —                                                 | **fixed** — `ENGINE-WIRING.csv`                                                                                                                                                         |
| Sellability was a sentence in a report                                                                                        | —                                                 | **fixed** — `sellable-industries.json`                                                                                                                                                  |
| 4-band business size (`solo / 2-5 / 6-20 / more`, in headcount)                                                               | persisted `StoreSize = small\|medium\|large`      | **NOT done** — code-only change, but mapping existing rows is an owner decision (`MIGRATIONS-PENDING.md` §6). Recorded as `D-01` in `OPEN-DECISIONS.md`, `Blocks: none`                 |
| 53 hooks with no consumer (V64 phase 0 named `useExchangeInvoice`, `useSalesOrder`, `useSerialHolds`, the project-task hooks) | 53 of 685                                         | **ledger delivered** — `UNUSED-HOOKS.csv`, every row `NEEDS_OWNER_DECISION`; wiring them blindly is what the owner ruled out. Recorded as `D-02` in `OPEN-DECISIONS.md`, `Blocks: none` |
| 0 industries sellable                                                                                                         | acceptance evidence recorded at `0b68fe4` ≠ HEAD  | **re-recorded at `fa4fd32`** (10 files / 54 tests) — still 0 sellable, because no mapped test is a Postgres test and no Playwright scenario ran                                         |

---

## 5. What could not be verified in this environment

| Gate                                                                      | State                    | Why                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Real Postgres (`*.pg.test.ts`, embedded-postgres)                         | **BLOCKED**              | `initdb.exe` is not present on this machine                                                                                                                                                                                    |
| Live Supabase                                                             | **BLOCKED**              | no credentials are read in this repository, by rule                                                                                                                                                                            |
| Browser E2E (Playwright)                                                  | **NOT RUN**              | `@playwright/test` is installed (`apps/web`, Chromium cached); the config targets `https://hisabche.com` with `channel: 'chrome'`, and no spec covers a family journey — the missing piece is the scenario, not the dependency |
| Owner product decisions (`D-01` business-size bands, `D-02` the 53 hooks) | **NEEDS_OWNER_DECISION** | recorded in `OPEN-DECISIONS.md`; both say `Blocks: none`, and the guard beside them asserts no script reads the file, so they gate no test                                                                                     |
| `next build`, Electron, Gradle                                            | **NOT RUN**              | forbidden by the task                                                                                                                                                                                                          |
| MCP `code_intel`                                                          | **NOT USED**             | the index (`.ai/codebase/graph.json`) is git-ignored and 73 MB; the wiring matrix reads the source directly so it works in a fresh clone                                                                                       |
