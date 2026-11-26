# Hisabche V13 — Self-Updating Architecture

## 1. Layered Separation

`Minimal Native Bootstrap → Updateable Core Runtime → Independently Versioned Feature Modules → Shared Backend Contracts (API + DB + Sync)`

1. **Native Bootstrap:** Smallest platform-specific foundation (`apps/desktop/electron/main/{window.ts,protocol.ts,services/updater.ts,services/updater-ports.ts}`, `apps/mobile/src/host/{ShellWebView,updater-adapter.ts}`). Never contains optional business features; never downloads native code.
2. **Updateable Core Runtime:** `packages/updater-core`, `packages/app-shell`, `packages/ui`, `packages/api`, `packages/local-engine`, core financial/accounting workflows. Core never imports optional modules directly; modules attach via `ModuleExtensionContract` (`packages/updater-core/src/module-contract.ts`).
3. **Optional Feature Modules:** Separable capabilities (`approvals`, `operations`, `manufacturing`, `workforce`, `intelligence`, `marketplace`) with independent SemVer manifests, compatibility ranges, and non-destructive disablement (`I13`).
4. **Asset & Data Packs:** Zod-validated non-executable packs (`i18n`, `template`, `report_schema`, `help`, `reference`). `validateArchiveEntries(..., { nonExecutableOnly: true })` blocks `.js`/`.exe`/`.sh`/`.dll` entries.

## 2. Pure Core + Ports + Thin Adapters

All update decision logic lives in `packages/updater-core/src/` with zero dependencies on Electron, React Native, DOM, `node:fs`, `node:crypto`, `fetch`, `Date.now()`, or `Math.random()`. Platform adapters implement `Clock`, `FileStore`, `Transport`, `SecureStore`, `Verifier`, `LocalDataProbe`, `Telemetry`, and `ProcessPort`.
