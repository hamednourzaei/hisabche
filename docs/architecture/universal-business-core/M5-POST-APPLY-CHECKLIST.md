# M5 — post-apply checklist (for the owner)

> The owner reports that the four M5 migrations were executed in Supabase and that "everything is OK". That is recorded as
> `APPLIED_BY_OWNER (owner-reported; VERIFY outputs not seen by the agent)`. The agent has not touched, queried or verified that
> database. Until the VERIFY outputs below are pasted back, the highest honest status is `IMPLEMENTED_NOT_LIVE_VERIFIED`.

## 1. Are the applied files the files in the repository?

Some of these files changed after they were first written (the grant migration lost the defaults on its trailing parameters because the first
version was not valid SQL; the deferred-revenue migration moved suspensions to append-only events and gained the profit-report function). If an
**earlier** copy was applied, the database does not match the code. Compare the hash of the file you applied with this list (`sha256sum <file>`
on Linux/macOS, `Get-FileHash <file>` on Windows):

| File                                                        | SHA-256                                                          |
| :---------------------------------------------------------- | :--------------------------------------------------------------- |
| docs/accounts-role-deferred-and-loss-01-migration.sql       | a3ea12702d3ef18fa4eeeeb58379e34a2fbd76216bc433efa4e85bf57e586c7f |
| docs/invoice-write-grant-01-migration.sql                   | e48ece59b41a4fe7a63b63c612f87de8235a5598fb7cbed97136d80e2ac2878b |
| docs/package-deferred-revenue-01-migration.sql              | cfaaaca18d7beefb36ded28bff9b6b73cd4f810f72e6bb272465de21d38cd6c9 |
| docs/invoice-return-06-scrap-loss-migration.sql             | 01b48bb69ac7932d055e405a9385b6bb76acc6e67c5843a3785ce2ffa3a8ce96 |
| docs/VERIFY-accounts-role-deferred-and-loss-01.sql          | b31fbe382d1b7e341fa2ac6e637c95a2383fb0eaaa2b63847b065d3c9b90637e |
| docs/VERIFY-invoice-write-grant-01.sql                      | 680421ce8954779bba1563cccbda9ac9b4f57cf816dab8376e91388241a603b4 |
| docs/VERIFY-package-deferred-revenue-01.sql                 | 9760d3e422fc788cae4023afb3bbac237b41ba1fcb467734bb6c712b0b4ec2c2 |
| docs/VERIFY-invoice-return-06.sql                           | 29639ffe6155a3d30275b1ff8100167ee32b157a974dda2f6f8243997bd0108d |
| docs/profit-ledger-totals-01-migration.sql (the FIFTH, new) | 55e1e0f7637f5d1944aa9df76a069b50ac5e7cd301ea766997f251335eca7a41 |
| docs/VERIFY-profit-ledger-totals-01.sql                     | 04721433dd3f54051682ad2275b0786daffab7440a99e1cad013733974ea08a7 |
| docs/FINDING-m5-post-apply.sql                              | 0dd000d974d8350d83cdbec6cbe9592aa10dc62a1abeecc02dd3af1a896a04af |

**Two files changed after they were first written, and the owner's copy may be the older one:** `package-deferred-revenue-01` (the ledger function behind the profit report now counts `reversed` originals - without that, cancelling a delivery was subtracted twice) and `invoice-write-grant-01` (valid SQL only after the first fix). Re-run the current copy of `package-deferred-revenue-01`: it is idempotent and `CREATE OR REPLACE` swaps the function.

If a hash differs, re-run the current migration: every one of them is written to be re-runnable. **One exception to know about:** a suspension
table created by an earlier interval-shaped version is NOT altered by `CREATE TABLE IF NOT EXISTS`; the `suspension_event_shape_ok` row of
the VERIFY below catches exactly that. If it is `false`, tell the agent; do not hand-edit the table.

## 2. Order and the VERIFY expected for each

