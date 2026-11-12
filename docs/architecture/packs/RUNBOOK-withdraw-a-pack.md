# Runbook: Withdraw a Broken or Compromised Feature Pack

- **Owner:** Engineering / Release Manager
- **Applies to:** `pack-manifest.json` CDN delivery (`packs.delivery=on`)
- **Severity:** High (prevents clients from downloading or executing a bad pack build)

## When to Use

- A published feature pack causes runtime crashes, security exposure, or mismatched `coreBuildId` chunk imports.
- Do **not** delete individual chunk files silently in place without updating the signed manifest; doing so causes signature/hash mismatch noise without giving clients a clean `withdrawn` signal.

## Procedure

1. **Identify affected `coreBuildId` and `PackId`**
   - Confirm whether the defect affects one pack (`operations`, `manufacturing`, `workforce`, `approvals`, `intelligence`, `marketplace`) or the entire build.

2. **Mark `withdrawn: true` in `pack-manifest.json`**
   - Edit the release `pack-manifest.json` entry under `packs.<packId>`:
     ```json
     "withdrawn": true
     ```
   - Never modify `coreBuildId` or leave stale signatures beside the edited JSON.

3. **Re-sign with the Ed25519 Private Key**
   - In CI / authorized release environment (never on an untrusted laptop):
     ```bash
     node scripts/packs/sign-manifest.mjs sign path/to/pack-manifest.json /secure/path/ed25519-private.pem
     ```
   - Verify that `pack-manifest.json.sig` passes `verifyManifestEd25519`.

4. **Publish Updated Manifest & Signature**
   - Upload `pack-manifest.json` and `pack-manifest.json.sig` with short cache headers (`Cache-Control: public, max-age=60, must-revalidate`) and purge CDN edge cache for both files.

5. **Emergency Kill-Switch (If Manifest Signing Key Cannot Run Immediately)**
   - Flip remote feature flag `packs.delivery=off` so clients revert to bundled core/full behavior (on `full` installers) or display `PackRouteNotice` (`not_installed`) cleanly without failing mid-fetch.

6. **Client Behavior & Rollback**
   - `packages/app-bridge/src/packs/plan.ts` checks `entry.withdrawn` before scheduling downloads; a withdrawn pack is blocked from new installs/downloads.
   - `PackStore` retains `previousBuildId` (`GC keeps current + previous`), allowing hotfix re-pinning if a prior verified build is unaffected.
   - Because SQLite schema and customer rows live in `core` (`ADR-0002`), customer local data remains intact while UI access pauses.

7. **Recovery**
   - Fix the underlying bug, build under a **new** `coreBuildId`, run `node scripts/packs/report.mjs` to check `bundle-budgets.json`, set `withdrawn: false`, sign `pack-manifest.json`, and publish.
