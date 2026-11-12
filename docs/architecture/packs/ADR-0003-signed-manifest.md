# ADR-0003: Signed Detached Manifest, Verified PackStore, and Privileged Protocol

- **Status:** Accepted (V62)
- **Date:** 2026-11-12
- **Deciders:** Hisabche Architecture / Engineering

## Context

When `packs.delivery=on` is enabled on Desktop (and later Mobile), executable JavaScript pack chunks must be stored locally and served into the Electron `BrowserWindow` WebView without degrading Chromium/Electron sandbox security, breaking ES module loading under `file://`, or trusting unauthenticated CDN responses.

## Decision

1. **Detached Ed25519 Signed Manifest:** Releases publish `pack-manifest.json` (`packManifestSchema` in `packages/app-bridge/src/packs/manifest.ts`) alongside a detached base64 signature `pack-manifest.json.sig` produced by `scripts/packs/sign-manifest.mjs`. The manifest binds `coreBuildId`, per-file relative POSIX paths, byte sizes, SHA-256 hashes, `dependsOn`, and `withdrawn` status.
2. **Atomic Staged Install & Keep-Two GC (`PackStore`):** `packages/app-bridge/src/packs/store.ts` writes downloaded files into `packs/.staging/<buildId>/`, verifies `verifyManifestEd25519` and `verifyFileSha256` for every file before promoting via atomic rename into `packs/<buildId>/`, writes `installed.json` last, and cleans up interrupted `.staging/` directories on startup. Garbage collection always keeps the `current` + `previous` verified builds.
3. **Strict Path & Origin Security:** `safeJoinRoot` (`packages/app-bridge/src/packs/verify.ts`) rejects `..`, backslashes, and NUL bytes. Desktop (`apps/desktop/electron/main/protocol.ts`) registers `hisabche-app://` (`standard: true`, `secure: true`, `supportFetchAPI: true`, `corsEnabled: true`) only when `packs.delivery=on`, serving bundled renderer files first and verified `PackStore` files second under a CSP built by shared helper `buildRendererCsp`.
4. **Default Off & Safe Fallback:** `packs.delivery` defaults to `off` and `packs.installer` defaults to `full`, keeping Desktop on `file://` unchanged until owner infrastructure and key pairs are provisioned. Mobile keeps its current asset load path pending the real-device spike (`SPIKE-mobile-loader.md`).

## Consequences

- **Positive:** Arbitrary CDN or MITM tampering fails Ed25519 or SHA-256 verification inside `.staging/` before any code is promoted or served. Interrupted downloads leave the prior verified build intact.
- **Negative / Trade-offs:** Pack releases must match the host binary's `coreBuildId` and require CI secret management for the Ed25519 private key plus CSP/protocol testing whenever `packs.delivery=on` is turned on.
