# Hisabche V13 — Update Manifest Specification

All manifests are validated by pure validators in `packages/updater-core/src/manifests.ts` using strict SemVer (`semver.ts`) — never lexicographic string comparison.

## 1. Core Manifest (`kind: 'core'`)

- `id`, `version` (SemVer), `channel` (`development|internal|beta|stable`), `platforms` (`web|windows|android`)
- `minBootstrapVersion`, `maxBootstrapVersion`, `apiRange`, `dbRange`, `minLocalSchemaVersion`, `maxLocalSchemaVersion`
- `moduleCompatibility` (`Record<moduleId, SemVerRange>`), `requiredMigrations`
- `artifact`: `{ url (https:// required), sha256 (64 hex), sizeBytes (>0), etag? }`
- `signature`: `{ role, keyId, algorithm: 'ed25519', sigBase64, sequence (>=1), signedAt, expiresAt }`
- `releaseNotes` (`{ fa, af, en }`), `criticality`, `minSupportedVersion`, `rollbackTarget`, `activationRequirements`, `nativeFingerprint?`

## 2. Module Manifest (`kind: 'module'`)

- `id`, `version`, `channel`, `dependencies`, `optionalDependencies`, `requiredCoreRange`, `apiRange`, `dbSchemaRange`, `minLocalSchemaVersion`, `platforms`, `requiredCapabilities`, `requiredPermissions`, `offlineSupport`, `artifact`, `signature`, `migrationReferences`, `releaseNotes`, `rollbackCompatibility`.
- Rejections enforced: self-dependency, dependency cycles, duplicate IDs, invalid SemVer/ranges, non-HTTPS artifact URLs, and module self-granting capabilities/permissions not present in workspace entitlements.
