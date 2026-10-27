# IMPLEMENTATION PHASE 1 — DATA INTEGRITY AND TENANCY (prompt for the implementation agent)

The audit phase is CLOSED. Do NOT run another audit, do NOT research competitors, do NOT open an audit loop. Decision stays `NO — DO NOT FREEZE`; the Gap Ledger stays UNFROZEN until Phase-1 fixes are verified.

Rules: no commit, no push, no subagents, do not discard existing worktree changes (`git status` is dirty — never `git checkout -- <file>`), no second/parallel implementation of anything, no live DDL (migrations only as files in `docs/` with Rollback block + VERIFY query; write "Post-migration verification query generated — PENDING HUMAN CONFIRMATION"), no `any` / `@ts-ignore` / `eslint-disable`, every new i18n key in `fa`, `af` and `en`, money in integer minor units, `workspace_id` is the only security boundary (role from `request.tenancy.role`). Read `.claude/skills/hisabche-session-rules/SKILL.md` first. Evidence for every claim is in `docs/audit/evidence/*.md` and `docs/audit/UNIVERSAL-CORE-GAP-LEDGER.md` §F — read the one for the item before touching it. Report status only with: `IMPLEMENTED_VERIFIED`, `IMPLEMENTED_NOT_LIVE_VERIFIED`, `BLOCKED_EXTERNAL`, `FAILED_VERIFICATION`, `NOT_IMPLEMENTED`.

In scope: N-30, N-18, N-31, N-20, N-17+N-01 (in this order). OUT of scope (Phase 2): N-37 (needs an owner accounting decision), N-44, N-36, capability expansion, competitor scoring, new features, UI refactors.

---

## STEP 0 — Baseline (before any edit)

Run and record exact command + result in `docs/audit/evidence/implementation-phase-1-baseline.md`:

```
cd backend      && npx tsc --noEmit && npx vitest run src/__tests__/sync-invariants.test.ts src/__tests__/sync-security.test.ts
cd packages/ui  && npx tsc --noEmit        # expected: 1 error, TS2304 toIsoDay (N-20)
cd packages/app-shell && npx tsc --noEmit  # same error via ../ui
cd apps/web && npx tsc --noEmit ; cd ../desktop && npx tsc --noEmit ; cd ../admin && npx tsc --noEmit
```

`*.pg.test.ts` cannot start on this Windows account (error 1314). Do not fake them; mark `BLOCKED_EXTERNAL`. Do not push to trigger CI.

---

## STEP 1 — N-30: `POST /api/sync/push` with `operation: "delete"`

**Files**

