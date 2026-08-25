---
name: hisabche-lessons
description: Hard-won lessons from real defects found in this codebase — tenancy, migrations, caching, git safety, and how to investigate. Read this before changing authorization, running SQL against production, or trusting a document over the database.
---

# Lessons

Each entry below is a defect that actually existed in Hisabche, or a mistake
actually made while working on it. They are written as rules because each one
cost real time or came close to costing a shopkeeper their data.

---

## 1. The database is the authority. Documents lie.

`documents/DATABASE_SCHEMA.md` has been wrong **twice** about production:

- it claimed `invoice_items` had `unit_label` / `weight_grams`. Production did
  not. A backend change that started passing those fields through produced a
  500 on every invoice create (`PGRST204`).
- it claimed `invoices`, `customers`, `products` and `transactions` had
  `workspace_id`. They did not. An entire migration was designed on that
  assumption before an `information_schema` query disproved it.

**Rule:** before writing a migration or a query against an unfamiliar column,
verify against the live database:

```sql
SELECT table_name, column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_name IN ('...')
 ORDER BY table_name, ordinal_position;
```

**Corollary:** write code that degrades when the schema is behind. See
`insertItemDetails()` in `invoice.service.ts` — on `PGRST204`/`42703` it retries
without the optional columns instead of failing the sale.

---

## 2. Never guess ownership. Fail closed and report.

When backfilling a tenancy column, only fill rows that map to **exactly one**
candidate. Everything else stays NULL and gets counted.

```sql
SELECT user_id, (array_agg(DISTINCT workspace_id))[1] AS workspace_id
  FROM workspace_members
 GROUP BY user_id
HAVING count(DISTINCT workspace_id) = 1
```

The `HAVING` is what makes `[1]` deterministic rather than a choice — rows with
0 or 2+ candidates never reach it.

**Classify unmapped rows precisely; the causes need different fixes.** A first
version of the diagnostic reported "creator has no workspace_members row" for
rows whose `user_id` was NULL — there was no creator at all. Three distinct
causes:

| cause                                    | visible today?                                   | fix                                                   |
| ---------------------------------------- | ------------------------------------------------ | ----------------------------------------------------- |
| `user_id IS NULL`                        | **no** — `WHERE user_id = $1` never matches NULL | already dark data; a human places or archives them    |
| creator has 0 memberships                | **yes** — would disappear                        | add the membership, re-run the backfill               |
| creator has 1 membership but row is NULL | **yes**                                          | drift: row written after the backfill ran. Re-run it. |
| creator has 2+ memberships               | **yes**                                          | genuinely ambiguous; only a human knows               |

That distinction turned "28 blocking rows" into "4 blocking rows".

**Repairing an orphan is not always a guess.** Creating a _new_ workspace owned
by the row's own creator, when that user belongs to zero others, assigns nothing
that could belong to anyone else. See `scripts/remediate-orphaned-workspace.sql`.

---

## 3. A fallback on a tenancy value is a security bug.

Three separate resolvers in this codebase failed open:

```ts
membership?.workspace_id ?? userId // invoice.service.ts, event-log.service.ts
membership?.workspace_id || '' // auth.middleware.ts
role: membership?.role || 'admin' // auth.middleware.ts
```

The first two return the **user's** id as a workspace id — a fabricated tenancy
boundary in the same UUID space as real ones. The third was worse and not
theoretical: a user with **no membership at all** received `role: 'admin'`, and
`workflow.service.ts` accepted `userRole === 'admin'` as an approver override.
Having no workspace granted approval rights.

**Rules:**

- No `workspaceId ?? userId`, `|| userId`, `|| ''`, or any equivalent.
- Missing workspace context is an authorization error, not a narrower query.
- An unknown role degrades to the **least** privilege, never the most.
- Applies to queries, cache keys, realtime channels and sync identity alike —
  a cache key _is_ a tenancy identity.

The single resolver is `services/tenancy.service.ts`. Nothing else resolves a
workspace.

---

## 4. Make the unsafe thing not compile.

