# Hisabche V13 — Update Security & Trust Model

## 1. TUF-Style Role Separation & RFC 8785 Canonical Signing

- Signed payloads use `canonicalJsonBytes` (RFC 8785 deterministic key sorting) in `packages/updater-core/src/canonical-json.ts` and Ed25519 signatures verified against Bootstrap-embedded `TrustedPublicKey[]` (supporting `keyId` rotation and `revoked` flags).
- **Private key custody (`OD-06`):** Private keys exist only in the release-signing environment (`scripts/updates/sign-release.mjs` reading `--key-file` or `HISABCHE_SIGNING_PRIVATE_KEY_FILE`) and are never stored in bundles, renderer, or the repository.

## 2. Replay, Downgrade, Clock-Skew & Archive Defenses

- **Monotonic sequence numbers:** `SecureStore.getSequence(layer)` persists the highest seen sequence; any manifest or halt directive with `sequence <= lastSeq` is rejected (`SEQUENCE_REPLAY_OR_DOWNGRADE`). Legitimate rollbacks are signed `SignedHaltDirective` objects with a strictly higher sequence number.
- **Clock skew (`#2`):** `verifySignedPayload` uses a bounded tolerance (`5m`) + `serverTimeMs` hint. Expired/skewed metadata only blocks installing new updates — it **never** disables an already-installed working version.
- **Archive safety (`validateArchiveEntries`):** Rejects `..`, absolute paths, backslashes, NUL bytes, symlinks/hardlinks, Windows reserved names (`CON`, `NUL`, etc.), case-insensitive duplicates, decompression bombs (`>50x` ratio), oversized entries, and executable extensions in data packs.
