---
name: hisabche-migrations
description: Writing a Supabase migration the owner will run by hand — the file, its VERIFY query and the real-Postgres test, with the privilege, trigger and idempotency rules that have each failed on the live database before. Use before creating any docs/*-migration.sql.
---

# Migrations for the live Supabase database

You never run DDL on the live database. You produce three files; the owner
runs the first two in the SQL Editor and pastes the VERIFY rows back.

```
docs/<name>-01-migration.sql          additive, idempotent, with ROLLBACK
docs/VERIFY-<name>-01.sql             read-only; one row per check: (check, ok)
backend/src/__tests__/<name>.pg.test.ts
```

Copy the shape from `docs/late-fees-01-migration.sql`,
`docs/shift-assignments-01-migration.sql` and their tests.

## The migration file

Header comment, in this order: what it adds in plain words, the rules the
database holds, `⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE`,
which VERIFY to run after, and any script that must run **first**.

- `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
  `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`.
  It must run twice without error or change.
- `workspace_id uuid NOT NULL` on every tenant table.
- Money columns are integers (`*_minor bigint`, hundredths) with `CHECK (> 0)`.
  A fixed amount has a `currency` column and a CHECK tying the two together.
- Retirement, not deletion: `is_active boolean NOT NULL DEFAULT true` and a
  partial unique index `WHERE is_active` for «one active X per name».
- Defaults are explicit. A policy defaults to **off**.
- Depends on another script → a `DO $$ … RAISE EXCEPTION 'Run … first' $$`
  block at the top, not a silent failure halfway.
- A column that may not exist yet on the live database → read it through
  `to_jsonb(row) ->> 'column'` so the script runs either way.

### Privileges — the part that failed on the live database

On Supabase every new table and function arrives with **ALL** granted to
`anon`, `authenticated` and `service_role`. A `GRANT SELECT, INSERT` on top
removes nothing.

```sql
ALTER TABLE public.x ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.x FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.x TO service_role;   -- never DELETE

REVOKE ALL ON FUNCTION public.f(...) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.f(...) TO service_role;    -- when the backend calls it
NOTIFY pgrst, 'reload schema';
```

### Rules that must survive two people at once

- «Once per (a, b, c)» → a UNIQUE index on the natural key.
- «No overlap» → a BEFORE INSERT trigger that takes
  `pg_advisory_xact_lock(hashtextextended(key, 0))` and then checks.
- Append-only / forward-only → a `BEFORE UPDATE OR DELETE` trigger that allows
  exactly one named change and raises `X_IMMUTABLE` for everything else.
  Compare with `to_jsonb(NEW) - 'allowed_col' IS DISTINCT FROM to_jsonb(OLD) - 'allowed_col'`.
- Values the caller must not choose (a snapshot of hours, a name) are
  overwritten inside the BEFORE INSERT trigger.
- A function that both changes state and must report failure **returns** the
  outcome; `RAISE` would roll the change back.

### Rollback block

Commented SQL at the end, with one sentence on what is lost and what is not.

## The VERIFY file

One `SELECT … UNION ALL …` returning `(check text, ok boolean)`; every row
should be true. Always include:

- each table / function / trigger / index exists;
- RLS is enabled;
- `anon` and `authenticated` have **no** grant;
- `service_role` has no `DELETE` / `TRUNCATE`;
- one data invariant («nobody is planned for two overlapping shifts»).

Name the **subject** in a privilege check (which role), not only the
privilege. Never call a function whose rows are other tenants' figures.

## The pg test

`embedded-postgres` + `postgres`, a random port, its own database. In setup:

```sql
CREATE ROLE anon / authenticated / service_role (NOLOGIN; service_role BYPASSRLS);
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
```

Without those two `ALTER DEFAULT PRIVILEGES` lines the test checks an
environment that does not exist, and stays green while the live VERIFY fails.

Then:

1. Create the minimal prerequisite tables the script touches.
2. Run the migration **twice**, unchanged, from the file.
3. Run the VERIFY file and assert no row has `ok !== true`.
4. One test per database-held rule, asserting the **name** of the refusal.
5. A concurrency test with `Promise.allSettled`: exactly one fulfilled, exactly
   one rejected, and the rejection message is the expected one.
6. `SET LOCAL ROLE service_role` cannot DELETE; `authenticated` cannot SELECT.

Traps in the test file itself:

- No backtick inside an SQL comment within a template literal — it ends the
  string and breaks the owner's pre-commit.
- `postgres.js`: pass JSON with `sql.json(value)`; `${json}::jsonb`
  double-encodes.
- Destructure rows as `const [row] = …; row!.count`, not `[{ count }]`
  (`noUncheckedIndexedAccess`).
- Build dates with `new Date(Date.UTC(y, m, d + n))`, never by string maths.

## In the service

Reading a schema that may not be there yet returns «not set up», not 500:

```ts
const MISSING_SCHEMA = new Set(['42703', '42P01', 'PGRST202', 'PGRST204', 'PGRST205'])
if (MISSING_SCHEMA.has(error.code ?? '')) throw new XNotConfiguredError() // 503, X_MIGRATION_PENDING
```

When an OPTIONAL later migration is missing and «none» is the true answer
(nobody is on a price list before price lists exist), catch only that typed
error and return the true answer. Any other failure stays a failure.

## In the report

`Post-migration verification query generated — PENDING HUMAN CONFIRMATION`,
and the scripts listed in the order they must be run.
