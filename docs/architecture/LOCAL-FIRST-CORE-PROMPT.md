# LOCAL-FIRST SHARED DOMAIN CORE — implementation prompt (v2, grounded in the repo)

> برای صاحب پروژه: این فایل را کامل به ایجنت بدهید. تفاوت با پیش‌نویس اول: (۱) روی وضع واقعی ریپو (۲۵ اکتبر ۲۰۲۶) بسته شده،
> نه حدس؛ (۲) هسته‌ی مشترک **از قبل وجود دارد** (`packages/validation` + `packages/local-engine`) و پکیج موازی نمی‌سازد؛
> (۳) با قوانین ثابت شما سازگار است (commit نه، subagent نه، migration را انسان اجرا می‌کند)؛ (۴) هر ادعا با اندازه‌گیری.
> بخش «VERIFY BY THE OWNER» آخر فایل همان چیزی است که من (Claude) در پایان با اجرای واقعی بررسی می‌کنم.

---

## 0. YOU ARE WORKING INSIDE AN EXISTING PRODUCT. READ THESE FIRST, IN THIS ORDER

1. `CLAUDE.md` (project rules — they override anything in this prompt that conflicts).
2. `.claude/skills/hisabche-session-rules/SKILL.md`, `.claude/lessons-learned.md` §226–§229, `.claude/DEBUG-PLAYBOOK.md`.
3. `docs/offline/01-CAPABILITY-MATRIX.md`, `docs/offline/entitlement/00-CONTRACT.md`.
4. `.ai/codebase/CODEBASE_MAP.md` (run `node scripts/build-ai-index.mjs` if stale). Query the code graph before wide greps:
   `C:/Users/hamed/AppData/Local/Programs/Python/Python313/Scripts/graphify.exe query "<symbol>"` (always the full path).

### Non-negotiable project rules (violating any one = the step is rejected)

