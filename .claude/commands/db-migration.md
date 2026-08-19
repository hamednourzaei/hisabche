---
description: Plan and write a schema migration safely
---

Create a migration for $ARGUMENTS using the `hisabche-database` skill.

Do not write SQL until you have:

1. Read `documents/DATABASE_SCHEMA.md` and the service that will use the field.
2. Confirmed no existing column can carry it.
3. Confirmed it is genuinely persisted rather than derived.

Then write `docs/<name>-migration.sql`:

- `add column if not exists`, `create index if not exists`
- additive only, defaults for `not null`
- a head comment explaining why the column exists, its shape, and what an
  absent value means

Make the code work **before and after** the migration: catch Postgres `42703`,
retry without the column, and fail loudly with the migration name if the write
specifically needed it.

You cannot run the migration. Say clearly that it needs applying to Supabase.
