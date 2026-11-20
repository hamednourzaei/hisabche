# SHARED-CORE INTEGRATION COVERAGE — Hisabche

> Mission: full-repository audit of the seams between business cores, elimination of
> missing integration tests, and closure of cross-domain regressions.
> Base HEAD: `d8dfdea3a107055a4a9176f2f7e7c091513c35fc` (main). Working tree preserved.
> Status vocabulary: `VERIFIED_COMPLETE` · `GAP_FOUND` · `IMPLEMENTED_AND_TESTED` ·
> `IMPLEMENTED_NOT_LIVE_VERIFIED` · `BLOCKED` · `NOT_IMPLEMENTED`.
> A green unit test on ONE side of a seam is not coverage of the seam.

Test infrastructure (discovered, not assumed):

| Suite location                                                       | Runner                                                               | Command                                      |
| -------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------- |
| `backend/src/__tests__`                                              | vitest 4, projects `unit` + `pg` (embedded-postgres, max 2 workers)  | `cd backend && npx vitest run`               |
| `packages/local-engine/src/__tests__`                                | vitest 4, real `node:sqlite` via `test-db.ts`                        | `cd packages/local-engine && npx vitest run` |
| `packages/app-shell/src/**/__tests__`                                | **jest via `apps/desktop/jest.config.js`** (roots include app-shell) | `cd apps/desktop && npx jest`                |
| `packages/validation`, `packages/ui`, `packages/store`, `apps/admin` | vitest                                                               | per-package `npx vitest run`                 |

PG preflight on this machine: executables present and `initdb` succeeds in `.pgtest/`,
but actual `postgres.exe` startup fails with error 1314 (filtered admin token drops
`SeCreateGlobalPrivilege`). Local `*.pg.test.ts` execution is therefore **BLOCKED**
(environment); the suites run in CI. See section C for the full evidence.

---

## A. Verified starting findings (re-opened at HEAD, not copied)

### SC-01 · Service Delivery sessions ↔ Sync push transport — `IMPLEMENTED_AND_TESTED`

- Domain A: Service Delivery (local engine + `service_delivery_deliver/cancel` SQL).
- Domain B: app-shell sync engine push (`pushEntry`).
- Source of truth: server `service-delivery` routes → one atomic PG function.
- Producer: `packages/local-engine/src/domains/service-delivery.ts` outbox commands
  (`<sessionId>` create, `<sessionId>-deliver`, `<sessionId>-cancel`, status moves).
- Consumer: `packages/app-shell/src/features/sync/sync-engine.ts:1136-1161` routes
  delivered→`/service-delivery/sessions/:id/deliver`, cancelled→`/cancel`,
  in_progress/no_show/checked_in→`/status`, else create.
- Existing tests: `service-delivery-integrity.test.ts` (local outbox shape, one command
  per action, replay), `sync-scenarios.test.ts:545-583` (server REFUSAL visibility),
  `service-delivery-http.test.ts` (server HTTP), `service-delivery-02.pg.test.ts` (atomicity).
- Missing coverage (proven by grep: no test hits the four success endpoints through `runSync`):
  successful endpoint selection per status, session id in URL, payload untouched,
  Idempotency-Key = clientId, queue drained exactly once, lost-ack retry reuses the same
  key, create-before-deliver ordering through the push gate.
- Risk: **High** — a wrong road here is a second session or a consumption that never lands.
- Required tests: success path per transition + retry + ordering. → added in
  `sync-scenarios.test.ts` (canonical suite, extended).

### SC-02 · Package Credit ledger ↔ Sync push transport — `IMPLEMENTED_AND_TESTED`

- `sync-engine.ts:1112-1134`: GRANT refused permanently (tested), REVERSAL→`/package-credits/reverse`,
  EXPIRE→`/expire`, ADJUSTMENT→`/adjust`, else CONSUME→`/consume`.
- Existing: GRANT refusal (`sync-scenarios.test.ts:615-633`), server side
  (`package-credits-http.test.ts`, `package-credit-service.test.ts`,
  `package-credit-financial-audit.test.ts`, `package-credit-concurrency.pg.test.ts`).
