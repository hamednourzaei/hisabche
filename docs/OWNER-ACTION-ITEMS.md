# Hisabche — Owner Action Items (only what YOU must do)

Everything code-side that could be done safely is already implemented in the working tree.
The items below CANNOT be done by the coding agent — they need your hand, your environment or
your decision. Nothing here has been executed or claimed as applied.

## 1. Apply pending SQL migrations — in this exact order

1. `docs/tenancy-workspace-migration.sql` (if not already applied — prerequisite of the sync engine)
2. `docs/sync-engine-migration.sql` (change log, cursor, idempotency, versions)
3. **`docs/sync-entity-coverage-migration.sql`** (NEW this session — four missing sync entities)
4. `docs/onboarding-server-state-migration.sql` (profile onboarding columns)
5. the other pending migrations listed in `docs/MIGRATIONS-PENDING.md` (roll-cutting, WP-13/15/19, …)

For each: run the matching `docs/VERIFY-*.sql` afterwards and confirm every check is true.
Status to record: `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`.
No migration may be marked PASS until you have run it.

## 2. Fix the PostgreSQL test environment

Embedded Postgres fails with `SeCreateGlobalPrivilege` (error 1314).

- Open `secpol.msc` → Local Policies → User Rights Assignment → **Create global objects**
- Add your Windows account, then **sign out and back in**
- Then run:
  ```
  cd backend && npx vitest run --project pg
  cd backend && npx vitest run --project pg src/__tests__/sync-entity-coverage.pg.test.ts
  ```

Until then the 168 `*.pg.test.ts` files cannot provide a live witness.

## 3. Decision required — `accounts` tenancy

`public.accounts` has `user_id` but **no `workspace_id`** (see
`docs/FINDING-sync-account-tenancy.sql`). A change-log trigger cannot route its rows to a
workspace. You must decide the backfill rule for historical accounts (which workspace owns each
row). Do NOT invent one. After your decision:

- add the tenancy column + backfill migration,
- then enable the `account` change-log trigger,
- then add `account` to `DELTA_ENTITIES`/`PULLED_TABLES` and remove it from `NOT_PULLED_YET`.

## 4. Decision required — widen local sync lists ONLY after step 1.3

After the sync-entity migration is actually applied and verified, move these four entities from
`NOT_PULLED_YET` into `PULLED_TABLES` / `DELTA_ENTITIES` (in `device-sync-state.ts` and
`sync-engine.ts`): `cost_layer`, `stock_batches`, `stock_serials`, `inventory_settings`.
Doing it BEFORE the server triggers exist makes devices wait forever for changes nobody emits.

## 5. Verification you must perform (production evidence)

| Evidence                 | Command / action                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------ |
| Live database            | steps 1–2 above                                                                      |
| Browser E2E              | run the 10 onboarding scenarios in `docs/onboarding/ONBOARDING-ARCHITECTURE.md`      |
| This internet cut        | install on Windows/Android, disconnect, create invoice, restart, confirm it survives |
| Reconnect exactly-once   | create offline changes, reconnect, count server rows                                 |
| Conflict review          | conflict an invoice/payment, confirm both versions survive and are reviewable        |
| Full archive round-trip  | export from a real device, import into a new cloud workspace, reconcile balances     |
| Windows packaged runtime | install the built app (you authorise any build)                                      |
| Android physical device  | run on a real phone                                                                  |
| Performance baselines    | low-memory Android + ordinary Windows, measured — not guessed                        |

## 6. Deployment order (when you are ready)

1. Apply migrations (step 1)
2. Deploy **backend**
3. Deploy web / desktop / mobile
4. Run the five acceptance tests above

## 7. What is deliberately NOT asked of you by the agent

No commit, no push, no build, no dependency change, no `.env` access, no live DDL was performed
by the agent. All code changes are uncommitted in the working tree at HEAD `b54636fa`.

Full status and evidence: `docs/prompts/THE-LAST.md` (PART 8–11),
`docs/audits/V2-PHASE-REVIEW.md`, `docs/audits/REMAINING-PHASES-CLOSURE.md`.
