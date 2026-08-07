# Hisabche — Coding Standards

> Engineering rules aligned with the root `CLAUDE.md` (Hisabche Engineering
> Manifest) and the shared `documents/CLAUDE.md`.

## TypeScript

- **Strict** everywhere; root `tsconfig.json` sets `strict`,
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noImplicitReturns`, `noFallthroughCasesInSwitch`.
- **No `any`**, no `unknown` casts, no `ts-ignore`, no `@ts-expect-error`.
- **No duplicated types** — prefer `z.infer<typeof schema>` for shapes that
  are Zod-defined; `$inferSelect`/`$inferInsert` for Drizzle tables.
- Prefer inferred types over explicit annotations.

> Note: some backend routes use `(schema as any)` for
> `zodToJsonSchema` (e.g. `workflow.routes.ts`, auth `toJsonSchema`).
> That is the one allowed escape hatch — wrapped in a helper, not scattered.

## Validation

- **Zod** at every trust boundary: API route bodies, Electron IPC payloads,
  form inputs.
- Shared schemas in `packages/validation/src/schemas/*`; reuse the common
  primitives (`uuidSchema`, `currencyCodeSchema`, `positiveNumberSchema`,
  `percentageSchema`, `nonEmptyStringSchema`, `optionalStringSchema`,
  `isoDateSchema`, `paymentMethodSchema`) from `common.schema.ts`.
- Never duplicate a schema in an app when it belongs in `@hisabche/validation`.

## Money & Currency

- Money is `numeric(12,2)` in the DB, number/decimal in code — **never
  float arithmetic** for ledger totals.
- Default currency `AFN`; always carry `currency` with amounts.
- Identity of an item: `id` uuid PK; server id stays the PK even in offline
  local mirrors.

## React & State

- Web: Next.js App Router, Server Components preferred; Zustand
  (`@hisabche/store`) for client state, TanStack Query for server state.
- Desktop: same store + api packages.
- Avoid unnecessary state/effects/memoization/Context (root manifest).
- UI: prefer `@hisabche/ui` (shadcn-style) — never build custom primitives;
  mobile uses `@hisabche/mobile-ui`.

## i18n & RTL

- All user-facing strings via i18n: `packages/i18n` + `messages/{fa,en,af}`
  (web), `apps/desktop/src/shared/i18n`, `@hisabche/i18n` (mobile).
- No hardcoded UI text. Locale prefix on web routes (`[lang]`).
- RTL: use logical CSS properties, honor the `dir` from locale; test
  `fa`/`af` render paths.

## Platform Conventions

- **Web** — `app/[lang]/` routes; `(dashboard)` group = authed shell.
- **Desktop** — every IPC channel declared in
  `apps/desktop/electron/shared/ipc-contract.ts` with a Zod schema;
  renderer → native only via preload; writable DB columns allow-listed.
- **Mobile** — expo-router routes; session in `expo-secure-store`;
  offline via WatermelonDb.

## Repository Discipline

- Prefer **local edits** — avoid cross-package ripple.
- Max **3 modified files** per task unless approved (root manifest).
- Follow the Engineer Manifest: search budget (≤5 searches, ≤10 files,
  ≤5 min), ship smallest correct change, verify then stop.
- Respect the stop conditions: root cause / confidence ≥70% → edit.

## Performance

- No premature optimization; measure then optimize.
- Use `@tanstack/react-virtual` for long lists (already a dependency on
  web + desktop).
- Mind Turbo pipeline caches; `dirty` flags keep the DB fast.

## Git committing

- Conventional message style from existing history: short, imperative
  (`fixed frontend 10`, `feat: `…).
- Commit only what the task requires; never include env files with secrets
  (`.env.*` are gitignored — don't force-add).
