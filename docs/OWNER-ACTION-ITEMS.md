# Hisabche — Owner Action Items (only what YOU must do)

Updated at HEAD `f2df3731` after the owner reported that all migrations were applied and confirmed
from `information_schema` that `accounts` now has a NOT NULL `workspace_id`.

Everything code-side that can be done safely is implemented in the working tree. The items
below genuinely need your hand, your environment or your signal. Nothing here is claimed as
applied by the coding agent.

## 1. Apply ONE new migration — `docs/sync-account-tenancy-coverage-migration.sql`

The earlier `docs/sync-entity-coverage-migration.sql` already covered four entities. The final
two are now implemented in code and need their server DDL:

- `accounts` — receives a version column, a bump trigger and a change-log trigger under the
  protocol name `account`. The tenancy question is **RESOLVED**: `docs/accounting-core-migration.sql`
  already added `accounts.workspace_id` and backfilled it; your `information_schema` output
  confirms it is NOT NULL. No tenant was invented.
- `inventory_settings` — receives a stable `id` (its primary key stays `workspace_id`) so the
  keyset snapshot and the device's id-based upsert can address the single settings row.

Run, in order:

```
docs/sync-account-tenancy-coverage-migration.sql
docs/VERIFY-sync-account-tenancy-coverage.sql
```

The migration is guarded and safe to re-run. Record the result as
`Post-migration verification query generated — PENDING HUMAN CONFIRMATION`; do not mark PASS
from a source file alone.

When this is applied, the device code is already ready: all five entities are in
`PULLED_TABLES`/`DELTA_ENTITIES`, with server pull columns, device mappers, local `version`
columns (local schema v36) and push refusal by name. Existing devices rehydrate on next sync
because their stamps for the new tables are missing.

## 1b. Commit the temporary Postgres cleanup (no decision needed)

The 968 embedded-Postgres files under `backend/src/__tests__/.pg-sync-scope-55723/` are deleted in the
working tree and `.gitignore` now ignores `backend/src/__tests__/.pg-*/`. Just include the deletions in
your next commit — no reset, no history rewrite. The file names inspected (`PG_VERSION`, `base/1/…`)
are a test cluster, not source; review the diff if you want before committing.

## 2. Re-run the PostgreSQL witness suites (environment prerequisite)

If embedded Postgres still fails with `SeCreateGlobalPrivilege`:

- `secpol.msc` → Local Policies → User Rights Assignment → **Create global objects**
- add your Windows account, then **sign out and back in**

Then:

```
cd backend && npx vitest run --project pg
cd backend && npx vitest run --project pg src/__tests__/sync-entity-coverage.pg.test.ts src/__tests__/sync-account-tenancy-coverage.pg.test.ts
```

Until then the `*.pg.test.ts` suites provide no live witness (they exit without asserting).

## 3. Verification only you can perform (production evidence)

| Evidence            | Action                                                                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Browser E2E         | the 10 onboarding scenarios in `docs/onboarding/ONBOARDING-ARCHITECTURE.md`                                                                                                                                              |
| Internet cut        | install, disconnect, create an invoice, restart, confirm it survives                                                                                                                                                     |
| Exactly-once        | offline changes → reconnect → count server rows                                                                                                                                                                          |
| Conflict            | conflict an invoice/payment, confirm both versions survive and are reviewable                                                                                                                                            |
| Archive round-trip  | export from a real device, import into a new cloud workspace, reconcile                                                                                                                                                  |
| Local restore drill | in the Sync Centre choose a portable archive, restore into a FRESH empty workspace, then reconcile `invoices`, `payments`, `journal_lines` totals. A non-empty workspace must refuse it with `RESTORE_TARGET_NOT_EMPTY`. |
| Windows packaged    | install the built app (you authorise any build)                                                                                                                                                                          |
| Android physical    | run on a real phone                                                                                                                                                                                                      |
| Performance         | low-memory Android + ordinary Windows, measured — not guessed                                                                                                                                                            |

Automated harnesses/scripts for these are code-side work and are already in the repository;
only the real-device execution remains yours.

## 4. Deployment order

1. Apply the migration in step 1
2. Deploy **backend**
3. Deploy web / desktop / mobile
4. Run the acceptance tests above

## 5. Explicitly NOT asked of you

No commit, push, build, dependency change, `.env` access or live DDL was performed by the
agent. All changes are uncommitted in the working tree at HEAD `b54636fa`.

Full evidence: `docs/prompts/THE-LAST.md`, `docs/audits/V2-PHASE-REVIEW.md`,
`docs/audits/REMAINING-PHASES-CLOSURE.md`.
