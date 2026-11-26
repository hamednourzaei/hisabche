# Hisabche V13 — Independent Self-Updating Gap Audit

## 1. Dependency Graph & Isolation Audit

- **Graph:** `Native Bootstrap (apps/desktop/electron/main, apps/mobile/src/host) → Updateable Core Runtime (packages/updater-core, app-shell, ui, api, local-engine) → Optional Modules (ModuleExtensionContract) → Backend Control Plane (updates.routes.ts) → Postgres (runtime_release_artifacts)`.
- **Verified:** `quality-gates.test.ts` confirms `packages/updater-core/src/*.ts` has zero imports from `apps/*`, `node:*`, `electron`, or `react-native`.
- **Remaining Native Coupling (Documented Honestly):**
  1. Electron shell updates still download full NSIS installers (~75.6 MB) because `differentialPackage: false` in `apps/desktop/electron-builder.yml` avoids Windows AV `.nsis.7z` stat races.
  2. Android `apps/mobile` bundles `assets/shell/` inside the APK and does not have `expo-updates` installed; self-hosted shell OTA (`OD-03`) requires native host wiring when owner chooses Play vs direct APK distribution.

## 2. Security, Offline & Transfer Audit

- **Security bypass checks covered by tests:** wrong Ed25519 key, tampered payload, replay/downgrade sequence, zip-slip, symlink, Windows reserved names, case collisions, decompression bombs, executable data packs, module self-granted permissions, and cross-tenant telemetry isolation.
- **Offline review:** `I1..I13` verified via `LocalDataProbe.getDataSnapshotHash()` across all 14 `CRASH_POINTS` and fault injections.
- **Delta updates claim:** Do **not** claim binary delta patching — Core/Module artifacts transfer full layer bundles (`slots/<layer>/<version>/`) with HTTP `Range` resume support (`206`), NOT binary bsdiff deltas.
