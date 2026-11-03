# V53 — FINAL COMPLETION PROMPT (everything still open, in dependency order)

Paste this whole file to the implementing agent. It is self-contained. It replaces all earlier "remaining work" lists.

---

## 0. ROLE AND RULES (non-negotiable)

You are the sole engineer finishing V53 in the Hisabche monorepo (`C:\Users\hamed\Desktop\hisabche`). Do the work yourself; do not spawn sub-agents.

- Read first, in this order: `CLAUDE.md`, `.claude/skills/hisabche-session-rules/SKILL.md`, `docs/implementation/V53-OWNER-DECISIONS.md`, `docs/implementation/V53-IMPLEMENTATION-STATE.json`, `docs/implementation/V53-IMPLEMENTATION-PROGRESS.md` (Continuations 6, 6b, 6c, 7 are the newest), `.ai/codebase/CODEBASE_MAP.md`, and the graph in `graphify-out/` (query before grepping).
- Preserve the working tree. Never `git commit`, `push`, `reset`, `stash`, `checkout --`. Never `git add -u/-A`. Never edit an already-applied migration (`cycle-count-02` is applied by the owner).
- No production DDL, no `.env` reads, no deployment. Migrations are files + VERIFY + a `*.pg.test.ts` + a PGlite scenario file, applied by a human.
- Do not change Expo SDK 51 / React Native 0.74; no New Architecture; no Redis; no polling for sync; no generic LWW on financial state; no `any`, `@ts-ignore`, `eslint-disable`, dead code. Keep `exactOptionalPropertyTypes`.
- Money in integer minor units; precision from the currency table, never a hardcoded `/100`. Never infer a missing currency, account, rate, variant or branch.
- Every new UI string in `fa`, `af`, `en` (web: `packages/i18n/messages/*/common.json`; desktop/mobile shell: `packages/i18n/src/locales/{en,fa-IR,fa-AF}.json` AND the inline `packages/app-shell/src/shared/i18n/desktop-strings.ts`). Logical CSS only (RTL). Code and comments in English.
- Generated docs (`scripts/generate-capability-matrix-csv.mjs`, `scripts/industry/generate-coverage-table.mjs`, `scripts/industry/generate-industry-diff.mjs`) are regenerated RAW at the end, never through prettier; verify with `--check`.
- Write multi-line scripts with the Write tool and run them (`node file.mjs`); heredocs with quotes/backticks have broken in this shell. Run suites sequentially. A formatter rewrites files after save: Read before Edit.
- Statuses allowed in reports: `VERIFIED_COMPLETE · IMPLEMENTED_NOT_LIVE_VERIFIED · PARTIALLY_IMPLEMENTED · NOT_IMPLEMENTED · BLOCKED_EXTERNAL · NEEDS_OWNER_DECISION · FAILED`. Never higher than the evidence. PGlite = `PGLITE_VERIFIED`, never "real Postgres".
- A blocker stops only its own sub-task. Record it with evidence and continue. Do not stop to ask routine questions.

## 1. WHAT IS ALREADY DONE (verify by running, do not rebuild)

| Area                     | State                                                                                                                                                                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 4.1 Order deposit        | backend receipt/apply/refund, `payment.record`, mandatory refund reason, audit, delta pull of `order_deposits` + both movement tables, backup/restore, restart test, mobile parity test, cancellation guard test. Real-Postgres concurrency `BLOCKED_EXTERNAL`.                                        |
| 4.3 Cycle count          | `cycle-count-03` (shrinkage/gain accounts, `cycle_count_finish`), service/route/UI, PGlite 10/10. Migration pending human.                                                                                                                                                                             |
| 4.4 Credit limit         | server guard (warn and block both need `credit.override` + reason, off skips), per-customer in-process serialization (`utils/keyed-lock.ts`), invoice preview override panel, offline `credit_validation` stage + approve dialog in the sync centre. Cross-instance race and real-Postgres tests open. |
| 4.5 D4 workspace profile | service/routes/hook/migration exist; `requireProfileCapability` guards only `variants` and `auto_fitments`; four screens read `useWorkspaceProfile`.                                                                                                                                                   |
| 4.7 Audit chain          | `audit-hash-01` migration + VERIFY + PGlite 16/16; `AuditService.verifyChain` asks the DB; route needs `workspace.manage`. No UI verdict screen.                                                                                                                                                       |
| 4.2 Variants             | invoice-line slice only (`checkVariantBinding`, `invoice_items.variant_id`, `variant-binding-01`).                                                                                                                                                                                                     |
| Not started              | 4.6 Store/Teacher/adaptive onboarding, 4.8 branch/device restrictions, OD-4 order WIP, consolidated invariant suite, variant stock/purchase/returns/POS/local/sync/UI.                                                                                                                                 |