The reason services take a `TenancyContext` rather than a `workspaceId: string`
is that a route which skipped `requireWorkspaceContext` then has nothing to
pass. Forgetting is the failure mode; a type is a better guard than a comment
or a code review.

Back that with a source-scanning test (`tenancy-static-guard.test.ts`). A
runtime test only proves the paths it calls; the defect to catch is a _new_
query written later by someone copying an old shape.

---

## 5. Cache scope must match query scope — flip them together.

Switching a route's cache key to the workspace **before** its service filters by
workspace serves member A's user-filtered result to member B. That is a real
cross-tenant leak introduced by a "safe" refactor.

Order: convert the service, then the route's cache scope, then its
`clearCache()` patterns — invalidation keys that no longer match the cache
identity leave every stale entry alive forever.

Also: user-scoped caches on shared data are a correctness bug even when they
are not a leak. A customer added by the owner is invisible to the manager until
the TTL expires. That is not a shared book.

---

## 6. Read the whole chain, not the failing line.

Every serious defect in this codebase was invisible at the point of failure:

- `LedgerTrigger` always wrapped children, so Radix `asChild` broke with
  "Primitive.button failed to slot" — the error named the child, the bug was in
  the parent.
- Product search was permanently empty because `useProducts` returns
  `{products, total}` and the picker read `data.data`.
- Login failing with "Missing authorization header" was **bad config**
  (`NEXT_PUBLIC_API_URL` missing `/api`), not bad credentials.
- `GET /api/transactions` had no tenancy filter at all and returned every
  transaction on the platform. Nothing about the code looked wrong; the filter
  was simply absent.

**Rule:** when the symptom does not match the obvious cause, keep reading
outward. Absence of a filter is invisible — grep for what _should_ be there,
not for what is.

---

## 7. Verification scripts have their own bugs.

Mistakes made while writing checks, all of which produced confident wrong
answers:

- **`\set ON_ERROR_STOP on`** — psql meta-commands do not work in the Supabase
  SQL editor. `RAISE NOTICE` output is also hidden there; write results into a
  table and `SELECT` it.
- **Recording a result inside a subtransaction that deliberately rolls back.**
  Five of twelve checks vanished because their `INSERT` was inside a block
  ending in `RAISE EXCEPTION 'rollback-marker'`. PL/pgSQL _variables_ are not
  transactional — set a boolean flag inside, record it after.
- **AND/OR precedence.** `a AND b AND c OR d` is `(a AND b AND c) OR d`.
  Parenthesise trigger-name filters or the count is a false positive.
- **`min(uuid)` does not exist** in PostgreSQL. Use
  `(array_agg(DISTINCT x))[1]` with a `HAVING count(DISTINCT x) = 1`.

---

## 8. Migration ordering is part of the migration.

A partial run of the sync migration committed the _triggers_ but not the
`ALTER TABLE`s. The triggers referenced `NEW.version` and `NEW.workspace_id`,
which did not exist, so **every INSERT on production failed**.

**Rules:**

- Start any migration that depends on a column with a **preflight** that raises
  if the column is absent. That guard is what stops the outage recurring.
- Ship an emergency rollback that drops only what the migration created and
  proves writes work again (`scripts/emergency-drop-sync-triggers.sql`).
- Split into separately-runnable parts: ANALYSE (read-only) → ADD (nullable,
  reversible) → BACKFILL → ENFORCE. Never `NOT NULL` before the application
  that writes the column is deployed, or every new row is rejected.
- `ON DELETE RESTRICT`, never `CASCADE`, on financial history.
- `ADD COLUMN` with no DEFAULT and no NOT NULL is metadata-only on PG 11+.
  Add FKs `NOT VALID`, then `VALIDATE` separately.

---

## 9. Git: never touch the user's stash.

A `git stash push` that stashed nothing (no changes), followed by `git stash
pop`, popped the user's **pre-existing** WIP stash — then `git stash drop`
discarded it. Recovery needed the dangling SHA and `git stash store`.

