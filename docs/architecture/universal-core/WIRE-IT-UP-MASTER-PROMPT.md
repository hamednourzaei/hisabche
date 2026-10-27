# Hisabche — Wire Up the Universal Core (last gap first, every link of the chain)

## Why this prompt exists

The previous round wrote the **calculation layer only**: 12 pure rule files in `packages/validation/src/schemas/universal-core/`, one migration (`docs/universal-core-migration.sql`, 9 tables) and its VERIFY query, plus documents. Measured on the repository, not taken from the agent's report:

- all 12 rule files have **zero consumers** outside tests — no backend service or route, no local-engine route, no `packages/api` hook, no `packages/ui` or `app-shell` screen;
- `SCHEMA_VERSION` is still 8 and `local-schema.ts` has none of the new tables;
- no `*.pg.test.ts` runs the migration; no server-vs-engine parity test exists;
- `credit_limit_mode` appears in no backend, api, ui or app-shell file;
- seven capabilities were flipped `planned` → `available` (3 → 10) **with nothing running them**, so profiles now advertise what no screen can do;
- full `ui` and `backend` vitest were not run; no build was made (newest APK is from 25 Oct); the Windows app was never driven.

That is `a rule nobody calls` (CLAUDE.md §7.1). **A capability is real only when a user can reach it.** Nothing from that round counts as done except the pure rules and the SQL file, and even those must be re-checked.

Read first: `docs/architecture/universal-core/CLOSE-ALL-GAPS-PROMPT.md` (the specification and decisions — still authoritative), `UNIVERSAL-CORE-GAP-ANALYSIS.md`, `INDUSTRY-COVERAGE-TABLE.md`, `docs/universal-core-migration.sql`, `docs/PRODUCTION-RELEASE-CHECKLIST-universal-core.md`. This file changes **order and proof**, not the decisions.

## 0. Rules (unchanged, restated because they were broken)

- No commit, no push, no subagents. No live DDL; migrations are files, run twice by a `*.pg.test.ts`, then `PENDING HUMAN CONFIRMATION`.
- Reuse the existing domain files — do not rewrite them. Audit each against its spec vector; fix only what is wrong, and say what.
- One calculation path in `packages/validation`, imported by the backend **and** the local engine. No second copy.
- Money is integer minor units; unknown cost is `null`; `workspace_id` on every row; additive only; **no backfill**; no `any`/`@ts-ignore`/`eslint-disable`; no dead code.
- Machine traps: `TEMP`/`TMP` → `.pgtest/tmp`; backend tsc with `NODE_OPTIONS=--max-old-space-size=6144`; suites **sequentially**; no pip-made `.exe`. Preserve the approved uncommitted work already in the tree; read a diff before touching a file.
- Honest labels only. A gap whose chain is not complete is **not** `VERIFIED_COMPLETE`.

## 1. Step zero — undo the false claims (before any new code)

1. Set every capability in `business-capabilities.ts` back to `planned` that has no runtime consumer today. The only ones allowed to stay `available` are the three that were available before the previous round (`measurement`, `weight_pricing`, `multi_unit`) — verify with `git diff`.
2. Remove from `industry-profiles.ts` any capability grant that depended on those flips.
3. Regenerate: `node scripts/industry/generate-coverage-table.mjs` and `generate-industry-diff.mjs`; both `--check` green. In `scripts/industry/coverage-data.mjs` restore each row the previous round upgraded to what is actually true (most go back to `UNSUPPORTED`/`PARTIALLY_SUPPORTED`).
4. Add a guard test (new file, e.g. `packages/validation/src/__tests__/capability-has-consumer.test.ts`): every `available` capability must name at least one consumer path outside `packages/validation` that exists on disk **and** a server-vs-engine parity test. Inject-test it: flip one capability and watch it go red.
5. Run `packages/validation` vitest; record real counts.

A capability may only be flipped back to `available` **inside the gap step that finishes its chain** (§3, step "flip").

## 2. Order: from the last gap to the first