- Missing: the four SUCCESS roads through `runSync` (endpoint, body, key, drain).
- Risk: **High**. → added in `sync-scenarios.test.ts`.

### SC-03 · Operational entities ↔ Device pull (snapshot + delta) — `IMPLEMENTED_AND_TESTED`

- Domain A: server `SyncService.snapshot/pull` + `PULL_COLUMNS`.
- Domain B: device `FROM_LOG` mappers + SQLite (`sync-engine.ts:306-395`).
- Existing: `sync-pull.test.ts:123-149` returns EMPTY pages for `product_variants`,
  `service_delivery_sessions`, `package_credit_ledger`, `repair_tickets`;
  `sync-operational-pull.test.ts` proves server columns/tenant scoping on a fake DB and
  asserts mapper existence BY TEXT (lines 532-563).
- Missing: populated rows actually mapped and persisted on the device; settlement fields
  (`package_credit_id`, `settlement_method`, customer), ledger `quantity`/`entry_type`,
  replay without duplicates, later version updates the right row, cursor advancement,
  workforce-pack entity scoping of the delta request.
- Note: sessions/credits carry NO local `version` column by design
  (`sync-engine.ts:300-305`); variants/tickets do. The test asserts the real contract.
- Risk: **High** — a delivered session that never arrives is a slot offered twice.
- → added in `sync-pull.test.ts` (canonical suite, extended).

### SC-04 · Service Delivery transaction ↔ change log ↔ real pull function — `IMPLEMENTED_NOT_LIVE_VERIFIED` (local PG `BLOCKED`)

- Existing: `operational-pull-02.pg.test.ts` applies the migration twice and proves
  triggers on RAW inserts/updates/deletes + privileges + VERIFY. It does NOT run the real
  delivery transaction, and never calls `sync_pull_changes`/`sync_pull_changes_v2`.
  `service-delivery-02.pg.test.ts` runs the real deliver/cancel but without the sync
  migrations, so it proves nothing about the change log or the pull.
- Missing: real `service_delivery_deliver` on top of the real sync migrations → session
  update + CONSUME in ONE transaction → `sync_change_log` rows under the PROTOCOL entity
  names with bumped versions → the real `sync_pull_changes_v2` returns both records →
  tenant isolation at the pull-function level → cancel reversal travels too → replay adds
  no log rows.
- Risk: **High**. → new `backend/src/__tests__/service-delivery-sync-roundtrip.pg.test.ts`
  (reuses `setupServiceDelivery` helper; real migrations in order: package-credit-ledger-01,
  service-delivery-01/02/03, sync-engine, sync-commit-horizon, sync-scope-01,
  operational-pull-02 ×2).

### SC-05 · Payment posting: device engine ↔ server service parity — `IMPLEMENTED_AND_TESTED`

- Existing: `payment-posting-parity.test.ts` / `payment-allocation-parity.test.ts` (device,
  hand-computed expectations), `till-on-payments.test.ts` (server service, recording repo),
  golden corpus `packages/validation/src/__golden__/vectors.json` (19 vectors, 2 payments —
  pure arithmetic through the shared core). Both sides assert the SAME hand numbers, but no
  test drives BOTH real implementations with ONE input and compares the normalized outcome.
- Missing: shared-input parity (foreign receipt at frozen-rate gap, bank vs cash, partial
  payment remainder, purchase-side loss), replay = one posting on both sides, cancel =
  reversal on both sides, fail-closed cancel when the period is locked.
- Risk: **High** — the mission's core example («۴ تست سبز در چهار لایه»).
- → new `backend/src/__tests__/payment-device-server-parity.test.ts` (real local engine on
  `node:sqlite` + real `PaymentsService` with recording ports; AFN books, zero-decimal,
  no implicit /100).

### SC-06 · Payment cancel ↔ ledger reversal (server) — `IMPLEMENTED_AND_TESTED` (was `WEAK_TEST`)

- `payment-cancel-reversal.test.ts` is STATIC_ONLY (source-text order assertions).
  Behaviour is partially covered elsewhere (`vertical-slice-integration.test.ts:430`,
  device `cancel-posts-reversal.test.ts`), but the fail-closed path (reversal throws →
  payment NOT marked cancelled) had no behavioural test. → behavioural assertions added in
  SC-05's suite (reverse-before-cancel ordering observed through real calls, PERIOD_CLOSED
  propagation, no repo.cancelPayment on failure). The static guard is left untouched.

