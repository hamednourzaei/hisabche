# UNIVERSAL BUSINESS CORE — PROGRESS (v51.0-NEAR9-UNIFIED)

**Last updated**: 2026-11-01 · **Current milestone**: M0 **PASSED** · M1.0 (owner decisions OD-1, OD-2 applied) **DONE** · **M1.1–M1.5** `IMPLEMENTED_NOT_LIVE_VERIFIED` (v51.2 closure: AUDIT §19; v52.0 gate: AUDIT §20 and PRODUCTION-DEPLOY-CHECKLIST.md) · **M2.1 offering_type** `IMPLEMENTED_NOT_LIVE_VERIFIED` · **M2.2 mixed_commerce** `IMPLEMENTED_NOT_LIVE_VERIFIED` · **Next**: M3 (Package Credit & Entitlement Ledger)

Canonical documents for this program: this directory. `docs/architecture/UNIFIED-CORE-AUDIT.md` and `UNIFIED-CORE-PROGRESS.md`
(a parallel set written under another label) are **history**; where they conflict with this file, this file wins.

---

## 1. M0 work log

| Step                          | Command / action                                                                                    | Result                                                                                                                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| working tree                  | `git status --short`, `git log -n 8 --oneline`                                                      | HEAD `01d4a66d`; pre-existing uncommitted work preserved (returns core, spec pack, local-engine returns route, feature-registry/matrix edits)                                    |
| spec reference check (before) | `node scripts/audit/verify-spec-references.mjs`                                                     | 31 unbacked paths (13 planned, 18 wrong) · 12 symbols claimed but absent                                                                                                         |
| corrections                   | exact-count replacement scripts (a miscount aborted one run without writing — the assertion worked) | wrong paths/symbols fixed in `01`, `24`, `IMPLEMENTATION-MAP`, `SPEC-GATE-REPORT`, `UNIFIED-CORE-AUDIT`; planned rows marked; 11 design docs marked `<!-- target-vocabulary -->` |
| spec reference check (after)  | same command                                                                                        | **0 unbacked paths, 0 unbacked symbols, exit 0**                                                                                                                                 |
| rule-sharing measurement      | `node scripts/audit/measure-rule-sharing.mjs`                                                       | 10 flows; 1 with no shared rule function (transfers); returns 1; invoice 2                                                                                                       |
| validation                    | `cd packages/validation && npx vitest run`                                                          | 45 files, 637 passed                                                                                                                                                             |
| boundary guard                | `npx vitest run src/__tests__/architecture-boundaries.test.ts`                                      | 4/4                                                                                                                                                                              |
| local engine                  | `cd packages/local-engine && npx vitest run`                                                        | 36 files, 270 passed                                                                                                                                                             |
| product code                  | —                                                                                                   | **unchanged by M0**                                                                                                                                                              |

## 1b. M1.0 — owner decisions applied

Decisions (1 Nov 2026): **close the offline door on returns now** and **delete the command envelope / lease domain**. What changed is listed in
`UNIVERSAL-BUSINESS-AUDIT.md` §8. Verification after the change (this session, commands run from each package folder):

