# CI-MATRIX — what the existing suites cover, and where the lab sits

All results measured **2026-10-17** on this working tree (Windows, Node
v22.22.0).

## The repository's suites

| Suite                                 | Command                                       | Measured result                                                                                                                                        |
| ------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| backend vitest (full)                 | `cd backend && npx vitest run`                | **345 files** → 1 failed / 344 passed · **4,999 tests** → 1 failed / 4,998 passed · 512.6 s — the single red is the known `sales-chart-window.test.ts` |
| packages/ui vitest (full; run 3 of 3) | `cd packages/ui && npx vitest run`            | **157 files** → 5 failed / 151 passed / 1 skipped · **2,255 tests** → 6 failed / 2,247 passed / 2 skipped                                              |
| packages/ui — isolated re-check       | `npx vitest run src/__tests__/one-ux.test.ts` | 17/17 green                                                                                                                                            |
| packages/api                          | `npx tsc --noEmit` (repo instruction)         | not re-measured in M1                                                                                                                                  |
| apps/web                              | `npx tsc --noEmit` (repo instruction)         | not re-measured in M1                                                                                                                                  |

The 6 red ui tests are exactly the known set from `AGENTS.md` (measured
12 Oct 2026, unchanged): `customers-hub` 1 · `personal-view` 1 · `sales-funnel`
1 · `sales-hub` 1 · `warehouse-hub` 2. `i18n-keys-exist` is green now (it was 3
of the previously-listed 9).

**Flake note — `one-ux.test.ts`.** Across three full runs of the ui suite it was
green, red, green — one intermittent red, not reproducible: green in isolation,
runs 1 and 3 green, and the test's five trigger words (`useUxVersion`,
`visibleInUx`, `UxVersionSwitch`, `uxVersion`, `UX_VERSIONS`) appear in **no**
file under its five scanned roots (checked with the same walk it performs). It
scans only `.ts`/`.tsx` under `packages/{ui,app-shell,store,ui-contract}/src`
and `apps/web/app`; the capacity lab's files are `.md`/`.mjs`/`.json` outside
all of them — recorded here because an unexplained intermittent test is a fact
the next person should have, not a number to bury.

## What each concern has, and what the lab adds

| Concern                           | Existing coverage                                                                                                                                                                                        | Capacity lab                                                                                                                                    |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema correctness per capability | `*.pg.test.ts` — one embedded Postgres per capability                                                                                                                                                    | rebuilds the **entire queue** in ONE long-lived database (276 files) — this is what surfaced the queue-order defects in `status/M1.md` §4       |
| RLS / tenancy                     | `rls-coverage.test.ts` proves migrations _declare_ a policy per tenant table; `scripts/verify-rls.mjs` proves behaviour but needs a real Supabase URL + keys + a signed-in user → **cannot run locally** | DB-layer probes as the real roles with real claims (`AUTH.md`) — the local counterpart of `verify-rls.mjs`, over all **240** RLS-enabled tables |
| Data at scale                     | none — fixtures are tiny                                                                                                                                                                                 | SMALL→TARGET profiles up to 10⁶ invoices; plan, latency, storage and maintenance behaviour at scale                                             |
| Money-path correctness            | strong (unit + pg suites)                                                                                                                                                                                | the invariant suite after every stage (`FINANCIAL-INVARIANTS.md`)                                                                               |
| Sync / realtime                   | unit tests; `scripts/sync-loadtest.mjs` needs a **deployed API** → not usable locally                                                                                                                    | DB-side poll and `claim_*` behaviour; the websocket fan-out is NOT TESTABLE (local) — `PARITY.md` §5                                            |
| Recovery                          | —                                                                                                                                                                                                        | M7: kill mid-load, restart, re-run the invariant suite                                                                                          |

## Could CI run the lab?

Everything it needs already ships in the repo (embedded PostgreSQL, Node 22).
It is **not** wired into CI in this milestone: a TARGET run (seed + concurrency
ladder + invariants) is hours, not minutes, and CI minutes are not the owner's
to burn. Recorded here; **no CI files were changed**.
