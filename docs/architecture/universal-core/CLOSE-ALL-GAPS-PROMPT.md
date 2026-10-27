# Hisabche — Close Every Universal-Core Gap, Fully Tested, Ready for Production

You are the implementation agent. Read first, in this order: `docs/architecture/universal-core/README.md` → `UNIVERSAL-CORE-GAP-ANALYSIS.md` → `INDUSTRY-COVERAGE-TABLE.md` (+`.csv`) → `CORE-BOUNDARIES.md`. They are the specification. Every gap G-04 … G-17 in the gap analysis, and every `PARTIALLY_SUPPORTED` / `UNSUPPORTED` row in the coverage table that the plan below names, must end this job as `VERIFIED_SUPPORTED` — with the evidence the table demands — or as a precisely named, externally blocked item. **"Needs an owner decision" is not an allowed stopping reason: every decision is made below. If you disagree with one, implement it anyway and record the objection.**

The deliverable is a change set the owner can push to production for every business type, on the knowledge in this repository today.

---

## 0. Non-negotiable rules

- **Do not commit or push. Do not spawn subagents.** The owner pushes.
- **No DDL against live Supabase.** Every database change is an additive, idempotent `docs/<name>-migration.sql` with a Rollback/Mitigation block, a `docs/VERIFY-<name>.sql`, and a `*.pg.test.ts` that runs it **twice** on a real Postgres. Report: `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`. Never write "Post-migration Audit: PASS".
- Never weaken tenancy (`workspace_id`), authorisation, plan entitlements, RLS, or financial validation. Money is integer minor units. Unknown cost is `null`, never `0`.
- **One calculation path.** New rules live once in `packages/validation` and are imported by the backend **and** the local engine. A second implementation of a rule is a defect. Import by direct module path in golden vectors (barrel-cycle lesson).
- Additive only: no rewrite of existing products, invoices, prices, stock or saved layouts; **no backfill of guessed data** (guardrail §12).
- No `any`, `@ts-ignore`, `eslint-disable`, no weakened assertions, no dead code (§14), no parallel architecture (G2).
- A capability may be `available` in `business-capabilities.ts` **only** with implementation paths and an existing test; flip a `planned` entry only when all platforms it claims actually work.
- Every new endpoint gets a row in `offline-endpoint-matrix.ts` (`available` | `online_required` | `not_supported`); every new header goes into `allowedHeaders`; every new public route into the reviewed lists; every new page into web + `app-shell` routes + `DESKTOP_ROUTES` + navigation + `robots`. Every new string in `fa`, `af`, `en`.
- Local-engine ↔ server parity: any rule the engine computes has a test that runs the same vector through the server path and the engine and compares.
- Honest labels only: `VERIFIED_COMPLETE`, `IMPLEMENTED_NOT_LIVE_VERIFIED`, `BLOCKED_EXTERNAL_CREDENTIAL`. No HTTP/DB proof → not `VERIFIED_COMPLETE`.
- Build tooling (this machine): set `TEMP`/`TMP` to `.pgtest/tmp` before esbuild/initdb; backend tsc needs `NODE_OPTIONS=--max-old-space-size=6144`; run suites **sequentially**, never in parallel; Defender flags Neshta — never run pip-made `.exe`.
- The parallel work already in the tree (filter contract, `fetchProducts` via engine, shared `unit-conversion.domain`, SCHEMA_VERSION 8, Settings industry editor) is approved: preserve it. Run `git status` and read diffs before touching a file.

## 1. Decisions already made (do not ask)

