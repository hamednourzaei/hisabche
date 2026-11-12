# Mobile Feature-Pack Loader Spike Plan (`SPIKE-mobile-loader`)

- **Status:** `NEEDS_OWNER_REAL_DEVICE_RUN` (current APK-bundled path `file:///android_asset/shell/index.html` remains active and untouched in V62)
- **Goal:** Prove that Android (and iOS) `react-native-webview` can load `core` + downloaded feature packs from the app sandbox directory with zero new runtime dependencies.

---

## 1. Proposed Sandbox Layout (No Network Required Once Installed)

1. On first launch (when `packs.delivery === 'on'`):
   - Copy bundled `assets/shell/` into `${FileSystem.documentDirectory}shell/<coreBuildId>/`.
   - Write verified downloaded pack chunks beside it under `${FileSystem.documentDirectory}shell/<coreBuildId>/assets/`.
2. Load the WebView at `${FileSystem.documentDirectory}shell/<coreBuildId>/index.html` with minimal file access props:
   - `allowingReadAccessToURL={`${FileSystem.documentDirectory}shell/`}` (iOS)
   - `allowFileAccess={true}` scoped strictly to `shell/<coreBuildId>/` (Android), keeping `allowUniversalAccessFromFileURLs={false}` and `allowFileAccessFromFileURLs={false}`.

## 2. Long-Term Native Alternative: Android `WebViewAssetLoader`

- Serving `${documentDirectory}shell/<coreBuildId>/` via Android's `androidx.webkit.WebViewAssetLoader` (`https://appassets.androidplatform.net/assets/...`) avoids `file://` origin quirks completely and allows strict origin-scoped CSP, but requires a small native Kotlin/Java module in `apps/mobile/android/`.

## 3. Pass / Fail Criteria on a Real Android Device

| Criterion              | Pass Condition                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Chunk loading          | Navigating to a lazy pack route loads `./assets/pack-*.js` with zero 404 or MIME errors.                                  |
| Sandbox isolation      | Attempting `fetch('file:///data/...')` outside `shell/<coreBuildId>/` is blocked by WebView.                              |
| Native bridge & SQLite | `window.hisabche` RPC, `expo-sqlite` queries, and offline outbox replay work identically to `android_asset`.              |
| Fallback safety        | If copy/verify fails, host falls back cleanly to `file:///android_asset/shell/index.html` and records `BLOCKED_EXTERNAL`. |
