---
name: hisabche-double-entry-ledger
description: Use when auditing or changing the accounting domain, chart of accounts, journal entries, journal lines, trial balance, posting rules, reversals, opening balances, or financial statements in Hisabche.
---

# Hisabche Double-Entry Ledger

## Mission

Preserve one canonical accounting ledger and prove every business event's accounting effect. Never create a parallel ledger, shadow balance engine, or second accounting formula.

## Mandatory context

1. Read root `AGENTS.md` and follow it as canonical.
2. Read `.claude/accounting-integrity/00-SPEC.md`.
3. Read `.claude/db-integrity/00-SPEC.md`.
4. Read `.ai/codebase/CODEBASE_MAP.md` if it exists in the checkout; verify freshness using the repository's documented code-intel command.
5. Locate current accounting services, repositories, SQL functions, Drizzle schema, migrations, and tests before proposing a change.
6. Read only the smallest relevant dependency graph. Do not explore unrelated domains.

## Non-negotiable accounting invariants

- Every posted journal entry balances: total debits equal total credits in the ledger's defined currency/measurement model.
- Each journal line has exactly one non-negative side populated: debit XOR credit. Confirm the actual schema and current legacy exceptions before changing constraints.
- Posted entries are immutable. Corrections use an explicit reversal/correction flow with actor, reason, source linkage, and audit trail.
- Draft, posted, reversed, voided, and failed states must not be conflated.
- Posting must be atomic: journal header, lines, source state, and required outbox/audit records either commit together or do not.
- A business event must not post twice. Use existing idempotency/source uniqueness mechanisms; do not invent a second key system.
- A trial balance that balances does not prove the ledger is semantically correct.
- A missing value is not zero. Unknown/partial cost or balance must remain explicitly unknown.
- Never sum different currencies into one amount. Do not infer exchange rates or currency from workspace defaults.
- AFN is a zero-decimal currency in the current product rules. Do not divide or multiply AFN values by 100. Verify all other currency scales from the canonical money implementation.
- Money path uses integer minor units (as defined per currency by the existing formatter/domain); never binary floating point.
- Server derives totals from validated line items. Never trust client-supplied totals.

## Domain boundaries

- Find the canonical `journal_entries` + `journal_lines` path and confirm it is still authoritative.
- Do not revive or write to legacy tables such as `ledger_entries` merely because a name sounds appropriate. Prove live readers/writers first.
- Preserve the current canonical accounts model and account-role vocabulary. Do not add an opening-capital role or change account semantics without owner decision and schema evidence.
- Opening inventory, opening balances, COGS, stock adjustments, transfers, production, payments, invoice posting and reversals must each be traced to their actual current posting path.
- Distinguish operational records from accounting evidence. An invoice or payment existing does not prove its journal was posted.

## Required workflow

1. Identify the business event and expected accounting outcome.
2. Find the current service, SQL/RPC function, schema and direct callers using code intelligence.
3. Draw a compact posting matrix: source event → debit account → credit account → currency → amount derivation → idempotency key → reversal path.
4. Inspect all relevant constraints, indexes, FK, RLS, workspace scoping and SQL function transaction boundaries.
5. Add or update tests before changing behavior.
6. Test both valid and invalid postings, duplicate replay, concurrent posting, rollback after partial failure, and reversal.
7. Verify the persisted journal lines and source state using real PostgreSQL integration tests where the project supports them.
8. Verify user-visible amounts and states; never stop at HTTP 200.

## Required test cases

- Balanced entry posts.
- One-unit imbalance is rejected by the authoritative database boundary.
- Negative debit or credit is rejected.
- Both debit and credit on one line are rejected.
- Neither side populated is rejected.
- Missing account, cross-workspace account, or invalid source is rejected.
- Duplicate source/idempotency replay does not create another posting.
- Two concurrent attempts result in exactly one posting.
- Failure between source mutation and ledger persistence rolls back atomically.
- Reversal is linked, balanced, auditable, and cannot be repeated.
- Posted lines cannot be edited/deleted through normal application paths.
- Unknown/partial COGS never becomes numeric zero or fabricated profit.
- Currency boundaries are enforced; no cross-currency aggregation without an explicit conversion record and rate provenance.

## Change safety

- No live Supabase DDL or writes.
- For schema changes, create `docs/<name>-migration.sql`, `docs/VERIFY-<name>.sql`, and the relevant `*.pg.test.ts`; human applies migration.
- Migrations must be additive, idempotent where feasible, and compatible with the deploy-before-migration window according to the existing migration policy.
- Do not modify dependencies, lockfiles, generated indexes, or unrelated files.
- Do not commit or push.

## Output format

Report in Persian:
1. Current canonical posting path (with file/symbol evidence).
2. Posting matrix.
3. Invariants preserved or violated.
4. Tests executed and exact results.
5. Migration status and human action required.
6. Status: `VERIFIED_COMPLETE`, `IMPLEMENTED_NOT_LIVE_VERIFIED`, `VERIFIED_WITH_LIMITATIONS`, `BLOCKED`, or `NOT_IMPLEMENTED`.

Never claim a balanced test fixture proves production ledger correctness.