Work in this order. Finish one gap **completely** (§3) before starting the next. Do not touch the next gap while the current one has an open link.

`G-17 → G-16 → G-15 → G-14 → G-13 → G-12 → G-11 → G-10 → G-09 → G-08 → G-07 → G-06 → G-05 → G-04`

Where a gap depends on a lower-numbered one (`G-11` warranty needs serials from `G-10`; `G-07` roll needs batches; `G-09` registry flip needs offline status of batches/serials; `G-05` variants feed several), implement **only the minimal dependency** inside the current step and mark the rest of the dependency as owned by its own step. Never skip a gap because it is "later in the order".

Group sizing: the seven trade extensions inside G-14/G-17 (freight, passenger, courier, delivery notes, appointments, agriculture, made-to-order/deposit) are each their own sub-step with their own proof — not one bundle.

## 3. The chain every gap must complete — in this order, with proof at each link

For gap _X_ (use the decisions table and numeric vectors in `CLOSE-ALL-GAPS-PROMPT.md` §1 and §3):

1. **Audit the rule.** Read `universal-core/<x>.domain.ts` and its tests against the spec vector. Fix defects; add missing golden vectors in `packages/validation/src/__golden__/` (import by direct module path, not the barrel).
2. **Migration.** Verify the SQL for _X_ in `docs/universal-core-migration.sql`: additive, idempotent, rollback block, `workspace_id`, RLS, `REVOKE ALL … FROM service_role` before grants, no FK guessing (check `pg_constraint`), `IS NOT NULL` in CHECKs. Write/extend `backend/src/__tests__/universal-core-<x>.pg.test.ts` that applies it **twice**, asserts constraints and RLS, and proves pre-existing rows are untouched. Try every environment fix (TEMP/TMP, plain data dir, kill stale `postgres`/`initdb`, non-elevated shell); record each attempt. A skipped pg test is **not** a pass.
3. **Server.** Service + route + zod schema + **the manual body mapping** (a field not named there is dropped silently) + `requireWorkspaceContext` + capability check + idempotency key + audit + cache invalidation (`invalidateMoneyCaches`) + `concurrency-safety-map.ts` entry for any write route. The service calls the shared rule — it must not re-implement it. HTTP tests with `fastify.inject`: happy path, validation refusal, **two-workspace isolation**, role refusal, idempotent retry, reversal where money/stock moves.
4. **Local engine.** Route + SQLite tables + `SCHEMA_VERSION` bump to **9** (one bump for the whole job; later gaps extend v9, it is unreleased) + an upgrade test on a **copy of a real device DB** (v8 → v9, run twice, prior data intact). Engine calls the same shared rule. If _X_ is online-only by nature, add an `online_required` row to `offline-endpoint-matrix.ts` and show `<CloudRequiredNotice />` — and say why. Anything done at a till is offline.
5. **Parity.** One test runs the same vector through the server path and the engine and compares to the spec number (e.g. 2 cartons × 24 = 48; 15 g × 33,000,000 = 495,000,000; 50 m roll, sell 12.5 → 37.5, sell 40 → `ROLL_INSUFFICIENT`; return 2 of 5 at original layer cost; credit 1,000/800/+300; serial S1 sold twice refused online **and** offline).
6. **API hooks** in `packages/api` (React Query, `asList`, status + data preserved on errors, invalidation under existing key families, offline gate via the matrix).
7. **UI** in `packages/ui`: reuse `DataTable`, `SelectField`, `PageHub`/`HubTabs`, `SegmentedControl`, existing modals; a new tab/section of an existing hub, **not** a new route unless unavoidable; web **and** `app-shell` (+ `DESKTOP_ROUTES`, navigation, `robots` if a new route). Tokens only, RTL logical classes. i18n in `fa`, `af`, `en` (+ `DARI-GLOSSARY.md`; `translateOr` where `t.has` is missing).
8. **Consumer proof.** `grep` shows the rule has a caller in backend **and** engine **and** UI; `node scripts/audit-unwired-routes.mjs` has no write route without a caller; `unwired-capability.test.ts` green.
9. **Flip.** Only now set the capability `available` in the registry with its evidence paths + test, update `coverage-data.mjs` (status, anchors, tests), regenerate both generators, `--check` green. The guard from step zero must stay green.
10. **Gap verdict.** Record in `docs/architecture/MASTER-EXECUTION-LOG.md` a row for _X_: files, commands, real pass/fail/skip counts, and one of `VERIFIED_COMPLETE` · `IMPLEMENTED_NOT_LIVE_VERIFIED` (name the exact thing not run) · `BLOCKED_EXTERNAL_CREDENTIAL` (live Supabase SQL or a physical device only).