| Topic                       | Decision                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Variants                    | A **template product + variant rows** (attributes as ordered name/value sets). The template is not sellable; each variant has its own SKU, barcode, price override (nullable = inherit), stock per warehouse. Existing products are untouched and remain "simple". No backfill.                                                                                                                   |
| Area pricing                | New measurement dimension `area` (m², plus cm², ft²) and **per-line dimensions** (`width`, `length`, optional `count`) that derive quantity. Line total uses the existing multiplier path.                                                                                                                                                                                                        |
| Roll / per-batch unit       | A **roll is a stock batch** (existing traceability batch) measured in a base unit (metre); sale of a partial roll consumes `remainingQty`; an optional per-batch factor (e.g. kg ↔ m) is stored on the batch and used instead of the product's fixed factor when present. Fixed-factor products behave exactly as today.                                                                          |
| Credit limit                | **Advise by default, block only if the owner turns it on.** New workspace setting `credit_limit_mode`: `off` \| `warn` (default) \| `block`. Limit `null` = no limit; `0` = cash only. Over-limit warn shows before posting; block refuses with a coded error. Evaluated in the shared domain, called by server and engine.                                                                       |
| Serial / batch at sale      | An invoice line may carry serial(s) or batch allocation. Selling a serial marks it `sold`; selling a sold serial is refused; FEFO is the default batch plan and the user may override. Return restores `in_stock`. Offline: the engine refuses a serial it knows is sold; sync conflicts on the same serial surface as a conflict, never a silent double sale.                                    |
| Returns                     | New document types `sale_return` and `purchase_return` that **reference the original invoice**, carry per-line quantity ≤ remaining returnable, a reason code, and a restock choice (`restock` \| `scrap`). Ledger reverses proportionally through the existing reversal machinery; cost comes from the original layers.                                                                          |
| Warranty                    | `warranty_months` on product (nullable) → warranty record created at sale per serial/line; claim = a linked record with status. No automatic financial effect.                                                                                                                                                                                                                                    |
| Pack barcodes               | A barcode may point to a **unit** of the product (carton = 24 pieces); scanning adds that unit's quantity through `toBaseQuantity`.                                                                                                                                                                                                                                                               |
| OEM / fitment               | Alternate identifiers table (`oem`, `aftermarket`, `supersedes`) searchable from the product picker; fitment = free-form make/model/year-range rows. No external catalog import.                                                                                                                                                                                                                  |
| Core charge                 | A product flag + deposit amount; the deposit is a separate invoice line to a **liability** account role and is refunded on a linked return within a configurable window. Needs a new account role `core_deposit` seeded additively.                                                                                                                                                               |
| Gold purity & making        | Karat/purity attribute on the line; rate per karat from a dated `metal_rates` table; making charge = per-gram, percentage-of-metal, or fixed-per-piece, configured per product; old-gold trade-in = a credit line valued by net weight × tested purity × rate. Posted as ordinary revenue/deduction lines; tax treatment follows the workspace's existing tax setting (no new tax rule invented). |
| Reconditioning cost         | Add-cost-to-unit operation on a serial/vehicle unit: creates a cost layer addition with an audit row; flows into that unit's profit.                                                                                                                                                                                                                                                              |
| Vehicles                    | A vehicle is a serial-tracked unit with a typed attribute set (VIN/chassis, make, model, year, colour, odometer). VIN is validated by length/charset only; **no decoder or external lookup**. Days-in-stock per unit is computed from `received_on`.                                                                                                                                              |
| Trips (freight)             | Entities: `vehicle` (links to fixed asset), `trip` (route text, dates, status), `trip_load` (customer, cargo, weight, freight charge), `trip_expense` (fuel, tolls, driver pay). Freight charge becomes an ordinary sales invoice through `InvoiceService.create`. Driver settlement = payroll line referencing trips.                                                                            |
| Passenger                   | `route`, `route_stop`, `fare_leg`, `bus_layout` (seat map), `scheduled_trip`, `booking`/`ticket` (seat, passenger, fare, status). A paid ticket is an ordinary sale. Passenger list report per trip.                                                                                                                                                                                              |
| Courier                     | `delivery` (status: unassigned → assigned → picked up → delivered/failed/returned), driver assignment, proof of delivery (signature/photo reference, timestamp), COD amount. COD lifecycle: `to_collect → with_driver → with_cashier → banked`, each move a posted till/bank transfer via existing till/payment services.                                                                         |
| Delivery notes & scheduling | `delivery_note` document from a sale (partial deliveries allowed); delivery/installation calendar with vehicle and crew capacity.                                                                                                                                                                                                                                                                 |
| Appointments                | `appointment` (resource, start/end, customer, service item); converting one to an invoice goes through `InvoiceService.create`.                                                                                                                                                                                                                                                                   |
| Agriculture                 | `land_unit`, `crop`, `crop_cycle`, `livestock_group` (count-based, not per-animal), production and mortality events; harvest posts stock-in through the existing stock-movement service.                                                                                                                                                                                                          |
| Made-to-order               | A confirmed sale line flagged `made_to_order` creates a draft work order via the existing manufacturing service.                                                                                                                                                                                                                                                                                  |
| Deposit on order            | Order-level deposit (`payments` linked to the sales order) that automatically applies to the invoice created from it.                                                                                                                                                                                                                                                                             |
| Registry                    | Flip `variants`, `length_pricing`, `batch_expiry`, `serialized_items`, `gold_purity`, `making_charges` to `available` only when their gate (§4) is green on server, engine, UI and offline matrix; add new capability keys for the extensions with evidence.                                                                                                                                      |

## 2. Execution order (each step ends green before the next begins)