### SC-07 · Remaining parameterized domain push roads — `IMPLEMENTED_AND_TESTED`

- `sync-engine.ts:1164-1365`: courier close/assign/create, resource_bookings create,
  stock_serials issue, invoice_returns (covered), order_deposits (covered),
  pos cash/close (covered), journal reverse, price-list items/active, promotion active,
  payment delete→cancel (+404 replay tolerance).
- Grep proved NO success-path test for: courier, bookings, serials issue, journal reverse,
  price-list updates, promotion update, payment cancel road. Conflict paths (409) for
  serials/bookings are covered (`serial-sync-conflict.test.ts`, `resource-capacity-race.test.ts`).
- Risk: **Medium-High** (same class as the NO_ENDPOINT bug these roads were built to fix).
- → added in `sync-scenarios.test.ts`.

---

## B. Domain sweep — integrations inventoried with existing evidence

| ID    | Integration                                      | Existing evidence (paths)                                                                                                                                                           | Status                                                         |
| ----- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| SC-08 | Invoice offline → server → confirm → pull        | `device-invoice-roundtrip.test.ts`, `invoice-idempotency.test.ts`, `http-integration.test.ts`, `sync-scenarios.test.ts` D/E                                                         | VERIFIED_COMPLETE                                              |
| SC-09 | Deposit receipt/apply/refund ↔ sync ↔ PG         | `sync-scenarios.test.ts:387-516`, `deposit-pull.test.ts`, `order-deposit-apply-refund-01.pg.test.ts`, `offline-core-charge.test.ts`                                                 | VERIFIED_COMPLETE                                              |
| SC-10 | Credit limit offline → server revalidation       | `credit-validation.test.ts`, `invoice-credit-limit.test.ts`, `credit-concurrency-01.pg.test.ts`                                                                                     | VERIFIED_COMPLETE                                              |
| SC-11 | Stock transfer device ↔ server ↔ cost layers     | `transfer-parity.test.ts`, `transfer-cost-layers.test.ts`, `stock-transfer-keyed.pg.test.ts`, `stock-count.test.ts`                                                                 | VERIFIED_COMPLETE                                              |
| SC-12 | Invoice return → disposition → stock/cost/ledger | `return-stock-decision.test.ts`, `invoice-return-01.pg.test.ts`, `invoice-return-once.test.ts`, `sync-scenarios.test.ts:585-613`, `invoice-return-06-scenarios.ts`                  | VERIFIED_COMPLETE                                              |
| SC-13 | Two devices, one serial → PENDING_REVIEW         | `serial-sync-conflict.test.ts`, `mobile-serial-01.pg.test.ts`, `offline-pos-conflict.test.ts`, `offline-serial-identity.test.ts`                                                    | VERIFIED_COMPLETE                                              |
| SC-14 | Two devices, one resource slot                   | `resource-capacity-race.test.ts`, `resource-capacity-01.pg.test.ts`, `appointment-conflict-sql.test.ts`                                                                             | VERIFIED_COMPLETE                                              |
| SC-15 | Period lock online + offline                     | `branch-period-lock-device.test.ts`, `period-lock-parity.test.ts`, `accounting-ledger-rules.test.ts`, `package-grant-outbox.test.ts`                                                | VERIFIED_COMPLETE                                              |
| SC-16 | Cursor / rehydration / outbox survival           | `sync-pull.test.ts`, `sync-scenarios.test.ts` H, `sync-cursor-concurrency.pg.test.ts`, `sync-invariants.test.ts`, `sync-chaos.test.ts`                                              | VERIFIED_COMPLETE                                              |
| SC-17 | Pull tenant isolation (server)                   | `sync-operational-pull.test.ts` (fake DB), `sync-security.test.ts`; real-PG proof for the four operational entities implemented in SC-04 (local run BLOCKED, CI pending)            | IMPLEMENTED_AND_TESTED (server side); real-PG layer pending CI |
| SC-18 | Revoked capability after offline mutation        | `sync-scenarios.test.ts:518-543`, `authorization-scope-applied.test.ts`                                                                                                             | VERIFIED_COMPLETE                                              |
| SC-19 | Missing endpoint → permanent visible refusal     | `sync-scenarios.test.ts:659-668`                                                                                                                                                    | VERIFIED_COMPLETE                                              |
| SC-20 | Package GRANT travels with the invoice           | `sync-scenarios.test.ts:615-633`, `invoice-write-grant-atomic.test.ts`, `package-invoice-grant.test.ts`, `offline-package-grant.test.ts`, `package-deferred-revenue-device.test.ts` | VERIFIED_COMPLETE                                              |
| SC-21 | One financial writer / subledger invariants      | `one-financial-engine.test.ts`, `m6-subledger-invariants.test.ts`, `m6-cross-domain-invariants.test.ts`, `financial-ledger-integrity.test.ts`, `reversal-ledger.test.ts`            | VERIFIED_COMPLETE                                              |
| SC-22 | Concurrent last credit, two devices (server)     | `package-credit-concurrency.pg.test.ts`, `m5-real-postgres.pg.test.ts`, `service-delivery-02.pg.test.ts` race scenario                                                              | VERIFIED_COMPLETE                                              |
| SC-23 | Device restart with pending outbox               | `order-deposit-restart.test.ts`, `order-deposit-backup-restore.test.ts`, `offline-invoice-outbox.test.ts`, `reopenTestDb` helper                                                    | VERIFIED_COMPLETE                                              |
| SC-24 | Purchase receipt → stock → costing → value       | `offline-procurement-match.test.ts`, `purchase-receive-once.test.ts`, `inventory-avco-01.pg.test.ts`, `costing.test.ts`, `valuation-consistency.test.ts`                            | VERIFIED_COMPLETE                                              |
| SC-25 | Variant sale → identity → stock → costing        | `offline-variant-identity.test.ts`, `invoice-variant-binding.test.ts`, `invoice-variant-availability.test.ts`, `product-list.test.ts`                                               | VERIFIED_COMPLETE                                              |

