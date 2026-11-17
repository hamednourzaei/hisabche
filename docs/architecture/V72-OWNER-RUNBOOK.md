# V72 — Owner Runbook (only the owner executes this)

> The agent wrote code, tests, SQL and documents. It did not commit, run SQL on Supabase, build, or run
> any live check. Every command below is taken from a `package.json` script or a file in `scripts/`;
> none is guessed. Operational procedures (release, rollback, incident, backup, key rotation) are in
> `V72-OPERATIONS-RUNBOOKS.md`.

## 1. Review and commit (owner)

```bash
git status --short
git diff --stat
```

Commit with `git add` on named paths only (memory rule «stage only my files») — never `git add -A`.

## 2. Migrations — in this order

The canonical, generated ledger of every migration with its VERIFY and pg test is
`docs/MIGRATIONS-PENDING.md` (`node scripts/migrations/pending-ledger.mjs`). New in this round:

| #   | File                                   | Needs first                                              | Verify                                       | Status                                                                   |
| --- | -------------------------------------- | -------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | `docs/repair-quality-01-migration.sql` | `retail-ops-01`, `quality-events-01` (both reported run) | `docs/VERIFY-repair-quality-01.sql` (4 rows) | Post-migration verification query generated — PENDING HUMAN CONFIRMATION |

Read-only, any time: `docs/FINDING-variant-cost-layers.sql` (two blocks; run each separately) — input for D5.

⚠️ **Removed, do not run:** `docs/gold-line-snapshot-01-migration.sql` (V72 first pass). It granted
`SELECT, INSERT, UPDATE ON public.invoice_items TO authenticated` and added five columns no code reads.
**If you already ran it**, run this mitigation in the SQL editor and keep the (empty, unused) columns:

```sql
REVOKE INSERT, UPDATE ON public.invoice_items FROM authenticated;
```

## 3. Evidence on a clean, committed tree

The sellable report counts a journey only when it ran on a clean commit (`worktreeDirty: false`).
This machine has no PostgreSQL binary for `embedded-postgres`, so steps 3a/3b must run on a machine that has it.

```bash
node scripts/industry/run-acceptance.mjs --dry-run
node scripts/industry/run-acceptance.mjs --postgres --browser
```

`--postgres` runs the mapped `journey-industries-{1..4}.pg.test.ts`; `--browser` runs
`apps/web/e2e/journey-industries.spec.ts` through Playwright (`apps/web`: `pnpm test:e2e` is the same runner).

## 4. Regenerate every derived document

```bash
node scripts/industry/generate-industry-registry.mjs
node scripts/industry/generate-industry-diff.mjs
node scripts/industry/generate-coverage-table.mjs
node scripts/generate-capability-matrix-csv.mjs
node scripts/industry/generate-gap-matrix.mjs
node scripts/industry/generate-sellable.mjs
node scripts/industry/generate-industry-docs.mjs
node scripts/migrations/pending-ledger.mjs
```

Then `node scripts/industry/generate-sellable.mjs --check` and
`node scripts/industry/generate-industry-docs.mjs --check` must exit 0.

## 5. Backup / restore

There is **no restore path in the product** (see `V72-OPERATIONS-RUNBOOKS.md` §4). The drill you can run
today is Supabase's own point-in-time restore into a separate project; record the result there.

## 6. Decisions waiting for you

See `V72-OPEN-DECISIONS.md`.