**Rules:** inspect `git status`, `git stash list` and `git diff` before any
stash operation. Never `stash`/`pop`/`drop`/`reset`/`clean`/`checkout` over
work you did not create. Never use a destructive git command to make
verification easier.

Also: **never `taskkill /F /IM node.exe /T`** — it kills the user's backend,
web and admin servers too. Kill the specific PID.

---

## 10. Prove "pre-existing" before claiming it.

Two suites fail for reasons unrelated to current work:

- `packages/design-tokens` — 17 failures from `rgba(…,0.80)` vs `0.8`,
  introduced in commit `867813d`. Proved with an empty `git diff HEAD` on those
  paths.
- `backend/kpi-currency-aggregation.test.ts` — needs `SUPABASE_SERVICE_KEY`.

Never say "that failure is pre-existing" without showing the evidence. And
never weaken an assertion or skip a test to go green.

---

## 11. Platform admin is not a workspace role.

`ADMIN_ALLOWED_EMAILS` + `platformAdminGuard` is a **separate security domain**
from `workspace_members`. A platform admin is not a member of any customer
workspace and gets 403 from workspace APIs like any other non-member.

`tenancy.service.ts` deliberately never asks whether the caller is a platform
admin. The test mock throws on any table other than `workspace_members`, so a
future "unless they are an admin" branch fails the suite instead of quietly
turning an email allowlist into read access over every customer's books.

Workspace roles are `owner | manager | seller`. `admin` is not one of them.

---

## 12. Investigate before estimating.

The tenancy rewrite was scoped as "four services". A grep for the intersection
of `.eq('user_id')` with the four shared tables found **74 query sites across
17 files** — `ai`, `analytics`, `crm`, `purchasing`, `manufacturing`,
`warehouse`, `entitlement`, `activity`, `accounting`. Of the 170 total
`.eq('user_id')` calls, most were legitimate (`billing`, `audit`,
`password_reset` genuinely key on the user).

Measure the real surface before promising a shape. And when the scope changes
by 4×, say so immediately rather than discovering it silently.

---

## 13. A test that silently skips is worse than no test.

Two green suites in this codebase asserted nothing:

- The desktop cache tests guarded every case with `if (!available) return`,
  because `better-sqlite3` is compiled against **Electron's** Node ABI
  (`NODE_MODULE_VERSION 125`) while jest runs the system Node (127). Seven
  tests "passed" without touching a database. Fixed with an injectable driver
  seam and Node's built-in `node:sqlite` — a real database, only a different
  binding.
- `kpi-currency-aggregation.test.ts` had "always failed on env" for weeks. The
  cause was a one-word mismatch: `setup.ts` set `SUPABASE_SERVICE_ROLE_KEY`,
  `db.ts` reads `SUPABASE_SERVICE_KEY`. The suite had never run.

**Rule:** a test that cannot run must FAIL, not skip. And before accepting
"that suite always fails", read why.

## 14. Mutation-test every security assertion.

An 18-test IDOR suite passed **with the defect reintroduced**. `getById` awaits
`getBalance` in parallel; the second threw first, so the unscoped read really
happened and nothing observed it.

Outcome assertions ("no foreign data came back") are too weak. The suite now
logs every query the fake database receives and asserts, after _every_ test,
that no query against a shared entity lacked `.eq('workspace_id', …)`. That
stronger form immediately caught two unscoped `DELETE`s I had written myself.

**Rule:** break the code on purpose and confirm the test goes red. If it stays
green, the test is decoration. Do this in more than one place — a guard tuned
to one call site proves nothing about the next.

## 15. Fail-closed guards must fire at the right moment.

`test-rls-isolation.sql` refused to run as `postgres`, which made it unrunnable
from the Supabase SQL editor — that editor always connects as `postgres`.

The danger was real (a bypassing role makes every check vacuous) but the check
was in the wrong place. RLS applies to the **current** role, and a superuser
that has done `SET ROLE` to a non-superuser IS subject to it. The correct guard
runs _after_ the impersonation and verifies it took effect: `current_user =
'authenticated'`, not superuser, no `BYPASSRLS`.

