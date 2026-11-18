// ============================================
// backend/src/__tests__/pg-preflight.setup.ts
//
// Fail a *.pg.test.ts file in milliseconds when Postgres cannot possibly start.
//
// ⚠️ WHY THIS EXISTS.
//
// Both known causes are environmental and both used to cost the whole run:
// a platform package installed without its `initdb.exe` / `postgres.exe` /
// `pg_ctl.exe` (180–240 s per file), and a Windows logon token without
// SeCreateGlobalPrivilege, which Postgres needs for its shared memory before it
// prints anything useful — measured at 65.7 s per file, 166 pg files, ~3 hours,
// every test skipped. The second one is why this file exists in the shape it has:
// the executable guard alone passed, and the suite still never finished.
//
// The two checks live in `helpers/pg-binaries.ts` (the prose explaining each
// failure, and what to do about it, is there). This file only runs them.
//
// It is a setup file of the `pg` project only, so the unit project pays nothing:
// `npx vitest run --project unit` stays green on a machine that cannot run
// Postgres at all.
// ============================================

import { assertPostgresCanStart, assertPostgresExecutables } from './helpers/pg-binaries'

assertPostgresExecutables()
assertPostgresCanStart()
