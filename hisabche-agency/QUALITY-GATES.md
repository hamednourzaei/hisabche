# Hisabche Quality Gates

No phase or workflow may mark itself passed until every applicable gate clears after the **last edit**:

## Gate 1 — Static & Contract Hygiene

- Zero `any`, `@ts-ignore`, `@ts-expect-error`, `eslint-disable` in changed code.
- `tsc --noEmit` exits `0` across affected packages (including `apps/desktop` both `tsconfig.json` & `tsconfig.node.json`).
- `eslint` on every edited file exits `0` (0 errors).
- `git diff --check` exits `0`.
- `exactOptionalPropertyTypes` respected cleanly (`prop?: T | undefined`).

## Gate 2 — Domain & Architectural Guards

- `packages/validation` tests green (`one-rule-each`, `architecture-boundaries`, `offline-endpoint-matrix`, `migrations-ledger`, `sellable-industries`, `capability-claims-match-code`, `unused-hooks-ledger`).
- `packages/local-engine` tests green (including `no-node-builtins-on-device.test.ts`).
- `packages/ui` tests green (`design-token-existence`, `i18n-keys-exist`, `one-ux`, `no-hardcoded-currency`, `unknown-is-not-zero`, `unwired-capability-hooks`).
- `packages/api`, `apps/admin`, `apps/desktop`, `apps/mobile` tests green.

## Gate 3 — Real HTTP & Database Verification

- Backend route changes proven via real `buildServer()` + `app.inject()` tests (`backend --project unit`).
- Database migration changes include `docs/<name>-migration.sql`, `docs/VERIFY-<name>.sql`, `backend/src/__tests__/<name>.pg.test.ts` (executing migration twice), and `docs/MIGRATIONS-PENDING.md` updated via `node scripts/migrations/pending-ledger.mjs`.
- Note: On hosts where `embedded-postgres` is blocked (e.g., Windows `0xC0000142` / `SeCreateGlobalPrivilege`), `.pg.test.ts` execution is marked `BLOCKED` and required in Linux CI before live DB execution.

## Gate 4 — Documentation & Ledger Parity

- Generators re-run when touched contracts change:
  - `node scripts/migrations/pending-ledger.mjs`
  - `node scripts/generate-capability-matrix-csv.mjs`
  - `node scripts/industry/generate-coverage-table.mjs`
  - `node scripts/industry/generate-sellable.mjs`
  - `node scripts/api/unused-hooks.mjs`
  - `UPDATE_INDUSTRY_DOCS=1` `industry-specs-complete.test.ts`
