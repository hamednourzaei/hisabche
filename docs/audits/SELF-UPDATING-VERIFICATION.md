# Hisabche V13 — Self-Updating Verification & Device Steps

## 1. Automated Verification Matrix

Raw command outputs for the Final Verification Gate are saved under `docs/audits/evidence/`.

## 2. `UNVERIFIED_ON_DEVICE` (Requires Physical/GUI Device Verification)

1. **Windows Packaged Electron Installer & Custom Protocol (`hisabche-app://`):**
   - Build: `pnpm --filter @hisabche/desktop run package:win`
   - Verify: Install `Hisabche-*-setup.exe` on a clean Windows 10/11 machine, verify `%APPDATA%/@hisabche/desktop/hisabche.db` migration continuity, verify `HISABCHE_PACKS_DELIVERY=on` loads `hisabche-app://app/index.html` with strict CSP, and test `checkForUpdates()` against staging `/api/updates/win/latest.yml`.
2. **Android Physical Device / Emulator (Expo SDK 51 / RN 0.74):**
   - Build: `pnpm --filter @hisabche/mobile run android:release`
   - Verify: Launch `ShellWebView` offline, confirm `assets/shell/index.html` renders all routes, and verify `evaluateAndroidOtaEligibility` refuses mismatched `nativeFingerprint` OTA payloads.
3. **Web Production Skew on Vercel:**
   - Check Vercel Project Settings → Skew Protection (`OD-01`) and verify `/api/version` returns `Cache-Control: no-store`.
