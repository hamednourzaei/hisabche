# Hisabche — Repository Map (forensic, read-only)

- Audit date: 2026-11-08
- Commit: `b546d5df103601194827a1bb7e79a68ae491aab4` (main checkout and this worktree are on the same HEAD; the main checkout has 4 uncommitted non-product files: `CLAUDE.md`, `apps/web/next-env.d.ts`, two `hisabche-promo-reel` files)
- Method: file system walk, `grep`, small Node extractors over source files. Docs were used only as pointers, never as evidence.
- Status vocabulary: VERIFIED_COMPLETE · IMPLEMENTED_NOT_LIVE_VERIFIED · PARTIALLY_IMPLEMENTED · UI_ONLY · API_ONLY · SCHEMA_ONLY · DOCUMENTATION_ONLY · NOT_IMPLEMENTED · BLOCKED_EXTERNAL · NEEDS_OWNER_DECISION · FAILED

## 1. Workspace layout (FACT)

`pnpm-workspace.yaml:1-4` declares three globs: `apps/*`, `packages/*`, `backend`. Turbo (`turbo.json:1`) defines `build`, `dev`, `lint`, `test`, `type-check`, `clean`; `test` and `type-check` depend on `^build`.

| Workspace                | package name              | `.ts/.tsx` files (excl. node_modules/dist/.next) | Role                                                         |
| ------------------------ | ------------------------- | -----------------------------------------------: | ------------------------------------------------------------ |
| `backend`                | `@hisabche/backend`       |                                              992 | Fastify API, supabase-js (service role), vitest              |
| `apps/web`               | `@hisabche/web`           |                                              199 | Next.js App Router, `[lang]` prefix                          |
| `apps/admin`             | `@hisabche/admin`         |                                              112 | Platform admin panel (Next.js)                               |
| `apps/desktop`           | `@hisabche/desktop`       |                               29 (+ `electron/`) | Electron host, SQLite, IPC, printing, updater                |
| `apps/mobile`            | `@hisabche/mobile`        |                                               33 | Expo host: WebView over `packages/app-shell` + native bridge |
| `packages/ui`            | `@hisabche/ui`            |                                              845 | All shared screens/components                                |
| `packages/validation`    | `@hisabche/validation`    |                                              195 | zod schemas + pure domain rules                              |
| `packages/api`           | `@hisabche/api`           |                                              152 | React Query hooks, axios client                              |
| `packages/local-engine`  | `@hisabche/local-engine`  |                                              131 | On-device API (SQLite) for desktop/mobile                    |
| `packages/app-shell`     | `@hisabche/app-shell`     |                                              106 | react-router shell shared by desktop + mobile                |
| `packages/ui-contract`   | `@hisabche/ui-contract`   |                                               40 | navigation, status/list/view contracts                       |
| `packages/mobile-ui`     | `@hisabche/mobile-ui`     |                                               36 | mobile-only UI pieces                                        |
| `packages/store`         | `@hisabche/store`         |                                               23 | zustand stores                                               |
| `packages/formatting`    | `@hisabche/formatting`    |                                               20 | money/date/digits/CSV                                        |
| `packages/app-bridge`    | `@hisabche/app-bridge`    |                                               19 | local SQLite schema, push routing, WebView RPC               |
| `packages/sync`          | `@hisabche/sync`          |                                               10 | sync wire protocol, stream client                            |
| `packages/db-schema`     | `@hisabche/db-schema`     |                                                7 | drizzle schema (partial)                                     |
| `packages/auth-core`     | `@hisabche/auth-core`     |                                                5 | session model and roles                                      |
| `packages/design-tokens` | `@hisabche/design-tokens` |                                                5 | tokens                                                       |
| `packages/auth`          | `@hisabche/auth`          |                                                3 | auth helpers                                                 |
| `packages/i18n`          | `@hisabche/i18n`          |                                                3 | messages `fa/af/en`                                          |
| `packages/analytics`     | _(no package name)_       |                                                3 | stub — PARTIALLY_IMPLEMENTED (no `name` in its package.json) |
| `packages/config`        | `@hisabche/config`        |                                                1 | shared config                                                |

**Count: 23 workspace members (4 apps, 18 packages, 1 backend).**

## 2. Backend anatomy (FACT)

- Entry: `backend/src/index.ts` — 115 `register(` calls; global auth `preHandler` at `backend/src/index.ts:353`; rate limiter `backend/src/index.ts:679-695`; CORS `backend/src/index.ts:584-622`.
- Route files: 110 under `backend/src/routes/` (109 declare endpoints).
- Endpoints extracted by a regex over route files: **853** (GET 410 · POST 290 · PATCH 59 · PUT 54 · DELETE 40). The repo's own `node scripts/audit-unwired-routes.mjs` counts **857** (exit 0, run this session). Difference = 4 dynamically-built paths.
- Services: `backend/src/services/` has 75 sub-folders and ~45 top-level `*.service.ts`/helpers.
- DB client: `backend/src/db.ts:92` creates the client with `SUPABASE_SERVICE_KEY`; `db.ts:37-40` warns if the key is not `service_role`. **Consequence (FACT): every backend query bypasses RLS; tenant isolation is enforced in application code.**
- Scheduler: `backend/src/scheduler/index.ts` (trial-expiration at :43-47, :187).

## 3. Documentation / SQL estate (FACT)

| Kind                                 | Count | Location     |
| ------------------------------------ | ----: | ------------ |
| SQL files                            |   415 | `docs/*.sql` |
| `*migration*.sql`                    |   228 | `docs/`      |
| `VERIFY*.sql`                        |   142 | `docs/`      |
| `FINDING*.sql`                       |    15 | `docs/`      |
| `*.pg.test.ts` (real-Postgres tests) |   106 | `backend/`   |

## 4. Repository hygiene (FACT → INFERENCE)

The repository root contains ~80 one-off scripts and data files (`fix-*.js`, `patch-*.js`, `recon*.py`, `scratch*.js`, `invoices.html`, `payload.json`, `Supabase Snippet Untitled query (1).csv`, `unknowns.json`, `__pycache__/`). FACT: they are tracked (git status clean). INFERENCE: they are not part of any build (`turbo.json` has no reference); they inflate search noise and one CSV may contain query output from the live database. RECOMMENDATION: owner review; move to `scripts/archive/` or delete.

- `.ai/codebase/CODEBASE_MAP.md` and `graph.json` are **gitignored** (`.gitignore:81`): they exist in the main checkout and not in a fresh worktree. _(Corrected 9 Nov: the first version of this file said they did not exist.)_
- CI: `.github/workflows/ci.yml` (lint, type-check, turbo test excluding desktop, web build, backend type-check + test), `desktop-build.yml`, `mobile-check.yml`.
- Deploy descriptors: `render.yaml` (backend), `vercel.json` (web).

## 5. Dependency direction (FACT, from imports)

```
apps/web ─┐
apps/desktop ─> packages/app-shell ─┐
apps/mobile ──> (WebView of app-shell)│
                                     ├─> packages/ui ─> packages/api ─> HTTP ─> backend
apps/admin ─────────────────────────┘        │            │
                                             ├─> ui-contract, formatting, i18n, store
                                             └─> validation (shared with backend)
apps/desktop, apps/mobile ─> packages/local-engine ─> app-bridge (SQLite schema) ─> validation
```

Full matrix and traces: `HISABCHE-DEPENDENCY-MAP.md`.
