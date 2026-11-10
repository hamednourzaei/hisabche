# V55 — FINAL COMPLETION AUDIT

**Date:** 2026-11-11 · **HEAD:** `56f31842` (branch `main`, unchanged) ·
**Working tree:** the P0/P1/P2/P3 V55 work preserved untouched; this phase
adds the final-completion work on top. Code intelligence at start: `FRESH`.

This is the Phase-0 revalidation the final-completion mission required: every
"remaining" item was re-checked against the SOURCE, not against the previous
report. Two of the six reported remainders turned out to be wrong or stale —
recorded below as REFUTED.

---

## 1. Revalidation of the reported remaining items

| #   | Reported                                                          | Revalidated finding                                                                                                                                                                                                                                                                                                          | Verdict                                                                                             |
| --- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | Offline batch identity missing (`OFFLINE_BATCH_IDENTITY_MISSING`) | TRUE — the local schema had no `stock_batches`/`lot_allocations`; server `issueFromBatches` (`traceability.service.ts` L287) existed but had NO route and no local twin                                                                                                                                                      | CONFIRMED → **CLOSED this phase** (§2)                                                              |
| 2   | Mobile variant picker missing (`MOBILE_NO_VARIANT_PICKER`)        | **REFUTED.** `apps/mobile` hosts the shared shell (`src/host/shell-webview.tsx`, guard `one-ui-two-hosts.test.ts`); the shell's builder is `@hisabche/ui/screens` → `InvoiceBuilderContainer` → grid + MOBILE `item-editor-sheet.tsx`, both rendering `RowVariantPicker`; `GET /products/:x/variants` is `available` offline | Registry limitation was STALE → corrected this phase                                                |
| 3   | Mobile serial picker missing                                      | **REFUTED.** The invoice-detail container renders `InvoiceSerialsPanel` (`useSerials` + `useAssignSerialsToSale` → `POST /operations/serials/issue`), and the local engine has answered that endpoint since v21. Now pinned by `apps/mobile/src/__tests__/mobile-picker-wiring.test.ts`                                      | Closed by evidence + guard test                                                                     |
| 4   | Live E2E `BLOCKED_EXTERNAL_CREDENTIAL`                            | TRUE — no live Supabase/device in this sandbox                                                                                                                                                                                                                                                                               | CONFIRMED → runbook produced (`V55-E2E-VERIFICATION-RUNBOOK.md` §C); local + pg parts verified (§4) |
| 5   | Variant-level costing `NEEDS_OWNER_DECISION`                      | TRUE — `cost_layers` still keyed (workspace, product, warehouse) on both runtimes                                                                                                                                                                                                                                            | CONFIRMED → documented as Decision A in `V55-OWNER-DECISIONS.md`, NOT changed                       |
| 6   | DNA `UNRESOLVED` persistence `NEEDS_OWNER_DECISION`               | TRUE — behaviour unchanged since V55 P0; consumers audited in preflight §6                                                                                                                                                                                                                                                   | CONFIRMED → documented as Decision B, NOT changed                                                   |
| 7   | `concurrency-safety-map.test.ts` failure pre-existing             | Re-run: fails with `POST /api/fx/remittances → backend/src/routes/exchange.routes.ts: service.createRemittance(r.tenancy` — a formatter split the multi-line call the map's evidence text expects; the file was last touched by HEAD `56f31842` itself ("fixed ci 16"); no V55 file involved                                 | CONFIRMED pre-existing & unrelated; recorded, not touched                                           |
| 8   | Code-intelligence index                                           | `FRESH` at start; rebuild run at the end of this phase (see progress doc)                                                                                                                                                                                                                                                    | Rebuilt                                                                                             |

## 2. Offline batch identity — implemented this phase

- **Shared allocation core (ONE FEFO, two runtimes):** the pure core
  (`daysUntilExpiry`, `expiryState`, `isIssuable`, `orderBatches`,
  `planAllocation` + types) moved from
  `backend/src/services/traceability/lot.domain.ts` to
  `packages/validation/src/schemas/universal-core/lot-allocation.domain.ts`;
  the backend file re-exports it, so its public API and every consumer
  (`traceability.service.ts`, `traceability-rules.test.ts`,
  `financial-flows-e2e.test.ts`) are unchanged. The local engine imports the
  SAME functions — there is no second FEFO implementation.
- **Local migration v22** (`SCHEMA_VERSION = 22`,
  `packages/app-bridge/src/local-migrations.ts` → `V22_BATCH_IDENTITY`,
  statements `BATCHES_STATEMENTS` in `local-universal-core-schema.ts`):
  `stock_batches` + `lot_allocations`, column-for-column the server's tables
  (TEXT ids + sync columns), with the server's CHECK constraints (quantity
  can be neither negative nor over-received; an allocation names exactly one
  of batch/serial), the FEFO index, and the unique
  `(workspace, product, batch_number)` index. Additive, idempotent, legacy
  rows untouched. Registered for hydration (`WRITABLE_COLUMNS`) and in the
  `LocalTable` union (`contract.ts`).