Skipping any link makes the gap `NOT_COMPLETE` — it does not get a flip and is listed as open.

## 4. Whole-job verification (after the last gap, sequential, real counts)

1. `packages/validation`, `packages/local-engine`, `packages/api`, `packages/app-bridge`, `packages/formatting` — tsc + vitest, full.
2. `packages/ui` — tsc + vitest **full** (isolate timeouts by running the file alone; fix real reds).
3. `backend` — tsc + vitest **full**; report the `|pg|` files separately: executed / skipped with the exact error.
4. `apps/desktop`, `apps/mobile`, `apps/web`, `apps/admin` — tsc + jest where they exist.
5. `eslint` on every changed file from its package directory.
6. Guards: offline-matrix, route-parity, no-hardcoded-currency, import-cycles, `no-eq-null-filter`, registry parity, both generators `--check`, the new capability-consumer guard. Inject-test each new guard.
7. `node scripts/build-ai-index.mjs`.

## 5. Builds and the real app (only if §4 is green)

Web build; Windows (`electron-builder --win -c.electronDist=node_modules/electron/dist`); Android (`pnpm run android:release`, judge by APK timestamp). Then open the real Windows app and drive, **offline**: a gram-priced sale (495,000,000); a carton→piece sale (48 pieces); a partial-roll sale and a refused oversell; a serial sale then its refused re-sale; a sale return of 2 of 5; an over-credit warning; a size × colour variant sale; a made-to-order sale creating a work order. Screenshots and logs only for what actually happened; anything not driven is `IMPLEMENTED_NOT_LIVE_VERIFIED` with the reason.

## 6. Hand-over

Update `docs/PRODUCTION-RELEASE-CHECKLIST-universal-core.md`: ordered migrations with each VERIFY and expected result; deploy order **database → backend → clients**; rollback per migration; default `credit_limit_mode = warn`; what a device does on first launch after the v9 bump; old-client/new-backend and new-client/old-backend compatibility; every new header in `allowedHeaders`; "no backfill performed". Lessons into `.claude/lessons-learned.md` (next number) and `CLAUDE.md`. `git status` summary. **Nothing committed or pushed.**

## 7. Completion gate — all true before the final report

- [ ] Step zero done; guard test exists and is inject-tested.
- [ ] Every gap G-04…G-17 has a log row; each is `VERIFIED_COMPLETE`, or the exact external block.
- [ ] Every capability marked `available` has a consumer in backend + engine + UI and a parity test; none is flipped without one.
- [ ] Migrations written, VERIFY written, double-run tests executed (or each environment failure recorded) — none run live.
- [ ] §4 suites ran to completion with counts; §5 builds exist with fresh timestamps; the offline Windows scenarios were driven or honestly labelled.
- [ ] Coverage table, support matrix and gap analysis match reality; both generators `--check` green.
- [ ] Release checklist, lessons and CLAUDE.md updated; nothing committed.

## 8. Final report (Persian)

One row per gap in the order worked (G-17 … G-04): وضعیت · زنجیره (قاعده / مهاجرت / سرور / موتور / parity / هوک / UI / consumer) هر کدام ✔ یا ✘ با دلیل · تست‌ها با عدد واقعی · باقی‌مانده. Then suite totals, build paths + times, live evidence, ordered release steps. The "باقی‌مانده" column is empty only if it truly is — never by omission, relabelling or deleting a failing test.

Start with step zero (§1), then G-17.
