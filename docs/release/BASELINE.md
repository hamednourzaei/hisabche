# Baseline Test & Typecheck Measurements

> Generated: 2026-10-27
> Environment: Windows (local machine)
> Commit/Branch: `release-close`

---

## 1. Typecheck (`tsc --noEmit`)

| Workspace / Package     | Command                                        | Result | Errors |
| :---------------------- | :--------------------------------------------- | :----- | :----- |
| `backend`               | `cd backend && npx tsc --noEmit`               | PASS   | 0      |
| `packages/validation`   | `cd packages/validation && npx tsc --noEmit`   | PASS   | 0      |
| `packages/api`          | `cd packages/api && npx tsc --noEmit`          | PASS   | 0      |
| `packages/ui`           | `cd packages/ui && npx tsc --noEmit`           | PASS   | 0      |
| `packages/app-shell`    | `cd packages/app-shell && npx tsc --noEmit`    | PASS   | 0      |
| `packages/local-engine` | `cd packages/local-engine && npx tsc --noEmit` | PASS   | 0      |
| `packages/sync`         | `cd packages/sync && npx tsc --noEmit`         | PASS   | 0      |
| `packages/store`        | `cd packages/store && npx tsc --noEmit`        | PASS   | 0      |
| `packages/formatting`   | `cd packages/formatting && npx tsc --noEmit`   | PASS   | 0      |
| `packages/i18n`         | `cd packages/i18n && npx tsc --noEmit`         | PASS   | 0      |
| `packages/auth-core`    | `cd packages/auth-core && npx tsc --noEmit`    | PASS   | 0      |
| `apps/web`              | `cd apps/web && npx tsc --noEmit`              | PASS   | 0      |
| `apps/desktop`          | `cd apps/desktop && npx tsc --noEmit`          | PASS   | 0      |
| `apps/admin`            | `cd apps/admin && npx tsc --noEmit`            | PASS   | 0      |
| `apps/mobile`           | `cd apps/mobile && npx tsc --noEmit`           | PASS   | 0      |

---

## 2. Test Suites Executed

| Package / App          | Test Runner             | Files / Suites Passed | Tests Passed    | Tests Failed / Skipped   | Duration |
| :--------------------- | :---------------------- | :-------------------- | :-------------- | :----------------------- | :------- |
| `backend`              | `vitest --project unit` | 319 / 319             | 4,660           | 0 / 0                    | 59.32s   |
| `packages/validation`  | `vitest run`            | 40 / 40               | 581             | 0 / 0                    | 5.74s    |
| `packages/ui`          | `vitest run`            | 186 / 187             | 2,458           | 0 failed / 2 skipped     | 65.63s   |
| `packages/api`         | `vitest run`            | 37 / 37               | 290             | 0 / 0                    | 6.57s    |
| `packages/ui-contract` | `vitest run`            | 18 / 18               | 381             | 0 / 0                    | 0.96s    |
| `apps/desktop`         | `jest`                  | 29 / 29               | 275             | 0 / 0                    | 14.32s   |
| `apps/mobile`          | `jest`                  | 17 / 17               | 207             | 0 / 0                    | 13.08s   |
| **Total**              |                         | **646 test files**    | **8,852 tests** | **0 failed / 2 skipped** |          |

---

## 3. Notes & Unexecuted Suites

- `backend/*.pg.test.ts` (85 files): `BLOCKED_EXTERNAL` on Windows due to embedded Postgres failure (`error code 1314`). To be executed on Linux runner via: `cd backend && npx vitest run --project pg`.
