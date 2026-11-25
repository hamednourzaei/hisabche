# 18 — Regression & Hygiene Verification Results

> **Execution Date:** 2026-11-25

## 1. Type-Checking (`tsc --noEmit` — 0 Errors Across All Checked Packages & Apps)

- Shared packages: `validation`, `formatting`, `local-engine`, `sync`, `store`, `api`, `i18n`, `ui`, `app-shell`, `auth-core` (`10/10` passed; `@hisabche/auth` has no `type-check` script).
- Apps & Backend: `backend`, `web`, `admin`, `desktop`, `mobile` (`5/5` passed).

## 2. Post-Fix Automated Test Suites

- `@hisabche/validation`: `106/106` files, `1277/1277` tests (`PASS`)
- `@hisabche/api`: `44/44` files, `320/320` tests (`PASS`)
- `@hisabche/ui` (`design-token-existence.test.ts`): `3/3` (`PASS`)
- `@hisabche/backend` (4 fixed files): `121/121` (`PASS`); Financial & Security batch (`8/8` files, `128/128` tests `PASS`); Sync/Schema/V76 batch (`4/4` files, `51/51` tests `PASS`)
- `@hisabche/local-engine` (Sync Chaos/Local-First/Viewer): `3/3` files, `39/39` tests (`PASS`)
- `@hisabche/admin` (`97/97`), `@hisabche/desktop` (`387/387`), `@hisabche/mobile` (`220/220`), `@hisabche/formatting` (`132/132`), `@hisabche/sync` (`42/42`), `@hisabche/store` (`22/22`), `@hisabche/i18n` (`29/29`), `@hisabche/app-shell` (`PASS`)

## 3. Code Hygiene

- `eslint` on modified files: `0` errors
- `git diff --check`: `0` whitespace/conflict errors
- `pnpm code-intel update`: `FRESH`
