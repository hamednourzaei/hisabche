# Hisabche — Testing Strategy

> Goal: no silent runtime regressions across 4 targets that share packages.
> The failure space to guard is **IPC contracts**, cross-package types,
> and offline DB schema drift.

## Layers

```
┌────────────────────────────────┐
│ E2E (Playwright / Detox)       │  real user paths
├────────────────────────────────┤
│ Unit (jest / vitest)           │  stores, services, schemas, IPC
├────────────────────────────────┤
│ Type gates (tsc --noEmit)      │  compile-time contract guard
└────────────────────────────────┘
```

## 1. Type Gate — always first

All apps/packages have `type-check`:

```bash
pnpm lint
pnpm type-check
pnpm test
pnpm build
```

- Root `tsconfig.json` is strict (`strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitReturns`) — the compiler itself
  catches most cross-package breaks.
- Because apps share `@hisabche/*`, a package change must keep **all**
  consumers type-checking (web + desktop + mobile).
- Run `pnpm --filter <pkg> type-check` for a single package.

## 2. Per-Package Strategy

### Backend (`backend/`, vitest)

- `pnpm --filter @hisabche/backend test`
- Unit: services (accounting, invoice, permission, workflow, sync) with
  mocks of `postgres`/Supabase.
- Route tests via `supertest` (dep installed). Assert Zod validation → 400,
  auth middleware → 401, role checks → 403.
- SQL schema drift (Drizzle vs migrations) — run `drizzle-kit` diff in CI.

### Packages / shared

- `@hisabche/auth-core`: session parse/serialize, role ranking, `can()`.
  Existing tests in `__tests__`.
- `@hisabche/validation`: every Zod schema — pass/fail fixtures.
  Existing `__tests__` in `packages/validation`.
- `@hisabche/api`: client wrapper (`ApiError` shape), token provider.
- `@hisabche/store`: Zustand slices — auth, cart, sync, workspace, currency.
- `@hisabche/db`: sync-queue logic, WatermelonDb schema/migrations.

### Desktop (Electron)

> Highlights the IPC contract as the risk surface.

- `apps/desktop/electron/shared/__tests__/ipc-contract.test.ts` — reads the
  Zod-validated IPC contract and verifies channel names + payload schemas
  match what main and preload agree on.
- **Add**: preload renderer test (contextBridge exposure shape),
  main-process handler tests (db:upsertMany, db:enqueue, secure-store
  round-trip against a temp SQLite file).
- jest default (`pnpm --filter @hisabche/desktop test`).
- Playwright e2e already exists: `apps/desktop/e2e/app.e2e.ts` (app
  boots, IPC calls resolve).
- Rebuild check: native module ABI test (better-sqlite3) at startup.

### Web (Next.js)

- `pnpm --filter @hisabche/web test:e2e` — Playwright
  (`apps/web/e2e/i18n-paths.spec.ts` existing).
- Component test app with React Testing Library (opt-in).
- i18n/RTL spec exists — extend to Arabic/Dari locales.

### Mobile (Expo)

- `pnpm --filter @hisabche/mobile test` — jest + jest-expo preset
  (`apps/mobile/jest.config`, `react-native` + `@shopify/flash-list`
  transform ignores). Roots include `packages/mobile-ui`.
- e2e: Detox (`apps/mobile/e2e/`, config `android.emu.debug` /
  `ios.sim.debug`) — for syncing flows.

## 3. What to Test (priorities)

1. **Sync round-trip** — offline enqueue → push → response statuses.
2. **Conflict override** — client_wins default; dirty-flag.
3. **Role gates** — the permission matrix; each capability boundary.
4. **Money precision** — decimal handling, never float math.
5. **IPC hardening** — Zod rejects unexpected payloads (security test).
6. **RTL/i18n** — every screen renders in `fa`/`af`.

## 4. Guard Rails (CI)

Recommended CI (currently absent — no `.github/workflows`):

```yaml
steps:
  - run: pnpm install --frozen-lockfile
  - run: pnpm lint
  - run: pnpm type-check
  - run: pnpm test
  - run: pnpm build
```

appears in RELEASE_PROCESS.md as the gate.

On PR:

- Web: `next build` (or `pnpm turbo build --filter @hisabche/web`).
- Desktop: `tsc --noEmit` both tsconfigs + `jest`.
- If a shared package changes → run the consumer test suites:
  `@hisabche/web`, `@hisabche/desktop`, `@hisabche/mobile`.

## Coverage targets

- Service layer ≥ 70% worth it; IPC + sync engine ≥ 90%.
- Keep integration tests on **real SQLite** (avoid mocks for storage,
  but mock network).

## Not Verified From Repository

- Existence of backend unit test files (vitest configured, supertest dep
  present; no test source found in `backend/test` — a fresh barrel needed).
- Exact Playwright/Detox base configurations (web e2e only `i18n-paths`).
- Coverage thresholds in tooling (none configured).