| #   | Migration                                                               | VERIFY                                    | Expected                                                                                                                    |
| :-- | :---------------------------------------------------------------------- | :---------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| 1   | accounts-role-deferred-and-loss-01                                      | VERIFY-accounts-role-deferred-and-loss-01 | `has_deferred_revenue_in_check` and `has_inventory_loss_in_check` both true                                                 |
| 2   | invoice-write-grant-01                                                  | VERIFY-invoice-write-grant-01             | `invoice_write_document_11_args_exists` and `document_write_rows_exists` both true                                          |
| 3   | package-deferred-revenue-01                                             | VERIFY-package-deferred-revenue-01        | every `*_ok` column true; `legacy_*` columns are informational counts                                                       |
| 4   | invoice-return-06                                                       | VERIFY-invoice-return-06                  | `trigger_ok`, `fn_private_ok`, `role_inventory_loss_ok` true; `legacy_scrap_lines_without_loss` is informational            |
| 5   | profit-ledger-totals-01 (new; read-only function for the profit report) | VERIFY-profit-ledger-totals-01            | `function_exists` and `function_private` both true. Without it the report simply has no ledger block (never a made-up zero) |

Paste each output back. Run the SQL Editor blocks one at a time (it shows only the last result).

## 3. Anomaly detection (read-only)

Run `docs/FINDING-m5-post-apply.sql` block by block. Healthy: blocks 1–7 and 9 return no rows (block 9 may list returns made before migration 4 —
they were never booked as a loss and are not backfilled); block 8 is informational (stock written before costing existed can differ — review, do
not auto-correct). Blocks 1–7 are proven to be valid SQL on the migrated schema and 1–2 to be empty on a trigger-produced ledger (PGlite).

## 4. Before the backend is deployed

1. Take a backup/snapshot of the database.
2. Confirm sections 1–3 are done and green.
3. Deploy the backend **after** the migrations, with `PACKAGE_DEFERRED_REVENUE` unset (OFF). Do not switch the device `package_deferred_revenue`
   key on either. Enabling deferral is an owner decision.
4. Failure mode if the backend runs **before** a migration: a package sale is refused with `PACKAGE_GRANT_MIGRATION_REQUIRED` naming the file
   (nothing is written); a sale without a package keeps working; a delivery with an expired/suspended-only credit is refused by the trigger only
   after migration 3 exists; the profit report reads 0 deferred change when the function is absent (the true answer without deferral).

## 5. Staging smoke test (flags OFF, then ON on staging only)

Sell a package (single currency) → the GRANT exists with the invoice; deliver a session → one CONSUME, an allocation row, no journal entry while
deferral is OFF; sell a goods return with restock as a seller → accepted; scrap as a seller → refused with the localized reason; scrap as a manager →
a `return_scrap_loss` entry; suspend one GRANT as a manager → the other GRANT of the same customer still consumes; with deferral ON (staging only):
sale credits deferred revenue, each delivery releases one unit's value, a cancellation restores it, the profit report's revenue is the recognised part.

## 6. Rollback notes

Nothing here edits history. `trg_package_credit_allocate` can be dropped (`DROP TRIGGER IF EXISTS trg_package_credit_allocate ON public.package_credit_ledger;`)
and `trg_invoice_return_scrap_loss` likewise; allocation, suspension and journal rows already written stay as the audit trail. The columns and
tables are left in place. The 11-argument `invoice_write_document` can be dropped; the 10-argument function is untouched and keeps working.

## 7. What the agent could and could not do

Executed by the agent: all four migrations twice on PGlite with their VERIFY files and scenarios. **Not** executed by the agent: anything on the
owner's database, anything on a real PostgreSQL (`initdb.exe ENOENT` here), and any multi-connection concurrency test.

## 8. VERIFY outputs received from the owner (2 Nov 2026)

