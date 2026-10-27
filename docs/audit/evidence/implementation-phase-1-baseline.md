# Implementation Phase 1 — Baseline Measurements

Recorded at: 2026-10-26T20:58:00+01:00

## Command 1: Backend Typecheck & Sync Tests

Command:

```bash
cd backend && $env:NODE_OPTIONS="--max-old-space-size=6144"; npx tsc --noEmit && npx vitest run src/__tests__/sync-invariants.test.ts src/__tests__/sync-security.test.ts
```

Exit code: 0
Output:

- `npx tsc --noEmit`: 0 errors
- `npx vitest run`:
  - `src/__tests__/sync-security.test.ts`: 23 passed
  - `src/__tests__/sync-invariants.test.ts`: 29 passed
  - Total: 2 test files passed (2), 52 tests passed (52)

## Command 2: packages/ui Typecheck

Command:

```bash
cd packages/ui && npx tsc --noEmit
```

Exit code: 1
Output:

```text
src/components/ui/invoices/invoice-returns-dialog.tsx(44,19): error TS2304: Cannot find name 'toIsoDay'.
```

Total: 1 error (TS2304)

## Command 3: packages/app-shell Typecheck

Command:

```bash
cd packages/app-shell && npx tsc --noEmit
```

Exit code: 1
Output:

```text
../ui/src/components/ui/invoices/invoice-returns-dialog.tsx(44,19): error TS2304: Cannot find name 'toIsoDay'.
```

Total: 1 error (TS2304 via ../ui)

## Command 4: Applications Typecheck (apps/web, apps/desktop, apps/admin)

- `apps/web`:
  Command: `cd apps/web && npx tsc --noEmit`
  Exit code: 1
  Output: `../../packages/ui/src/components/ui/invoices/invoice-returns-dialog.tsx(44,19): error TS2304: Cannot find name 'toIsoDay'.`
- `apps/desktop`:
  Command: `cd apps/desktop && npx tsc --noEmit`
  Exit code: 1
  Output: `../../packages/ui/src/components/ui/invoices/invoice-returns-dialog.tsx(44,19): error TS2304: Cannot find name 'toIsoDay'.`
- `apps/admin`:
  Command: `cd apps/admin && npx tsc --noEmit`
  Exit code: 1
  Output: `../../packages/ui/src/components/ui/invoices/invoice-returns-dialog.tsx(44,19): error TS2304: Cannot find name 'toIsoDay'.`

## Note on Postgres Tests

`*.pg.test.ts` cannot start on this Windows account (error 1314 / permission error). Marked `BLOCKED_EXTERNAL`.
