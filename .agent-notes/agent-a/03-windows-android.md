# Pass 3 — what a user sees: Windows and Android

## Files read

- `packages/app-shell/src/app/app.tsx` (207 lines; every `path:` line)
- Feature file list under `packages/app-shell/src/features` (41 files)
- `apps/desktop/electron/main/services/printing.ts` (full)
- `apps/desktop/electron/main/services/updater.ts` (full)
- `apps/desktop/electron/main/services/local-api.ts` (full, 29 lines)
- `apps/desktop/electron/main/services/secure-store.ts` (grep: safeStorage, markers)
- `apps/mobile/app/_layout.tsx` (full)
- `apps/mobile/src/host/camera-scan.ts` (full)
- `apps/mobile/src/features/notifications/use-push-registration.ts` (full)
- `apps/mobile/app.json`, `apps/mobile/eas.json` (full)

## Facts proven

- Windows/Android route list: 34 rendered screens + `audit` + 4 public token
  pages + login, and 35 redirects (`app.tsx`). Screens are the same shared
  containers the web mounts (`features/*/…-page.tsx` → `@hisabche/ui`).
- Android is a **WebView host** around the same app-shell bundle, not a second
  UI (`apps/mobile/app/_layout.tsx` header comment + `ShellWebView`). The host
  starts: local DB, session storage, outbox/sync runner, push registration.
- Barcode scan by phone camera exists as a host capability (`camera-scan.ts`,
  `barcode.scan`); one scan at a time; answers code / closed / not-allowed.
- Push registration exists (Expo token → `POST /notifications/devices`);
  no-op on simulators (`use-push-registration.ts`).
- Android build profiles exist (development/preview apk/production aab);
  **no iOS build profile** in `eas.json`. `app.json` has iOS identifiers and
  camera/FaceID strings, but nothing builds iOS → iOS is UNCLEAR, not AVAILABLE.
- Desktop printing: A4/HTML through an offscreen window **and** ESC/POS thermal
  receipts through the OS spooler; printer list; copies; page width in mm.
  Printing requires `record.create` (`printing.ts:65`).
- Desktop updates: check → download → install, manual by design (no auto
  download); a build with no feed answers «unsupported», not an error
  (`updater.ts`).
- Desktop runs the **local engine in-process** over the same SQLite file
  (`local-api.ts` → `createLocalEngine(getLocalDb())`).
- Desktop session is stored encrypted with the OS user key (DPAPI/Keychain via
  `safeStorage`), with an explicit unencrypted-file fallback and an
  `isEncryptionAvailable` signal (`secure-store.ts:4-7,62-64,96-111`).

## Facts not proven

- That the Windows installer is published/downloadable today — no release
  artefact or feed file read. (Code exists; distribution unknown.)
- iOS: no build profile → UNCLEAR.
- Mobile offline depth: the host opens the local DB and runs the outbox, but the
  pull is desktop-only (`OFFLINE_SYNC.md` §1, §6) → Android reads what it pulled
  never; PARTIAL.

## Deliberately skipped

- The 41 feature wrapper files' bodies — each is a thin re-export of a shared
  container; the container is the same one the web page mounts (verified for
  invoices/warehouse/customers hubs in Pass 2).
- `camera-scan-overlay.tsx` UI details, `secure-store.ts` full body.
- Desktop `files.ts`, `monitoring.ts`, `network-log.ts` — not claim-bearing.
