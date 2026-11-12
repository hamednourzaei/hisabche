# Feature Pack Release & Publishing Workflow

> Owner-gated CI/CD procedure for building, budgeting, signing, and publishing Hisabche feature packs.
> Never run live CDN uploads or store signing keys in the repository.

## 1. Prerequisites (Owner Infrastructure)

- Dedicated immutable CDN bucket + domain (configured via pack CDN base URL; not committed here).
- Ed25519 signing key pair generated offline (`node scripts/packs/sign-manifest.mjs generate-keys`):
  - **Private key (PKCS#8 PEM):** stored strictly in CI secret manager / hardware key.
  - **Public key (SPKI PEM):** embedded in desktop/mobile release configuration for `verifyManifestEd25519`.

## 2. Deterministic Build & Map Generation

1. Regenerate the Rollup pack chunk map from the canonical registry (`FEATURE_PACKS` / `ENGINES`):

   ```bash
   node scripts/packs/emit-pack-map.mjs
   ```

   This updates `packages/app-shell/pack-map.generated.json` so `.mjs` Vite configs stay pure JS with no TypeScript import at config-load time.

2. Build the shell renderer for the target host (`packages/app-shell/vite.shell.mjs` for desktop or `apps/mobile/vite.shell.config.mjs` with `singleFile: false`), producing `.vite/manifest.json` plus `pack-*.js` and `locale-*.js` chunk groups.

3. Measure raw and gzip-9 sizes per bucket and verify against `packages/app-shell/bundle-budgets.json`:

   ```bash
   node scripts/packs/report.mjs <renderer-out-dir>
   ```

   Fail the release pipeline if core entry or any pack exceeds `bundle-budgets.json` (plus `headroomFactor: 1.1`).

## 3. Generate `pack-manifest.json`

Build a JSON manifest conforming to `packManifestSchema` (`packages/app-bridge/src/packs/manifest.ts`):

- `schemaVersion`: `1`
- `coreBuildId`: unique release/build identifier matching the host binary's bundled core build
- `generatedAt`: ISO-8601 timestamp
- `packs`: record keyed by `PackId`, each entry containing:
  - `id`: pack ID (`operations`, `manufacturing`, `workforce`, `approvals`, `intelligence`, `marketplace`)
  - `files`: array of `{ path, sha256, sizeBytes }` with relative POSIX paths under the renderer output (no leading `/`, no `..`, no `\`)
  - `dependsOn`: array of dependency pack IDs matching `FEATURE_PACKS`
  - `withdrawn`: `false` (or `true` when withdrawing a bad pack via `RUNBOOK-withdraw-a-pack.md`)

## 4. Sign the Manifest (Detached Ed25519 Signature)

Sign the exact bytes of `pack-manifest.json` using the CI private key:

```bash
node scripts/packs/sign-manifest.mjs sign <out-dir>/pack-manifest.json /path/to/ed25519-private.pem
```

This writes `<out-dir>/pack-manifest.json.sig` containing the base64 Ed25519 signature expected by `verifyManifestEd25519(manifestBytes, signatureBase64, publicKeyPem)` in `packages/app-bridge/src/packs/verify.ts`.

Verify before upload by parsing with `parsePackManifest` and running `verifyManifestEd25519` + `verifyFileSha256` against every referenced file.

## 5. Upload & Cache Headers

Upload build artifacts under a build-scoped prefix `<cdn-origin>/builds/<coreBuildId>/`:

- Hashed chunk files (`assets/*.js`, `pack-*.js`, `locale-*.js`):
  - `Cache-Control: public, max-age=31536000, immutable`
- `pack-manifest.json` and `pack-manifest.json.sig`:
  - `Cache-Control: public, max-age=60, must-revalidate`

Never overwrite an existing `<coreBuildId>` folder in place; always publish under a new `coreBuildId` so `PackStore` retains clean `current` and `previous` builds.