Pending human migrations (do not apply): `cycle-count-03`, `variant-binding-01`, `audit-hash-01` (+ their VERIFY files); plus the older pending list in `CLAUDE.md`.

Known environmental problems to handle, not hide:

1. Embedded PostgreSQL binary missing (`embedded-postgres` windows-x64 holds DLLs but no `.exe`) → every `*.pg.test.ts` waits 120 s then skips. Do NOT download unverified binaries. Run logic on PGlite: `PGLITE_DIR=$TEMP/pglite SCENARIOS=<file> SETUP=<fn> node scripts/pg/run-scenarios.mjs` (install `@electric-sql/pglite esbuild` OUTSIDE the repo if `$TEMP/pglite` is gone).
2. `apps/desktop` renderer build fails on this machine: `[vite:esbuild-transpile] remove …\Temp\esbuild-<hash>: Access is denied` (5 tries; changing TEMP/ESBUILD_BINARY_PATH did not help; config host esbuild 0.25.12 vs renderer 0.28.1). Investigate the root cause (which esbuild service, who holds the file, antivirus). Two jest suites (`built-css-contains-utilities`, `built-html-loads-under-file-protocol`) stay red until a renderer build exists; fix the cause if it is in the repo, otherwise record it `BLOCKED_BY_EXISTING_SYSTEM`.

## 2. OWNER DECISIONS — adopted defaults (the owner said "complete it"; conservative defaults are final unless overridden)

Already settled in `V53-OWNER-DECISIONS.md` (D4=B, P1 liability, P2 legacy-null, CC separate accounts, PO draft, OD-3=C, OD-4 full order WIP, refund permission = `payment.record`).

Adopt these for the items that had no answer, and write them into `V53-OWNER-DECISIONS.md` as "adopted default, overridable":

- **V1 — variant stock key.** Stock is tracked per `(workspace, warehouse, product, variant_id)` where `variant_id IS NULL` means "the product itself / legacy". A product with active variants never holds stock on its `NULL` row for NEW movements; legacy stock already on the `NULL` row stays and is shown as "unassigned" until an explicit, audited reassignment. No variant row is invented; the parent is never summed together with its variants (sum of variants + unassigned, shown separately).
- **V2 — variant cost.** Cost layers and average cost are per `(product, variant)`; a variant without its own layer does not borrow the parent's cost silently (cost unknown ⇒ `null`, per the "unknown is not zero" rule).
- **B1 — branch/device restriction.** A member's allowed branches are an explicit list (already `branches.resolveActive`); a DEVICE is registered once per workspace with an explicit allowed-branch subset and may be revoked. Effective scope = member branches ∩ device branches. Offline: the device carries its last server-signed grant with an expiry (default 72 h); past expiry, sensitive operations (post invoice, payment, refund, count, transfer) are refused locally, drafts are still saved and queued; the server re-checks everything on sync and never trusts a client branch id.
- **S1 — Store and Teacher are compositions, not engines.** Store = retail profile (catalog, variants, purchase, inventory, POS, invoices, payments, returns, reports). Teacher = service-business composition (customers as students, a service/course catalog as products of type service/package, packages with credit ledger as enrolments, sessions as service delivery, attendance, receipts/payments, debt). Do not build a school-management platform.
- **W1 — WIP accounting.** Order-based WIP: direct material (actual issued cost), direct labour = actual hours × a valid rate (no rate ⇒ `null`, flagged, not zero), overhead applied at a predetermined rate per labour hour (or per unit), completion moves WIP → finished goods at actual accumulated cost, normal scrap absorbed into the good units' cost, abnormal scrap expensed to its own account, applied-vs-actual overhead difference to a variance account. Missing WIP/variance/overhead accounts ⇒ production completes only in "pending accounts" state like cycle count: nothing guessed.
- **C1 — cancellation fee on a deposit:** no code path; refund in full (already so). A retained fee stays `NEEDS_OWNER_DECISION`.
- **A1 — audit head anchor:** `audit_chain_head(ws)` is exportable; storing it outside the DB is `NEEDS_OWNER_DECISION`; ship a manual export button/report, nothing automatic.

