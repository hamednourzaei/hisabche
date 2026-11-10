# V55 — Implementation Progress

**Session:** 2026-11-11 · **Base HEAD:** `56f31842` (main) · Companion to `V55-PREFLIGHT-AUDIT.md`.
This file lets the next session continue without repeating completed work.

## Completed slice — P0 canonical correctness (Phases 0–3 of the execution order)

Status: `IMPLEMENTED_NOT_LIVE_VERIFIED` (all gates green in this session; no live HTTP/DB).

### Defect A — one canonical primary-industry decision

- New export `primaryIndustryKeyOf(types, explicitPrimary?)` in
  `packages/validation/src/schemas/industry-profiles.ts` (the ADR rule, now callable).
  `resolveBusinessProfile` delegates to it — no second derivation.
- Consumers switched from insertion order to the canonical rule:
  - `packages/ui/src/components/ui/onboarding/containers/onboarding-container.tsx`
    (`primaryTrade = primaryIndustryKeyOf(businessType) ?? undefined`; DNA inferred from it —
    `selected[0]` removed, guard `operating-profile-wiring.test.ts` updated and injection-tested).
  - `packages/ui/src/hooks/use-operational-dna.ts` (was `types[0]`).
  - `packages/ui/src/components/ui/settings/operating-profile-settings.tsx` (was `businessTypes[0]`).
- Exported from `packages/validation/src/index.ts`.

### Defect B — Unknown is never a fabricated business

- `packages/validation/src/schemas/operational-dna.ts`:
  - `UNRESOLVED` added to `offeringModelEnum` and `inventoryBehaviorEnum` (backward-compatible;
    consumer audit in preflight §6: jsonb column has no enum constraint, `resolveDnaCapabilities`
    matches by inclusion → nothing activates, `dna-menu-suggestion` hides nothing).
  - `inferOperationalDna`: explicit `holdsStock:'no'` now beats EVERY trade suggestion
    (`NONE`, no `PHYSICAL_GOODS`); unknown stock in the generic path → `UNRESOLVED`
    (was the fall-through that produced `PHYSICAL_GOODS` + `RETAIL_STOCK`).
- `packages/ui/src/lib/menu/dna-menu-suggestion.ts`: an `UNRESOLVED` axis hides nothing.

### Tests added (all green)

- `packages/validation/src/__tests__/industry-profiles.test.ts` — 5 new: registry-order
  determinism, explicit primary, sales-model vs trade, legacy/unknown never win, resolver parity.
- `packages/validation/src/__tests__/operational-dna.test.ts` — 8 new, incl. the five mandatory
  regressions of mission §15.2 + module-safety + schema-parse backward compatibility.
- `packages/ui/src/__tests__/dna-menu-suggestion.test.tsx` — UNRESOLVED hides nothing.
- `packages/ui/src/__tests__/operating-profile-wiring.test.ts` — guard re-pinned to the canonical
  primary; red/green injection check performed.

### Gates measured (real commands, real totals)

| Gate                      | Command                                                                                            | Result                                                                                                                                                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| validation tsc            | `npx tsc --noEmit`                                                                                 | exit 0                                                                                                                                                                                                                                                                         |
| validation vitest         | `npx vitest run`                                                                                   | 904 passed / 2 failed — both **pre-existing at clean HEAD** (verified via worktree): `capability-matrix-csv` (route citation `operations.routes.ts:470` drifted), `industry-coverage-table` (`--check` STALE: committed files are prettier-formatted, generator output is not) |
| ui tsc                    | `npx tsc --noEmit`                                                                                 | exit 0                                                                                                                                                                                                                                                                         |
| ui vitest                 | `npx vitest run`                                                                                   | **2683 passed / 0 failed** (2 skipped)                                                                                                                                                                                                                                         |
| backend tsc               | `npx tsc --noEmit` (6 GB heap)                                                                     | exit 0                                                                                                                                                                                                                                                                         |
| backend vitest (profile)  | `npx vitest run src/__tests__/operational-profile.test.ts src/__tests__/workspace-profile.test.ts` | 35 passed                                                                                                                                                                                                                                                                      |
| api tsc / web tsc         | `npx tsc --noEmit`                                                                                 | exit 0 / exit 0                                                                                                                                                                                                                                                                |
| eslint (11 changed files) | `npx eslint <files>` from each package                                                             | 0 errors                                                                                                                                                                                                                                                                       |
| `git diff --check`        | —                                                                                                  | clean                                                                                                                                                                                                                                                                          |
| Code intelligence         | `node scripts/build-ai-index.mjs`                                                                  | status `FRESH`                                                                                                                                                                                                                                                                 |