1. **Foundations** — verify the working tree builds: validation, local-engine, api, ui tsc + their suites. Fix any red you did not cause only if it blocks you; record the rest.
2. **Quick shared wins** — G-04 offline unit-conversion parity test; G-16 pack barcodes; G-08 credit limit; G-12 returns.
3. **Identity** — G-10 serial/batch at sale; G-11 warranty; vehicles; reconditioning cost; roll batches (G-07).
4. **Catalog shape** — G-05 variants (largest); G-06 area/dimensions.
5. **Trade rules** — G-13 gold purity/making/old-gold; G-15 OEM/fitment/core charge; made-to-order; deposit-on-order; delivery notes/scheduling.
6. **Extensions** — freight trips; passenger ticketing; courier/COD; appointments; agriculture. Each is a self-contained module reusing invoices, payments, assets and payroll — **no copy of the accounting engine**.
7. **Registry, onboarding, profiles** — flip capabilities with evidence; give the new trades real profiles (freight/passenger/courier/fabricRoll/computerComponents now have generic profiles); the "specialised features not yet available" note must disappear for a trade the moment its profile stops being generic (derived, no edit).
8. **Coverage table** — update `scripts/industry/coverage-data.mjs` so statuses/evidence/tests reflect reality; regenerate; `--check` green; every `UNSUPPORTED` that is now supported becomes `VERIFIED_SUPPORTED` or `IMPLEMENTED_THIS_ROUND` **with a test file**; gap analysis rows updated; no row may claim more than a test proves.
9. **Full verification, builds, live check, docs, lessons** (§5, §6).

## 3. Per-gap acceptance (all required)

For **every** item in §1, deliver all of:

1. **Shared rule** in `packages/validation` (pure, with golden vectors in `__golden__/`).
2. **Server**: service + route + schema + manual body mapping (the route-mapping trap: a field not named in the mapping is dropped silently) + idempotency + audit + `workspace_id` on every row.
3. **Migration**: additive, idempotent, rollback block, VERIFY query, `*.pg.test.ts` that applies it twice and asserts constraints, RLS and that existing rows are unchanged.
4. **Local engine**: route + SQLite tables + `SCHEMA_VERSION` bump + upgrade test on a copy of a real device DB (v8 → vN, run twice, prior data intact) — or an explicit `online_required` matrix row with `<CloudRequiredNotice />` when the item is online-only by nature (courier dispatch, passenger ticketing). Choose offline for anything a shop does at the till.
5. **API hooks** in `packages/api` (React Query, `asList`, error with status/data preserved) and cache invalidation under the existing key families.
6. **UI** in `packages/ui`: reuse `DataTable`, `SelectField`, `HubTabs`/`PageHub`, `SegmentedControl`, existing modals; a new capability is a tab/section of an existing hub, **not** a new route unless unavoidable. Web + Windows + mobile through `app-shell`. Tokens only, RTL logical classes, no raw `<select>`.
7. **i18n** `fa`, `af`, `en` (+ `DARI-GLOSSARY.md`); `translateOr` where the desktop shim lacks `t.has`.
8. **Tests**: shared unit; backend HTTP (`fastify.inject`) including **two-workspace isolation**, role/permission, idempotent retry, reversal; engine test; **server-vs-engine parity test** on the same vector; UI test; offline-matrix guard; and a guard that stops a second implementation appearing.
9. **Docs**: capability registry entry with evidence; coverage-data row; CLAUDE.md bullet and a numbered lesson in `.claude/lessons-learned.md` for each trap you meet.

### Specific numeric vectors that must pass on server **and** engine **and** UI

- `2 cartons × 24 pieces = 48 pieces` (base-unit stock, carton display).
- `15 g × 33,000,000 = 495,000,000` and `12 × 25,000 = 300,000`.
- `3 m × 2.5 m` area line at `1,200,000 / m²` = `9,000,000` (and the rounded-up-to-whole-metre rule is **not** applied unless the product says so).
- Partial roll: roll of 50 m, sell 12.5 m → remaining 37.5 m; sell 40 m → refused (`ROLL_INSUFFICIENT`).
- Per-batch factor: batch A 1 kg = 3.2 m, batch B 1 kg = 3.5 m consumes by its own factor.
- Sale return of 2 of 5 units restores 2 units at **original layer cost**, reverses 2/5 of revenue and tax, refuses a third return of the same 5 once 5 are returned.
- Credit: limit 1,000 / receivable 800 / new invoice 300 → `warn` shows 100 over; `block` refuses with a coded error; `off` ignores; limit `0` and limit `null` differ.
- Gold: 10 g net, 22K rate table, making 8% of metal, old gold 4 g at 18K credited → exact integer result in minor units, identical in engine.
- Serial: sell S1; sell S1 again → refused online and offline; return S1 → sellable again.