- **Local routes** (`packages/local-engine/src/routes/batches.ts`, paths
  mirror the server's):
  `GET /operations/batches` · `POST /operations/batches` (receive; duplicate
  batch number → 409 `BATCH_NUMBER_DUPLICATE`) ·
  `POST /operations/batches/plan-issue` (plan-only) ·
  `POST /operations/batches/issue` (the claim: invoice must be a recorded,
  non-cancelled SALE carrying the product; already-recorded allocations count
  against the sale → a replay is `BATCH_COUNT_MISMATCH`; the plan is the
  shared `planAllocation`; the UPDATE keeps `remaining_qty >= ?` in its WHERE
  so two tills cannot consume one carton — `BATCH_INSUFFICIENT_STOCK`).
- **Cancellation releases only its own take:**
  `packages/local-engine/src/routes/invoices.ts` cancel handler now iterates
  the invoice's own `lot_allocations` rows, adds each recorded quantity back
  to its batch, and deletes those rows — a cancellation can never restore a
  quantity that was never allocated, because the restore is driven by the
  allocation rows and nothing else.
- **Server twin:** `POST /api/operations/batches/issue`
  (`backend/src/routes/operations.routes.ts` →
  `TraceabilityService.issueBatchesForSale`, which verifies the sale, refuses
  replays, and consumes through the existing `issueFromBatches`). The online
  and offline paths now share one route shape and one allocation core.
- **Offline matrix:** `GET/POST /operations/batches`,
  `POST /operations/batches/plan-issue`, `POST /operations/batches/issue` →
  `inventory.batch_items` (new feature key, `execution: 'local'`,
  `feature-registry.ts`), `available`. Date correction, the expiry report and
  the lot trail stay `online_required` under `expiry.batches` — the device
  has no claim on them.
- **Registry:** `batch_expiry` limitations rewritten:
  `OFFLINE_BATCH_IDENTITY_MISSING` (closed) replaced by
  `BATCH_RETURN_RESTORE_MISSING` — a RETURN does not restore the batch it
  came from, on the SERVER either, so no restore policy was invented.

## 3. Mobile variant and serial — evidence recorded, drift guarded

- Wiring (paths above): shared builder → `RowVariantPicker` (grid +
  mobile sheet); invoice detail → `InvoiceSerialsPanel`; offline reads
  `GET /products/:x/variants`, `GET/POST /operations/serials*` all
  `available`. i18n: the pickers' keys already exist in all three message
  files; no new user-facing string was introduced by this phase (route and
  engine work only), so no translation keys were added.
- Guard test `apps/mobile/src/__tests__/mobile-picker-wiring.test.ts` (jest)
  pins the wiring and restates the no-private-mobile-UI rule.
- **Not done on device:** no Android device/emulator in this sandbox — no
  screenshot, no manual RTL walkthrough. The pickers' RTL/layout behaviour is
  the shared web components' existing, already-tested behaviour.

## 4. E2E separation

- **A (local, automated):** verified — see the runbook §A table and the gate
  totals in the progress doc.
- **B (embedded Postgres):** `purchase-variant-binding-01.pg.test.ts` —
  real Postgres, migration twice, VERIFY all-true, FK refuses a ghost
  variant.
- **C (live):** `BLOCKED_EXTERNAL_CREDENTIAL` — the owner runs the runbook
  §C. No result from §C is claimed anywhere.

## 5. Purchase-variant migration + VERIFY (mission §6)

`docs/purchase-variant-binding-01-migration.sql` and
`docs/VERIFY-purchase-variant-binding-01.sql` exist and MATCH the
implementation: additive column + NOT-VALID FK + validate + partial index +
ANALYZE, rollback block, tenant-safety checks (orphan variant / cross-workspace
variant queries in VERIFY). Executed on a real embedded Postgres by the pg
test this session. NOT executed on live Supabase, and no deployment is
claimed.

## 6. Concurrency safety map (mission §7)

Failure reproduced and diagnosed: the map's evidence text for
`POST /api/fx/remittances` expects `service.createRemittance(r.tenancy` on
one line; the route file now wraps the call across lines. Pre-existing at
HEAD `56f31842`, unrelated to V55 (no V55 file appears in the failing
evidence). Left untouched, per the rules; the fix belongs to whoever updates
the map's evidence text (or a prettier-tolerant evidence match).

## 7. What this phase did NOT do (honest)

1. **Live/device verification** — runbook §C/§C5 only.
2. **Decision A / Decision B** — documented, NOT applied.
3. **Batch restore on RETURN** — neither server nor device implements it; the
   registry names the limitation (`BATCH_RETURN_RESTORE_MISSING`) instead of
   inventing policy.
4. **Server-side batch restore on invoice cancel** — the server's
   `releaseClaims` restores serials and time entries but not batch
   allocations (the server's invoice flow does not consume batches at all;
   `issueBatchesForSale` is an explicit claim). The local cancel restores
   what the local claim took. Making the server cancel reverse a
   server-side batch claim is a policy decision riding on Decision A.
5. **concurrency-safety-map fix** — pre-existing, unrelated; not touched.