Files edited: 11 (9 source/test + this doc + preflight audit). Edit operations: 17.

## Not done in this session (precise next actions — NOT silently dropped)

1. **P1 adaptive question coverage (mission §6.4)** — mostly **gated by capability status**:
   the mission itself forbids questions whose workflow does not exist. `batch_expiry` is
   `planned` → pharmacy FEFO/batch questions must wait for that capability; currency-exchange
   cashboxes, repair job tickets, restaurant tables have no domain yet. Next action: implement
   capability vertical slices first (below), then add questions per newly `available` capability.
2. **P2 capability vertical slices (mission §8.4)** — highest-impact candidates with real
   evidence already in the registry: `variants` (`NOT_BOUND_TO_INVOICE_LINE`,
   `NOT_BOUND_TO_STOCK_MOVEMENT` — needs `InvoiceService.create` line binding + stock movement),
   `serialized_items` (`SALE_DOES_NOT_CLAIM_SERIAL` — sale-side claim in `InvoiceService`),
   `batch_expiry` (planned → whole vertical: domain exists? start from
   `packages/validation/src/schemas/universal-core/serial-batch.domain.ts`). Each needs owner
   accounting decisions (costing on variant, ledger posting path) → mark `NEEDS_OWNER_DECISION`
   where the rule is not defined.
3. **Warehouse product-location workflow (mission §10)** — entry points verified:
   `backend/src/services/inventory/warehouse-map.service.ts` (exists, L358 cited by coverage),
   `backend/src/services/inventory-costing/transfer.domain.ts`. Gap analysis not yet done.
4. **End-to-end archetype tests (mission §15.6)** — require a real environment (live HTTP or
   embedded Postgres run of the full signup→onboarding path); BLOCKED_EXTERNAL_CREDENTIAL
   (no live Supabase in this sandbox; owner runs pg tests on his machine).
5. **`capability-matrix-csv` + `industry-coverage-table` red tests** — pre-existing, verified
   stale at clean HEAD `56f31842`. Fix belongs to whoever regenerates and prettify-formats the
   generated docs (or the generator should emit prettier output). Not touched: unrelated files.

## NEEDS_OWNER_DECISION

- Whether `UNRESOLVED` DNA should ever be **saved** (currently only produced when a person leaves
  a question unanswered with no trade suggestion) or whether the wizard should require an explicit
  answer before completing. Current behaviour is conservative and reversible.
- Variant costing: which cost layer a variant line consumes (FIFO/AVCO per variant vs parent
  product) — prerequisite for closing `NOT_BOUND_TO_INVOICE_LINE` honestly.

---

# P2 — VERTICAL SLICE: VARIANT → SALES → INVENTORY → COSTING

Session 2026-11-11 (second slice). Base: the P0 working tree above, untouched.

## Evidence table (audited from source, 11 Nov 2026)

