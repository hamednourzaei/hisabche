# Prompt: Safe schema migration + verification (Supabase / PostgreSQL)

Copy everything below the line into any capable AI coding assistant.
Replace `<<CHANGE>>` with what you actually want done.

---

You are making a schema change to a **production financial database**. Wrong
data here means a real business is lied to about its own money. Work
accordingly.

## The change

<<CHANGE — e.g. "add workspace_id to the subscriptions table so a subscription
belongs to a workspace instead of a user">>

## Rule 0 — the database is the authority

Do not trust schema documentation, README files, ORM models, or the existing
code's assumptions about what columns exist. All of them go stale, and a
migration designed against a stale doc has to be undone.

Before writing anything, ask me to run this and wait for the output:

```sql
SELECT table_name, column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name IN ('<<the tables you care about>>')
 ORDER BY table_name, ordinal_position;
```

If you need a fact you cannot derive from what I have given you, **ask for a
read-only query and wait**. Do not proceed on an assumption and do not say
"assuming the schema is X". State plainly that you are blocked and on what.

## Rule 1 — never guess ownership

When backfilling a tenancy or ownership column, fill **only** rows that map to
exactly one candidate. Classify everything else and leave it NULL:

| case                                       | action                                                             |
| ------------------------------------------ | ------------------------------------------------------------------ |
| exactly one candidate                      | backfill — this is a fact, not a choice                            |
| zero candidates, but a real creator exists | ORPHANED — report; these are visible today and would disappear     |
| zero candidates and no creator at all      | UNRESOLVABLE — already unreachable; report but do not let it block |
| two or more candidates                     | AMBIGUOUS — only a human who knows the business can decide         |

Distinguish those last three explicitly. Lumping them together produces a
migration that blocks on rows no remediation could ever fix.

Never merge records. Never delete business data. Never overwrite a value a
human already set. Never invent a default that silently assigns everything to
one owner.

## Rule 2 — structure the migration as separately-runnable parts

Deliver ONE `.sql` file with numbered parts I can run one at a time:

```
PART 1  ANALYSE   read-only. Returns a table. Changes nothing. Safe on prod.
PART 2  ADD       nullable column + FK (NOT VALID) + indexes. Reversible.
PART 3  BACKFILL  deterministic rows only, then report what is left.
PART 4  VERIFY    row counts, primary keys, referential integrity,
                  and cross-tenant misassignment.
PART 5  ENFORCE   NOT NULL / VALIDATE CONSTRAINT — COMMENTED OUT.
        ROLLBACK  commented, and honest about when it stops being safe.
```

Requirements:

- `ADD COLUMN` with no DEFAULT and no NOT NULL (metadata-only on PG 11+).
- Foreign keys added `NOT VALID`, validated later — avoids a long lock.
- `ON DELETE RESTRICT` on anything touching financial history, never CASCADE.
- `PART 5` stays commented out. Enforcing NOT NULL before the application that
  writes the column is deployed rejects every new row. Say this in the file.
- The backfill must be **idempotent**: guard it with `WHERE col IS NULL` so a
  re-run cannot undo a human's decision on an ambiguous case.
- Every part prints a verdict I can read, not just a row count.

## Rule 3 — Supabase / pooler constraints

These are not hypothetical. Each one has broken a migration:

- **No psql meta-commands.** `\set`, `\echo`, `\i` are syntax errors in the
  Supabase SQL editor.
- **`RAISE NOTICE` output is hidden** there. Return results as ROWS.
- **The pooler runs in transaction mode.** Consecutive statements can land on
  different connections, so a `TEMP TABLE` created by one statement is gone for
  the next, and a `BEGIN … ROLLBACK` spanning statements is unreliable. If you
  need state across steps, put it in ONE statement — a `plpgsql` function that
  `RETURN NEXT`s its rows.
- **PL/pgSQL variables are not transactional.** If you record a result INSIDE a
  block that deliberately rolls back, the record rolls back too and the check
  vanishes from the output. Set a variable inside, write the row after.