## 3. EXECUTION ORDER

### Phase A — baseline (do first, 30 minutes)

1. `git status --short`; read the files above; run the backend unit suite (`cd backend && npx vitest run --project unit --exclude "**/*.pg.test.ts"`), `packages/validation`, `packages/local-engine`, `packages/ui`, `apps/desktop` jest, `apps/mobile` jest, tsc for backend/validation/local-engine/api/ui/app-shell/desktop/web. Record the baseline numbers (last known: backend 371 files/5152 tests, validation 55/841, local-engine 69/499, ui 198/2574, mobile 18 suites/212 tests; desktop jest 32/34 suites with the two build-dependent ones red).
2. Fix the desktop renderer build (item 2 in §1) or record it with evidence. Then build web (`cd apps/web && npx next build`) — it passed last time.

### Phase B — 4.2 variants end to end (blocks Store)

Write ONE migration `docs/variant-stock-02-migration.sql` (+ `VERIFY-variant-stock-02.sql`, `*.pg.test.ts`, PGlite scenarios, rollback comment) after `variant-binding-01`:

- nullable `variant_id` on: stock movement rows, the per-warehouse stock projection (extend its unique key to include `variant_id` with `COALESCE`-style handling for NULL), cost layers / consumptions, purchase lines, invoice-return lines, supplier-return lines, inventory adjustment / count lines, transfer lines, reservations. FK to `product_variants` as `NOT VALID`. Nothing backfilled.
- DB functions that move stock take the variant and refuse a NULL variant for a product that has active variants (same rule as `checkVariantBinding`, implemented once in SQL and mirrored by the TS domain; add a parity test).
  Then, each as extend-not-duplicate:

1. Server: purchase lines, purchase receipt, returns (customer credit and supplier), adjustments, counts, transfers, POS sale, reservations — all carry and validate `variantId`. Valuation (FIFO/avco) per `(product, variant)`; COGS and inventory valuation reports unchanged in total for products without variants (prove with before/after fixtures); a variant sale never moves the parent row.
2. Reports: stock views show variants + "unassigned (legacy)" separately and never double count; add an invariant test: `sum(variant stock) + unassigned = product total`.
3. Local engine (`packages/local-engine`), local schema/migrations in `packages/app-bridge` (bump `SCHEMA_VERSION`, additive), outbox payloads, push routing (`FINANCIAL_FIELDS`/domain route), delta pull (`DELTA_ENTITIES`) of `product_variants`, backup/restore tables, offline matrix rows (`offline-endpoint-matrix.ts`) for every new/changed endpoint.
4. UI (`packages/ui`, shared by web/desktop/mobile): a `VariantSelectField` used by the product screen (variant CRUD: today only the API exists), invoice builder rows, purchase form, POS, return form, inventory/stock views. Required-variant validation messages localized. Hide nothing when the capability is off (historical rows stay visible).
5. Tests: legacy NULL rows stay valid; offline purchase/invoice/return → reconnect → duplicate delivery → conflict; cross-workspace variant refused; inactive variant refused for new lines but historical lines render; HTTP-level negative tests through real Fastify inject.

### Phase C — 4.4 remainder (credit, cross-instance)

