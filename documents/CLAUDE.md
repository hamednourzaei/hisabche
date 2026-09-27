# CLAUDE.md — Hisabche (documentation)

> This is the _project documentation_ CLAUDE.md. The operational
> engineering rules for Claude Code live in the repository root
> `CLAUDE.md` (Hisabche Engineering Manifest). Both apply; the root
> manifest takes precedence for process rules.

## Project Identity

Hisabche is an offline-first accounting, inventory, invoicing, and
customer-management platform for SMBs. A pnpm/Turborepo monorepo with
four deployable targets:

- `apps/web` — Next.js 16 (App Router, `[lang]` i18n)
- `apps/desktop` — Electron 31 + React/Vite (Windows)
- `apps/mobile` — Expo / React Native (iOS + Android)
- `backend/` — Fastify 5 API (Supabase auth, Postgres + Drizzle, BullMQ)

Shared packages under `packages/`: `auth-core` (session contract + roles),
`auth` (Supabase adapters), `api` (typed client + hooks + realtime), `store`
(Zustand), `db-schema` (Drizzle subset), `validation` (Zod), `ui`,
`mobile-ui`, `i18n`, `config`, `analytics`, `sync` (the HSB wire + stream
client), `app-shell` (desktop/mobile shell + sync engine). `db` and `offline`
(WatermelonDb) were never imported and were removed (27 Sep 2026).

Default currency: **AFN**. Default language direction: **RTL** (Persian/Dari
primary).

## Architecture Rules

- Respect the existing architecture; never redesign unless explicitly asked.
- Shared contracts live in `packages/`; apps consume them via workspace
  aliases (`@hisabche/*`).
- Do not introduce new dependencies for what existing packages already do.
- Keep TypeScript strict (root `tsconfig.json` has `strict`,
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- Follow existing patterns: feature folders per app, hooks in
  `@hisabche/api/hooks`, stores in `@hisabche/store/slices`,
  validation in `@hisabche/validation`.
- Prefer existing UI components (`@hisabche/ui`, shadcn-style); never build
  custom primitives unless impossible.
- Keep the change local to one app/package when possible — avoid
  cross-package ripple.
- Max 3 modified files per task unless approved (root manifest).

## Coding Rules

- **No `any`**, no `unknown` casts, no `ts-ignore`, no duplicated types —
  prefer inferred types.
- **Validation with Zod** at every trust boundary (API routes, IPC payloads,
  forms). Backend routes use `@hisabche/validation` schemas +
  `zod-to-json-schema` for Swagger.
- **RTL support** — UI must render correctly in RTL; use logical CSS
  properties, honor i18n direction.
- **i18n** — user-facing strings go through the i18n system
  (`packages/i18n`, `messages/{fa,en,af}` on web, `src/shared/i18n` on
  desktop, `@hisabche/i18n` on mobile). Never hardcode UI text.
- **Performance** — don't optimize prematurely; avoid unnecessary state,
  effects, memoization, Context (React rules in root manifest).
- Money as decimal/numeric, never float comparisons; keep `AFN` default.
- Never break other platforms: a change to `@hisabche/api` or `@hisabche/store`
  must type-check for web, desktop, and mobile consumers.

## Before Changing Code

1. Analyze the existing implementation of the specific file/feature first
   (root manifest: ≤5 searches, ≤10 files, ≤5 min).
2. Check related files: shared packages used by the target, IPC contract
   (desktop), sync/offline paths.
3. Understand the data flow: UI → store → local DB → API → backend → Postgres.
4. Avoid breaking other platforms (web/desktop/mobile share the packages).
5. When in doubt, ship the smallest correct change; verify before stopping.

## Platform Rules

Changes affect their platform and the shared packages underneath:

- **Web** — Next.js App Router. Routes under `app/[lang]/`; the `(dashboard)`
  group is the authed shell. RTL + i18n required.
- **Desktop** — Electron: main process (`electron/main/`), preload bridge
  (`electron/preload/index.ts`), shared IPC contract
  (`electron/shared/ipc-contract.ts`). Every new IPC channel needs a Zod
  payload schema + main-side validation; renderer talks to native only via
  preload (context isolation).
- **Mobile** — Expo/React Native. Offline via expo-sqlite (`apps/mobile/src/host/local-db.ts`) + outbox (`apps/mobile/src/features/offline/sync-runner.ts`);
  session via expo-secure-store. Keep iOS and Android both working.

## Testing Requirements

Before completing tasks, run (for the affected app/package):

- **TypeScript check** — `pnpm --filter <pkg> type-check` (or `turbo type-check`)
- **Tests** — `pnpm --filter <pkg> test` (web: Playwright e2e; mobile: jest;
  backend: vitest)
- **Build verification** — `pnpm --filter <pkg> build` (or `turbo build`)

Desktop: `apps/desktop` additionally has e2e tests (`apps/desktop/e2e`).
Don't skip verification of the changed target; a diff that compiles on web
but breaks the desktop TS build is a failure.