Not re-proven by this mission (out of the actionable gap set, evidence above is the
existing canonical coverage): payroll/attendance cross-core (E), manufacturing
consumption, FX trade drafts, courier POD/COD server side. Their device→server seams
that pass through `pushEntry` are covered by SC-07's additions where a road exists.

---

## C. Execution record (this session, base HEAD `d8dfdea3`)

New tests added: **42** (24 sync push roads + 4 populated pull + 9 payment parity + 5 PG roundtrip).
Production code changed: **none** — the gaps were missing coverage, not product defects.
Test-infra defect fixed: `operational-pull-02.pg.test.ts` and `service-delivery-02.pg.test.ts`
omitted `await pg.initialise()`, which the pinned `embedded-postgres@17.10.0-beta.17`
requires (`start()` does not auto-initialise). Both now call it, matching the other ~80 pg
suites. Without it they fail at `postgresql.conf` even in CI.

Commands actually run, and their real results:

| Command (from)                                                                                                  | Result                                                           |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `npx jest --testPathPattern "features/sync"` (apps/desktop)                                                     | 11 suites, **116 passed**                                        |
| `npx vitest run --project unit payments sync service-delivery package-credit parity` (backend)                  | 25 files, **339 passed**                                         |
| `npx vitest run` (packages/local-engine, full)                                                                  | 105 files, **666 passed**                                        |
| `npx tsc --noEmit` (backend)                                                                                    | **0 errors**                                                     |
| `npx tsc --noEmit` (packages/app-shell)                                                                         | **0 errors**                                                     |
| `npx eslint <4 changed backend files>` (backend)                                                                | **0 errors** (1 pre-existing unused-var warning, untouched line) |
| `npx eslint <2 changed app-shell files>` (packages/app-shell)                                                   | **0 errors**                                                     |
| `git diff --check` (changed files)                                                                              | clean                                                            |
| `npx vitest run --project pg service-delivery-sync-roundtrip service-delivery-02 operational-pull-02` (backend) | **BLOCKED locally** — see below                                  |

