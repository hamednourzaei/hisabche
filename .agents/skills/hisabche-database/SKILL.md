---
name: hisabche-database
description: Any schema change, migration, new column or table, or question about how data is stored. Use before adding a field to the database.
---

# Database and migrations

Postgres via Supabase. Read `documents/DATABASE_SCHEMA.md` and
`documents/DATABASE_MIGRATION_POLICY.md` before changing anything.

## Before proposing a migration

1. Read the schema doc and the relevant service.
2. Ask whether an existing column can carry it. **Never invent a table or column
   when an existing model supports the requirement.**
3. Confirm the field is genuinely persisted, not derived. A party's buyer/seller
   role is derived from invoice direction and deliberately has no column;
   `customers.type` already means payment terms and must not be repurposed.
4. Only then write the migration.

## How migrations work here

Hand-written SQL in `docs/`, applied manually by the maintainer against Supabase.
Drizzle exists (`backend/drizzle/migrations/`, `drizzle.config.ts`) and runs in
the deploy, but feature migrations follow the `docs/*.sql` convention.

**You cannot run these.** Write the file, say clearly it needs running, and make
the code work before and after.

Existing examples to copy the shape from:

```
docs/task-assignment-migration.sql
docs/task-customer-outcomes-migration.sql
docs/workspace-member-fields-migration.sql
docs/unified-sale-purchase-migration.sql
```

## Rules for the SQL

- `add column if not exists`, `create index if not exists` — idempotent.
- Additive only. Never drop a column in the same migration that stops using it;
  deprecate first (see the migration policy doc).
- `not null` needs a default, or existing rows fail.
- Add the index the new query needs, in the same file.
- Head comment explaining _why_ the column exists and what its shape is,
  including what an absent value means.

## Code must tolerate its absence

Until the migration runs, selecting the column raises `42703`. Follow the
existing fallback: retry without it, and if the write specifically needed that
column, fail loudly with the migration name — succeeding silently tells the user
their data was saved when it was discarded.

## Domain invariants the schema encodes

- `invoices.type` is `sale | purchase`; NULL means sale (legacy rows).
- Invoice items keep `quantity`, `unit`, `unit_label` and `weight_grams` as
  separate fields. Collapsing them loses real information for weighted goods.
- `invoice_item_details` holds nested line components (stone, chain, labour).
- Stock direction: purchase `+`, sale `−`. See `batchUpdateStock` in
  `invoice.service.ts`.

## RLS

Tables have RLS enabled. The backend uses the `service_role` key, which bypasses
it — so a `42501` from the backend almost always means the client lost its
service role, not that a policy is missing. Read the `hisabche-auth` skill
before adding a policy to "fix" it.

## Validation

```bash
cd backend && npx tsc --noEmit && npx vitest run
```

Add a test for any new invariant to `packages/validation`.

## Common mistakes

- Adding a column for something derivable.
- Repurposing an existing column whose meaning is already established.
- Non-idempotent SQL.
- No fallback, so the deploy breaks between code and migration.
- Adding an RLS policy to work around a service-role bug.