- **Do NOT `git commit`, `git push`, or create branches/PRs.** The owner commits. (This overrides any "commit per step" habit.) Keep a running `docs/architecture/PROGRESS.md` log instead.
- **Do not spawn sub-agents.** Do the work yourself, in this session.
- **No build (Windows/Android/Next) until ALL steps are done**, and only when the owner asks. Verification = per-package `tsc --noEmit`, `vitest`/`jest`, `eslint` on changed files (run from each package's own directory).
- **No DDL/migration is ever executed against the live Supabase database.** You write additive, idempotent `docs/<name>-migration.sql` files (with a Rollback/Mitigation block) plus a separate `docs/VERIFY-<name>.sql`, and a `*.pg.test.ts` that runs the migration twice on embedded Postgres. Report: `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`. Never write "Post-migration Audit: PASS".
- supabase-js has no transactions: any multi-table write is a Postgres function called with `.rpc()`. Compensating `DELETE` is forbidden.
- Guardrails G1–G4: no UI theatre / fake data, **no parallel architecture**, no destructive migration, no undefined policy. No `any`, `@ts-ignore`, `eslint-disable`, dead code, unused imports.
- Money is integer **minor** units end to end (see §1.4 — the repo currently mixes units; resolving that is ADR-001 and it blocks everything else).
- Every new i18n key exists in `fa`, `af`, `en`. Dari digits = Latin; Persian digits = Persian (`resolveIntlLocale`).
- Reports/status words only from: `VERIFIED_COMPLETE` · `IMPLEMENTED_NOT_LIVE_VERIFIED` · `BLOCKED_EXTERNAL_CREDENTIAL` · `BLOCKED_BY_EXISTING_SYSTEM` · `NOT_APPLICABLE` · `FAILED`. Nothing is `VERIFIED_COMPLETE` without real HTTP or a real database.
- Pre-existing, unrelated red you must NOT "fix" by loosening anything and must report separately: `tsc` errors in `backend/src/services/inventory/warehouse-summary.domain.ts` (`category`) and `packages/ui/src/components/ui/landing/site-footer.tsx` (`t.has`).
- Never ask the owner a question. Decide, write a short ADR in `docs/architecture/adr/NNN-title.md`, list unknowns in `docs/architecture/OPEN-QUESTIONS.md`, continue.
- Final report is in **Persian**, with a table of REAL numbers (test counts, matrix counts, measured values).

## 1. GROUND TRUTH (verified on 25 Oct 2026 — re-verify each line with a command, correct this prompt in an ADR if the repo disagrees)

### 1.1 The shared core already exists — extend it, never fork it

- Pure rules live in **`packages/validation/src/schemas/*`** and are consumed by BOTH the backend and the offline engine. Examples already one-definition/two-readers: `buildInsights` (insight-rules.ts), `planPayrollOutcome` (payroll-rules.ts), `buildGeneralLedger`/`toBalanceSheet` (accounting.reports.ts), `buildProfitReport` (profit-report.domain.ts), `buildInstallmentPlan`, `planLateFeeAssessment`, `buildCustomerPriceList`, `buildAttendanceSheet`, `planBudgetSave`, `buildDeadStock`, `nestBranches`/`validateBranchPlacement`, `computeProductionCost`, `quotePrice`, `SEEDED_UNITS`, invoice grid math (`invoice-grid.ts`).
- The device engine is **`packages/local-engine`**: `Router` (first match wins — literals before `:id`), `routes/*.ts` (SQLite readers/writers only), local schema in `packages/app-bridge/src/local-schema.ts` (+ `local-migrations.ts`, `SCHEMA_VERSION = 7`), host adapters in `apps/desktop/electron` and `apps/mobile`.
- **Do NOT create `packages/domain/` or any second home for business rules.** If the audit proves the pure code needs sub-structure, move files _inside_ `packages/validation` (e.g. `schemas/domain/{invoice,inventory,payments,accounting,payroll}/`), keep the public barrel stable, and delete the old paths in the same change. Two homes = rejected.
- The backend files that used to hold rules now re-export or import from validation. Any remaining rule in `backend/src/services/**` that is pure must move; backend keeps only I/O (Supabase reads/writes, caching, auth).

### 1.2 The capability matrix is the single execution authority

- `packages/validation/src/schemas/offline-endpoint-matrix.ts`: **462 client endpoints → one feature + one status** (`available` 159 · `online_required` 288 · `not_supported` 15 — recount with `grep -c`). Registry: `feature-registry.ts` (`execution: local|server|hybrid` is _intent_; the matrix is _reality_; `resolveEntitlement` consults both).
- Guards that must stay green and may only be tightened: `packages/api/src/__tests__/offline-matrix-guard.test.ts` (every client call has a row; scans `apiClient.<verb>` + `INDIRECT_ENDPOINTS`), `packages/local-engine/src/__tests__/offline-matrix-consistency.test.ts` (sends **every row to the real engine**: `available` ⇔ engine answers, everything else ⇒ 501), `packages/ui/src/__tests__/offline-entry-audit.test.ts` (every dashboard page has an offline entry mode; dead gates fail), `backend/src/__tests__/unwired-capability.test.ts`.
- UI never branches on `offline`. It asks `useActionAvailability` / `<OfflineGate>` / `PAGE_FEATURES`. `apiClient` refuses non-`available` endpoints before the engine (`onOfflineRefusal`).
- A row flips `online_required → available` in the SAME change that registers its local route and test. No stubs, no fake routes, no mock-as-implementation.

### 1.3 Sync/outbox already exists — audit it, do not rebuild it

- Find and read: `packages/app-shell/src/features/sync/sync-engine.ts`, `use-sync.ts`, `sync-page.tsx`; `packages/api/src/lib/offline-queue.ts`; `sync_queue` in `local-schema.ts` (owner-stamped outbox, `V4_OUTBOX_OWNER`); backend `/api/sync/*` (`sync/push`, `sync/cursor`, `sync/overview`, conflicts, binary `.hsb` format — `.claude/SESSION-CACHE-2026-09-27.md`); idempotency (`Idempotency-Key`, `mig-…`, `aip-…`); invoice numbers from DB `nextval`; `x-workspace-id` header; `invalidateMoneyCaches`.
- Phase 3 below = harden and complete this, not replace it. Any "new outbox" proposal must be an ADR proving the existing one cannot be extended.

### 1.4 Known hazards you MUST resolve with evidence before touching authority

1. **Money units are mixed.** `invoices.total` on the server is _major_-unit numeric; local `invoice.total` is `INTEGER`; `OpenInvoice.total` is major; the rule says minor-integer. Produce a table (every money column × server/local/wire/UI) and an ADR-001 that fixes ONE wire contract. Property tests in Phase 2 are meaningless until this is decided.
2. **Ledger posting is split**: backend `ledger.postDocument` (Postgres function `accounting_post_journal_entry`, balance enforced there) vs engine `routes/local-ledger.ts`. The posting _rule_ (accounts by role, amounts) must be ONE pure function; persistence stays two adapters. Balance (debits = credits) must be asserted in the pure function as well as in SQL.
3. **Costing/FIFO/avco** layers (`cost_layers`, `computeProductionCost`, `buildProfitReport`): "unknown is not zero" (`null`, never `0`) is a product law (`cost-unknown-is-not-zero.test.ts`).
4. **Floats / Intl / Date / Math.random inside rules** — grep `packages/validation/src` for `Date.now|new Date\(\)|Math.random|toLocale|Intl\.|parseFloat|toFixed` and list every hit with a decision (inject Clock/IdGenerator, or justify).
5. **Hermes (React Native) / Electron / Node parity** — `@noble/hashes` (ESM-only, now used by local-engine `checksum.ts`) already broke desktop+mobile jest until `transformIgnorePatterns` were fixed; prove nothing else in the core is runtime-specific.
6. **Entitlement/plan**: cloud plans (`FREE|ONLINE_500|ONLINE_1000|ONLINE_1500`) vs the `OFFLINE` licence plan. "Local-first authority" for a cloud-plan tenant must respect plan limits and be a per-tenant, per-capability decision (§5).
7. `workspace_id` is the only security boundary (CLAUDE.md §1). Local permission checks are UX only; the server re-authorises everything.

## 2. PHASE 0 — AUDIT (documents + generated artifacts, zero product-code changes)

Outputs (all under `docs/architecture/`):

- `AUDIT.md` — where every business rule lives (backend, web, desktop, mobile, engine): invoice math, discounts, tax, totals, stock movements, payments, postings, payroll, validation, permissions. For each duplicate or divergence: file paths, the observed behavioural difference, and a failing-or-passing characterization test that proves it.
- `capability-matrix.csv` — **generated by a script you commit to `scripts/`** (not hand-typed) from `OFFLINE_ENDPOINT_MATRIX` + `FEATURE_REGISTRY` + a route inventory of `backend/src/routes/*.ts` (+ `node scripts/audit-unwired-routes.mjs`). Must contain ALL 462 rows (not only the 288) with: `endpoint, feature, status, domain, server_reason (auth|payment-gateway|sms-email|subscription-billing|cross-device|cross-branch-aggregation|file-storage|large-report|other), can_run_locally (yes|partly|no), data_needed_locally, local_tables_exist (yes|no), conflict_risk (low|med|high), target_path (LOCAL_FIRST|HYBRID|SERVER_ONLY), wave, value, effort, risk, tests_required, evidence (file:line)`. A CI test (`capability-matrix-csv.test.ts`) regenerates it in memory and fails if the committed CSV is stale.
- `CORE-READINESS.md` — per domain (invoice, inventory, payments, accounting, payroll, validation): pure & portable? blockers (I/O, clock, randomness, Intl, floats, DB calls in logic) with file:line, and the exact change needed.
- ADR-001 (money units), ADR-002 (core location = `packages/validation`, rejected alternatives), ADR-003 (execution authority per plan), ADR-004 (Clock/IdGenerator injection).

Rule for the CSV: a capability is `SERVER_ONLY` when it truly needs the cloud (payment gateways, SMS/email, billing/subscription, OAuth consent, marketplace, cross-device coordination, cross-branch aggregation, file storage/CDN, AI providers). Everything else must justify why it is not local. "Not built yet" is an effort value, not a reason.

## 3. PHASE 1 — ONE CORE (behaviour-preserving)

1. **Ports & adapters inside the existing structure.** Define interfaces in `packages/validation` (e.g. `Clock`, `IdGenerator`, `UnitOfWork`, repository interfaces per aggregate). Rules receive plain data + injected ports; they import no `node:*`, no DOM, no framework, no Supabase, no SQLite. Adapters: SQLite (`packages/local-engine`, transaction-capable via the host `LocalDb`) and Postgres (`backend/src/services/**`, `.rpc()` for multi-table).
2. **Commands, facts, events.** A command handler takes `{ command, factsSnapshot }` (prices, tax rates, promotions, currency rates, rule version, period lock state, stock on hand it relied on) and returns `{ events, derived }`. Every event carries: `rulesVersion`, `coreVersion`, `deviceId`, per-device monotonic `seq`, `idempotencyKey`, `clientTimestamp`, `workspaceId`. Reuse existing idempotency-key conventions; do not invent a second one.
3. **Consolidate, then delete.** For each duplicate found in Phase 0: make one implementation, redirect all callers, delete the others in the same change (no shims left unused — dead re-export files are rejected; tests import from `@hisabche/validation`).
4. **Enforce boundaries mechanically.** Add `dependency-cruiser` (or eslint-plugin-boundaries) rules: `apps/*`, `packages/ui`, `packages/app-shell`, `packages/api` hooks and `packages/local-engine/routes` may not contain money arithmetic or business rules; `packages/validation` may not import from any of them. Add a CI test that greps for arithmetic on money-typed identifiers outside the core and fails with the file:line. Existing guards to keep: `no-self-barrel-import`, `no-service-import-cycles`, `no-hardcoded-currency` (fix by using `CURRENCY_CODES`, never by adding a `NOT_YET` row).
5. **Numbers.** One rounding policy in one module; integer minor units on the wire (per ADR-001); no `Intl`/locale inside rules; display formatting stays in `@hisabche/formatting` (Persian digits for `fa`, Latin for `af`/`en`).
6. Gate: all existing suites green before and after (record counts): validation, formatting, api, local-engine, app-bridge, ui, app-shell, backend (run suites **sequentially** — parallel runs make embedded-postgres suites time out), desktop jest, mobile jest.

## 4. PHASE 2 — PROOF OF EQUIVALENCE

- **Golden vectors**: one JSON corpus in `packages/validation/src/__golden__/` (inputs + expected outputs; nasty rounding, discounts, tax, multi-currency with `exchangeRate`, partial payments, returns/reversals, FIFO/avco, stock edge cases, closed periods, unknown cost = `null`). Executed on: Node (vitest), Electron main (desktop jest), React Native (mobile jest; plus an emulator smoke run recorded in the report), and the backend. Results compared **byte-for-byte** (canonical JSON). Any difference fails.
- **Property tests (fast-check)**: invoice total = lines − discounts + tax; payments never exceed receivable (per currency); on-hand = sum of movements; every posting balances; replaying the same events twice yields identical state; sync merge is commutative/idempotent for the movement ledger.
- **Shadow mode** — implemented as a _test/diagnostic harness and an opt-in server flag_, never as silent production authority: for each capability the server re-computes with the shared core on commands it already receives and writes any mismatch (full input + both outputs, tenant-scoped, no secrets) to a `core_divergence` table (additive migration in `docs/`, human-executed). Rollout of authority requires **zero divergence over a stated volume** (state the number in the ADR before you collect data).

## 5. PHASE 3 — SYNC & INTEGRITY (harden the existing pipeline)

- **Outbox**: idempotent delivery, retry with exponential backoff + jitter, batching, strict per-device ordering, dead-letter queue visible in `/sync-center` and to support. Reuse `sync_queue`; extend columns via a versioned local migration (`SCHEMA_VERSION` bump + `local-migrations.ts` step that uses the SAME statement list as a fresh install).
- **Server never trusts client results.** `POST /api/sync/push` (and every authoritative write route) re-runs the shared core on `{command, factsSnapshot}`; accepts only matching derived values; otherwise **reject or quarantine with a machine-readable reason** (`CORE_MISMATCH`, `RULES_VERSION_UNSUPPORTED`, `PERIOD_CLOSED`, `PLAN_LIMIT`, …). Authorisation, subscription limits, device trust, tenant isolation stay server-side (`requireWorkspaceContext`, `requireCapability`, `has_access`).
- **Conflict policy per entity — documented in an ADR and covered by tests**: posted invoices immutable (reversal/credit note, never edit); inventory = movement ledger (never overwrite quantities) with a configurable negative-stock policy and a reconciliation flag; **document numbers**: per-device pre-allocated blocks (server-issued, collision-free, reclaimable) so offline devices never collide — the server `nextval` remains the source for online issuance; offline entries into a closed accounting period: defined rule (reject **or** post into the current period with a visible flag — pick one per ADR); clock skew: hybrid logical clock + server receive time; tombstones for deletions.
- **Pull side**: change feed with cursors, initial snapshot, per-device partial scoping, local schema migrations with versioning **and a tested rollback path**, rules-version negotiation (server keeps interpreting events stamped with an older `rulesVersion`).
- **Security**: encrypted local database (SQLCipher or OS-keystore-backed key — Electron `safeStorage` vault already pinned in `apps/desktop/electron/main/services/secure-store.ts`; mobile keystore), offline token + grace-period policy (existing licence re-check `checkStoredLicence`), device registration/revocation/remote-wipe path, audit trail of every posted event. **A reinstall/update must never log the user out** (existing guards: `secure-store-survives-update.test.ts`, `installer-keeps-the-sign-in.test.ts` — keep them green).
- **Chaos tests (automated)**: network drops mid-sync, duplicate delivery, reordered batches, device clock skew ±1 day, two devices selling the last unit, week-long offline, app killed mid-write, server restart mid-batch, migration interrupted. Each asserts the invariants of §4.

## 6. PHASE 4 — STAGED MIGRATION BY WAVES (per capability)

Order waves by value × safety from the CSV; suggested start: pure read models / reports (no write conflict) → single-writer documents → shared-ledger writes (payments, stock) → payroll/HR. For EACH capability:

1. per-tenant feature flag (reuse the registry/entitlement layer, not a new flag system);
2. shadow run (§4) → zero divergence;
3. local-first authority for devices that run the engine; **web and any device without a local engine keep the server adapter of the same core** (document, don't build, a future browser engine);
4. monitored rollout with an instant kill switch back to the server path and a documented, tested rollback;
5. flip the matrix row to `available` + route + guard test in the same change.
   Keep truly cloud-dependent capabilities on the server and label cloud-only reports "data as of last sync". The 15 `not_supported` rows are re-audited once: a real product flow becomes `online_required`, never left `not_supported` to turn a test green.
   "Reduce backend load" is the **goal, not a claim**: online-connected clients may compute locally only where the ADR for that capability says the server re-verification is cheaper than the original server computation (it often is not — measure first).

## 7. PHASE 5 — MEASUREMENT (no guesses)

Baseline BEFORE the first authority flip, then repeat AFTER, on realistic shop-day scenarios (k6 or equivalent; seeded data; same hardware): requests per user-hour; backend CPU-ms and memory per operation; DB queries and rows per operation; p50/p95/p99 latency; UI response time offline vs online; sync batch size & payload bytes; mobile CPU/battery proxy; error/rejection rates. Add dashboards/alerts: sync lag, outbox depth, rejection rate, divergence rate, dead-letter count, per-version adoption. `docs/architecture/MEASUREMENTS.md`: methodology, raw numbers, environment, and ONLY the conclusions the numbers support (including "no improvement" or "worse").

## 8. DEFINITION OF DONE (every line proven by a command, output pasted in the report)

1. `capability-matrix.csv` covers all 462 rows; every one of the 288 has a justified target path; none is localized without its tests + shadow check.
2. Exactly one implementation of every business rule; the boundary rules and the "no money arithmetic outside the core" CI check pass; no second core package exists.
3. Golden-vector (Node/Electron/RN/server byte-identical), property-based and chaos tests green; shadow divergence zero for every migrated capability (volumes stated).
4. Server re-verification, idempotency, conflict policies, numbering blocks, closed-period rule, rules-version negotiation implemented and tested.
5. Feature flags, kill switch, rollback verified; local DB encrypted; local migrations (up and rollback) tested; sign-in survives update/reinstall.
6. `MEASUREMENTS.md` with real before/after; ADRs, `ARCHITECTURE.md`, runbook, updated matrix in the repo; lessons appended to `.claude/lessons-learned.md` and a short pointer in `CLAUDE.md`; Graphify + `build-ai-index` refreshed.
7. Per-package results pasted: `tsc`, test counts, `eslint` on changed files (0 errors). Report each pre-existing red separately.
   Do not stop until each item passes or is documented as `BLOCKED_*` with the reason.

---

## VERIFY BY THE OWNER (what Claude runs at the end — pre-run these yourself)

```bash
# counts and guards
grep -c "'available'\]"       packages/validation/src/schemas/offline-endpoint-matrix.ts
grep -c "'online_required'\]" packages/validation/src/schemas/offline-endpoint-matrix.ts
cd packages/validation  && npx tsc --noEmit && npx vitest run
cd packages/formatting  && npx vitest run
cd packages/api         && npx tsc --noEmit && npx vitest run
cd packages/local-engine&& npx tsc --noEmit && npx vitest run
cd packages/app-bridge  && npx vitest run
cd packages/ui          && npx tsc --noEmit && npx vitest run
cd backend              && npx tsc --noEmit && npx vitest run      # sequential, ~9 min
cd apps/desktop         && npx tsc --noEmit && npx jest
cd apps/mobile          && npx tsc --noEmit && npx jest
# one definition per rule (each must print exactly ONE definition site)
grep -rn "function buildInstallmentPlan\|function planPayrollOutcome\|function buildProfitReport\|function buildGeneralLedger" backend packages --include=*.ts | grep -v node_modules
# no second core
ls packages | grep -i domain      # must be empty
# no live DDL, no commits
git log -1 --format=%H            # unchanged from the start of the session
```

Reviewer's acceptance questions (answers must be in the report, with file:line evidence):

- Which ONE function holds each money rule, and who calls it (backend + engine)? Show the call sites.
- Show the money-unit table and ADR-001; show one invoice end-to-end (UI → core → SQLite → outbox → server re-verify → Postgres) with identical totals.
- Show a divergence row produced by a deliberately broken rule, proving shadow mode catches it; show the kill switch reverting authority.
- Show the chaos test list with pass results and the measured before/after numbers (or the explicit statement that a metric did not improve).
