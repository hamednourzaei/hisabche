# M5 apply runbook (decision tree driven by the state probe)

> Written from the files in this repository (hashes in `M5-POST-APPLY-CHECKLIST.md`), not from memory. The agent never ran any of this on a
> real database; PGlite proofs of every branch are listed in section 6.

## 0. Read this first

- **"Success. No rows returned" is NOT a verification.** It is what the Supabase SQL editor prints after statements that return no rows
  (`CREATE FUNCTION`, `ALTER TABLE`, `COMMENT`). It proves the statements did not error. It does not say which definition is installed
  or that behaviour is correct. Only a result table with `pass = true` rows (section 3) verifies anything.
- Never edit an already-applied migration. Never re-run a half-applied file by hand. If a step fails midway, stop and send the error.
- Take a snapshot/backup before step 1 and before the backend deployment.

## 1. Run the state probe (read-only) and send the table

`docs/PROBE-m5-state.sql` → one result table: `object | exists | version_marker | fingerprint | note`. It writes nothing and never errors on a
missing object. Choose the branch:

| State                      | How it looks in the probe                                                                            | Do                                         |
| :------------------------- | :--------------------------------------------------------------------------------------------------- | :----------------------------------------- |
| **S1 fresh**               | every M5 object `exists = false`                                                                     | section 2                                  |
| **S2 old definitions**     | objects exist, `version_marker` is NULL, a fingerprint says `OLD ...`                                | section 4                                  |
| **S3 current definitions** | objects exist, fingerprints `ok`, markers NULL or `rev2`                                             | section 5                                  |
| **S4 unexpected**          | an interval-shaped suspension table (`starts_on` present / `kind` absent), a missing table or column | **STOP**, send the table. Do not hand-edit |

## 2. S1 — fresh database: apply the full chain

Order and files (never skip a file; run each as ONE script, then its VERIFY):

1. `docs/accounts-role-deferred-and-loss-01-migration.sql` → `docs/VERIFY-accounts-role-deferred-and-loss-01.sql` (both true)
2. `docs/invoice-write-grant-01-migration.sql` → `docs/VERIFY-invoice-write-grant-01.sql` (both true)
3. `docs/package-deferred-revenue-01-migration.sql` → `docs/VERIFY-package-deferred-revenue-01.sql` (every `*_ok` true)
4. `docs/invoice-return-06-scrap-loss-migration.sql` → `docs/VERIFY-invoice-return-06.sql` (`trigger_ok`, `fn_private_ok`, `role_inventory_loss_ok` true)
5. `docs/profit-ledger-totals-01-migration.sql` → `docs/VERIFY-profit-ledger-totals-01.sql` (both true)
6. `docs/m5-forward-fix-01-migration.sql` (writes the version markers; a functional no-op here)
7. `docs/VERIFY-m5-combined.sql` — every `pass` must be `true`.

## 3. How to read the combined VERIFY

`check_name | expected | actual | pass`, 27 rows, never "no rows". Rows 1–19 are catalog facts (exact). Rows 20–22 are **fingerprints** of the
installed function text (heuristic, not proof of behaviour). Rows 23–27 are **version markers**: they read `(none)` / `false` until the
forward-fix has been applied, which is expected on a database that was applied before the forward-fix existed.

## 4. S2 — old definitions: forward-fix, do NOT re-run applied originals

1. Run `docs/m5-forward-fix-01-migration.sql` (idempotent; replaces the five changed functions, re-creates their triggers, writes markers).
2. If `profit-ledger-totals-01` was never applied (probe: `function accounting_profit_ledger_totals` absent), apply it first, then the forward-fix.
3. Run `docs/VERIFY-m5-combined.sql`; all 27 `pass`.

## 5. S3 — current definitions already installed

1. Run the forward-fix anyway: it is a no-op on behaviour and adds the version markers (rows 23–27).
2. Apply `profit-ledger-totals-01` if the probe shows it absent.
3. Run `docs/VERIFY-m5-combined.sql`; all 27 `pass`.

## 6. What was proven where (PGlite, single connection — logic only)

| Branch                                                                      | Proof                                                                                                                               | Result      |
| :-------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- | :---------- |
| empty database                                                              | probe and combined VERIFY return rows, never error                                                                                  | 2/2         |
| S1 fresh chain + forward-fix                                                | all 27 checks pass; cancelled sale nets to 0                                                                                        | 3/3         |
| S2 old definitions (the two ledger sums put back to their first definition) | probe says OLD; the bug is real (−100 for a cancelled sale); forward-fix repairs it; all checks pass                                | 3/3         |
| S3 / double forward-fix                                                     | one trigger of each kind, a delivery afterwards allocates once and recognises revenue once                                          | 2/2         |
| NOT_RECONSTRUCTABLE                                                         | the first copy of `invoice_write_document` (not valid SQL, never installable); an interval-shaped suspension table (reported as S4) | not guessed |

## 6b. Owner database — first combined VERIFY (2 Nov 2026)

22 of 27 rows `pass` first (the 5 marker rows read `(none)` before the forward-fix); AFTER the forward-fix the owner reported 27 of 27 (checklist section 12). Reading: the schema objects exist
with the event-shaped suspensions and the corrected fingerprints; apply the forward-fix (S3 path) and re-run to get 27/27.

## 7. Backend deployment

Migrations first, then the backend, with `PACKAGE_DEFERRED_REVENUE` unset (OFF) and the device `package_deferred_revenue` key OFF. A backend
that runs before `invoice-write-grant-01` refuses a package sale with `PACKAGE_GRANT_MIGRATION_REQUIRED` naming the file (nothing is written);
a sale without a package keeps working.

## 8. Rollback limits

Nothing here edits history. The triggers can be dropped; allocation, suspension and journal rows already written stay as audit trail. Tables
and columns stay. An older function body can be restored only by re-running an older copy of its file — do not.
