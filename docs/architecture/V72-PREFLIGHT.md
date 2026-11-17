# V72 Preflight Audit & Local Reconciliation

## 1. Git State & Working Tree Audit (§3.1)

- **HEAD Commit**: `98a2520ef755bc564e2870763f624d9b17a19596`
- **Current Branch**: `main`
- **Remote**: `https://github.com/hamednourzaei/hisabche.git` (fetch & push)
- **Working Tree State**: DIRTY (Protected local modifications preserved intact)
- **Baseline Comparison**:
  - `98a2520`: Clean upstream commit.
  - `881ae1c`: Prior commit cited in dirty sellability evidence.
  - Working tree contains previous modifications from V68, V69, V70, V71 sessions (all preserved under Rule 0 and §3.4).

## 2. Protected Files Inventory (§3.4)

The following directories and files are actively modified in the working tree and MUST NOT be reverted or overwritten:

- `backend/src/routes/repair.routes.ts`, `backend/src/services/repair/repair-ticket.service.ts`
- `backend/src/__tests__/v59-1-repair-routes-http.test.ts`, `backend/src/__tests__/repair-quality-01.pg.test.ts`
- `docs/MIGRATIONS-PENDING.md`, `docs/repair-quality-01-migration.sql`, `docs/VERIFY-repair-quality-01.sql`
- `packages/api/src/hooks/business-packs.ts`, `packages/api/src/hooks/payments.ts`
- `packages/local-engine/src/routes/payments.ts`, `packages/app-shell/src/features/sync/sync-engine.ts`
- `packages/validation/src/schemas/industry-profiles.ts`, `packages/validation/src/schemas/offline-endpoint-matrix.ts`, `packages/validation/src/schemas/repair-tickets.ts`
- `docs/industries/**` (All 67 industry directories and matrices)

## 3. Seed Leads Verification (§10 & §3.5)

- **L1 [CONFIRMED]**: 0 of 67 industries have recorded PostgreSQL or browser evidence (`sellable-industries.json`: `sellable: 0`, `postgresEvidence: 0`, `browserEvidence: 0`).
- **L2 [CONFIRMED]**: `scripts/industry/coverage-data.mjs` maps many trades to shared suites (`INDUSTRY_ACCEPTANCE_TESTS`). Separation of shared core vs industry-specific acceptance required in Wave 0.
- **L3 [CONFIRMED]**: Appointment endpoints are `online_required` in `offline-endpoint-matrix.ts`. DB exclusion constraints exist in docs migrations pending live human application.
- **L4 [CONFIRMED]**: `packages/local-engine/src/routes/repair-tickets.ts` is absent on disk. Local repair transition rules exist in `repair-transitions.ts`.
- **L5 [CONFIRMED]**: `backend/src/services/manufacturing.service.ts` posts completion via `ledger.postDocument` (line verified), but has no during-production WIP ledger posting. Policy D1 defaults to keeping completion posting as-is without manual WIP journal.
- **L6 [CONFIRMED]**: Exactly 5 capabilities are `status: 'planned'`: `table_service`, `asset_rental`, `livestock_register`, `crop_cycle`, `room_nights`.
- **L7 [CONFIRMED]**: 30 partial capabilities verified in `business-capabilities.ts` with explicit limitation codes.
- **L8 [CONFIRMED]**: Fleet/trip domain helpers exist; per-vehicle fuel/repair cost wiring and fleet offline need explicit composition.
- **L9 [CONFIRMED]**: Regulated domains (health, KYC, food safety) are structural DNA axes without separate permission gating. Default D4 mandates explicit permission gating and denial by default.
- **L10 [CONFIRMED]**: `POST /api/appointments` in `backend/src/routes/appointment.routes.ts` casts body without a schema (`as { customerId ... }`).
- **L11 [CONFIRMED]**: Commercial paths (trial, billing, license, backup/restore) require systematic audit and test coverage in Wave 10.

## 4. Readiness-Gate Baseline per Family (G1-G5 Baseline)

All 13 families (`retail`, `wholesale`, `food_hospitality`, `personal_services`, `repairs`, `education`, `health`, `manufacturing`, `construction`, `transport`, `finance_trading`, `tourism_lodging`, `professional_office`) currently hold:

- **G1 (Product)**: PARTIAL (Core workflows exist; edge trade capabilities partially planned).
- **G2 (Evidence)**: NOT_LIVE_VERIFIED (0/67 sellable due to unrecorded live PostgreSQL / browser journeys on clean commit).
- **G3 (Operations)**: PARTIAL (Runbooks need formal completion in V72-OWNER-RUNBOOK.md).
- **G4 (Commercial)**: PARTIAL (Feature entitlements exist, need plan gating tests).
- **G5 (Policy)**: PARTIAL (Regulated domains default to limitation warnings per D4).
  Overall starting baseline status: `IMPLEMENTED_NOT_LIVE_VERIFIED` / `PARTIALLY_IMPLEMENTED`.
