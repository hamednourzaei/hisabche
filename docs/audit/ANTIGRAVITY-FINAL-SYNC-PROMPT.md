You are doing the LAST round before the owner pushes. Repository: C:\Users\hamed\Desktop\hisabche. An independent reviewer re-read your last output against the code. Most of it is accepted; one thing is not: the Postgres "scenarios A–H" prove nothing, yet `docs/product-intelligence/SYNC-INTEGRITY-REPORT.md` presents them as real-concurrency verification. This round fixes that honestly. No new research, no red-team, no features, no BOM code.

## 0. RULES (unchanged)

Read `CLAUDE.md` and `.claude/skills/hisabche-session-rules/SKILL.md`; `git status` first (dirty tree — never reset/clean/checkout others' changes). No commit, no push, no subagents, no `.env`/secrets, no live DB/DDL (migrations only as files in `docs/` with Rollback + VERIFY + a pg test that runs them twice; "PENDING HUMAN CONFIRMATION"). No `any`, `@ts-ignore`, `eslint-disable`, dead code; reuse existing code; `workspace_id` is the only tenant boundary. Status words only: `VERIFIED_COMPLETE` (real HTTP/DB run, seen by you), `IMPLEMENTED_NOT_LIVE_VERIFIED`, `BLOCKED_EXTERNAL`, `FAILED_VERIFICATION`, `NOT_COVERED`. `*.pg.test.ts` cannot start on this Windows account (error 1314): write them, keep them collected by `backend/vitest.config.mts` project `pg`, give the Linux command, never claim they ran. A test that writes the rows it later asserts on, or that never calls the code under test, is not evidence — do not write one. Never write "production ready", "real concurrency" or "verified" for anything that did not run.

## 1. ACCEPTED — do not touch

- `backend/src/services/sync.service.ts` update path (~`:575-630`): the version is now in the UPDATE's WHERE (`.eq('version', mutation.expectedVersion)` + `.select('version').maybeSingle()`), zero rows ⇒ re-read, `fileConflict`, `SyncError('version_conflict')`. Keep. Only verify (below, §3.4) that all 9 `ENTITY_TABLE` tables really have a `version` column.
- The pull commit-horizon (`sync_pull_changes`, no fallback), N-30 refusal, strict `syncPushRequestSchema`, stable device/batch ids.
- Client-side scenarios D, E, F, H in `packages/app-shell/src/features/sync/__tests__/sync-scenarios.test.ts` and D, E, F in `apps/mobile/src/__tests__/sync-scenarios.test.ts` (real `runSync`/runner with a fake transport) — keep, but label them honestly as "client logic with a fake transport", not as server integrity.
- The corrected red-team documents (GAP-04 `ALREADY_IMPLEMENTED`, GAP-09 `REAL_GAP_NEEDS_VALIDATION`, GAP-10 wire-or-delete decision, banner, two-tier launch gate) and `OFFLINE-BOM-PLAN.md` (gated).
  Reviewer checks that passed: `backend` tsc 0 errors; unit suite state as you reported.

## 2. THE DEFECT — `backend/src/__tests__/sync-scenarios.pg.test.ts` is tautological

Evidence (cite and fix, don't argue):

- It never imports or calls `SyncService`, `sync_pull_changes`' callers, the push path, or the version-guard. `grep -n "SyncService\|\.push(\|\.pull(" backend/src/__tests__/sync-scenarios.pg.test.ts` finds nothing.
- Scenario A (`:134-207`): the TEST inserts the `sync_mutations` row, performs the stock decrement, and INSERTs the `sync_conflicts` row itself, then asserts that the conflict row it inserted exists and stock is -1 (which it computed). Device A and B run one after the other, not concurrently. Nothing proves the service files a conflict.
- Scenario B (`:208-258`): five connections run `UPDATE … stock = stock - 5`, then every connection SELECTs the same table and the test asserts the snapshots are equal — connections to one database always agree. No device, no push, no pull, no convergence logic.
- Scenario G (`:376-418`): `sync_pull_changes` is called ONLY AFTER transaction A has committed, then asserts `length >= 2`. The in-flight moment — the whole point (N-36) — is never observed, and a naive pull would pass too.
- Scenarios C, D/E, F, H follow the same pattern (hand-written SQL, asserts on own writes).
- The report (`SYNC-INTEGRITY-REPORT.md`) and the file header claim "TWO OR MORE REAL DATABASE CONNECTIONS … proving the core invariants". That claim is false for what the file does.

## 3. FIX

### 3.1 Delete and rewrite `sync-scenarios.pg.test.ts` so it tests only what Postgres itself guarantees, using the REAL objects

Load the real migrations (copy the loader pattern of `sync-cursor-concurrency.pg.test.ts` and `inventory-avco-01.pg.test.ts`: `docs/sync-engine-migration.sql`, `docs/sync-commit-horizon-migration.sql`, plus the minimal base tables the repo's other pg tests already create). Never insert into `sync_change_log` by hand — write to the entity tables (`products`, `customers`, …) and let the REAL triggers (`sync_record_change()`, `sync_bump_version`) produce log rows. Each test uses ≥ 2 connections and is genuinely interleaved (use a `postgres.js` transaction held open by awaiting a promise you resolve later, never `setTimeout`):

1. **Version guard is atomic** — two connections run the exact statement the service issues, `UPDATE products SET … WHERE id=$1 AND workspace_id=$2 AND version=$3 RETURNING version`, started together with `Promise.all` inside open transactions: exactly ONE returns a row; the loser sees zero rows. (Copy the statement from `sync.service.ts` so the test and the code cannot drift; if you can, extract the statement text to a shared constant used by both.)
2. **Commit-horizon (N-36), observed during the in-flight moment** — A opens a transaction and writes (log row, id 100); B writes and COMMITS (id 101); while A is STILL OPEN call `sync_pull_changes(ws, cursor, limit)` and assert it returns NOTHING with `sync_version >= 100` (neither A's nor B's); then A commits; call again and assert the rows come back in `sync_version` order, both present. A second test: a rolled-back transaction and rows of another workspace create gaps; the cursor still reaches the head (no stall).
3. **Mutation idempotency at the DB** — two connections insert the same `(workspace_id, mutation_id)` into `sync_mutations` concurrently: exactly one insert wins (`ON CONFLICT DO NOTHING` returns zero rows for the other); the entity row changes once.
4. **Triggers** — updating an entity row bumps `version` once and writes exactly one log row with the right `operation`; deleting writes `delete` with `data` null; a workspace-B write never appears in `sync_pull_changes(ws_A, …)`.
5. **Tenant isolation at the DB function** — `sync_pull_changes(ws_B, 0, 100)` never returns A's rows.
   Name each test by the guarantee it checks. Remove the "Scenario A–H" labels from this file; the scenario names belong only to the table in §3.3.
   Injection test each of 1–2 by reasoning in the report and, where you can run a cheap check, by showing the assertion would fail if the guard were removed (e.g. test 1 against an `UPDATE` without `AND version = $3`; test 2 against a pull without the `txid < pg_snapshot_xmin(...)` predicate). State clearly that you could not execute them here.

### 3.2 Service-level behaviours go in the unit suite (fake supabase), not in pg

In `backend/src/__tests__/sync-invariants.test.ts` (existing fake: `backend/src/__tests__/helpers/fake-supabase.ts`) add or confirm — with real assertions on the service's return values: (a) a push whose version-guarded UPDATE matches zero rows files a conflict (`conflicts.record` called once with both versions) and returns `version_conflict` + the current row; (b) replaying the same `mutationId` returns the stored result and performs no second write; (c) a duplicated batch with the same `batchId`/`mutationId`s has exactly one effect; (d) delete through `/sync/push` is rejected and nothing is written; (e) a rejected mutation does not move the cursor or write a log row; (f) cross-workspace entity id is `forbidden`/not found. Do not build a Postgres-backed supabase shim; do not duplicate these in pg.

### 3.3 Honest scenario table

Rewrite `docs/product-intelligence/SYNC-INTEGRITY-REPORT.md` and `SYNC-INTEGRITY-MAP.md`: a table A–H × layer (DB guarantee test · service unit test · client logic test · NOT_COVERED) × file:test name × status. Be specific: scenario A (oversell on the last unit → conflict filed end to end) and B/C (multi-device convergence, aggregate edits) need service + database together; there is no harness for that, so they are `NOT_COVERED — needs an integration harness (PostgREST or a pg-backed client)`; state what part IS covered (version guard atomicity, conflict filing in the unit suite, client retry behaviour). D/E/F: DB (mutation idempotency) + unit + client. G: DB commit-horizon (3.1.2). H: client rehydrate test + `isBehindHorizon` unit test (add one if missing: cursor older than the oldest surviving log row ⇒ `mustRehydrate: true`, no changes returned). No row may say VERIFIED unless you saw the run. Remove "real concurrency" and any "proving" wording from the file header, the report and the final summary. State the owner's Linux command: `cd backend && npx vitest run --project pg src/__tests__/sync-scenarios.pg.test.ts src/__tests__/sync-cursor-concurrency.pg.test.ts src/__tests__/sync-conflicts-forward.pg.test.ts`.

### 3.4 One verification the previous round skipped

Confirm from `docs/*.sql` that every table in `ENTITY_TABLE` (`invoices, customers, products, transactions, time_entries, warehouses, branches, exchange_rates, warehouse_stock`) has a `version` column that `sync_bump_version` maintains (the new guard filters on it; a table without it would return a validation error for every versioned update). Put the table in the map with the file:line of each column. If any table lacks it, make the guard conditional on that entity and add a unit test; do not add a column (no DDL without the owner).

## 4. VERIFICATION (sequential, never parallel)

`cd backend && npx tsc --noEmit && npx vitest run --project unit`; `cd packages/app-shell && npx tsc --noEmit`; `cd packages/api && npx tsc --noEmit && npx vitest run`; `cd packages/local-engine && npx tsc --noEmit && npx vitest run`; `cd apps/mobile && npx tsc --noEmit && npx jest`; `cd apps/desktop && npx tsc --noEmit && npx jest` (the app-shell scenario test runs through desktop jest — confirm it is collected and report its test count); eslint on changed files from each package folder; `node scripts/build-ai-index.mjs`. Report real counts only.

## 5. FINAL REPORT

Update `docs/product-intelligence/SYNC-INTEGRITY-REPORT.md` and `docs/audit/UNIVERSAL-CORE-GAP-LEDGER.md` §F. In one place, for the owner before push: (1) the three migrations in order with their VERIFY files — `docs/universal-core-migration.sql`, `docs/invoice-return-01-migration.sql`, `docs/sync-commit-horizon-migration.sql` — all "PENDING HUMAN CONFIRMATION", backend deployed after them; (2) the Linux command above plus `invoice-return-01.pg.test.ts` — the whole `*.pg.test.ts` set (`cd backend && npx vitest run --project pg`) has never been executed and is the P0 gate; (3) the owner decision list (tax split policy N-37, cash refund vs customer credit, seller capabilities, offline-edition returns, wire-or-delete transfer service and scheduled reports, cheque validation questions, offline-BOM go/no-go after the pg run). Final line exactly `FINAL PRE-PUSH ROUND COMPLETE` only if §3.1–3.4 are done, the unit/client suites pass, and the report contains no claim stronger than what ran; otherwise `FINAL PRE-PUSH ROUND INCOMPLETE` + the failing item with file evidence. No commit, no push.
