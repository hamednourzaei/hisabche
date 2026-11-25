# 11 — Database, Migrations & Schema Parity Audit

> **Standards:** ISO/IEC 20246, ISO/IEC 25010:2023 (Reliability, Security)
> **Execution Date:** 2026-11-25

## 1. Migration Registry Summary (`docs/MIGRATIONS-REGISTRY.json`)

- **Total Migrations:** `310`
- **With `VERIFY-*.sql`:** `190` (`120` without VERIFY)
- **With `*.pg.test.ts`:** `200` (`110` without PG test)
- **Schema Contract Parity:** `backend/src/__tests__/schema-contract-parity.test.ts` (`PASS` in `51/51` run).

## 2. External Blocker (`BLOCKED_EXTERNAL`)

- All `*.pg.test.ts` suites cannot execute on this Windows host because `embedded-postgres` `initdb.exe` exits with `3221225794` (`0xC0000142`). Must execute in Linux/CI Postgres before claiming live DB/RLS verification.
- Live Supabase DDL/writes are strictly forbidden per `AGENTS.md` §0.2.
