# Handoff

> Required by `.claude/master-prompt.md` §4.2 and §56 STEP 1. Read this first,
> then `PROJECT_STATE.md`, then the relevant capability contract in
> `docs/capabilities/`.

---

## Start here

```bash
git status
git stash list
git branch --show-current
git log -1 --oneline
```

Then read, in order:

1. `PROJECT_STATE.md` — what is done, what is blocked, with evidence
2. `.claude/skills/hisabche-lessons/SKILL.md` — 20 defects that actually
   happened here, written as rules. Read before touching authorization,
   running SQL against production, or trusting a document over the database
3. `docs/capabilities/` — the contract for the capability you are resuming

---

## The last capability closed

**Admin Workspace Membership** — `PRODUCTION-READY`, not deployed.

Three endpoints, live and guarded:

```
GET    /api/admin/workspaces/:workspaceId/members
PATCH  /api/admin/memberships/:membershipId
DELETE /api/admin/memberships/:membershipId
```

UI at `/[lang]/workspaces`: workspace parent rows with real owner identity,
chevron-expanded member rows, role editing, removal with confirmation.

**Left undone deliberately:** browser verification with a real admin session.
`apps/admin` has no test infrastructure, and §5 of the task said not to add a
heavy framework for one capability.

---

## The next capability — pick ONE (§56 STEP 3)

Do not start two. §13: small capability → verify → release → observe → next.

**1. Unblock the subscription migration** — smallest, and it unblocks a
`BLOCKED` capability. Run PART 3 and verifications 4a/4c of
`docs/subscription-workspace-migration.sql` and return the output. Nothing can
be claimed about that migration until check 4c (cross-workspace assignment) is
seen.

**2. Deploy the backend** — everything tenancy-related is code-only until this
happens. Production still filters by `user_id`. Needs deploy authority (§19);
the agent must not assume it.

**3. Remaining-table tenancy** — 29 tables, audit says `SAFE`, 0 blocking rows.
Largest, but fully deterministic.

---

## Standing rules that have already been violated once

- **`ADMIN_ALLOWED_EMAILS` lives in two places.** `apps/admin/.env` gates the
  UI; `backend/.env` gates the API. Setting only one produces a login that
  works followed by a 403 on every admin call. It is read at module scope —
  editing `.env` on a running server does nothing, restart is required.
- **The database is the authority.** `documents/DATABASE_SCHEMA.md` has been
  wrong twice about production. Verify with `information_schema` before
  designing a migration.
- **A test that cannot run must FAIL, not skip.** Two suites here reported
  green while asserting nothing.
- **Mutation-test every security assertion.** Reintroduce the defect on
  purpose and confirm the test goes red. An 18-test IDOR suite once passed
  with the defect restored.

---

## Do not

- `git reset --hard`, `git checkout -- .`, `git clean`, `git stash pop/drop`
- `taskkill /F /IM node.exe /T` — kills the user's own servers. Kill the PID.
- Run `PART 5` of any migration (`NOT NULL` / `VALIDATE`) before the backend
  that writes the column is deployed
- Implement anything from `.claude/master-prompt.md` §§26–54 without a current
  capability that needs it. §37 forbids building from the Constitution itself.
