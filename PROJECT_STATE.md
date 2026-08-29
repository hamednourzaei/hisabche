# Hisabche — Project State

> Required by `.claude/master-prompt.md` §4.3 (Session Start Protocol) and
> §56 STEP 1. Read this before touching anything.
>
> Statuses come from §18 and are the ONLY permitted vocabulary:
> `NOT STARTED · DESIGNING · IMPLEMENTING · VERIFYING · PRODUCTION-READY ·
DEPLOYING · RELEASED · RELEASED + VERIFIED · BLOCKED`
>
> §18 forbids "almost done", "basically complete", "should work",
> "probably safe". Evidence determines status — nothing else.
>
> **Last updated:** after the Admin Workspace Membership capability.
> **Branch:** `main` · **Last commit:** `24513f9 fixed admin 6`

---

## Evidence classes (§11)

Every claim below is tagged:

| tag            | meaning                                           |
| -------------- | ------------------------------------------------- |
| **FACT**       | verified in the repository or the live database   |
| **OBSERVED**   | seen at runtime (test output, HTTP response, log) |
| **INFERRED**   | reasoned from evidence, not directly observed     |
| **UNVERIFIED** | believed but not proven — treat as unknown        |

§11: `PROPOSED ≠ IMPLEMENTED`, `TESTED ≠ PRODUCTION-PROVEN`,
`PRODUCTION-READY ≠ DEPLOYED`, `DEPLOYED ≠ VERIFIED`.

---

## Capability status

### Admin Workspace Membership — `PRODUCTION-READY`

Contract: `docs/capabilities/admin-workspace-membership.md`

Platform admins can list workspaces with real owner identity, expand a row to
see members, change a member's role, and remove a membership.

- **FACT** — 3 endpoints registered: `index.ts:460 → adminRoutes →
admin.routes.ts:185, 207, 234`
- **OBSERVED** — 208 backend tests pass, including 23 for this capability
- **OBSERVED** — all four admin endpoints answer `401` unauthenticated against
  a live server
- **OBSERVED** — mutation testing: removing the owner guard, the one-owner
  guard, or the batched owner lookup each turns specific tests red
- **FACT** — no migration; `workspace_members.id` already existed
- **OBSERVED** — the workspace page loads and renders in the browser against a
  real admin session (user-confirmed after the PGRST205 fix)
- **OBSERVED** — a real production defect was found only by running it: five
  queries targeted `public.users`, a table that does not exist. All identity
  now resolves through `profiles` + `auth.admin`. This is why local tests are
  not production evidence (§11).
- **UNVERIFIED** — role change and member removal have not been exercised
  through the UI against real data.

**Not deployed.** §19: `PRODUCTION-READY` is not deployment authorization.

### Admin Subscription Management — `PRODUCTION-READY`

Platform admins can list subscriptions filtered by plan and status, and change
either — both audited server-side with before/after snapshots.

- **FACT** — zero backend change; every endpoint already existed
  (`/admin/subscriptions`, `/subscriptions/:id/plan`, `/subscriptions/:id/status`)
- **FACT** — plan and status use the real `packages/validation` enums, not
  open strings
- **OBSERVED** — admin build emits `/[lang]/subscriptions`
- **UNVERIFIED** — browser behaviour and the two mutations against real data
- **NOT IMPLEMENTED** — date-bucketed expiry ("expires in 3/7/30 days").
  `listPastDueSubscriptions` filters on `status = past_due`, not on
  `period_end`, and `listSubscriptions` has no date filter. Bucketing a paged
  list client-side would only bucket the visible page and under-report, so the
  UI highlights expiring rows but does not claim to filter by date. A backend
  date-range filter is needed first — recorded, not faked.

### Workspace tenancy (invoices / customers / products / transactions) — `PRODUCTION-READY`