- Cross-instance safety: take a Postgres advisory lock keyed by `(workspace, customer)` inside the invoice transaction (invoice creation currently isn't one transaction — introduce the narrowest correct mechanism, e.g. a SQL function `invoice_credit_reserve(ws, customer, amount, idem_key)` that locks, re-reads exposure and records a short-lived reservation row, released on invoice commit/rollback), PGlite scenarios + `*.pg.test.ts` with two connections for: two concurrent invoices crossing the limit; invoice vs payment allocation; invoice vs credit note; duplicate idempotency key; rollback on posting failure.
- Offline: the device's provisional projection of a credit-refused sale must be visibly marked and excluded from device "final" reports until approved (a `credit_pending` marker on the local invoice, set when the outbox row becomes `credit_validation`, cleared on approval, offering "cancel this sale" which reverses the local projection). Add tests with the real local engine + SQLite (not mocks): create over-limit sale offline → reconnect refused → restart app → approve with reason → server approves → local reconciled once.
- UI: the preview override panel must also show current exposure, limit and excess (the server error carries only the excess today; extend the refusal body with `limit`, `exposure`, `currency` — in `ConflictError` details, not in the message string).

### Phase D — 4.5 D4 workspace profile (complete)

- Enumerate every capability in the registry marked as business-specific and add `requireProfileCapability(...)` ONLY where the route belongs to exactly one capability and an undeclared workspace stays unrestricted (legacy rule). Add a table-driven test: for each guarded route, (declared-without-capability ⇒ 403 `CAPABILITY_NOT_ENABLED`, declared-with ⇒ pass, undeclared ⇒ pass, permission missing ⇒ 403 regardless of capability).
- Profile change must not touch roles, grants or historical rows (test by snapshotting `roles`, `member_roles`, invoices before/after).
- Settings screen section (web + app-shell settings page — they are separate, see CLAUDE.md): choose business types, show what each capability turns on/off, show "historical data stays visible", owner-only (`workspace.manage`), localized, with the 409 `WORKSPACE_PROFILE_NOT_CONFIGURED` state shown as such.
- Offline: the device caches the profile (read-only, pulled), refreshes on sync.

### Phase E — 4.8 branch/device restrictions

Inspect first: `branches.resolveActive`, `member_branches`, `warehouse-access.ts`, `attendance_terminal*` (a different concept — do not reuse), local `auth.ts`, JWT/session code. Then:

- Migration `docs/device-scope-01-migration.sql` (+VERIFY, pg test, PGlite): `workspace_devices(id, workspace_id, label, allowed_branch_ids uuid[], status, registered_by, registered_at, revoked_at, revoked_by, grant_version)`; append-only `device_scope_audit`. RLS/grants per the repo's rule (revoke from `service_role` first on new tables).
- Server: device id travels in a header (allowed in CORS `allowedHeaders` in the SAME change); a middleware computes effective branches = member ∩ device; every branch-scoped read/write (invoices, payments/till, warehouses & stock, counts, transfers, reports with branch filter) uses the effective set; a client-supplied `branchId` outside it ⇒ 403 `BRANCH_NOT_ALLOWED`; revoked device ⇒ 401/403 `DEVICE_REVOKED`; reassigning bumps `grant_version`. Add `device.manage` permission only after reading the permission registry (follow the existing pattern: domain list + MIN_ROLE + local-engine parity test + module level).
- Sync: pull `workspace_devices` row of THIS device (revocation propagation), signed grant with expiry returned on each sync; the local engine enforces the last grant offline (UI filtering + refusal of sensitive ops after expiry); on reconnect the server re-validates queued mutations and rejects out-of-scope ones as `REJECTED_` with a visible reason (reuse the outbox stages; do not invent a new queue).
- UI: devices list/register/revoke/reassign inside the existing team/settings hub (no new route unless unavoidable; see `hisabche-ux-consolidation`), localized.
- Tests: cross-branch read and write denied through HTTP; multi-branch member sees the union ∩ device; revoked device; stale offline grant; reconnect rejection; direct API call without device header from a restricted member where the workspace enforces devices.

### Phase F — OD-4 order WIP (manufacturing)

Inspect `ManufacturingService`, `manufacturing_save_bom` / `manufacturing_complete`, `computeProductionCost`, work orders and `work_order_lines` snapshots first. Extend (do not replace):

- `docs/wip-01-migration.sql` (+VERIFY, pg, PGlite): work-order cost accumulation rows (material, labour hours + rate snapshot, overhead applied), scrap records (normal/abnormal), account roles `wip`, `manufacturing_overhead_applied`, `production_variance`, `abnormal_scrap_loss` added to the standard accounts like `inventory_shrinkage` was (roles + names in 3 languages + `account-name.ts`), atomic function `manufacturing_complete_wip(...)` posting a balanced entry in the same transaction as the stock/cost-layer moves; missing accounts ⇒ pending-accounts state (no guess).
- Domain functions in `packages/validation` (pure, tested with hand-computed numbers and a scale assertion — remember BUG-096): labour, overhead application, scrap, variance, WIP→FG transfer.
- Routes/hook/UI: the existing `ProductionEditor` gets labour hours, overhead basis, scrap fields; a WIP summary per order. Online-only (matrix row), as manufacturing is today.
- Tests: material+labour+overhead into WIP; completion transfers exactly the accumulated cost; normal scrap raises unit cost, abnormal scrap is expensed; variance sign and account; missing rate ⇒ `null` cost not 0; idempotent retry; rollback on posting failure.

### Phase G — 4.6 Store, Teacher, adaptive onboarding

- Read `packages/validation/.../industry-profiles`, the archetype/capability registry, `INDUSTRY-COVERAGE-TABLE.md`, onboarding code (`useOnboardingStore`, `BookCurrencySync`, onboarding screens) first.
- Onboarding step "what do you sell?" writes the WORKSPACE profile (Phase D) and derives: initial modules (navigation items shown/hidden — hiding is by capability AND permission, never a lock on historical data), terminology (one helper used by nav, dashboard, forms, reports — no per-screen overrides), dashboard composition (saved-report cells only; no new numbers), default report set, form fields. Owner defaults must not grant permissions to other roles (test).
- Store journey and Teacher journey each get: a seeded demo-free flow (no fake data — empty states), and an executable E2E script. Use the project's Playwright setup (`apps/desktop/e2e`, `apps/web` e2e if present) or, where a browser run is impossible in this environment, a real-HTTP + real-local-engine integration test that drives the same UI-facing hooks' endpoints in order:
  - Store: onboarding → catalog with variants → purchase (with variant) → stock → POS sale → invoice with partial payment → customer debt → sales return → ledger balanced → profit report → go offline → sale → reconnect → sync → reports equal.
  - Teacher: onboarding → students (customers) → course/service catalog → package enrolment (credit grant) → session delivery consumes credit → attendance → payment with debt → receipt → report → offline/sync.
    State exactly which parts ran in a real browser and which in integration tests.

### Phase H — consolidated financial invariants + audit UI

- One suite `backend/src/__tests__/v53-financial-invariants.test.ts` (+ a PGlite scenarios file where DB-level): no duplicate posting (replay with same idempotency key for deposit/apply/refund/invoice/count/production); no unbalanced journal; no over-apply / over-refund / negative refundable balance; no parent+variant double counting; no unauthorized cross-branch write; no unauthorized credit override; no financial finalization before server validation (offline); every operation above leaves an audit row; currency precision by currency (AFN 0, USD 2, a 3-digit currency) for each money path. Each invariant = a named test with the proving assertion; list them in the final report with file:line.
- Audit verdict UI: a card in the existing security/audit area (owner only) showing verified / broken-at-seq with reason / migration required, the exported head value with a copy button (`copyText`), and the plain-language limitation. Localized. Consume `useVerifyAuditLog`.

### Phase I — final verification

Run in order and report exact counts: backend unit; every `.pg.test.ts` (expect SKIPPED with the reason, never "passed"); each new PGlite scenario file (state `PGLITE_VERIFIED` + counts); validation; local-engine; api/ui/app-shell/web/desktop/backend tsc; ui + desktop + mobile jest; `eslint` on every changed file from its package folder; `prettier --check` on source (not on generated docs); `git diff --check`; generator `--check` for the three generated artifacts; `node scripts/audit/verify-spec-references.mjs`; `node scripts/audit-unwired-routes.mjs` for any new write route; `unwired-capability` guard. Then builds (only now, once): `apps/web` next build; desktop renderer build; mobile shell `pnpm run build:shell` if the mobile part changed. Update `V53-IMPLEMENTATION-STATE.json`, `V53-IMPLEMENTATION-PROGRESS.md`, append numbered lessons to `.claude/lessons-learned.md`, add the migration run-order list to the progress file.

## 4. MIGRATION RUN ORDER TO HAND TO THE OWNER (extend with what you add)

`customer-advances-01` → `order-deposit-apply-refund-01` → `cycle-count-02` (applied) → `cycle-count-03` → `variant-binding-01` → `variant-stock-02` → `audit-hash-01` → `device-scope-01` → `wip-01`; each followed by its `VERIFY-*.sql` (every returned row must be `ok = true`). Deploy order notes per migration: which side (backend/web) must go first.

## 5. FINAL REPORT (Persian), sections A–K

A executive status (one word, honest) · B phase matrix 4.0–4.8 + WIP + invariants (status, implementation, UI, backend, local/offline, sync, tests, blockers) · C codebase map with file:line evidence · D changed files and purpose · E migrations (name, dependency, applied?, VERIFY, rollback, human action) · F every test command with package, passed/failed/skipped, exit code, reason for skips · G end-to-end proof (deposit online/offline/cross-device/restore/restart; credit override online/offline; variant purchase/sale/return; cycle count; WIP; Store; Teacher; D4; audit tamper; branch/device) pass/fail · H each financial invariant with its proving test · I genuinely unresolved owner decisions only · J blockers (external / human production / missing policy / remaining implementation) · K exact next commands.

Do not report any phase complete without the evidence listed in §3 for it. Do not stop because the list is long.