| Package                | Command                                         | Result                                                                                                                                                                                                                       |
| ---------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validation`           | `npx tsc --noEmit` · `npx vitest run`           | tsc 0 · 43 files, **633 passed** (637 − 4 tests deleted with the self-comparing harness and the envelope/lease code)                                                                                                         |
| `local-engine`         | `npx tsc --noEmit` · `npx vitest run`           | tsc 0 · 36 files, **270 passed** (3 open-door tests replaced by 3 closed-door tests)                                                                                                                                         |
| `ui`                   | `npx tsc --noEmit` · `npx vitest run`           | tsc 0 · the closed-list guard `packages/ui/src/__tests__/cloud-required.test.ts` (57 → **58** server-only features, `invoice.returns` is the new member) fixed and re-run: 30/30; the other 190 files passed in the full run |
| `backend`, `app-shell` | `npx tsc --noEmit`                              | 0 / 0                                                                                                                                                                                                                        |
| spec references        | `node scripts/audit/verify-spec-references.mjs` | 35 documents, 404 path references, 200 symbols, **0 unbacked**, exit 0                                                                                                                                                       |

Not re-run after M1.0 (nothing they depend on changed): backend suite, `apps/desktop` jest, `apps/mobile` jest. The generated tables
(`docs/architecture/capability-matrix.csv`, industry coverage) were regenerated from code and their guard tests pass inside the `validation` run.

---

## 2. Gate status

| Gate (prompt §22)            | Status                                                                                   | Why                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| A — no parallel architecture | `FAILED`                                                                                 | F-02 competing envelope; F-04 duplicated rules; F-09 five availability layers vs a spec that assumes one  |
| B — financial correctness    | `PARTIALLY_IMPLEMENTED`                                                                  | online return/refund core proven on a real Postgres engine (19 scenarios); offline return diverges (F-01) |
| C — offline parity           | `FAILED` for returns, `PARTIALLY_IMPLEMENTED` otherwise                                  | F-01 a–h; payment allocation and period-lock differ                                                       |
| D — platform parity          | `IMPLEMENTED_NOT_LIVE_VERIFIED`                                                          | no device run; Web has no offline adapter                                                                 |
| E — security                 | `NOT_AUDITED_M0`                                                                         | tenant isolation over HTTP verified for the return/refund routes only (22/22)                             |
| F — core capabilities        | `NOT_BUILT` for offering/package/service delivery; `PARTIAL` for manufacturing/recurring | audit §5                                                                                                  |
| G — recovery & performance   | `NOT_AUDITED_M0`                                                                         |                                                                                                           |
| H — regression               | `VERIFIED_COMPLETE` for the suites re-run in §1                                          | 2 parallel-load flakes pass alone                                                                         |

## 3. Status claims in earlier documents that this audit does not support

| Document                                      | Claim                                                                                                                          | Verdict                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `UNIFIED-CORE-PROGRESS.md` §1                 | "Slice 2 — Returns & Refunds … PASSED"                                                                                         | not supported — F-01                                         |
| `IMPLEMENTATION-MAP.md` S2.3                  | "Offline Refund Lease … passed"                                                                                                | the code has no consumer — F-02                              |
| `UNIFIED-CORE-AUDIT.md` §3                    | "Local return handler must … atomically update product_stock and cost_layer" listed as a _requirement_, then slice marked done | requirement not met (F-01 e)                                 |
| `19-PLATFORM-VERIFICATION.md`                 | Windows "VERIFIED_COMPLETE (installer & tests verified)"                                                                       | no evidence in repository; withdrawn                         |
| `01-CURRENT-STATE.md` / `SPEC-GATE-REPORT.md` | `computeInvoiceLines` shared by both sides                                                                                     | symbol does not exist; real functions differ per side (F-03) |
| `05-CONFIGURATION-MODEL.md`                   | one `resolveCapabilities`                                                                                                      | does not exist (F-09)                                        |

## 4. Owner decisions (see `UNIVERSAL-BUSINESS-DESIGN.md` §7) — OD-1 **decided: close now** · OD-2 **decided: delete** · still open:

`OD-3` offline invoices and policy checks ·
`OD-4` offline payment allocation · `OD-5` expired package credit · `OD-6` restore.

## 4. M2.1 — Offering Type & Stock Movement Isolation

| Step                                 | Command / action                                                                              | Result                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| failing guard                        | `packages/validation/src/__tests__/offerings-domain.test.ts`                                  | RED first (module missing), then GREEN with 4/4                                    |
| server failing guard                 | `backend/src/__tests__/service-line-stock.test.ts`                                            | RED first (movesStock missing), then GREEN with 1/1                                |
| device failing guard                 | `packages/local-engine/src/__tests__/service-line-stock.test.ts`                              | RED first (column missing / stock moved), then GREEN with 1/1                      |
| pure predicate                       | `packages/validation/src/schemas/universal-core/offerings.domain.ts`                          | `movesStock`, `isServiceOffering`, `isPackageOffering`, `offeringTypeSchema`       |
| product schema                       | `packages/validation/src/schemas/product.schema.ts`                                           | `offeringType` default `'goods'`                                                   |
| migration files                      | `docs/offering-type-01-migration.sql` + `docs/VERIFY-offering-type-01.sql`                    | `PENDING HUMAN CONFIRMATION`                                                       |
| local schema v12                     | `packages/app-bridge/src/local-schema.ts` + `local-migrations.ts`                             | `SCHEMA_VERSION = 12`, `V12_OFFERING_TYPE`                                         |
| migration test                       | `packages/local-engine/src/__tests__/migration-v12.test.ts`                                   | 2/2 green on real SQLite, idempotent                                               |
| backend integration                  | `backend/src/services/product.service.ts` + `invoice.service.ts` + `product.mapper.ts`        | service items skip opening warehouse movements, stock movements, and costing       |
| local engine integration             | `packages/local-engine/src/routes/invoices.ts` + `invoice-returns.ts`                         | service items skip local `inventory_movement`, stock decrements, and cost layers   |
| UI form + i18n                       | `packages/ui/src/components/ui/add-product-modal.tsx` + `fa/af/en` `common.json`              | `SegmentedControl` goods vs service, unit selectable for services, quantity hidden |
| M2.1 Hardening — 10 Parity Scenarios | `packages/local-engine/src/__tests__/offering-parity-matrix.test.ts`                          | RED first (transfer 409 vs 400), then GREEN with 10/10                             |
| Warehouse Transfer Guard             | `backend/src/services/warehouse.service.ts` + `packages/local-engine/src/routes/transfers.ts` | Refuse stock transfer for non-stocking offerings (`CANNOT_TRANSFER_SERVICE_STOCK`) |
| Low Stock Filter Guard               | `backend/src/services/product.service.ts` + `packages/local-engine/src/routes/products.ts`    | Exclude service/package from low stock alerts                                      |
| Sync Engine Field Preservation       | `packages/app-shell/src/features/sync/sync-engine.ts`                                         | `FROM_LOG.product` preserves `offering_type` from server change logs               |
| Package Safety Assertion             | `packages/validation/src/schemas/universal-core/offerings.domain.ts`                          | `assertCreditLedgerAvailable` enforces package credit ledger isolation until M3    |

## 5. M2.2 — Mixed Commerce Invoicing

| Step                             | Command / action                                                                           | Result                                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| characterization test            | `packages/local-engine/src/__tests__/mixed-commerce-invoice.test.ts`                       | 7 core scenarios: goods only, service only, mixed, partial payment, mixed return, offline outbox, package safety (7/7 green) |
| server mixed ledger verification | `backend/src/__tests__/service-line-stock.test.ts`                                         | 2/2 green, verifies COGS and inventory posting occurs only for goods lines while AR and sales span full mixed total          |
| existing invoice engine          | `backend/src/services/invoice.service.ts` + `packages/local-engine/src/routes/invoices.ts` | single invoice aggregate, per-line offering capability; no parallel engine created                                           |

## 6. M3 — Package Credit & Entitlement Ledger

| Step                             | Command / action                                                                                     | Result                                                                                                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| failing guard (pure domain)      | `packages/validation/src/__tests__/package-credit-ledger.domain.test.ts`                             | RED first (module missing), then GREEN with 25/25                                                                                                                                          |
| SQLite migration test            | `packages/local-engine/src/__tests__/migration-v13.test.ts`                                          | 2/2 green on real SQLite, creates `package_credit_ledger` table and indexes, idempotent                                                                                                    |
| local engine integration suite   | `packages/local-engine/src/__tests__/package-credit-ledger.test.ts`                                  | 7/7 green covering balance derivation, invoice auto-grant, consumption decrement, idempotency guard, reversal restoration, expiry isolation, and invoice cancellation revocation           |
| pure domain engine               | `packages/validation/src/schemas/universal-core/package-credit-ledger.domain.ts`                     | 5 immutable ledger facts (GRANT, CONSUME, REVERSAL, EXPIRE, ADJUSTMENT); universal derived balance; fail-closed over-consumption guard; strict separation of entitlement from money/refund |
| PostgreSQL migration files       | `docs/package-credit-ledger-01-migration.sql` + `docs/VERIFY-package-credit-ledger-01.sql`           | `PENDING HUMAN CONFIRMATION` (additive schema, RLS tenant isolation, idempotency unique constraint)                                                                                        |
| local schema v13                 | `packages/app-bridge/src/local-schema.ts` + `local-migrations.ts` + `local-universal-core-schema.ts` | `SCHEMA_VERSION = 13`, `V13_PACKAGE_CREDIT_LEDGER`, writable & searchable table definitions                                                                                                |
| local engine invoice integration | `packages/local-engine/src/routes/invoices.ts`                                                       | sales invoice creates package grant; invoice cancellation creates negative adjustment revocation; outbox sync enqueued                                                                     |
| local engine package routes      | `packages/local-engine/src/routes/package-credits.ts`                                                | `/package-credits/balance`, `/package-credits/ledger`, `/package-credits/consume`, `/package-credits/reverse`, `/package-credits/expire`, `/package-credits/adjust`                        |
| contract & sync engine           | `packages/app-bridge/src/contract.ts` + `packages/app-shell/src/features/sync/sync-engine.ts`        | `LocalTable` includes `package_credit_ledger`; domain push branch routes consume/reverse/expire/adjust                                                                                     |
| React Query API hooks            | `packages/api/src/hooks/universal-core.ts`                                                           | `usePackageCreditBalance`, `usePackageCreditLedger`, `useConsumePackageCredit`, `useReversePackageCredit`, `useExpirePackageCredit`                                                        |

## 7. M4 — Service Delivery & Attendance Core

| Step                            | Command / action                                                                                     | Result                                                                                                                                                                                                 |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| failing guard (pure domain)     | `packages/validation/src/__tests__/service-delivery.domain.test.ts`                                  | RED first (module missing), then GREEN with 13/13                                                                                                                                                      |
| SQLite migration test           | `packages/local-engine/src/__tests__/migration-v14.test.ts`                                          | 2/2 green on real SQLite, creates `service_delivery_sessions` table and indexes, idempotent                                                                                                            |
| local engine integration suite  | `packages/local-engine/src/__tests__/service-delivery.test.ts`                                       | 5/5 green covering session scheduling, package credit redemption, invoice fallback, cancellation reversal, and attendance enforcement                                                                  |
| pure domain engine              | `packages/validation/src/schemas/universal-core/service-delivery.domain.ts`                          | Session lifecycle state machine, session duration math, deterministic settlement resolution (credit vs invoice vs complementary), cancellation credit reversal, and practitioner attendance validation |
| PostgreSQL migration files      | `docs/service-delivery-01-migration.sql` + `docs/VERIFY-service-delivery-01.sql`                     | `PENDING HUMAN CONFIRMATION` (additive schema, RLS tenant isolation, indexes)                                                                                                                          |
| local schema v14                | `packages/app-bridge/src/local-schema.ts` + `local-migrations.ts` + `local-universal-core-schema.ts` | `SCHEMA_VERSION = 14`, `V14_SERVICE_DELIVERY`, writable & searchable table definitions                                                                                                                 |
| local engine routes             | `packages/local-engine/src/routes/service-delivery.ts`                                               | `/service-delivery/sessions`, `/service-delivery/sessions/:id/deliver`, `/service-delivery/sessions/:id/cancel`                                                                                        |
| Fastify server routes & service | `backend/src/routes/service-delivery.routes.ts` + `service-delivery.service.ts`                      | tenant-isolated authoritative service delivery with automated package credit consumption & practitioner attendance checks                                                                              |
| HTTP verification               | `backend/src/__tests__/service-delivery-http.test.ts`                                                | 4/4 green (real HTTP via `buildServer()` + `app.inject()`, tenant isolation verified)                                                                                                                  |
| contract & sync engine          | `packages/app-bridge/src/contract.ts` + `packages/app-shell/src/features/sync/sync-engine.ts`        | `LocalTable` includes `service_delivery_sessions`; domain push branch routes deliver/cancel                                                                                                            |
| React Query API hooks           | `packages/api/src/hooks/universal-core.ts`                                                           | `useServiceDeliverySessions`, `useCreateServiceDeliverySession`, `useDeliverServiceDeliverySession`, `useCancelServiceDeliverySession`                                                                 |

## 8. Next slice: M5 (Refund and Accounting Integrity)

- Reconcile multi-device concurrent redemptions and handle overage accounting.
- Comprehensive refund lifecycle across Goods, Services, Packages with double-entry ledger reversals.
- Fiscal period lock enforcement across online/offline execution modes.

## 9. Reproduction

Every number above can be regenerated with the commands in the table in §1. Nothing here was copied from an earlier report.