| Stage                              | Current implementation (file · function)                                                                                                                                                                                                                                                                                                                                                                                          | Existing tests                                                                | Missing                                                                       | Real gap?                      |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------ |
| Variant domain rules               | `packages/validation/src/schemas/universal-core/variants.domain.ts` · `checkVariantBinding`, `resolveVariantPrice`, `canonicalAttributeKey`; `packages/validation/src/schemas/variant-stock.ts` · `expandVariantMatrix`, `checkVariantStockMove`, `summarizeVariantStock`                                                                                                                                                         | `universal-core.test.ts`, `variant-binding.test.ts`, `business-packs.test.ts` | —                                                                             | No                             |
| Variant CRUD + matrix + stock read | `backend/src/services/product/variant.service.ts` · `createMatrix`, `stock`, `moveStock` (rpc `product_variant_stock`); `backend/src/routes/variant.routes.ts`                                                                                                                                                                                                                                                                    | `business-packs-10nov.pg.test.ts` (migration + VERIFY)                        | —                                                                             | No                             |
| Invoice line binding               | `backend/src/services/invoice.service.ts` · `assertVariantBindings` (L1486) before numbering (L1041); `variant_id` on the line (`buildItemRows` L2582) and on the movement (`planStockMovements` L3368)                                                                                                                                                                                                                           | `invoice-variant-binding.test.ts`                                             | —                                                                             | No (V53 P2)                    |
| Return restores the exact variant  | `backend/src/services/invoices/stock-reversal.domain.ts` · `netReversal` — the variant is part of the net key                                                                                                                                                                                                                                                                                                                     | covered via pg scenarios                                                      | —                                                                             | No                             |
| Sale availability per VARIANT      | NOTHING. The only stock refusal is product-level, inside the Postgres consume (`mayIssue` on product-keyed layers). A variant with 0 on hand sells as long as the PRODUCT has layers                                                                                                                                                                                                                                              | —                                                                             | per-variant refusal before write, gated by the existing negative-stock policy | **YES**                        |
| Purchase line → variant            | `purchase_order_items` has NO `variant_id`; `purchasing.schema.ts` item has no `variantId`; `PurchasingService.createPurchaseOrder` drops it; `moveReceivedGoods` movements carry no variant                                                                                                                                                                                                                                      | —                                                                             | schema field + column + binding validation + movement identity                | **YES**                        |
| Costing                            | `cost_layers` is keyed (workspace, product, warehouse) — NO variant column (server + local `cost_layer`). Consumption is per invoice line (`consumerLine`) → layers → purchase docs. FIFO/AVCO at product level is COHERENT with the stock model (variant stock = movements; product total = the parent). Variant-specific layers would need purchase-line variant identity FIRST — which this slice adds — and an owner decision | `valuation-consistency.test.ts`, `v53-financial-invariants.test.ts`           | variant-level cost layers — **NEEDS_OWNER_DECISION**, not silently invented   | Documented, not changed        |
| Local engine (offline)             | `createInvoiceSchema` already parses `variantId` per line, but `packages/local-engine/src/routes/invoices.ts` DROPS it (`derivedItems` L585-621); local `invoice_item` / `inventory_movement` / `purchase_order_item` have no `variant_id` column; no binding check offline                                                                                                                                                       | `migration-v9.test.ts`, `engine.test.ts`                                      | v20 migration + carry identity + binding check offline                        | **YES**                        |
| Sync / hydration                   | Outbox payload = raw request body (carries `variantId` to the server); BUT `WRITABLE_COLUMNS` (hydration whitelist) drops `variant_id` on pull, so a hydrated device loses the identity                                                                                                                                                                                                                                           | `wire-codec.test.ts`                                                          | whitelist additions                                                           | **YES**                        |
| Web/Desktop UI                     | `row-variant-picker.tsx` in the invoice grid; `invoice-grid.ts` L1029 carries `variantId` into the create payload; required-variant warning rendered                                                                                                                                                                                                                                                                              | `invoice-grid.test.ts`                                                        | —                                                                             | No                             |
| Mobile                             | no variant wiring in `apps/mobile` / `packages/app-shell`                                                                                                                                                                                                                                                                                                                                                                         | —                                                                             | variant picker (React Native cannot import `packages/ui`)                     | **YES — documented, deferred** |
| Capability registry                | `variants: partial` with `NOT_BOUND_TO_INVOICE_LINE`, `NOT_BOUND_TO_STOCK_MOVEMENT` — STALE: lines and movements have carried `variant_id` since V53 P2 / variant-stock-01                                                                                                                                                                                                                                                        | `capability-has-consumer.test.ts` (does not read limitations)                 | registry update                                                               | **YES**                        |

Conclusions on variant identity (mission §2, answered from source):

1. A stock movement identifies product AND variant (`stock_movements.variant_id`, variant-stock-01).
2. A purchase line CANNOT identify a variant (fixed in this slice).
3. An invoice line CAN (`invoice_items.variant_id`, variant-binding-01).
4. A return restores the exact sold variant (`netReversal` keys on it).
5. Stock is separated by variant × warehouse through `product_variant_stock` (server).
6. FIFO/AVCO consumes at PRODUCT level; identity is preserved for traceability via `consumerLine`, not via a variant column — no second ledger was created.
7. Legacy rows keep `variant_id = NULL` and are never re-validated — everywhere.

## P2 vertical slice — implemented (same session, after the evidence table above)

Status: `IMPLEMENTED_NOT_LIVE_VERIFIED`.

### What was genuinely missing, and is now implemented

1. **A sale a VARIANT cannot cover is refused.** The product-level refusal
   existed inside the locked Postgres consume; nothing refused «sell black L
   when all stock is on white M». New pure rule `checkVariantSalesAvailability`
   (`packages/validation/src/schemas/universal-core/variants.domain.ts`) —
   demands per (variant, warehouse) summed per document, compared against the
   variant's movements. Wired in `InvoiceService.planStockMovements`
   (`backend/src/services/invoice.service.ts`, sale direction only), gated by
   the EXISTING negative-stock policy (`costing.getSettings` → `block` checks,
   `allow` skips — same policy gate `mayIssue` keeps for the product). The
   stock read is the same `product_variant_stock` rpc the variant stock screen
   uses; a pre-variant-stock-01 database is skipped, not guessed.
