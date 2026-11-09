# Hisabche — Platform Parity (Web · Windows · Android)

Audit date 2026-11-08, commit `b546d5df`. Read-only; no app was launched, no build made.

## 1. How the three platforms share code (FACT)

| Platform | Host                                                                                       | Screens                              | Data path                                                 |
| -------- | ------------------------------------------------------------------------------------------ | ------------------------------------ | --------------------------------------------------------- |
| Web      | `apps/web` Next.js, 30 dashboard `page.tsx` = metadata + container from `@hisabche/ui`     | `packages/ui`                        | HTTP only (`packages/api`)                                |
| Windows  | `apps/desktop` Electron (`electron/main/index.ts`, `window.ts`, preload)                   | `packages/app-shell` → `packages/ui` | `local-engine` on SQLite + HTTP sync                      |
| Android  | `apps/mobile` Expo; `src/host/shell-webview.tsx` renders the app-shell bundle in a WebView | same app-shell                       | `local-engine` via `src/host/local-api.ts`, `local-db.ts` |

## 2. Route parity (FACT)

30 web dashboard routes ↔ 30 app-shell routes (`packages/app-shell/src/app/app.tsx:111-146`). 28 legacy redirects identical on web (`apps/web/next.config.js:90-123`) and shell (`app.tsx:156-205`). Guard `route-parity.test.ts` passed in the UI suite this session.

Web-only: `/accept-invite`, `/oauth/authorize`, `/feedback/[token]`, all public marketing/blog/docs/legal/market pages.

## 3. Native capability matrix (FACT from file names; behaviour not run)

| Capability                        |       Web        |    Windows    |    Android    | Evidence                                                                                |
| --------------------------------- | :--------------: | :-----------: | :-----------: | --------------------------------------------------------------------------------------- |
| Offline engine                    |        ✗         |       ✓       |       ✓       | `apps/desktop/electron/main/services/local-api.ts`, `apps/mobile/src/host/local-api.ts` |
| Secure token store                | browser storage  |       ✓       |       ✓       | `electron/main/services/secure-store.ts`, `apps/mobile/src/shared/lib/storage.ts`       |
| Printing                          |     browser      |       ✓       |       ?       | `electron/main/services/printing.ts`; no mobile printing host file found                |
| Camera barcode scan               |  browser camera  |       ?       |       ✓       | `apps/mobile/src/host/camera-scan.ts`                                                   |
| Push notifications                |        ✗         |       ✗       |       ✓       | `apps/mobile/src/features/notifications/use-push-registration.ts`                       |
| Auto-update                       |       n/a        |       ✓       |     store     | `electron/main/services/updater.ts`; server `routes/updates.routes.ts:119`              |
| Offline licence screen            |        ✗         |       ✓       |       ✓       | `packages/app-shell/src/features/auth/offline-licence-screen.tsx`                       |
| Device outbox page `/sync-center` | shared container | device outbox | device outbox | CLAUDE.md §0.6; `features/sync/sync-page.tsx`                                           |

## 4. Gaps

| Item                                    | Status                                                                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Android release build on this machine   | BLOCKED_EXTERNAL (Defender removed `hermesc.exe` and other binaries on 31 Oct; brief)                                  |
| Desktop jest in CI                      | excluded: `.github/workflows/ci.yml:37` filters `!@hisabche/desktop` → desktop tests run only locally/desktop workflow |
| Mobile visual parity                    | NOT verified (no emulator run)                                                                                         |
| Invite acceptance inside desktop/mobile | NOT_IMPLEMENTED (web-only page) — NEEDS_OWNER_DECISION                                                                 |
| Printing on Android                     | not found → NOT_IMPLEMENTED or handled by WebView; verify                                                              |

## 5. Type-check evidence (this session, main checkout)

`apps/desktop` tsc exit 0 · `packages/app-shell` tsc exit 0 · `apps/web` tsc exit 0. Mobile tsc/jest **not run** (Expo toolchain; time).
