# Hisabche — Test and Build Evidence

Audit date 2026-11-08. All commands below were **actually run this session** in the main checkout `C:\Users\hamed\Desktop\hisabche` (same HEAD `b546d5df` as the worktree; the worktree has no `node_modules`). `TMP`/`TEMP` = `C:\Users\hamed\Desktop\hisabche\.esbuild-tmp`. Raw logs were kept in the session scratchpad, not in the repo.

## 1. Commands and exit codes (FACT)

| #   | Command (cwd)                                          | Exit  | Duration | Result                                                         |
| --- | ------------------------------------------------------ | :---: | -------: | -------------------------------------------------------------- |
| 1   | `npx tsc --noEmit` (backend)                           |   0   |     32 s | clean                                                          |
| 2   | `npx tsc --noEmit` (packages/ui)                       |   0   |     34 s | clean                                                          |
| 3   | `npx tsc --noEmit` (packages/api)                      |   0   |      8 s | clean                                                          |
| 4   | `npx tsc --noEmit` (apps/web)                          |   0   |      8 s | clean                                                          |
| 5   | `npx tsc --noEmit` (apps/desktop)                      |   0   |     30 s | clean                                                          |
| 6   | `npx tsc --noEmit` (apps/admin)                        |   0   |     26 s | clean                                                          |
| 7   | `npx tsc --noEmit` (packages/local-engine)             |   0   |      6 s | clean                                                          |
| 8   | `npx tsc --noEmit` (packages/app-shell)                |   0   |     29 s | clean                                                          |
| 9   | `npx vitest run --exclude "**/*.pg.test.ts"` (backend) |   0   |     85 s | 382 files, **5,240 tests passed**                              |
| 10  | `npx vitest run` (packages/ui)                         |   0   |    105 s | 211 files passed + 1 skipped; **2,670 passed, 2 skipped**      |
| 11  | `npx vitest run` (packages/local-engine)               |   0   |     11 s | 73 files, **513 passed**                                       |
| 12  | `node scripts/audit-unwired-routes.mjs` (repo)         |   0   |     <5 s | 857 routes, 122 without client caller                          |
| 13  | `node scripts/check-schema-drift.mjs` (repo)           | **1** |     <5 s | 74 reported missing columns (some false positives, see DB doc) |

Total automated tests passed this session: **8,423** (5,240 + 2,670 + 513).

## 2. Not run (with reason)

| Suite                                 | Reason                                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `backend/**/*.pg.test.ts` (106 files) | embedded-postgres binaries removed by Defender on 31 Oct (brief); running downloaded binaries is forbidden |
| `apps/desktop` jest                   | time budget; tsc only                                                                                      |
| `apps/mobile` jest                    | time budget                                                                                                |
| eslint                                | read-only audit, no changed product files                                                                  |
| web / desktop / Android builds        | owner rule: builds only when asked; Android blocked locally                                                |
| E2E (Playwright, Detox)               | no running servers/emulators                                                                               |

## 3. Quality observations (FACT → INFERENCE)

- Backend test files: 488 total `*.test.ts` under `backend/src`, of which 106 are real-Postgres. INFERENCE: on this machine ~22% of DB behaviour (migrations, triggers, concurrency) has no runnable proof; the green 5,240 cover mocked supabase.
- Many guards are **source-assertion** tests (read source text and assert patterns), e.g. `unwired-capability.test.ts`, `route-parity.test.ts`. They prevent regressions of known bugs but do not prove runtime behaviour (CLAUDE.md rule 5).
- Warning noise: vitest prints `vi.mock(...) is not at the top level` for `backend/src/__tests__/approval-template-rule.test.ts` — will become an error in a future vitest.
- The drift script is red on a clean tree → it cannot be used as a CI gate as-is.
- CI (`.github/workflows/ci.yml:31-37,84-87`) runs lint, type-check, turbo test excluding desktop, web build, backend type-check + test. INFERENCE: whether CI runs pg tests depends on the Linux runner having embedded-postgres; not checked.

## 4. Status

Type safety across 8 workspaces: IMPLEMENTED_NOT_LIVE_VERIFIED (green). Runtime behaviour against a real DB: NOT verified locally. Live HTTP: NOT run.