- Route: `backend/src/routes/sync.routes.ts:106-108` (preHandler is `[authenticate, requireWorkspaceContext]`, no capability).
- Service: `backend/src/services/sync.service.ts` — delete branch `:503-512` (`assertOwned` then raw `supabase.from(table).delete().eq('id').eq('workspace_id')`), runs before `pickWritable` and before the finalized-invoice test at `:547` (update path only). Entity map `ENTITY_TABLE`/`WRITABLE`/`REFUSED_FIELDS` at `:59-146`.
- Request schema: `packages/validation/src/schemas/sync-protocol.schema.ts:86-141`.
- Domain delete to reuse (do NOT reimplement): `backend/src/services/invoice.service.ts` `delete` (~`:1649-1703`) + `reverseEffects` (`:1777`); `scopes.assertMay`, `sod.assertAllowed/recordAction`, `logBusinessEvent`. Product/customer/warehouse/branch/exchange-rate/time-entry/transaction services under `backend/src/services/**` (find each one's own delete/guard before deciding).
- Authorization source: `backend/src/services/authorization.domain.ts` (27 capabilities; `invoice.delete`, `product.write`, `customer.write`, `inventory.configure`, `ledger.*`).
- Existing tests that touch it: `backend/src/__tests__/sync-security.test.ts:341-363` (tenancy only), `sync-invariants.test.ts:640-660` ("sends no row for a delete" — it **relies on the unsafe delete**; rewrite it to delete through the safe path or to expect rejection, do not delete it silently), `sync-writable-is-descriptive.test.ts`, `sync-binary-http.test.ts`.
- Nobody legitimate sends deletes here: desktop `push-routing.ts:100-102` routes deletes to the domain route; only `pushVersioned` calls `/sync/push` (`packages/app-shell/src/features/sync/sync-engine.ts:642`, `apps/mobile/src/features/offline/sync-runner.ts:109`).

**First** write failing regression tests (new file `backend/src/__tests__/sync-delete-authority.test.ts`, same in-memory fake style as `sync-invariants.test.ts`; do not weaken to fit the code): finalized invoice not deletable; customer / product (with stock history) / warehouse (with stock) not deletable; seller token cannot delete; workspace A cannot delete B; a rejected delete leaves ledger, stock movements, balances and `sync_change_log` untouched; rejection is recorded in `sync_mutations` idempotently (same `mutation_id` replay → same rejection).
**Then fix** inside the existing push path: either refuse `delete` for all 9 entities on this road with a stable error code (preferred: nothing legitimate uses it), or route each entity to its existing domain delete with the same capability the REST route requires. Never a generic hard delete in `sync.service`.
Residual: live foreign-key state is unknown (`NOT VALID` FKs) — state it, do not assume.

---

## STEP 2 — N-18: workflows cross-tenant

**Files**

- Routes: `backend/src/routes/workflow.routes.ts` — `GET /:id` (`:95`, cache key `workflow:<id>` at `:105-107`), `PATCH /:id` (`:124`), `DELETE /:id` (`:153`), `POST /instances` (`:181`), `GET /instances/:id` (`:236`, cache `workflow:instance:<id>`). `clearCache('workflows:*')` after writes purges every tenant.
- Service: `backend/src/services/workflow.service.ts` — `getWorkflow :230-250`, `updateWorkflow :257-285` (also deletes+inserts `workflow_steps` by `workflow_id`), `deleteWorkflow :290-295`, `startWorkflow :301-325` (never checks `workflow_id` belongs to workspace), `getInstance :413-440`. Reference for the correct pattern in the same file: `performAction` filters `.eq('workspace_id', ctx.workspaceId)`.
- Client: hooks `packages/api/src/hooks/use-workflow.ts`; UI `packages/ui/src/components/ui/workflow/containers/{workflow-templates-container,approvals-container}.tsx`, `invoice-detail-container.tsx`, `work-queue-container.tsx` (do not change UI unless a signature changes).
- Existing tests: `workflow-builder.test.ts`, `workflow-template-problems.test.ts`, `workflow-escalation.pg.test.ts`; guard `tenancy-static-guard.test.ts`.

Fix: pass `workspaceId` (from `request.tenancy`) into every service method; every `.eq('id', …)` also `.eq('workspace_id', …)` (steps are checked through the verified parent); verify `workflow_id` belongs to the workspace in `startWorkflow`; put workspace id in cache keys and in `clearCache` patterns. 404 for foreign ids (never 403, no existence leak). Negative tests with two workspaces: GET/PATCH/DELETE `/workflows/:idOfA` with B's token → 404 and A's row + steps unchanged; `GET /instances/:idOfA` → 404; `POST /instances` with A's `workflow_id` → 404; cache keys contain the workspace. Do not add capabilities in this phase.

---

## STEP 3 — N-31: project members cross-tenant

**Files**

- Routes: `backend/src/routes/project.routes.ts` — `GET/POST /api/projects/:projectId/members` (`:296`, `:322`), `DELETE …/members/:memberId` (`:349`); also P2: `POST …/tasks` and `…/time-entries` (`:404`) accept a foreign `projectId`.
- Service: `backend/src/services/project.service.ts` — `listMembers :335-352`, `addMember :354-373`, `removeMember :375-390`, `createTask`, `createTimeEntry` (`:413`).
- Schema: `docs/SETUP-COMPLETE.sql:638-647` — `project_members` has **no `workspace_id`**. Do not write DDL against the live DB: verify the project (`.eq('id', projectId).eq('workspace_id', ctx.workspaceId)`) first in code, and only if a column is truly needed produce an additive idempotent migration file in `docs/` + VERIFY + `*.pg.test.ts`, "PENDING HUMAN CONFIRMATION".
- Client: grep `packages/api/src/hooks` for project-member hooks (none found by name; check `useProjects*` files) and `packages/ui/src/components/ui/timesheets/containers/timesheets-container.tsx`.

Negative tests (two workspaces): list, add, remove members on A's project with B's token → 404 and no row changed; embedded employee names not returned.

---

## STEP 4 — N-20: `toIsoDay` not imported

**File** `packages/ui/src/components/ui/invoices/invoice-returns-dialog.tsx:44` — import `toIsoDay` from the formatting package (`packages/formatting/src/dates.ts:111`; use the same import path other `packages/ui` files use for it). Nothing else in this step. Re-run tsc for `packages/ui`, `packages/app-shell`, `apps/web`, `apps/desktop`, `apps/admin` → all must pass.

---

## STEP 5 — N-17 + N-01: sales returns (one coherent fix)

**Files**

- Route: `backend/src/routes/invoice-return.routes.ts:29-60` (`POST /api/invoices/:id/returns`, capability `invoice.create`; maps `quantity`→`returnQuantity`, defaults `restockChoice 'restock'`, `reasonCode 'other'`; passes **no `originalLines`**).
- Service: `backend/src/services/sales/invoice-return.service.ts:36-60` — reads undefined table `invoice_lines` and ignores the query `error`; columns it expects (`unit_price_minor`, `subtotal_minor`, `total_minor`, `total`) do not exist.
- Real table: `invoice_items` (`docs/SETUP-COMPLETE.sql:399-414`): `id, invoice_id, product_id, product_name, quantity numeric(12,3), unit_price numeric(12,2) MAJOR, discount numeric(5,2) PERCENT, total_price numeric(12,2) MAJOR, unit…`. Convert major→minor with the repo's currency helpers (`packages/formatting`, `toMinorUnits`), never the `|| unit_price` fallback. Add the `workspace_id` / invoice-ownership check the query lacks.
- Domain: `packages/validation/src/schemas/returns.domain.ts` (`calculateReturnDocument` `:84`, `ReturnReason` `:12`: `defective, wrong_item, customer_change_of_mind, damaged_in_transit, expired, other`).
- Offline twin (do not diverge): `packages/local-engine/src/routes/invoice-returns.ts` (reads SQLite `invoice_item`; writes records only).
- Everything a return must reuse, not rewrite: `InvoiceService.reverseEffects` (`invoice.service.ts:1777`) for patterns; `ledger.reverseDocument` / `ledger.postDocument` (source types in the ledger union include `reversal`); `reversalOfRecordedMovements`; `costing.releaseDocument`; `PaymentsService` for refunds; `invoiceLedgerLines` (`packages/validation/src/schemas/invoice-posting.domain.ts`); `ProductService`/stock-movement API for restock (movement must name the warehouse — `stockEditWarehouse`, BUG-080); `invalidateMoneyCaches(workspaceId)`; AVCO costing (`inventory_settings.costing_method`) — a restocked unit returns at the cost it was sold at; multi-currency (`invoices.exchange_rate` frozen; ledger in books currency).
- Client: hook `packages/api/src/hooks/universal-core.ts:376-395` (`useCreateInvoiceReturn`; sends `quantity`), UI `packages/ui/src/components/ui/invoices/invoice-returns-dialog.tsx` — defects: `originalLineId: 'line-default'` (`:47`, must be a real `invoice_items.id`), `reasonCode: reason || 'customer_return'` (`:50`, not a valid `ReturnReason`), and the dialog is **mounted nowhere** (exported from `packages/ui/src/index.ts:574` only). Mount it on the invoice detail page (`packages/ui/src/components/ui/invoice-detail/containers/invoice-detail-container.tsx`) as an action of the existing page, not a new route; list the invoice's real lines and let the user choose quantity per line; errors via `apiErrorMessage`; new strings in fa/af/en.
- Existing tests to extend / not break: `reverse-invoice.test.ts`, `vertical-slice-integration.test.ts`, guard `no-new-ui-primitives.test.ts:104`.

Before coding, trace the existing invoice→ledger→stock path and write down (in the report, from code, not invention): what a full return, a partial return, restock vs scrap, refund vs customer credit each do to stock, ledger (reverse revenue + COGS at original cost), receivable/customer balance and payments. If the existing model has no refund concept, document it as intentionally unsupported instead of inventing it. Write in one DB transaction via a Postgres function + `.rpc()` (supabase-js has no transactions; no compensating DELETE). Idempotency key per return (`returnNumber` + invoice). Tests (`backend/src/__tests__/reverse-sales-return.test.ts`): full, partial, stock quantity, ledger effect (measure balances, not row counts), customer balance, duplicate return idempotent, foreign-tenant invoice → 404, two currencies, over-return rejected, invalid reason rejected; offline twin behaviour documented or aligned.

---

## Verification gate (after all five)

Backend `npx tsc --noEmit && npx vitest run` (sequentially, not parallel with other suites); `packages/ui`, `packages/api`, `apps/web`, `apps/desktop`, `apps/admin` tsc; relevant vitest in `packages/ui`; eslint on changed files from each package's own folder; `node scripts/audit/capability-coverage-v2.mjs` untouched. `*.pg.test.ts`: `BLOCKED_EXTERNAL`.

## Required outputs

1. `docs/audit/evidence/implementation-phase-1-baseline.md` and `implementation-phase-1-report.md` (sections: Baseline · Changes · N-30 · N-18 · N-31 · N-20 · N-17/N-01 · Tests · Type-check · Lint · Database limitation · Remaining Phase-2 findings).
2. Update `docs/audit/UNIVERSAL-CORE-GAP-LEDGER.md` §F with table `| ID | Status | Evidence | Tests | Remaining blocker |` — only for items actually verified.
3. Final line exactly `PHASE 1 IMPLEMENTATION COMPLETE` only if every claimed item passed its available verification; otherwise `PHASE 1 IMPLEMENTATION INCOMPLETE` + failing item and file evidence. Never write "production ready", "Universal Core complete", or freeze the ledger.
