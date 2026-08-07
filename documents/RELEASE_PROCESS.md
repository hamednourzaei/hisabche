# Hisabche — Release Process

> Install steps: pnpm workspace at repo root (`packages: apps/*, packages/*,
backend`). All commands from repo root unless noted.

## Common Gate (always before packaging)

```bash
pnpm install
pnpm lint
pnpm type-check
pnpm test
pnpm build
```

Turborepo pipeline orders `build` after `^build` (deps first), so shared
packages compile before their consumers. For a single app:

```bash
pnpm --filter @hisabche/<app> build
```

## Web (Next.js 16)

```
pnpm --filter @hisabche/web build        # next build + postbuild (standalone)
        │
        ▼
Deploy target: Vercel (repo has apps/web/.vercel)
        └─ static export served from .next/standalone
```

- `postbuild` runs `node scripts/copy-standalone-assets.js` — copies
  standalone assets into `.next/standalone` for self-hosted/Node deploys.
- Public env: `NEXT_PUBLIC_API_URL` (base API), Supabase keys, Sentry DSN,
  PostHog — see `.env.example` / `packages/config`.
- E2E smoke: `pnpm --filter @hisabche/web test:e2e` (Playwright)
  run in CI before merge.

## Desktop (Windows)

Scripts in `apps/desktop/package.json`:

| Command                                          | What                                                                          |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| `pnpm --filter @hisabche/desktop dev`            | electron-vite dev (HMR)                                                       |
| `pnpm --filter @hisabche/desktop build`          | `electron-vite build` → `out/`                                                |
| `pnpm --filter @hisabche/desktop rebuild:native` | `electron-builder install-app-deps` — rebuild better-sqlite3 for Electron ABI |
| `pnpm --filter @hisabche/desktop package:win`    | build + `electron-builder --win --publish never` → installer                  |
| `package:mac` / `package:linux`                  | other platforms (not the primary target)                                      |

Flow:

```
pnpm install
pnpm --filter @hisabche/desktop rebuild:native   # native modules for Electron
pnpm --filter @hisabche/desktop package:win       # .exe / nsis installer
        ▼
Windows installer (.exe)
        ▼
electron-updater auto-update channel (updater.ts)
```

- **Native gotcha**: `better-sqlite3` (and similar) must be rebuilt for the
  Electron Node ABI; forgetting `install-app-deps` yields
  `NODE_MODULE_VERSION mismatch` at startup.
- Release notes / upload channel config live in electron-builder config; the
  updater fetches from the publish provider.
- Signing: Windows code-signing cert is **not configured in repo**
  (no signing step found) — unsigned builds would trigger SmartScreen.

## Mobile (Expo / React Native)

Uses EAS (Expo Application Services) for release builds. Detox e2e for
Android emulator / iOS simulator.

| Command                                      | What                                           |
| -------------------------------------------- | ---------------------------------------------- |
| `pnpm --filter @hisabche/mobile dev`         | `expo start` (Metro)                           |
| `pnpm --filter @hisabche/mobile android`     | `expo start --android`                         |
| `pnpm --filter @hisabche/mobile ios`         | `expo start --ios`                             |
| `pnpm --filter @hisabche/mobile e2e:android` | `detox test --configuration android.emu.debug` |
| `pnpm --filter @hisabche/mobile e2e:ios`     | `detox test --configuration ios.sim.debug`     |

```
repo:
  pnpm install
  cd apps/mobile

release (EAS):
  eas build --platform android   # → Play Store
  eas build --platform ios       # → TestFlight
```

- No `eas.json` / EAS build version in repo — **projectId / appId not
  verified**. EAS CLIs are typically in devDependencies via Expo tooling;
  actual store credentials live in the Expo account, not the repo.
- Bare React Native 0.74 + Expo 51 — uses Swift/Kotlin toolchains from EAS.

## Backend (Fastify API)

```
pnpm --filter @hisabche/backend dev      # tsx watch src/index.ts
pnpm --filter @hisabche/backend build    # tsc → dist/
pnpm --filter @hisabche/backend start    # node dist/index.js
```

Deployment notes (from `docs/VPS_MIGRATION.md` present in repo):

- Node host + `dist/index.js`; env: `DATABASE_URL`
  (Supabase/Postgres DSN), Supabase URL/anon keys, Arcjet key, Redis
  (`ioredis`/BullMQ), Resend API key.
- Health: `/api/health`, `/live`, `/ready` (VPS/container probes).
- Queues (BullMQ, pdf queue) need Redis.
- Swagger at `/docs`.

## Versioning

- Packages are pinned `workspace:*` (workspace protocol) — a single `pnpm
install` keeps all apps on the same shared-package versions.
- `pnpm-lock.yaml` is committed at repo root.

## CI

No CI YAML found in `.github/` root scan (only `.github/` exists). Add a
GitHub Actions workflow: `lint` → `type-check` → `test` → `build` per app,
then deploy gates. **Not present — to be created.**

## Version bumps / release-please

- Turbo pipeline has no version/change-set story; versioning is manual.
  `package.json` versions are `0.0.1` across the board.

## Not Verified From Repository

- Vercel project id / deployment env.
- Windows code-signing certificate.
- EAS app ids (`app.json`/`app.config` not read) — project id required
  for `eas build`.
- CI pipeline files (`.workflows` — none found).
- Redis/DATABASE_URL wiring for staging/prod (env files exist:
  `.env.production`, `.env.staging`).
