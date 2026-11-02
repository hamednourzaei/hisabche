# PROMPT FOR ANOTHER AGENT — CONTINUE M5 (resume after the entry gate)

> Written 2 Nov 2026. The first M5 attempt stopped correctly at a red gate and left only the decisions document
> (`M5-DECISIONS.md`, same folder). This prompt is the **resume** instruction: what to re-measure, what is allowed while
> something is still red, how to run PostgreSQL logic proofs on this machine, and the order of work once the gate is green.
> It adds to — and does not replace — `PROMPT-M5-REFUND-AND-ACCOUNTING-INTEGRITY.md` (rules) and `PROMPT-M5-COMPLETION.md` (per-answer build plan).

Repository: Hisabche monorepo (pnpm + Turbo, branch `main`). The working tree holds uncommitted work that belongs to the owner: never
`git add -A/-u`, `commit`, `push`, `reset`, `stash`, `checkout --`. Persian-speaking solo owner; code/comments/tests English; every
user string in `fa`, `af` (Dari), `en`. No subagents. Never read `.env`. No live DDL. Builds only when asked.

---

## 1. Re-measure the gate FIRST (commands, exit codes, in your report)

| #   | Gate                                                                                                                   | Command / evidence                                                                                                                                                                                                                                                    | Last seen                                                                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | Six backend failures closed                                                                                            | `cd backend && npx vitest run src/__tests__/invoice-return-once.test.ts src/__tests__/reverse-sales-return.test.ts src/__tests__/sync-pull-columns.test.ts`                                                                                                           | RED: 5 × `…eq(...).in is not a function` (the returns service calls `.in()`, the test's fake query builder has no `.in`), 1 × `offering_type` missing from the pull columns |
| G2  | Migrations ran twice each on a real test DB, human pasted the VERIFY row                                               | order: `docs/offering-type-01-migration.sql`, `package-credit-ledger-01-migration.sql`, `service-delivery-01-migration.sql`, `service-delivery-02-atomic-migration.sql`, `service-delivery-03-cancellation-reason-migration.sql`, each followed by its `VERIFY-*.sql` | NO human output exists                                                                                                                                                      |
| G3  | Real Postgres for `*.pg.test.ts`, or the owner wrote «PGlite logic proofs suffice; concurrency stays BLOCKED_EXTERNAL» | `cd backend && npx vitest run --project pg src/__tests__/service-delivery-02.pg.test.ts` must show tests **run**, not skipped                                                                                                                                         | RED: embedded `postgres.exe` ENOENT                                                                                                                                         |
| G4  | Owner answers on file                                                                                                  | the **Answer** column of `M5-DECISIONS.md`                                                                                                                                                                                                                            | EMPTY                                                                                                                                                                       |
| G5  | Service Delivery UI present                                                                                            | `packages/ui/src/components/ui/service-delivery/` + its tests                                                                                                                                                                                                         | GREEN                                                                                                                                                                       |

If any gate is red, you may do **only** what section 2 allows. Everything else in M5 is forbidden until the gate is green — including «harmless» M5.0 scripts that touch the schema.

## 2. What is allowed while the gate is red

1. **Record, don't answer.** If the owner (not you) has put answers anywhere in the conversation or the decisions file, copy them into the Answer column verbatim with the date. If nothing is answered, change nothing.
2. **Make the PostgreSQL logic proof runnable by anyone** (it was a scratch file that is not in the tree — a finding of the last attempt). It is now in the repository: `scripts/pg/run-scenarios.mjs`. PGlite and esbuild are **not** repo dependencies and you must not add them to a `package.json`; install them outside the repo:
   ```
   mkdir <scratch>/pglite && cd <scratch>/pglite && npm init -y && npm i @electric-sql/pglite esbuild
   ```
   then, from the repo root:
   ```
   PGLITE_DIR=<scratch>/pglite \
   SCENARIOS=backend/src/__tests__/helpers/service-delivery-02-scenarios.ts \
   SETUP=setupServiceDelivery \
   VERIFY="docs/VERIFY-service-delivery-02.sql docs/VERIFY-service-delivery-03.sql" \
   node scripts/pg/run-scenarios.mjs
   ```
   Expected today: `setup OK`, two VERIFY rows with every boolean `true` and every `legacy_*` = 0, `ALL 14 PASSED`, exit 0. Report that output as **PGlite logic evidence**. It proves the SQL rules by running them twice on a real Postgres engine; it does **not** prove lock contention between two connections (that is `*.pg.test.ts` on a working Postgres) and it does **not** replace the human running the migrations on the owner's database.
