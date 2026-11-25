# Workflow — Mobile & Desktop Cross-Platform Audit

**Default Profile:** `STANDARD`

## Sequence

1. **`Mobile App Builder` (`hisabche-mobile-app-builder`)** audits `apps/mobile` Android Expo SDK 51 / RN 0.74 / Legacy WebView bridge, camera/biometric/SQLite parity, and checks Hermes JS constraints (`no-node-builtins-on-device.test.ts`).
2. **`Desktop App Engineer` (`hisabche-desktop-app-engineer`)** audits `apps/desktop` Electron IPC, `file://` URL asset loading, `safeStorage` keystore persistence, `openUserPartitionWith()`, and `.esbuild-tmp` build guards.
3. **`Code Reviewer` (`hisabche-code-reviewer`)** + `.claude/agents/parity-reviewer` check route alignment (`apps/web/next.config.js` vs `packages/app-shell/src/app/app.tsx`) and native mobile card/sheet parity.
4. **`Test Results Analyzer` (`hisabche-test-results-analyzer`)** validates `apps/desktop` Jest + `tsc` (`tsconfig.json` & `tsconfig.node.json`) and `apps/mobile` Jest results.

## Hard Constraints

Zero upgrades to Expo SDK 51 or React Native 0.74; keep Legacy WebView; do not enable New Architecture.
