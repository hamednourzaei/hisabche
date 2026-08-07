# Hisabche — Database Migration Policy

> Financial data = misuse of migrations is unacceptable. These rules are
> mandatory for any schema change. Applies to the Postgres server schema
> (`backend/drizzle-schema.ts`) and the desktop offline mirror
> (`apps/desktop/electron/main/db/schema.ts`).

## Golden Rules

1. **Never modify production schema manually.**
   Every change is a migration, applied through the migration system. No
   `ALTER TABLE` by hand, no ad-hoc SQL in production beyond scripted,
   reviewed migrations.
2. **Every schema change requires a migration.**
   Schema source = Drizzle (`backend/drizzle-schema.ts`) → generate
   migration with `drizzle-kit` → commit migration + meta. The desktop
   offline mirror must be updated in the same change if the table is
   mirrored.
3. **Migrations must support a rollback strategy.**
   Migrations are additive where possible; a destructive migration must be
   reversible (document how) or explicitly approved.
4. **Never delete columns immediately.**
   Remove data-affecting columns only after a release cycle:
   `deprecated` → confirmed no readers → dropped.

## The Deprecation Flow (removing a column)

```
old_column (still read & written)
    │
    ▼   release N: new_column added (nullable, backfilled)
old_column + new_column (dual-write, read from new)
    │
    ▼   release N+X: data_verified, app no longer reads old_column
old_column dropped
```

- Step 1 release: add the new column + backfill existing rows as a data
  migration.
- Step 2 release: app reads/writes the new column; the old one is
  deprecated (kept, no longer sourced).
- Step 3 release (after the old column has no readers in prod): remove it.

## Rollback Strategy

- **Prefer forward-only migrations that are additive** (new tables,
  nullable columns) — rollback = revert the app code, keep the column.
- For a **destructive** migration (drop column/table, data reshape):
  - the migration SQL is written so its inverse is documented in a comment
    at the top of the migration file;
  - or the change is shipped as a **two-phase** migration to allow
    rollback of code without data loss (see Deprecation Flow).
- `docs/*.sql` out-of-band scripts (e.g.
  `workspace-stamp-migration.sql`) must have the same review + backup
  discipline as Drizzle migrations.

## Migration Mechanics

### Server (backend)

- Source: `backend/src/drizzle-schema.ts`.
- Generate: `drizzle-kit generate` (config `backend/drizzle.config.ts`).
- Output: `backend/drizzle/migrations/*.sql` + `meta/` (journal).
- Apply: `drizzle-kit migrate` against the configured DSN, or a reviewed
  SQL apply in a maintenance window.
- Existing history: `0000_loose_bishop.sql`, `0001_dry_avengers.sql`
  (initial schema, then user_id + RLS indexes).

### Desktop offline mirror

`apps/desktop/electron/main/db/schema.ts`:

- `SCHEMA_VERSION = 1` gates the local SQLite `CREATE_STATEMENTS`.
- Any server column change to a mirrored table must be reflected here
  (and `WRITABLE_COLUMNS` / `SEARCHABLE_COLUMNS` if affected).
- Local-only evolution: bump `SCHEMA_VERSION` with a migration path keyed
  by version (destination-only; destructive local changes are safe because
  the server DB is authoritative and repulls).

### Web/mobile WatermelonDb

`packages/db/src/schema/`:

- WatermelonDb migrations live beside the schema
  (`migrations` entries with `toVersion`). Bump version + add a migration
  step for each change (WatermelonDb requires explicit versioned
  migrations).

## Checklist for any schema PR

```text
[ ] new Drizzle migration generated & committed
[ ] desktop SQLite mirror updated (if table mirrored) — SCHEMA_VERSION bump if needed
[ ] WatermelonDb migration bump (if model touched)
[ ] rollback described (or known-safe additive)
[ ] no immediate column DELETE
[ ] data backfill included (data migration step) where new NOT NULL column added
[ ] `type-check` + `test` pass for all consumers
```

## Prohibited

- Editing an existing migration file after it has been applied (write a
  new migration instead).
- Manual `ALTER TABLE` in prod console.
- Dropping a column in the same release that adds its replacement.
- Changing `numeric` precision on money in place without dual-write.

## Money column rule

`numeric(12,2)` for money — never lossy re-type in place; any precision
change goes through the Deprecation Flow above.