2. **A purchase line names its variant.** `variantId` added to
   `purchasing.schema.ts` items; `PurchasingService.createPurchaseOrder`
   validates with the SAME `checkVariantBinding` rule as a sale line
   (`assertPurchaseVariantBindings`, legacy `42P01/PGRST205` handled), writes
   `variant_id` on the line, reads it back in both select column lists, and
   `moveReceivedGoods` puts the arrival ONTO THAT VARIANT
   (`stock_movements.variant_id`). The cost layer stays product-keyed — a
   variant does NOT get a second costing ledger (see decision below).
3. **Offline identity.** Local migration **v20**
   (`packages/app-bridge/src/local-migrations.ts`, `SCHEMA_VERSION = 20`):
   `variant_id TEXT` on `invoice_item`, `inventory_movement`,
   `purchase_order_item` (+ partial indexes); base schema carries the columns;
   `WRITABLE_COLUMNS` hydrate `variant_id` from the server pull.
   `packages/local-engine/src/routes/invoices.ts` carries the variant through
   derivedItems → invoice_item → inventory_movement and enforces the binding
   rule offline (`assertLocalVariantBindings`, shared with the purchase route —
   an offline refusal is learned offline, not on sync). `purchasing.ts` carries
   it through create and receive. Two real bugs fixed on the way:
   `variants.ts` POST returned `{status,data}` instead of the engine's plain
   payload (a created variant's id could never reach the caller), and its id
   was `v-<timestamp>` — not a uuid, so the invoice schema refused every later
   sale of it. Legacy rows stay NULL and are never re-mapped.
4. **Registry truth.** `business-capabilities.ts` variants entry: the stale
   `NOT_BOUND_TO_INVOICE_LINE` / `NOT_BOUND_TO_STOCK_MOVEMENT` limitations are
   replaced with the two that really remain: `COST_LAYERS_ARE_PRODUCT_KEYED`
   and `MOBILE_NO_VARIANT_PICKER`; evidence now cites the purchase, invoice and
   local-engine files with their tests.

### Costing decision (evidence, no new policy invented)

`cost_layers` is keyed (workspace, product, warehouse) on BOTH runtimes; the
consumption trail is `invoice line (consumerLine) → cost_consumption → cost
layer → purchase document (sourceId/sourceLine)`. Variant identity is preserved
in that chain through the LINE, not through a layer column. Because the stock
model already treats a variant as «movements of the parent product» and the
parent's total is the sum of those movements, product-level FIFO/AVCO is the
coherent reading of the existing architecture; variant-specific layers would be
a NEW costing policy. **NEEDS_OWNER_DECISION** — not implemented, not silently
chosen. Everything else in the slice works through the existing engine.

### Tests added (all green)

- `packages/validation/src/__tests__/variant-sales-availability.test.ts` — 8.
- `packages/validation/src/__tests__/draft-purchase-order.test.ts` — 3 new.
- `backend/src/__tests__/purchase-variant-binding.test.ts` — 10 (rule + wiring).
- `backend/src/__tests__/invoice-variant-availability.test.ts` — 4 (wiring).
- `backend/src/__tests__/purchase-variant-binding-01.pg.test.ts` — 3, on a REAL
  Postgres: migration twice, VERIFY all-true, insert through the real
  `document_write_rows` path, FK refuses a ghost variant. (Harness lesson
  recorded: pass the JS array to postgres.js, NOT `JSON.stringify` — a string
  is re-encoded and the function sees a jsonb scalar and returns silently.)
- `packages/local-engine/src/__tests__/migration-v20.test.ts` — 4.
- `packages/local-engine/src/__tests__/offline-variant-identity.test.ts` — 7:
  offline sale keeps the variant on line AND movement, parent-alone/wrong-
  product/inactive refusals offline, purchase line + receive move THAT variant,
  legacy product unchanged.
- `migration-v8/v9/v19.test.ts` — minimal fixtures extended with the three
  tables v20 alters (a real cache of those versions has them; the assertions
  are untouched).

### Gates measured (real commands, real totals)

| Gate                                    | Command                                                                                                                                                                     | Result                                                                                                                                                              |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| validation tsc                          | `npx tsc --noEmit`                                                                                                                                                          | exit 0                                                                                                                                                              |
| validation vitest                       | `npx vitest run`                                                                                                                                                            | 915 passed / 2 failed — the SAME two pre-existing at clean HEAD (`capability-matrix-csv`, `industry-coverage-table`)                                                |
| app-bridge tsc                          | `npx tsc --noEmit`                                                                                                                                                          | exit 0                                                                                                                                                              |
| local-engine tsc                        | `npx tsc --noEmit`                                                                                                                                                          | exit 0                                                                                                                                                              |
| local-engine vitest                     | `npx vitest run`                                                                                                                                                            | **523 passed / 0 failed** (1 skipped), 75 files                                                                                                                     |
| backend tsc                             | `NODE_OPTIONS=6GB npx tsc --noEmit`                                                                                                                                         | exit 0                                                                                                                                                              |
| backend vitest (unit project)           | `npx vitest run --project unit`                                                                                                                                             | **5293 passed / 1 failed** — `concurrency-safety-map.test.ts` (fx/remittances evidence drift); NEITHER file touched by this slice → pre-existing at HEAD `56f31842` |
| backend vitest (pg project, this slice) | `npx vitest run src/__tests__/purchase-variant-binding-01.pg.test.ts`                                                                                                       | 3 passed (embedded Postgres)                                                                                                                                        |
| backend targeted regressions            | purchase-receive-once, purchase-cancel-voids-cost-layers, purchase-return-accounting, purchase-order-items-has-no-workspace, valuation-consistency, invoice-variant-binding | 52 passed                                                                                                                                                           |
| ui / api / app-shell tsc                | `npx tsc --noEmit`                                                                                                                                                          | exit 0 ×3                                                                                                                                                           |
| web / desktop tsc                       | `npx tsc --noEmit`                                                                                                                                                          | exit 0 ×2                                                                                                                                                           |
| eslint (all changed files, per package) | `npx eslint <files>`                                                                                                                                                        | 0 errors (warnings only, all `no-explicit-any` style, pre-existing pattern)                                                                                         |
| `git diff --check`                      | —                                                                                                                                                                           | clean                                                                                                                                                               |
| Code intelligence                       | `pnpm code-intel status`                                                                                                                                                    | FRESH at start; this session's edits make it **STALE (requires rebuild upon completion)** — no automatic rebuild run, per rules                                     |

Files edited this slice: 22 (11 modified + 8 new + 3 test-fixture extensions + this doc). Edit operations: 29 (the MultiEdit tool counts each part; several files took more than one pass — see invoice.service and the migration-test fixtures).

### Not done in this slice (precise next actions — NOT silently dropped)

1. **Mobile variant picker** (`apps/mobile` / `packages/app-shell`) — React
   Native cannot import `packages/ui`; the engine and sync support now exist,
   the screen does not. Registry limitation `MOBILE_NO_VARIANT_PICKER`.
2. **Variant-level cost layers** — `NEEDS_OWNER_DECISION` (above).
3. **Runtime/device verification** — no live Supabase or device in this
   sandbox: the pg slice ran on embedded Postgres; web/mobile flows were not
   launched. Owner runs `docs/purchase-variant-binding-01-migration.sql`, then
   `docs/VERIFY-purchase-variant-binding-01.sql`, then deploys backend BEFORE
   the web/desktop/mobile builds.
4. The two pre-existing validation red tests and the concurrency-safety-map
   drift are documented, not touched (unrelated files).

---

# P1 + P3 + generated docs — completed (same working tree, after the P2 slice)

Status: `IMPLEMENTED_NOT_LIVE_VERIFIED`.

## P1 — adaptive question coverage (mission §6.4) — no longer gated

The two unit-tracking workflows now EXIST (audited: serials server-flow complete; batches FEFO
server-flow complete), so the questions the mission forbade until then are now legitimate:

- **New questions** `tracksSerials` («کالاهایت شماره سریال یا IMEI دارند؟») and `hasExpiryDates`
  («کالاهایت تاریخ انقضا دارند؟») in `packages/validation/src/schemas/operational-dna.ts`:
  added to `YES_NO_QUESTIONS`, `operatingAnswersSchema` (additive, strict), and
  `operatingQuestionsFor` — asked ONLY of a business that keeps stock.
- **New DNA axis 9** `unitTracking` (`NONE | SERIAL_NUMBERS | EXPIRY_DATES | BOTH | UNRESOLVED`),
  OPTIONAL on `operationalDnaSchema`: every DNA saved before V55 stays valid and requests nothing
  (a missing axis reads as NONE — no historical profile is re-interpreted). The axis is set ONLY
  from what a person SAID or the trade suggests; a half-known answer (one «no», one «unknown»)
  stays ABSENT, never a fabricated NONE.
- **`resolveDnaCapabilities`** requests `serialized_items` / `batch_expiry` from the axis —
  an answer, not a trade guess.
- **Trade suggestions**: `mobilePhones`/`repairs`/`mechanic` → `tracksSerials: 'yes'`;
  `pharmacy`/`grocery` → `hasExpiryDates: 'yes'`. An explicit answer still beats the trade.
- **i18n**: the two question keys added to `packages/i18n/messages/{fa,af,en}/common.json`
  (surgical insertion; the renderer is generic and needed no change).
- Registry consequence: `batch_expiry` moved `planned → partial` with REAL evidence
  (`lot.domain`, `traceability.service`, `operations.routes`, expiry hooks, warehouse receive
  modal, `traceability-rules.test.ts`); limitation `OFFLINE_BATCH_IDENTITY_MISSING`.
  `serialized_items` limitation rewritten from the stale `SALE_DOES_NOT_CLAIM_SERIAL` to
  `OFFLINE_SERIAL_IDENTITY_MISSING` — the sale DOES claim its units, through the designed
  `POST /operations/serials/issue` (`assignSerialsToSale`) + `releaseClaims`, not a call inside
  `InvoiceService.create` (by design, per the QA report: «فروش = انتخاب IMEI مشخص»).

## P2 remainder — OFFLINE serial identity (the last serialized_items gap) — closed

- **Local migration v21** (`SCHEMA_VERSION = 21`): the device's `stock_serials`
  (`packages/app-bridge/src/local-universal-core-schema.ts` → `SERIALS_STATEMENTS`), mirrored
  from `docs/SETUP-COMPLETE.sql` with TEXT ids; base schema + v21 both create it idempotently.
  This also repairs the v9 fitment join (`vehicle_attributes → stock_serials`), which referenced
  a table no local schema ever created.
- **Hydration**: `stock_serials` added to the syncable table union and `WRITABLE_COLUMNS`.
- **Local routes** (`packages/local-engine/src/routes/serials.ts`, paths mirror the server's):
  `GET/POST /operations/serials`, `POST /operations/serials/issue` — the claim decided by the
  SHARED `validateSerialSale`, the status in the UPDATE's WHERE (two tills cannot sell one phone),
  the count guarded against the invoice's own lines (`SERIAL_COUNT_MISMATCH`), and the invoice
  cancel handler frees the claims (the local twin of `releaseClaims`).
- **Offline matrix**: the three rows moved `online_required → available` under a NEW feature key
  `inventory.serial_items` (`execution: 'local'`) — they never belonged under the server-execution
  `expiry.batches`, which the matrix guard correctly refused.
- **Tests**: `migration-v21.test.ts` (2), `offline-serial-identity.test.ts` (6): receive/duplicate,
  claim on the invoice, double-claim refused, count mismatch, cross-product serial refused,
  cancel frees the unit.

## P3 — warehouse product-location workflow (mission §10): gap analysis DONE — no gap found

Audited end-to-end: server routes (`warehouse-map.routes.ts`: map / locations / place /
auto-shelf with the three-capability gate), domain + pg tests (`warehouse-map-01.pg.test.ts`,
`shelf-capacity-01.pg.test.ts`), invoice integration (`autoShelveInvoice` called from
`invoice.service.ts` L1354/L3255), offline local routes (`shelves.ts`, `products.ts` storage
locations), UI (`warehouse shelves`, `product-shelf-locations`), matrix row `available`. The
workflow exists on every floor; nothing to build in this phase.

## Generated docs — the two pre-existing red tests are FIXED

- `docs/architecture/capability-matrix.csv` regenerated (`generate-capability-matrix-csv.mjs`) —
  the drifted `operations.routes.ts:470` citation is current again.
- `INDUSTRY-COVERAGE-TABLE.{md,csv}` and `industry-diff.generated.md` regenerated — the
  generator's `key→status` adjacency regex now matches the registry (the batch_expiry comment
  was moved below `status:`), so the new partial capability appears in the registry table.
- `capability-composition.test.ts` fixtures: batch_expiry was the PLANNED example; recipe_bom
  (still planned) replaces it, and the pharmacy case now asserts the real new state — its
  batch_expiry is kept, partial, with the support note, never silently complete.

## Gates measured (this phase, real commands, real totals)

| Gate                                                     | Command                                                                     | Result                                                                                                          |
| -------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| validation tsc                                           | `npx tsc --noEmit`                                                          | exit 0                                                                                                          |
| validation vitest                                        | `npx vitest run`                                                            | **924 passed / 0 failed** (was 915/2 pre-existing — both now fixed)                                             |
| app-bridge tsc                                           | `npx tsc --noEmit`                                                          | exit 0                                                                                                          |
| local-engine tsc                                         | `npx tsc --noEmit`                                                          | exit 0                                                                                                          |
| local-engine vitest                                      | `npx vitest run`                                                            | **531 passed / 0 failed** (1 skipped)                                                                           |
| backend tsc                                              | `NODE_OPTIONS=6GB npx tsc --noEmit`                                         | exit 0                                                                                                          |
| backend vitest unit                                      | `npx vitest run --project unit`                                             | 5293 passed / 1 failed — `concurrency-safety-map.test.ts`, verified pre-existing at HEAD (neither file touched) |
| ui tsc / api tsc / app-shell tsc / web tsc / desktop tsc | `npx tsc --noEmit`                                                          | exit 0 ×5                                                                                                       |
| ui onboarding + i18n guards                              | `npx vitest run (wiring, dna-menu, bootstrap, one-screen, i18n-keys-exist)` | 49 passed / 0 failed                                                                                            |
| backend profile tests                                    | `npx vitest run (operational-profile, workspace-profile)`                   | 35 passed                                                                                                       |
| eslint (changed files per package)                       | `npx eslint <files>`                                                        | 0 errors                                                                                                        |
| `git diff --check`                                       | —                                                                           | clean                                                                                                           |

Files edited this phase: 19 (12 modified + 7 new incl. tests). Edit operations: 34.

## Still open (honest)

1. **`OFFLINE_BATCH_IDENTITY_MISSING`** — the device has no `stock_batches`; an offline pharmacy
   cannot yet receive or FEFO-allocate batches. Entry point: `SERIALS_STATEMENTS` pattern
   (app-bridge v21) + `lot.domain.planAllocation` (already shared-pure) + a local batches route.
   Needs its own reviewed slice.
2. **Mobile variant/serial pickers** — engine + sync ready; the React Native screens are not.
3. **End-to-end archetype tests** — `BLOCKED_EXTERNAL_CREDENTIAL` (no live Supabase/HTTP here).
4. **`concurrency-safety-map.test.ts`** — pre-existing fx/remittances evidence drift at HEAD;
   not touched (belongs to whoever adds that route to the map).
5. Runtime/device verification was not possible in this sandbox (no live DB, no device).

---

# FINAL COMPLETION — offline batches, mobile-picker truth, E2E readiness, pre-push audit

Session 2026-11-11 (third slice, same working tree preserved). Companion docs:
`V55-FINAL-COMPLETION-AUDIT.md` (the revalidation evidence), `V55-OWNER-DECISIONS.md`,
`V55-E2E-VERIFICATION-RUNBOOK.md`.

Status: `IMPLEMENTED_NOT_LIVE_VERIFIED`.

## What the revalidation corrected before any code

- `MOBILE_NO_VARIANT_PICKER` was **STALE** — the mobile app hosts the shared shell
  (`apps/mobile/src/host/shell-webview.tsx`), whose builder is `@hisabche/ui`'s
  `InvoiceBuilderContainer`: `RowVariantPicker` renders in the grid AND the mobile
  `item-editor-sheet`; the serial picker is the invoice-detail
  `InvoiceSerialsPanel`; `GET /products/:x/variants` and `POST /operations/serials/issue`
  are `available` offline. Now pinned by
  `apps/mobile/src/__tests__/mobile-picker-wiring.test.ts` (6, jest).
- `concurrency-safety-map.test.ts` failure re-confirmed pre-existing at HEAD
  `56f31842`: the map's evidence text for `POST /api/fx/remittances` expects
  `service.createRemittance(r.tenancy` on one line; the route file wraps it.
  Not touched.

## Offline batch identity (v22) — implemented

- **One FEFO core, two runtimes.** The pure allocation core moved to
  `packages/validation/src/schemas/universal-core/lot-allocation.domain.ts`
  (`planAllocation`, `orderBatches`, `expiryState`, `daysUntilExpiry`,
  `isIssuable` + types); `backend/src/services/traceability/lot.domain.ts`
  re-exports it — every backend import unchanged, no second algorithm.
- **Local migration v22** (`SCHEMA_VERSION = 22`): `stock_batches` +
  `lot_allocations` (server-shaped, TEXT ids, the server's CHECK constraints,
  FEFO index, unique batch number). `WRITABLE_COLUMNS` + `LocalTable` union +
  base schema + migration, all additive.
- **Local routes** (`packages/local-engine/src/routes/batches.ts`): GET/POST
  `/operations/batches`, `POST /operations/batches/plan-issue`,
  `POST /operations/batches/issue` — the claim gated on a recorded,
  non-cancelled SALE carrying the product; a replay is `BATCH_COUNT_MISMATCH`;
  the consume UPDATE keeps `remaining_qty >= ?` in its WHERE.
- **Cancel restores only its own take** (local `routes/invoices.ts`): the
  restore iterates the invoice's own `lot_allocations` rows — nothing else.
- **Server twin**: `POST /api/operations/batches/issue` →
  `TraceabilityService.issueBatchesForSale` (same gates, existing
  `issueFromBatches` does the consume; tolerant of a pre-`lot_allocations`
  database via `42P01/PGRST205`).
- **Matrix**: the four batch routes are `available` under the new feature key
  `inventory.batch_items` (`execution: 'local'`); date-fix/expiry-report/lot-trail
  stay `online_required`. `viewer-cannot-write.test.ts`: plan-issue joins the
  closed list as "a calculation; consumes nothing".
- **Registry**: `batch_expiry` limitation replaced — offline identity closed;
  `BATCH_RETURN_RESTORE_MISSING` recorded (a return does not restore its batch,
  on the server either — no policy invented).

## Docs

- `V55-OWNER-DECISIONS.md` — Decision A (variant-level costing: Option A status quo
  recommended) and Decision B (persist DNA `UNRESOLVED`: Option A recommended);
  neither applied.
- `V55-E2E-VERIFICATION-RUNBOOK.md` — A: locally verified table; B: embedded-PG
  commands; C: the owner's live sequence (env names only, deploy backend first,
  expected results, device walkthrough, cleanup). `BLOCKED_EXTERNAL_CREDENTIAL`
  recorded for C only.
