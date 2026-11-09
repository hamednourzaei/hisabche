# Hisabche — Database and Data Model

Audit date 2026-11-08, commit `b546d5df`. Read-only. **No query was run against Supabase.** Everything below is about the SQL files in the repository; the live database may differ.

## 1. Estate (FACT, grep over `docs/*.sql`)

| Measure                                                                 |                                                                                    Value |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------: |
| SQL files                                                               |                                                                                      415 |
| migration files (`*migration*.sql`)                                     |                                                                                      228 |
| VERIFY files                                                            |                                                                                      142 |
| FINDING files                                                           |                                                                                       15 |
| distinct table names in `CREATE TABLE`                                  |                                                                                      305 |
| distinct function names in `CREATE [OR REPLACE] FUNCTION`               |                                                                                      201 |
| `SECURITY DEFINER` occurrences                                          |                                                                                      214 |
| `CREATE POLICY` occurrences                                             |                                                                                      266 |
| `ENABLE ROW LEVEL SECURITY` occurrences                                 |                                                                                      521 |
| `NOT VALID` occurrences (constraints added without validating old rows) |                                                                                      256 |
| Real-Postgres tests `*.pg.test.ts`                                      | 106 (cannot run on this machine — embedded-postgres binaries removed by Defender, brief) |
| Distinct tables touched by backend `.from('…')`                         |                                                                                      259 |
| Local SQLite tables (device)                                            |                                                                                       62 |

Schema baselines: `docs/base-schema-migration.sql`, `docs/DUMP-STRUCTURE-ONLY.sql` (last committed 30 Sep 2026), `docs/_dump-schema.sql`. INFERENCE: no single file reproduces the live schema; the live state = base + an owner-run subset of 228 migrations.

## 2. Destructive SQL (FACT)

- Active `DROP TABLE` statements: none found outside commented rollback blocks (`docs/universal-core-migration.sql:303-311` and `docs/service-delivery-01-migration.sql:102` sit inside `/* … */` rollback sections).
- `docs/WIPE-ALL-BUSINESS-DATA.sql` exists; per CLAUDE.md it is kept with a `'NO'` switch. Not opened in this audit. NEEDS_OWNER_DECISION whether it should live in the repo.

## 3. Key RPCs used by the backend (FACT)

| RPC                             | Caller                                            | Defined in                                                                                        |
| ------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `workspace_create_with_owner`   | `backend/src/services/workspace.service.ts:149`   | workspace-create-01 (per CLAUDE.md, pending owner VERIFY)                                         |
| `invoice_write_document`        | `services/invoice.service.ts:2669`                | `docs/invoice-write-document-migration.sql`, re-defined in `docs/m5-forward-fix-01-migration.sql` |
| `get_next_invoice_number`       | `services/invoice.service.ts:4143`                | sequence-backed                                                                                   |
| `assert_customer_credit`        | `services/invoice.service.ts:1569`                |                                                                                                   |
| `accounting_post_journal_entry` | ledger (CLAUDE.md: only place balance is checked) |                                                                                                   |
| provisioning RPC                | `services/subscription-order.service.ts:271-290`  |                                                                                                   |

Full RPC list: `grep -rhoE "rpc\('[a-z_0-9]+'" backend/src` (not tabulated here).

## 4. Drift check (FACT, tool run this session)

`node scripts/check-schema-drift.mjs` → **exit 1**: "160 tables fully described … 74 queries read a column that does not exist". Top tables: `boms` 11, `attendance` 11, `payments` 8, `products` 6, `invoices` 5, `workflow_instances` 4, `payrolls` 4.

**The tool has false positives (FACT):** it reports `invoices.exchange_rate` missing, but `docs/invoice-exchange-rate-01-migration.sql` adds it; it reports `attendance.ends_next_day` missing, which `attendance-02` adds (`docs/VERIFY-attendance-02.sql:17`). INFERENCE: the tool does not parse `ALTER TABLE … ADD COLUMN` inside `DO` blocks. Status of the drift tool: FAILED as a gate (red on a clean tree). The 74 lines need a FINDING query on the live DB to separate real gaps from parser gaps.

## 5. Data-model facts relevant to correctness

- `workspace_id` is the tenant key; backend bypasses RLS (service role, `backend/src/db.ts:92`).
- Many references have no FK and `workspace_id` is nullable on financial tables (CLAUDE.md "db-integrity" section; `docs/db-integrity-01-migration.sql` adds 18 FKs as `NOT VALID`). Per CLAUDE.md this migration is **awaiting owner run and VERIFY**; not confirmed here.
- Subscriptions are keyed by `user_id` with optional `workspace_id` (`services/billing.service.ts:308-311`) — mixed key model (see SaaS audit §2.4).
- Notifications carry `workspace_id` but are read by `user_id` only (`services/notification.service.ts:78`).
- Dead tables per CLAUDE.md: `ledger_entries`, `sync_queue` (server), `sync_logs`, `journal_lines_archive`. Not re-verified.
- 66 `timestamp without time zone` columns (CLAUDE.md, F3) — not re-verified.

## 6. Migrations awaiting owner run (DOCUMENTATION claims, from CLAUDE.md — not verified)

`db-integrity-01`, `dashboard-fx-01`, `shelf-capacity-01`, `custom-units-01`, `attendance-devices-01`, `attendance-02`, `invoice-exchange-rate-01`, `till-payments-01`, `invoice-return-03/04/05`, `workspace-create-01`, `operational-profile-01`. Brief confirms as run: `session-deposit-01`, `advances-02`, `email-otp-01`, `provider-commission-01`, `user-guide-progress-01`.
Post-migration verification query generated — PENDING HUMAN CONFIRMATION for every other file.

## 7. Recommendations

1. Owner runs a read-only FINDING that lists `information_schema.columns` for the 20 tables in §4 and attaches the output; fix the drift tool parser after.
2. Produce one regenerated structure dump from live (read-only `pg_dump --schema-only`) and commit it as the baseline.
3. Track which migrations were run in a table (`schema_migrations`) instead of CLAUDE.md prose.
