# GATE-04 — real-Postgres tests: blocker and safe alternatives

Date: 2026-10-26. Nothing created, nothing contacted, no credentials used, no SQL executed.

## Status

**`BLOCKED_EXTERNAL`.** 81 `*.pg.test.ts` files exist in `backend/src/__tests__/`; none could be run on this machine.

## 1. What was tried (this machine)

| Attempt                                                                   | Result                                                                                                                   |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `embedded-postgres` 17.10.0-beta.17 (`backend/package.json:50`): `initdb` | works                                                                                                                    |
| starting the server                                                       | fails with Windows error **1314** (`CreateFileMapping Global/PostgreSQL…` — the account lacks `SeCreateGlobalPrivilege`) |
| `psql`, `pg_ctl`, Docker, WSL                                             | not present                                                                                                              |
| a Postgres server elsewhere                                               | not used: the rules forbid cloud resources, production access and asking for credentials                                 |

## 2. Repository-documented alternatives

| Alternative                                               | Exists?                                                                                                                                                                                                                                                                                         | Usable by this audit?                                                                                    |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Existing CI workflow that runs the pg tests               | **Yes** — `.github/workflows/ci.yml` job `backend-tests` (`ubuntu-latest`) runs `pnpm --filter @hisabche/backend test` → `vitest run`; `backend/vitest.config.mts:15-35` defines a separate `pg` project (`src/**/*.pg.test.ts`, `maxWorkers: 2`) that boots its own embedded Postgres per file | **No** — running it needs a push or a manual workflow dispatch, which the audit forbids (no commit/push) |
| Test containers / docker-compose                          | none in the repository (no `docker-compose*`, no `Dockerfile*`)                                                                                                                                                                                                                                 | —                                                                                                        |
| Running the pg project locally with a different privilege | would need changing the Windows account's rights — a system setting                                                                                                                                                                                                                             | not done                                                                                                 |
| Running as Linux in CI by the owner                       | possible                                                                                                                                                                                                                                                                                        | **Next action for the owner**                                                                            |

## 3. Observations about CI (read, not run)

- `ci.yml` job `Lint, type-check, test` runs `pnpm type-check` (line 33). With N-20 (`toIsoDay` missing) that step fails for `packages/ui` and the workspaces that include its sources; the green local test result did not cover it.
- `desktop-build.yml` and `mobile-check.yml` exist; contents not audited.
- `ci.yml` last changed 2026-08-08, i.e. before most of the Universal Core work; whether recent CI runs were green is `UNKNOWN` (not retrievable without network credentials, not attempted).

## 4. What the missing gate leaves unproven

Everything that depends on real constraints or functions: FK behaviour of the N-30 deletes, trigger behaviour of the sync log (N-36), `accounting_post_journal_entry`, the avco/shelf/dashboard migrations, concurrency tests. Static reading and the in-memory-fake unit suites stand in; they are labelled CODE/TEST/SQL, never LIVE.

## 5. Next action (owner)

Run the existing `backend-tests` job (or `pnpm --filter @hisabche/backend exec vitest run --project pg`) on a Linux runner or a Windows account that holds `SeCreateGlobalPrivilege`; attach the log. GATE-04 stays `BLOCKED_EXTERNAL` until that output exists.