- `V55-FINAL-COMPLETION-AUDIT.md` — per-item revalidation (2 REFUTED items), the
  batch implementation record, and the honest not-done list.

## Gates measured this phase (real commands, real totals)

| Gate                                    | Command                                                                                                   | Result                                                                                                                                              |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| validation tsc                          | `npx tsc --noEmit`                                                                                        | exit 0                                                                                                                                              |
| validation vitest                       | `npx vitest run`                                                                                          | **933 passed / 0 failed**                                                                                                                           |
| app-bridge tsc                          | `npx tsc --noEmit`                                                                                        | exit 0                                                                                                                                              |
| local-engine tsc                        | `npx tsc --noEmit`                                                                                        | exit 0                                                                                                                                              |
| local-engine vitest                     | `npx vitest run`                                                                                          | **553 passed / 0 failed** (1 skipped, 80 files)                                                                                                     |
| backend tsc                             | `NODE_OPTIONS=6GB npx tsc --noEmit`                                                                       | exit 0                                                                                                                                              |
| backend vitest unit                     | `npx vitest run --project unit`                                                                           | 5293 passed / 1 failed — `concurrency-safety-map.test.ts`, pre-existing at HEAD (fx/remittances evidence drift)                                     |
| backend pg (this slice)                 | `npx vitest run src/__tests__/purchase-variant-binding-01.pg.test.ts`                                     | 3 passed (embedded Postgres)                                                                                                                        |
| ui tsc                                  | `npx tsc --noEmit`                                                                                        | exit 0                                                                                                                                              |
| ui vitest                               | `npx vitest run`                                                                                          | **2683 passed / 0 failed** (2 skipped)                                                                                                              |
| app-shell / web / desktop tsc           | `npx tsc --noEmit`                                                                                        | exit 0 ×3                                                                                                                                           |
| mobile tsc                              | `npx tsc --noEmit`                                                                                        | 2 errors in `packages/api/src/hooks/guide-progress.ts` (implicit any) — file untouched by V55, last changed `b546d5df` "fixed ci 12" → pre-existing |
| mobile jest                             | `npx jest (one-ui-two-hosts, mobile-picker-wiring)`                                                       | 22 passed                                                                                                                                           |
| eslint (all changed files, per package) | `npx eslint <files>`                                                                                      | 0 errors                                                                                                                                            |
| generated docs                          | `generate-capability-matrix-csv.mjs`, `generate-coverage-table.mjs --check`, `generate-industry-diff.mjs` | current; both guard tests green                                                                                                                     |
| `git diff --check`                      | —                                                                                                         | clean                                                                                                                                               |

Files this phase: 15 modified + 9 new (4 docs, 3 local-engine tests, 1 validation
test, 1 mobile test) + backend lot.domain rewrite (re-export shim).

## Still open (honest)

1. **Live/device verification** — the owner runs `V55-E2E-VERIFICATION-RUNBOOK.md` §C
   (deploy backend first). Nothing from §C is claimed.
2. **Decision A / Decision B** — documented in `V55-OWNER-DECISIONS.md`, NOT applied.
3. **Batch restore on RETURN** — not implemented (server-side too); registry
   limitation `BATCH_RETURN_RESTORE_MISSING`.
4. **`concurrency-safety-map.test.ts`** — pre-existing, untouched.
5. **mobile tsc** — 2 pre-existing implicit-any errors in
   `packages/api/src/hooks/guide-progress.ts` (untouched by V55).