**Rule:** assert the property you actually need, at the point where it can be
verified rather than assumed. A guard that fires too early blocks legitimate
work; one that fires too late proves nothing.

Corollary: always include one POSITIVE check. `USING (false)` passes every
"returns 0 rows" assertion. "A can still read its own 27 invoices" is what
distinguishes isolation from a broken policy.

## 16. Supabase pools connections in transaction mode.

`BEGIN; CREATE TEMP TABLE …; DO $$…$$; SELECT …; ROLLBACK;` fails with
`relation "…" does not exist`. Consecutive statements can land on different
backend connections, so temp tables do not survive between them and a
multi-statement transaction is not reliable.

**Rule:** for anything that needs state across steps, put it in ONE statement —
a `plpgsql` function that `RETURN NEXT`s its results. That also dodges the
editor hiding `RAISE NOTICE`.

Related SQL traps hit in this work: window functions are not allowed in
`HAVING` (it is evaluated before the window step — use the aggregate form); a
temp table is not owned by a role you `SET ROLE` into, so it needs a `GRANT`.

## 17. Read the manifests, not the architecture doc.

CLAUDE.md documents `api → store`. The `package.json` files say the opposite:
`@hisabche/store` depends on `@hisabche/api`. Importing the store from api to
scope realtime produced a cycle and pnpm refused to build the workspace.

The fix was to invert the flow rather than the dependency: api exposes a tiny
registry (`setActiveWorkspaceId`) and store pushes the value in
(`bindActiveWorkspace`). It defaults to `null`, and null means "subscribe to
nothing" — never "subscribe to everything".

**Rule:** verify the dependency direction from the manifests before designing
against it. And when a value must cross a package boundary the wrong way, push
from the depending side instead of pulling from the depended-on side.

Bind at **module scope**, not in an effect: React runs child effects before
parent ones, so a parent `useEffect` fires after the children have already
looked for the value.

## 18. Realtime is a tenancy boundary too.

`subscribeToChannel` subscribed to `{event: '*', schema: 'public', table}` —
every row change on that table, for every business, to every connected client.
"The callback discards the payload" is not a defence: the row still travels the
socket, every write anywhere wakes every client (a timing side channel, and the
message bill multiplied by tenant count), and the channel NAME was shared so
two tenants joined one topic.

Fixed with `filter: workspace_id=eq.…` (server-side) plus the workspace in the
topic name. `workspaceId` must be in the effect's dependency array, or
switching workspace leaves the old channel subscribed for the life of the tab.

**Rule:** audit cache keys, realtime channels and local storage keys with the
same seriousness as SQL `WHERE` clauses. All four are tenancy identities.

## 19. Cache scope and query scope must change together.

Flipping a route's cache key to the workspace **before** its service filters by
workspace serves member A's user-filtered result to member B — a real
cross-tenant leak introduced by a "safe" refactor.

Order: convert the service → the route's cache scope → its `clearCache()`
patterns. Invalidation keys that no longer match the cache identity leave every
stale entry alive forever.

`cacheMiddleware` now takes a **required** `scope: 'workspace' | 'user'` with no
default — a default would be a fallback in disguise, silently wrong for half the
routes.

## 20. Precision is not the enemy of caution.

The RLS preflight refused on any `workspace_id IS NULL` row. That blocked the
migration on 24 rows whose `user_id` is also NULL — rows that are **already**
unreachable (`WHERE user_id = $1` never matches NULL) and that no remediation
can improve, because there is no creator to derive a workspace from.

Blocking on them was not caution, it was imprecision: it held the security work
hostage to a data-quality decision it had nothing to do with. The gate now asks
the right question — _would enabling RLS hide something visible today?_ — and
still blocks loudly on any row with a real creator, while reporting the
creator-less ones as a warning.

**Rule:** when a guard blocks, check whether it is measuring the thing you
actually care about. Sharpen it; do not delete it, and do not shrug and
override it.