## 4. Capability flip gates

A capability becomes `available` only when: shared rule + tests exist; server path tested; engine path tested **or** matrix row `online_required` with notice; UI reachable on web and shell; i18n complete; parity test green. Otherwise it stays `planned` and the coverage row stays honest.

## 5. Verification (sequential, record real counts)

1. `packages/validation`, `packages/local-engine`, `packages/api` — tsc + vitest, full.
2. `packages/ui` — tsc + vitest **full** (isolate timeouts by running the failing file alone; fix real reds).
3. `backend` — `NODE_OPTIONS=--max-old-space-size=6144`, tsc + vitest full. The `|pg|` files: try, in order, `TEMP/TMP → .pgtest/tmp`; data dir on a plain local path; kill stale `postgres`/`initdb`; single-file with file parallelism off; non-elevated shell. Record every attempt. Skipped `pg` tests are **not** a pass: report them as "not executed" with the exact error, and run the migration with the in-repo embedded Postgres if at all possible.
4. `apps/desktop`, `apps/mobile` — tsc + jest.
5. `eslint` on every changed file from its own package directory.
6. Guards: offline-matrix, route-parity, no-hardcoded-currency, import-cycles, `unwired-capability` (every new domain file must be reachable from a route or job), `no-eq-null-filter`, industry-profile registry parity, `node scripts/industry/generate-coverage-table.mjs --check`, `node scripts/industry/generate-industry-diff.mjs --check`.
7. Inject-test each new guard (temporarily revert the fix, see red).
8. `node scripts/audit-unwired-routes.mjs` — no write route without a caller.
9. `node scripts/build-ai-index.mjs`.

## 6. Builds and live check (only when §5 is green)

Web build; Windows (`electron-builder --win -c.electronDist=node_modules/electron/dist`); Android (`pnpm run android:release`; trust the APK timestamp, not Gradle's message). Then open the real Windows app and execute, **offline**: a jewellery weight sale; a countable carton→piece sale; a partial-roll sale; a serial sale then re-sale refusal; a sale return; an over-credit warning; a variant sale (size × colour) — screenshots and logs only for actions that actually happened. Any item that cannot be driven live is `IMPLEMENTED_NOT_LIVE_VERIFIED` with the exact reason.

## 7. Production readiness package (the owner pushes, so hand over)

- `docs/PRODUCTION-RELEASE-CHECKLIST-universal-core.md`: ordered list of migrations to run (with each VERIFY query and expected result), which migrations must precede which deploy (**database first, backend second, clients last**), the rollback for each, feature flags/settings defaults (`credit_limit_mode = warn`), and what a device does on first launch after the SCHEMA_VERSION bump.
- A **compat statement**: old clients vs new backend and new clients vs old backend; every new header in CORS `allowedHeaders`.
- Backfill statement: none performed.
- PSI / landing impact: state that no landing bundle changed (or measure it).
- Update `docs/architecture/industry/FINAL-RESULTS.md` and `VERIFICATION-LOG.md`.

## 8. Completion gate — do not write the final report until every line is true

- [ ] Every gap G-04…G-17 is `VERIFIED_COMPLETE`, or `BLOCKED_EXTERNAL_CREDENTIAL` with the exact external dependency (only: live Supabase SQL, a physical device).
- [ ] Coverage table regenerated; **no** row says `UNSUPPORTED` for something now implemented; no row claims support without an anchored test; Markdown, CSV and support matrix agree; `--check` green.
- [ ] Every suite in §5 ran to completion with real counts; failures are fixed or proven pre-existing with `git stash`-free evidence (`git log -S` / blame).
- [ ] Migrations: files + VERIFY + double-run tests written; none executed live.
- [ ] Windows live scenarios done offline, or labelled honestly.
- [ ] Builds exist with fresh timestamps.
- [ ] Lessons, CLAUDE.md, release checklist written.
- [ ] `git status` summary given; **nothing committed or pushed**.

## 9. Final report (Persian)

Table with a row per gap: وضعیت (one of the three labels), فایل‌های تغییرکرده، تست‌ها (اجراشده/قبول/رد/رد‌شده با عدد واقعی)، مهاجرت (فایل + VERIFY + منتظر اجرای انسان)، آفلاین (matrix + parity)، یافته‌های سرراه. Then: totals per suite, build artifact paths + times, Windows live evidence, the ordered production-release steps, and the list of things you chose where I said "do not ask". **The "باقی‌مانده" column is empty only if it really is. Never empty it by omission, relabelling, or deleting a failing test.**

Start with `git status` and the four documents. Do not stop after the plan; do not stop after the first green step.