- **Window functions are not allowed in `HAVING`** (it is evaluated first). Use
  the aggregate form: `GROUP BY x HAVING count(DISTINCT y) = 1`.
- **`min(uuid)` does not exist.** Use `(array_agg(DISTINCT x))[1]` together
  with a `HAVING count(DISTINCT x) = 1` — the HAVING is what makes `[1]` a fact
  rather than an arbitrary pick.
- **`AND` binds tighter than `OR`.** Parenthesise or your counts lie.
- A role you `SET ROLE` into does not own a temp table — it needs a `GRANT`.

## Rule 4 — write a preflight that fails closed

If the migration depends on a prior migration, start it with a `DO $$` block
that raises `feature_not_supported` when the precondition is missing.

Make the preflight measure the thing you actually care about, not a proxy. "Are
any rows NULL?" and "would this change hide something a user can see today?"
are different questions, and only the second one should block. A guard that is
imprecise blocks work it has no business blocking; sharpen it, never delete it.

## Rule 5 — then write the tests

After the SQL, write automated tests for the same rules, in the repo's existing
test framework and style:

1. The mapping rule as a pure function — one test per classification branch
   (mappable / orphaned / ambiguous / no-creator).
2. **A test that no refusal ever returns a value.** A guess shows up as a
   non-null result on a case that should have been refused.
3. Idempotency: a second run does not overwrite an already-set value.
4. Cross-tenant misassignment: the record never lands on someone else's tenant.
5. **At least one positive test.** A rule that rejects everything passes every
   "returns nothing" assertion. Prove the happy path still works.
6. The behavioural regression the change exists for — state it as a sentence
   first, then write the test for that sentence.

## Rule 6 — mutation-test the security assertions

Do not trust a green suite. For each critical rule:

1. Reintroduce the defect on purpose (delete the filter, invert the condition).
2. Run the tests. **They must go red.**
3. Restore the code and confirm green again.
4. Tell me which test caught it.

Do this in at least two different places. A guard tuned to one call site proves
nothing about the next one.

If a test cannot run in this environment, it must **FAIL**, not skip. A suite
guarded with `if (!available) return` reports green while asserting nothing —
worse than having no test at all.

## Rule 7 — verify, then report honestly

Run type-check, lint, and the full test suite. Then report, in this order:

1. What you changed — files, with paths.
2. The migration's parts and what each does.
3. What the verification proved, quoting actual output.
4. **What you did NOT do, and what remains unverified.** Be specific.
5. Anything you found that I did not ask about — especially absent filters.
6. The exact production run order, and the rollback procedure.

Rules for the report:

- Never say "should work", "presumably", or "assuming". Either you verified it
  or you did not.
- If a test fails, show the output. Do not summarise it away.
- If you make a mistake, correct it in one sentence and continue. Do not
  apologise at length.
- Do not claim completion because the code compiles or the UI renders.

## Rule 8 — never do these

- `git reset --hard`, `git checkout -- .`, `git clean`, `git stash pop/drop`,
  or any command that touches work you did not create. Inspect `git status` and
  `git stash list` before any stash operation.
- Weaken, skip, or delete a failing test to go green. Find the cause.
- Kill processes broadly (`taskkill /F /IM node.exe`). Kill the specific PID.
- Run a destructive command to make verification easier.

## Rule 9 — when you are genuinely blocked

Fail closed and say so. Do everything that does not depend on the unknown, then
state precisely:

- what you need,
- the exact read-only query that would answer it,
- and what you will do with each possible answer.

Do not guess. Do not pick the likely option and note it in passing. A decision
that belongs to the person who knows the business is not yours to make.

---

## Why this shape

The order is deliberate: **inspect → analyse read-only → change reversibly →
backfill deterministically → verify → enforce separately → test → mutation-test
→ report**.

Every step is recoverable until the last. The parts that are not recoverable —
`NOT NULL`, dropping a column, deleting a row — are either commented out or
absent, so applying them is always a deliberate human act rather than something
that happens because a script ran to the end.
