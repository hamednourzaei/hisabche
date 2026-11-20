# Hisabche — Supabase Database Reference

## 1. Registration

| Field                | Value                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| Registered name      | `HISABCHE_SUPABASE_SCHEMA_SNAPSHOT`                                                              |
| Path                 | `docs/supabase-All-detail.md`                                                                    |
| Format               | Ten concatenated JSON arrays inside a Markdown file (not prose)                                  |
| Size at registration | 2,665.3 KB · 91,113 lines                                                                        |
| Capture date         | **Unknown** — the export contains no timestamp field. Do not infer one from the Git commit date. |
| Nature               | Metadata captured from the Hisabche Supabase project through Supabase SQL Editor                 |

This document is the **primary engineering reference for the observed database structure**. It is a
snapshot: what the metadata export saw at capture time. It is not a live connection, not a test
result, and not proof of runtime behavior.

Every AI agent working on Supabase, PostgreSQL, Drizzle, accounting, inventory, permissions, RLS,
migrations, or synchronization **must consult it before proposing a database change**. Do not
rediscover or invent the schema when the answer is already in the snapshot. If the snapshot does not
cover an object category, say so explicitly instead of treating absence as proof.

## 2. What the snapshot contains

Measured at registration (counts are of this file, not of the live database):

| #   | Section                     |  Rows | Key fields                                                                                       |
| --- | --------------------------- | ----: | ------------------------------------------------------------------------------------------------ |
| 1   | Objects                     |   377 | `object_name`, `object_type` (364 TABLE, 13 VIEW), `rls_enabled`, `rls_forced`, `estimated_rows` |
| 2   | Columns                     | 4,303 | `table_name`, `column_name`, `data_type`, `is_nullable`, `column_default`                        |
| 3   | RLS summary                 |   364 | `has_workspace_id`, `rls_enabled`, `policy_count`                                                |
| 4   | Policies                    |   204 | `policyname`, `permissive`, `roles`, `cmd`, `using_expression`, `with_check_expression`          |
| 5   | Constraints                 | 1,556 | `constraint_type`, `definition`, `is_validated`                                                  |
| 6   | Indexes                     | 1,035 | `indexname`, `indexdef`                                                                          |
| 7   | Functions                   |   461 | `security_definer`, `arguments`, `function_settings`                                             |
| 8   | Triggers                    |   116 | `trigger_name`, `function_name`, `trigger_definition`                                            |
| 9   | Migration tracking          |     1 | `supabase_migration_table`, `public_drizzle_migrations`, `drizzle_migrations_schema`             |
| 10  | Legacy / sync purpose notes |    23 | `purpose`, `existence`, `has_workspace_id`, `policy_count`                                       |

`estimated_rows` is `-1` throughout: the snapshot carries **no row counts**. Section 9 reports all
three migration-tracking lookups as `null`. Neither migration history nor data volume can be
established from this file.

## 3. Source-of-truth hierarchy

When sources disagree, use this order and record the disagreement:

1. **Current live Supabase database** — actual runtime state (only an authorised live inspection can establish this).
2. **`HISABCHE_SUPABASE_SCHEMA_SNAPSHOT`** — the captured metadata, with its unknown capture date.
3. **Migration history** — intended schema evolution (`docs/*-migration.sql`, verified by `VERIFY-*.sql`).
4. **Application schema definitions** — Drizzle / local SQLite definitions (`packages/db-schema`, `packages/app-bridge`).
5. **Backend implementation** — the behaviour that actually runs.
6. **Tests** — verified behaviour inside their own scope.
7. **Documentation and comments** — architectural intent, not proof.

Rules:

- Report the exact disagreement before changing anything.
- Establish which source is newer only when there is real evidence; a Git commit date is not evidence about when the snapshot was captured.
- Classify the difference: intentional, legacy, an applied-but-uncaptured migration, or a defect.
- Never silently edit one source to match another.
- Never assume the snapshot is newer than the repository migrations, or vice versa.
- Mark unresolved live discrepancies `PENDING LIVE VERIFICATION`.
- A newer verified live inspection overrides this snapshot.

## 4. How to review a future database change

1. Read the relevant sections of the snapshot (columns, constraints, indexes, policies, triggers, functions).
2. Read the corresponding `docs/*-migration.sql` and its `VERIFY-*.sql`.
3. Find the real application caller (`backend/src/services/...`, routes, hooks, local engine).
4. Identify the existing source of truth and the compatibility constraint it enforces.
5. Decide whether the behaviour already exists; extend it instead of adding a parallel table,
   ledger, permission engine, sync engine, or business rule.
6. Produce: problem + evidence, existing implementation, proposed change, impact, backward
   compatibility, migration, rollback, verification SQL, required tests, and the explicit note that
   the migration is **not applied** until a person runs it.
7. Record any difference from the snapshot in the change description rather than rewriting it.

## 5. What this snapshot cannot prove

It does **not** establish:

- current live database state, or that any migration has been applied;
- correct business logic or accounting calculations;
- correct RLS enforcement at runtime (policy text is not a runtime test);
- successful offline synchronisation or convergence;
- production readiness;
- complete migration history (section 9 found no tracking tables);
- referential or transactional integrity (a constraint can be `NOT VALID`; triggers can be disabled);
- view security behaviour — the snapshot lists views but carries no `security_invoker` flag;
- row counts or data volume (`estimated_rows = -1`);
- who captured the export or when.

A table's presence proves only that the object existed in the captured metadata. A policy's presence
proves only that a policy definition existed. Neither is a witness for runtime behaviour.

## 6. Reading conventions

- `is_nullable = NO` is the snapshot's NOT NULL; it is not a guarantee about a newer live column.
- `rls_enabled = true` with `policy_count = 0` means default-deny for roles subject to RLS; it does
  not by itself show whether a service role bypasses it.
- `permissive = PERMISSIVE` is not the same as "restrictive policy exists" — the snapshot currently
  lists 204 PERMISSIVE and 0 RESTRICTIVE policies.
- `is_validated = false` (or a `NOT VALID` definition) means existing rows were never checked.
- Section 10's `purpose` strings are the export's own classification (e.g. "Legacy frozen ledger",
  "Inventory quantity source of truth"). They are useful evidence of intent, not a runtime proof.

## 7. Proposed central-instruction change (not applied)

The smallest appropriate pointer in `AGENTS.md`, to be added by the owner if he wants it global:

```md
- Any database, RLS, migration, accounting, inventory or sync work: read
  `docs/architecture/SUPABASE-DATABASE-REFERENCE.md` first; it registers
  `docs/supabase-All-detail.md` (`HISABCHE_SUPABASE_SCHEMA_SNAPSHOT`).
```

It was not added here because global instructions are the owner's scope. The reference document above
is the permanent entry point regardless.

## 8. Related audit

The read-only consistency audit against repository evidence is reported in the final response and
summarised in `docs/prompts/THE-LAST.md`. Findings are classified as confirmed, potential, legacy,
intentional, missing evidence, or `PENDING LIVE VERIFICATION`; no database change was made.