3. **Fix G1 only if the owner assigned it to you**, as its own slice, separate from M5: for the five returns tests, read what `backend/src/services/sales/invoice-return.service.ts` now queries and extend the **test double** to answer it (do not weaken an assertion, do not delete a test); for `sync-pull-columns.test.ts` do **not** add `offering_type` to the pull columns unless the owner confirms `offering-type-01` ran on that database — a pull selecting a column the live DB lacks answers 500 for everyone.
4. **Write nothing else.** No migration, no route, no UI, no ledger code, no refund/expiry/posting behaviour, not even behind a flag. `PACKAGE_REFUND_POLICY_NOT_DECIDED` (and its siblings in the decisions file) is the **only** thing the code may say about an undecided operation, and today nothing in the code says it because no such route exists — keep it that way.

## 3. When the gate is green — order of work

Follow `PROMPT-M5-COMPLETION.md` §3 exactly. In short:

1. **3.0 One balance rule** (decision-free; first): replace the inline `GRANT/ADJUSTMENT/REVERSAL − CONSUME/EXPIRE` sum in `package_credit_consume` and `service_delivery_deliver` with one SQL function, keep `derivePackageBalance` as the TypeScript reference, prove equality with golden vectors, add nothing else. New behaviour is forbidden in this slice; its proof is the 14 PGlite scenarios plus the existing domain/device tests unchanged.
2. **M5.0** read-only liability instrument (`null` where the unit value is unknown, never zero; no backfill) and **M5.1** fiscal-lock proofs both sides of the boundary, server and device.
3. Only then the rows of `PROMPT-M5-COMPLETION.md` §3.1–§3.4 whose decision is on file, one slice at a time, each ending in a status token and the commands that produced it.

Every SQL file you write: additive, idempotent, rollback block, separate `VERIFY-*.sql`, labelled `PENDING HUMAN CONFIRMATION`, **run twice** through `scripts/pg/run-scenarios.mjs` with a scenarios file next to the existing ones, plus a `*.pg.test.ts` for CI. A function whose signature changes needs the old signature dropped **and** the earlier migration guarded against re-creating it (see the guard in `service-delivery-02-atomic-migration.sql` and the scenario «re-running migration 02 AFTER 03»).

## 4. Facts that changed since the first M5 prompt (re-verify in code)

- A service-session cancellation **requires a reason** (`CANCELLATION_REASON_REQUIRED`) in the domain, the device route, the server route and `service_delivery_cancel(uuid, uuid, uuid, text)`; it is stored as `cancellation_reason` (PostgreSQL + SQLite schema v16). Cancelling asks for `invoice.create` on both sides (the device used to ask for `invoice.delete`).
- The ledger refuses a second CONSUME and a second REVERSAL per service session by unique index in both databases; the device ledger has no append-only trigger (the pull upserts it) — do not add one.
- The six backend failures are **not** caused by M4/M5 code.
- `docs/architecture/capability-matrix.csv` and the industry table are generated: after any route/registry/matrix change run `node scripts/generate-capability-matrix-csv.mjs` and `node scripts/industry/generate-coverage-table.mjs`.

## 5. Report (Persian, tables, real numbers)

Gate table with commands + exit codes; what you did under section 2 (and what you refused to do); PGlite output pasted verbatim; slices done with their token (`VERIFIED_COMPLETE` needs real HTTP/DB evidence · `IMPLEMENTED_NOT_LIVE_VERIFIED` · `PARTIALLY_IMPLEMENTED` · `BLOCKED_EXTERNAL` · `NEEDS_OWNER_DECISION` · `FAILED`); product-code changes separately from documents; test counts and exit codes; owner decisions still open; the next independent slice. Documents cite full repo paths and `node scripts/audit/verify-spec-references.mjs` stays at 0 unbacked.