### PG local execution — `BLOCKED` (environment, not a code failure)

`initdb` succeeds in `.pgtest/`, but `postgres.exe` exits with
`FATAL: could not create shared memory segment: error code 1314`
(`CreateFileMapping … Global/PostgreSQL:…`). The logon token is a filtered
Administrators token ("deny only", Medium integrity); PostgreSQL restricts its own
token on Windows and drops `SeCreateGlobalPrivilege`, even though the parent token
holds it (a 144 MB global mapping succeeds from PowerShell, fails from postgres).
This is the exact failure `helpers/pg-binaries.ts` documents. It cannot be repaired
here without a security-policy change (grant the privilege + sign out/in), which the
repository rules and this mission forbid. On Windows only `shared_memory_type=windows`
exists, so the named Global mapping is unavoidable.

Status: the three PG suites are **IMPLEMENTED** and run in CI (which holds the
privilege). Locally they are **BLOCKED**, never counted as PASS. The loud guard reports
"postgres did not start — run in CI"; `service-delivery-02`'s scenarios early-return
(skipped). No BLOCKED/NOT_RUN result was converted to PASS.

### Remaining items (lower risk, recorded — not silently dropped)

- The five read-only pull entities (`cost_layer`, `stock_batches`, `stock_serials`,
  `inventory_settings`, `account`) still use empty snapshot fixtures. They are
  pull-only reference data (no device financial mutation), Medium/Low risk. The four
  operational entities that move credit/session/variant/ticket (the F-002 set) are now
  covered populated.
- `payment-cancel-reversal.test.ts` remains a static source-order guard; its behaviour
  is now additionally proved by the parity suite (reverse-before-cancel, fail-closed).
- Device→server round trips for stock/returns/transfers rely on the canonical
  local-engine + backend suites (666 + 339 green this session); a single combined
  device-outbox→server→pull harness for those domains is a future consolidation, not a
  missing invariant.

---

## D. Phase-7 re-audit (after implementation, same session)

Re-opened every `pushEntry` road in `sync-engine.ts` and grepped the canonical suites
for a SUCCESS-path assertion per road. Result — no actionable critical/high gap remains
in the audited scope:

| Road                                                                       | Success-path assertion now exists at                                          |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| session deliver / cancel / status (in_progress, no_show, checked_in)       | `sync-scenarios.test.ts:730,747,763`                                          |
| lost-ack retry reuses Idempotency-Key, no duplicate consumption            | `sync-scenarios.test.ts:818`                                                  |
| package credit CONSUME / REVERSAL / EXPIRE / ADJUSTMENT                    | `sync-scenarios.test.ts:832-835`                                              |
| courier close (delivered/failed) / assign / create                         | `sync-scenarios.test.ts:909-934`                                              |
| resource booking create                                                    | `sync-scenarios.test.ts:945`                                                  |
| serial issue                                                               | `sync-scenarios.test.ts:951`                                                  |
| journal reverse                                                            | `sync-scenarios.test.ts:957`                                                  |
| price-list items / active                                                  | `sync-scenarios.test.ts:966,973`                                              |
| promotion active                                                           | `sync-scenarios.test.ts:980`                                                  |
| payment delete→cancel (+404 replay tolerance)                              | `sync-scenarios.test.ts:987`                                                  |
| populated operational pull (sessions, credits, variants, tickets)          | `sync-pull.test.ts` SC-03 suite (17/17 green)                                 |
| device↔server payment parity (9 scenarios incl. replay/cancel/period-lock) | `payment-device-server-parity.test.ts` (9/9 green)                            |
| real PG deliver→change-log→pull roundtrip + tenant isolation               | `service-delivery-sync-roundtrip.pg.test.ts` (implemented; local BLOCKED, CI) |

No new unmapped sync entity, untested route, or static-only critical guard was exposed
by the re-audit. The only open execution item is the local Windows PG privilege block
(section C), which is an environment blocker, not a coverage gap.

Final verdict: **IMPLEMENTED_AND_TESTED** for all locally runnable scope;
**IMPLEMENTED_NOT_LIVE_VERIFIED** for the three PG suites (CI execution pending).
