# Capability Contract — Admin Workspace Membership Management

> Written under `.claude/master-prompt.md` v22.0 §5. Implementation must remain
> inside this contract unless a Scope Change Gate (§6) is triggered.

## CAPABILITY

Platform-admin management of workspace membership: view every workspace with
its owner, expand to see members, change a member's role, and remove a
membership.

## BUSINESS PURPOSE

Support and operations cannot currently answer "who is in this business, and
what can they do?" without querying the database by hand. The Admin Panel shows
KPI cards and nothing actionable. This capability makes membership legible and
correctable from the console, without giving the platform admin any access to
the customer's financial data.

## REQUIRED NOW

- `GET /api/admin/workspaces/:workspaceId/members` — membership id, user id,
  name, email, role, status, joined date.
- `PATCH /api/admin/memberships/:membershipId` — `{ role }`, audited.
- `DELETE /api/admin/memberships/:membershipId` — membership only, audited.
- Owner identity on the workspace list, without N+1.
- Admin UI: workspace table, owner on the parent row, chevron-expanded member
  rows, role editing, removal with confirmation.
- Loading / empty / error states; i18n in fa, af, en; RTL and LTR; keyboard
  accessible; responsive to tablet.

## REQUIRED BOUNDARY

Contracts only — no future behaviour implemented:

- **Membership addressed by its own primary key.** `workspace_members.id`
  exists but is absent from `MEMBER_COLUMNS`, so today nothing can address a
  membership. Exposing it is what makes any future membership operation
  (invite, suspend, transfer) possible without another schema change.
- **A stable member response shape** carrying identity separately from
  membership, so a future identity source (auth metadata, profiles) can change
  without breaking the UI.
- **Role vocabulary fixed at `owner | manager | seller`**, validated by the
  existing enum. No open string.
- **Audit envelope** for membership mutations reusing `AuditService`, so
  ownership transfer and suspension later append to the same log.

## FUTURE — explicitly NOT implemented now

- Ownership transfer as a first-class operation (demote + promote atomically).
- Member invitation / re-invitation from the admin console.
- Member suspension and reinstatement (`has_access`, `suspended_at` are read
  and displayed, never written).
- Bulk membership operations.
- Per-member activity or last-login.

## OUT OF SCOPE

- Any change to billing, subscriptions, invoices, transactions, or ledgers.
- The subscription→workspace migration (its own capability; contract in
  `docs/subscription-workspace-migration.sql`).
- Deleting user accounts. This capability never touches `auth.users`.
- Impersonation. Explicitly prohibited by the tenancy model.
- Revenue metrics — no authoritative pricing source exists.
- Refactoring unrelated admin pages for style.

## DO NOT TOUCH

- `backend/src/services/tenancy.service.ts` — the workspace authorization
  boundary. It must keep reading only `workspace_members` and must never learn
  what a platform admin is. Pinned by `platform-admin-isolation.test.ts`.
- `backend/src/middleware/platform-admin.middleware.ts` — the allowlist guard.
- Any invoice / customer / product / transaction service.
- `workspace_single_owner_idx` — the live DB invariant.
- The 24 creator-less orphan rows.

## DOMAIN OWNER

Platform administration. Separate security domain from workspace tenancy.

## SOURCE OF TRUTH

The database. `workspace_members` for membership; the users projection for
identity; `workspaces.owner_id` for ownership. Not documentation — it has been
wrong twice.

## DEPENDENCIES

Real, already present: `authenticate`, `platformAdminGuard`, `AuditService`,
`@hisabche/ui` (Skeleton, Dialog, Select exist), TanStack Query, next-intl.

## DATABASE IMPACT

**None.** No migration. `workspace_members.id` already exists
(`uuid NOT NULL default gen_random_uuid()`) — it is simply not selected. This
capability changes a projection, not a schema.

## API IMPACT

Three new endpoints. Two existing projections widened (`MEMBER_COLUMNS` gains
`id`; workspace list gains owner identity). No existing response field removed
or renamed.

## AUTHORIZATION IMPACT

All three endpoints behind `[authenticate, platformAdminGuard]`. Membership
mutations verify the membership belongs to the named workspace before writing —
cross-workspace IDOR. `user_id` is never a tenancy boundary. No new capability
for workspace members; no admin access to financial rows.

## UI IMPACT

`apps/admin` only. Workspace table replaces the KPI-only dashboard as the
primary surface. The `@/components/ui` barrel gains Skeleton / Dialog / Select
re-exports from `@hisabche/ui` — no new local components.

## OFFLINE/SYNC IMPACT

None. The admin console is online-only and not part of the sync engine.

## AUDIT IMPACT

Every successful role change and removal writes an `audit_logs` row: actor,
action, `entity_type = 'workspace_member'`, entity id, before/after snapshot,
timestamp. **A refused or failed mutation writes nothing** — a log of attempts
that did not happen makes the log useless as a record of what did.

## OBSERVABILITY

Existing structured request logging (reqId, route, status, userId). No new
telemetry. Secrets and member PII stay out of logs.

## TEST STRATEGY

- 401 unauthenticated, 403 non-allowlisted, on all three endpoints.
- Member listing returns identity + membership id.
- Cross-workspace IDOR: a membership id from workspace B refused under A.
- One-owner invariant: promoting a second owner refused before the DB.
- Owner removal refused.
- `auth.users` and financial tables untouched by a removal.
- Audit written on success; **not** written on refusal.
- N+1: assert the member listing issues a bounded number of queries.
- Design-system regression: admin `Button` comes from `@hisabche/ui` and
  honours `asChild`.
- Mutation-test the IDOR and owner guards — reintroduce the defect, confirm red.