- **FACT** — 74 query sites across 17 files scoped to `workspace_id`
- **FACT** — `tenancy.service.ts` fails closed; no `?? userId` fallback remains
- **OBSERVED** — static guard (`tenancy-static-guard.test.ts`) green, 8/8
- **OBSERVED** — RLS verified live: 14/14 checks in
  `scripts/test-rls-isolation.sql`, including a positive check (owner reads
  their own 27 invoices) that rules out a vacuous `USING (false)` pass
- **FACT** — `workspace_single_owner_idx` is live in production

**Not deployed.** The backend running in production still filters by
`user_id`; all of this is code-only until a deploy happens.

### Subscription → Workspace — `BLOCKED`

Migration and tests written; the migration is only partly applied.

- **FACT** — `docs/subscription-workspace-migration.sql` PARTs 1–2 applied;
  `subscriptions_workspace_idx` and `subscriptions_one_per_workspace_idx`
  exist and are valid
- **UNVERIFIED** — PART 3 (backfill) results were never returned
- **UNVERIFIED** — verification 4a (row counts / primary keys) and 4c
  (cross-workspace assignment) were never run

**Blocked on:** the output of PART 3 and checks 4a/4c. Until 4c is seen, no
claim can be made that the mapping is correct. §11: never claim a migration is
safe without verification evidence.

### Remaining-table tenancy (29 tables) — `DESIGNING`

`projects`, `employees`, `warehouses`, `purchase_orders`, `boms`,
`crm_interactions`, `accounts`, `journal_entries` and others still use
`user_id` as their tenancy boundary and have no `workspace_id`.

- **OBSERVED** — audit returned: 29 tables, 748 rows, 738 deterministically
  mappable, 10 with no creator, **0 blocking**, verdict `SAFE`
- **INFERRED** — under the shared-book model a manager cannot see the owner's
  employees or warehouses. This is a product-model violation, not a security
  leak: the current scope is narrower than intended, not wider.

### Sync engine — `PRODUCTION-READY` (server), `IMPLEMENTING` (clients)

- **OBSERVED** — 69 tests in `packages/sync`, including 13 workspace-isolation
  tests; mutation-tested
- **FACT** — web IndexedDB adapter and desktop SQLite cache both workspace-scoped
- **NOT STARTED** — mobile adapter integration

### Realtime isolation — `PRODUCTION-READY`

- **FACT** — channels keyed `hisabche-{workspaceId}-{table}` with a
  server-side `filter: workspace_id=eq.…`
- **OBSERVED** — 61 tests in `packages/api`, 8 of them isolation

---

## Known blockers

| blocker                 | blocks                       | needed                                 |
| ----------------------- | ---------------------------- | -------------------------------------- |
| Backend not deployed    | every tenancy capability     | deploy authority (§19)                 |
| PART 3 / 4a / 4c output | subscription migration       | run and return the SQL output          |
| 24 creator-less rows    | `NOT NULL` on `workspace_id` | a human decision — cannot be derived   |
| Hermes binary broken    | mobile build                 | `hermesc.exe` exits 0 emitting nothing |
| No admin test infra     | admin UI regression cover    | a decision on whether to add one       |

---

## Established workflows (§4.6 — never invent these)

- **CI** — `.github/workflows/ci.yml`: `pnpm lint`, `pnpm type-check`,
  `pnpm test`, plus `web-build` and `backend-tests` jobs
- **Migrations** — hand-run `.sql` files in `docs/`. No migration tool. Every
  file is split into separately-runnable PARTs with a read-only analysis first
- **Deploy** — `render.yaml` (backend), `vercel.json` (admin, web)
- **Branch** — currently committing to `main`

---

## Verification baseline

Last full run, all green:

```
type-check   17/17 tasks
lint         19/19 tasks, 0 errors
tests        13/13 tasks — 1210 tests
admin build  compiled, /[lang]/workspaces emitted
```

`design-tokens` 87/87 — an earlier claim in conversation that it had 17
pre-existing failures was wrong and is corrected here.
