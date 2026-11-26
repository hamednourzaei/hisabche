# Hisabche V13 — Self-Updating Baseline (Evidence-Only)

- **Audit Timestamp:** `2026-11-26T11:05:28Z`
- **Raw Measurement Evidence:** `docs/audits/evidence/s0-baseline-measurements.json`

## 1. Monorepo & Shared Shell Architecture

- **Workspace manager:** `pnpm` + `turbo.json` (`build`, `dev`, `lint`, `test`, `type-check`, `clean`).
- **Packages:** `analytics`, `api`, `app-bridge`, `app-shell`, `auth`, `auth-core`, `config`, `db-schema`, `design-tokens`, `formatting`, `i18n`, `local-engine`, `mobile-ui`, `store`, `sync`, `ui`, `ui-contract`, `validation`.
- **Single Shared UI Host:** `packages/app-shell` (`src/app/app.tsx`) is built via `@hisabche/app-shell/vite.shell` for **both** Electron (`apps/desktop/out/renderer`) and Android WebView (`apps/mobile/android/app/src/main/assets/shell`).
- **Existing V62 Pack Foundation:**
  - `packages/app-bridge/src/packs/{manifest.ts,plan.ts,store.ts,verify.ts}` implements Node-only `PackStore` with Ed25519 manifest signature + SHA-256 file verification + `.staging/` atomic rename + `installed.json` keeping `current`/`previous` builds (`coreBuildId`).
  - `packages/app-shell/src/features/packs/{pack-gate.tsx,prefetch.ts}` provides `PackRouteGate` and `scheduleIdlePackPrefetch` (`core`, `operations`, `manufacturing`, `workforce`, `approvals`, `intelligence`, `marketplace`), defaulting `hisabche:packs.delivery` to `off`.

## 2. Platform Baseline

### 2.1 Web (`apps/web`)

- **Framework:** Next.js `16.2.6`, React `19.2.6`, `output: 'standalone'` (unless `NEXT_STANDALONE=0`), `compress: true`, `experimental.inlineCss: true`, `experimental.optimizeCss: true`.
- **Deployment:** `apps/web/vercel.json` (`pnpm run build`, Next.js framework).
- **Gaps Found:** No version-skew detection endpoint/header check in client, no chunk-load retry with backoff, no deferral guard for active financial operations during reload, Vercel Skew Protection status `UNVERIFIED` (`OD-01`).
- **Measured Artifacts (`apps/web/.next/static/chunks`):** `13,216,455` bytes across `236` files.

### 2.2 Windows / Electron (`apps/desktop`)

- **Runtime:** Electron `^31.7.7`, `electron-vite` `^5.0.0`, `electron-builder` `^26.15.3`, `electron-updater` `^6.3.4`, native module `better-sqlite3` `^11.3.0` (`asarUnpack`).
- **Security Posture (`apps/desktop/electron/main/window.ts`):** `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `webviewTag: false`, CSP enforced in packaged mode (`buildRendererCsp`), `userData` pinned to `%APPDATA%/@hisabche/desktop`.
- **Protocol & Updater:** `hisabche-app://app` protocol exists (`protocol.ts`) when `HISABCHE_PACKS_DELIVERY=on`; `services/updater.ts` wraps `electron-updater` with `autoDownload = false`, `autoInstallOnAppQuit = false`.
- **Packaging Limitation (`electron-builder.yml`):** `differentialPackage: false` (Windows AV/indexer stat race on `.nsis.7z`), so full NSIS installer (~79.3 MB) is downloaded on shell updates; Windows code-signing certificate is not provisioned in repo (`OD-02`).
- **Gaps Found:** No pure `updater-core` slot/state-machine integration, no Core-vs-Module independent SemVer slots with crash-loop boot counter, no Windows AV rename retry loop in a shared FileStore adapter, `apps/desktop/out/main` currently `0` bytes (not yet built in current working tree).
- **Measured Artifacts (`apps/desktop/`):**
  - `out/renderer`: `16,061,612` bytes across `48` files
  - `dist/Hisabche-0.0.1-setup.exe`: `79,266,524` bytes (~75.6 MB)
  - `dist/Hisabche-0.0.1-win-x64.zip`: `125,285,009` bytes (~119.5 MB)
  - `dist/latest.yml`: `325` bytes
  - Cold start time: `UNMEASURED` (GUI interactive launch not executed in headless CLI session).

### 2.3 Android (`apps/mobile`)

- **Runtime:** Expo `~51.0.0`, React Native `0.74.2` (New Architecture NOT enabled), `react-native-webview` `13.8.6`, `expo-sqlite` `~14.0.6`, `expo-secure-store` `~13.0.2`, `expo-file-system` `~17.0.1`.
- **Architecture:** Native Expo shell (`ShellHost` / `ShellWebView`) renders `assets/shell/index.html` (`@hisabche/app-shell`, built via `vite.shell.config.mjs`, `singleFile: false`) inside `react-native-webview`, communicating over `webview-rpc` (`@hisabche/app-bridge`).
- **Updates Baseline:** `expo-updates` is **NOT** installed in `apps/mobile/package.json`; `app.json` has no `runtimeVersion` or `updates` block; `eas.json` has `development`, `preview` (apk), `production` (app-bundle).
- **Measured Artifacts (`apps/mobile/android/app/src/main/assets/shell`):** `10,356,591` bytes across `61` files. APK/AAB binary size: `UNMEASURED` (Gradle Android build not run in baseline; EAS/Gradle release size will be recorded if runnable).

### 2.4 Backend & Local Database

- **Backend (`backend/src/routes/updates.routes.ts`):** Serves unauthenticated `GET /api/updates/:platform/latest.yml` and `302` redirect `GET /api/updates/:platform/:fileName` from `app_releases` (`win`, `mac`, `linux`), enforcing exact `file_name` match and `sha512`.
- **Gaps Found:** No Core/Module/Data-Pack manifest registry, no channels (`development`/`internal`/`beta`/`stable`), no deterministic cohort rollout, no auto-halt/kill-switch, no signed TUF-style metadata or monotonic sequence numbers, no API compatibility negotiation headers.
- **Local DB & Offline:** Custom SQLite engine in `packages/local-engine` + `packages/app-bridge/src/local-{schema,migrations,universal-core-schema}.ts` and outbox sync in `packages/sync` (NOTE: Hisabche uses SQLite + `local-engine`, NOT WatermelonDB).
