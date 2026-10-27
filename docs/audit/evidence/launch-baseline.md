# Hisabche Launch Baseline

Date: 2026-10-26T21:06:00+01:00
Environment: Windows 11 / Node v22.22.0 / pnpm monorepo

## 1. Initial Git Status

Branch: `main...origin/main`
Working tree status: Clean state with approved uncommitted universal-core and gap ledger files preserved.

## 2. Command Executions and Measurements

### Backend TypeScript and Sync Tests

```bash
cd backend && $env:NODE_OPTIONS="--max-old-space-size=6144"; npx tsc --noEmit && npx vitest run src/__tests__/sync-invariants.test.ts src/__tests__/sync-security.test.ts
```

- **TypeScript**: 0 errors (Exit code: 0)
- **Vitest**:
  - `src/__tests__/sync-security.test.ts`: 23 passed
  - `src/__tests__/sync-invariants.test.ts`: 29 passed
  - Total: 2 test files passed (2), 52 tests passed (52)

### UI and Application Typechecks

- `packages/ui`:
  - Command: `cd packages/ui && npx tsc --noEmit`
  - Output: `src/components/ui/invoices/invoice-returns-dialog.tsx(44,19): error TS2304: Cannot find name 'toIsoDay'.` (1 error)
- `packages/app-shell`:
  - Command: `cd packages/app-shell && npx tsc --noEmit`
  - Output: `../ui/src/components/ui/invoices/invoice-returns-dialog.tsx(44,19): error TS2304: Cannot find name 'toIsoDay'.` (1 error via packages/ui)
- `apps/web`:
  - Command: `cd apps/web && npx tsc --noEmit`
  - Output: `../../packages/ui/src/components/ui/invoices/invoice-returns-dialog.tsx(44,19): error TS2304: Cannot find name 'toIsoDay'.` (1 error)
- `apps/desktop`:
  - Command: `cd apps/desktop && npx tsc --noEmit`
  - Output: `../../packages/ui/src/components/ui/invoices/invoice-returns-dialog.tsx(44,19): error TS2304: Cannot find name 'toIsoDay'.` (1 error)
- `apps/admin`:
  - Command: `cd apps/admin && npx tsc --noEmit`
  - Output: `../../packages/ui/src/components/ui/invoices/invoice-returns-dialog.tsx(44,19): error TS2304: Cannot find name 'toIsoDay'.` (1 error)

## 3. PostgreSQL Embedded Test Runner Limitation

On this Windows local user account, `embedded-postgres` fails to initialize clusters with error 1314 (`A required privilege is not held by the client` on shared memory / symlinks).

- 81 `*.pg.test.ts` test files cannot run locally on this machine.
- Status: `BLOCKED_EXTERNAL`.
- Linux/CI execution command: `npx vitest run "**/*.pg.test.ts"`.
