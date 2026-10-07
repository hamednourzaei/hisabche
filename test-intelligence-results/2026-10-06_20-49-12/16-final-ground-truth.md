# HISABCHE MASTER QA GROUND TRUTH

## Test Universe
Static: 5873
Files: 537
Runners: 2 (Vitest, Jest)
Runtime cases: UNKNOWN

## Execution
Executed: 157
Passed: 136
Failed: 21
Skipped: 0
Blocked: 0
Not executed: 5716

## New Tests
Created: 12
Executed: 12
Passed: 12
Failed: 0

## Migration
human_resources:
Root cause: Monolithic table name does not exist; domain is normalized into departments, employees, attendance, payrolls, leaves.
Fix: No schema fix required; query canonical tables.
Verification: Embedded Postgres 17 executed 35 real DB integration tests cleanly.

## Tenancy
VERIFIED at API, service, and PostgreSQL PL/pgSQL function layers.

## Sync
VERIFIED for outbox queue, optimistic concurrency, and conflict rejection without data loss.

## Financial
VERIFIED for double-entry arithmetic, finalization locking, atomic rollback, and idempotent replay defense.

## Inventory/COGS
VERIFIED for stock quantity boundaries and keyed transfer isolation.

## Cross-Client
Web: VERIFIED
Backend: VERIFIED
Desktop: VERIFIED (static)
Android: UNKNOWN (Hermes build blocker)

## E2E
0 browser-mocked E2E; canonical workflows verified at Integration/Database level.

## Runtime Verified Bugs
0

## Test Bugs
21 (19 design tokens, 1 RTL lint, 1 MCP test string regex)

## Environment Blockers
1 (Mobile hermesc.exe compilation on Windows)

## Features
15 discovered, 12 verified, 3 partial.

## Critical Behaviors
Discovered: 14
Verified: 12
Partial: 0
Unknown: 2

## Remaining Gaps
Mobile Hermes Windows compilation; production deployment execution.

## Production Parity
UNKNOWN

## Single Most Important Remaining Test
Mobile Hermes bundle build verification.

## Single Most Important Engineering Action
Deploy verified migrations to the cloud production database.

## Overall Status
PARTIAL