| Migration                          | Output seen by the agent                                                                                                                                                                                                                                              | Reading                                                                                                                                                    |
| :--------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| profit-ledger-totals-01            | `function_exists: true`, `function_private: true`                                                                                                                                                                                                                     | applied; the ledger function exists and is not callable from the browser roles                                                                             |
| package-deferred-revenue-01        | every `*_ok` column `true` (including `suspension_event_shape_ok`, `deferred_change_function_ok`, `deferred_change_function_private_ok`, which exist only in the current VERIFY); `legacy_grants_without_deferred_amount: 0`, `legacy_consumes_without_allocation: 0` | applied in its event-shaped form with the profit function; zero legacy grants and zero legacy consumes means the database held no package credit before M5 |
| accounts-role-deferred-and-loss-01 | NOT YET RECEIVED                                                                                                                                                                                                                                                      | —                                                                                                                                                          |
| invoice-write-grant-01             | NOT YET RECEIVED                                                                                                                                                                                                                                                      | —                                                                                                                                                          |
| invoice-return-06                  | NOT YET RECEIVED                                                                                                                                                                                                                                                      | —                                                                                                                                                          |

Status after these two outputs: still `IMPLEMENTED_NOT_LIVE_VERIFIED` (3 of 5 VERIFY outputs missing; the file hashes are still unconfirmed; the `*.pg.test.ts` and the multi-connection tests have not run on a real PostgreSQL). The output of the current VERIFY proves the schema shape; it does not prove that the `reversed`-original fix is the copy that was applied (compare the hash in section 1).

## 9. Classification of the owner's later statement ("all migrations ran, Success. No rows returned")

- "Success. No rows returned" is the Supabase SQL editor's answer to statements that return no rows (`CREATE FUNCTION`, `ALTER TABLE`). It shows the
  statements ran without an error. It is **not** a VERIFY result and does not say which definition is installed or that behaviour is correct.
- Recorded status of the migrations: `APPLIED_BY_OWNER (owner-reported; DDL success)`. Where the owner also pasted the combined VERIFY (section 10),
  that output is evidence for the objects it names; the rest stays unverified. Production database status: `IMPLEMENTED_NOT_LIVE_VERIFIED`.
  The statement "VERIFIED_COMPLETE" is not granted by it.
- Still unknown to the agent: which copy of each file was run (two files changed after first authoring), and whether the fifth migration ran in
  every database (the owner's VERIFY output for it exists, section 8).

## 10. Combined VERIFY run by the owner (docs/VERIFY-m5-combined.sql, first version)

| Rows                                                       | Result                    | Reading                                                                                                 |
| :--------------------------------------------------------- | :------------------------ | :------------------------------------------------------------------------------------------------------ |
| 1–19 (schema shape, triggers, privileges, RLS, role check) | all `pass = true`         | the M5 objects exist in the expected shape; suspensions are event-shaped                                |
| 20–22 (fingerprints of the installed function text)        | all `pass = true`         | heuristic: the corrected `reversed` handling and the SUSPEND/RESUME events are in the installed text    |
| 23–27 (version markers)                                    | `(none)` / `pass = false` | expected: the markers are written only by `m5-forward-fix-01-migration.sql`, which had not been applied |

Next: apply `docs/m5-forward-fix-01-migration.sql` (S3 path, `APPLY-RUNBOOK.md`) and re-run; the expectation is 27/27. The VERIFY file was edited
once after the owner copied it (the fingerprint became specific to the corrected predicate), so re-copy the current file.

## 11. Current hashes (added files and the forward-fix)

| File                                 | SHA-256                                                          |
| :----------------------------------- | :--------------------------------------------------------------- |
| docs/m5-forward-fix-01-migration.sql | c3e6708c2ce917e8f0fda539f7b0c27fa75d2cc0e830c9c6e3d460c84d3a9702 |
| docs/PROBE-m5-state.sql              | b664b9d5e9b62b1af010334fb5f616f6cda65ba00071c98b9eb782aab95e223c |
| docs/VERIFY-m5-combined.sql          | e8845a2c1eaf67d4195968f6c2c13dc59a201e25b82b0861ad66eedc5c373276 |

The forward-fix embeds the function bodies of the originals; a guard test (`backend/src/__tests__/m5-forward-fix-drift.test.ts`) fails if they drift.