## ROLLBACK / RECOVERY

Code-only; `git revert` of the commit. No migration to undo, no data written
that a rollback would strand. Audit rows already written remain, correctly —
they record things that really happened.

## DEPLOYMENT IMPACT

Backend to Render (`render.yaml`), admin to Vercel (`vercel.json`). CI
(`.github/workflows/ci.yml`) runs `pnpm lint`, `pnpm type-check`, `pnpm test`,
plus a backend job. Backend must deploy before the admin app, or the UI calls
endpoints that do not exist yet.

## POST-DEPLOY VERIFICATION

Load the workspace list; expand one row and confirm exactly one member request
in the network tab; change a role and confirm the `audit_logs` row; attempt to
remove an owner and confirm refusal; confirm the user still exists in
`auth.users` after a successful removal.

## CHANGE BUDGET

|                                    |                                         |
| ---------------------------------- | --------------------------------------- |
| EXPECTED FILES CHANGED             | ~12 (3–4 backend, 6–8 admin, plus i18n) |
| EXPECTED DATABASE TABLES CHANGED   | 0                                       |
| EXPECTED MIGRATIONS                | 0                                       |
| EXPECTED NEW API ENDPOINTS         | 3                                       |
| EXPECTED NEW DOMAIN CONCEPTS       | 0 — membership already exists           |
| EXPECTED EXISTING BEHAVIOR CHANGES | 2 widened projections, additive only    |
| EXPECTED NEW TESTS                 | ~20                                     |
| EXPECTED DEPLOYMENT IMPACT         | backend before admin                    |

## BLAST RADIUS

- **DIRECTLY AFFECTED:** `admin.service.ts`, `admin.routes.ts`, `apps/admin`.
- **INDIRECTLY AFFECTED:** `workspace_members` rows an admin edits; `audit_logs`
  grows.
- **POTENTIAL PRODUCTION BEHAVIOR CHANGES:** `MEMBER_COLUMNS` gains a field —
  additive, so existing consumers are unaffected.
- **MIGRATION RISK:** none.
- **SECURITY RISK:** moderate and contained. New mutation endpoints on
  membership. Mitigated by the guard, the workspace check, the owner
  protection, and mutation-tested IDOR coverage.
- **FINANCIAL RISK:** none. No financial table is read or written.
- **SYNC/OFFLINE RISK:** none.
- **ROLLBACK COMPLEXITY:** low — revert the commit.

## STATUS

**PRODUCTION-READY** (§18 vocabulary). Not deployed — §19: production-ready is
not deployment authorization.

### STEP 8 — VERIFY (§56)

```
backend type-check   clean
backend tests        208 passed (23 for this capability)
monorepo type-check  17/17 tasks
monorepo lint        19/19 tasks, 0 errors
monorepo tests       13/13 tasks, 1210 tests
admin build          compiled, /[lang]/workspaces emitted
```

### STEP 9 — ATTACK (§56)

Deny paths, each with a test and each mutation-tested — the guard was removed
on purpose and the named tests confirmed to go red:

| attack                            | result                    | caught by                           |
| --------------------------------- | ------------------------- | ----------------------------------- |
| remove the workspace owner        | refused                   | `refuses to remove the owner`       |
| create a second owner             | refused before the DB     | `refuses to create a second owner`  |
| audit a refused mutation          | no row written            | `writes NO audit row…` (×2)         |
| delete the user account           | never touched             | `never deletes the user account`    |
| removal keyed on the wrong column | one row only              | `removes exactly one membership…`   |
| N+1 owner lookup                  | bounded                   | `costs a bounded number of queries` |
| unauthenticated call              | 401                       | live probe, all 4 endpoints         |
| unknown membership id             | rejected, nothing written | 2 tests                             |

### STEP 10 — MEASURE (§56)

- Member listing: **2 queries** regardless of member count
  (`expect(queryLog).toEqual(['workspace_members', 'users'])`)
- Workspace listing: **4 queries** regardless of page size; **1** for an empty
  page — enrichment is skipped rather than issued against nothing
- UI: members are fetched only on first expand; collapsing keeps the cache

### Evidence classes (§11)

- **FACT** — routes registered (`index.ts:460` → `admin.routes.ts:185,207,234`)
- **OBSERVED** — every test and probe result above
- **UNVERIFIED** — browser behaviour with a real admin session. `apps/admin`
  has no test infrastructure and no E2E run was performed. This is the one
  gap, and it is not claimed as working.

### Change budget — actual vs estimated (§8)

|                         | estimated | actual |
| ----------------------- | --------- | ------ |
| files changed           | ~12       | 13     |
| database tables changed | 0         | 0      |
| migrations              | 0         | 0      |
| new API endpoints       | 3         | 3      |
| new tests               | ~20       | 23     |

Within budget. No Scope Change Gate (§21) was triggered.

### Two findings outside the original scope

Both were fixed because leaving them would have been negligent, and both are
recorded here rather than folded silently into the capability:

**1. An authentication bypass pinned by a test.** `api.test.ts` asserted that
an unknown path returns 404. That only held while `/api` sat in the
public-paths list in `index.ts` — matched with `url.startsWith(p)`, which made
**every** `/api/*` route public. The entry had already been removed; the test
was corrected to assert 401 with the reason documented, plus a counterweight
test proving routing still resolves for a genuinely public prefix.

**2. `request.user` was typed with a hand-rolled shape** declaring
`email: string` (required) plus an index signature. The Supabase `User` type
has an optional email and no index signature, so the real value could not be
assigned to the type meant to describe it. Now aliased to `SupabaseUser`;
`platformAdminGuard` already handled a missing email at runtime, which is where
it genuinely has to be handled.
