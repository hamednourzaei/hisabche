// ============================================
// packages/validation/src/schemas/universal-core/migration-preflight.domain.ts
//
// PART 5 / Slice 4 — NATIVE ARCHIVE PREFLIGHT.
//
// The cloud migration center must validate an uploaded archive BEFORE staging
// anything. This is the pure decision layer: it reads manifest facts (never
// the file itself), refuses unknown versions and missing required sections,
// and yields an idempotency key so a retried upload is one import, not two.
// ============================================

export interface ArchiveManifestFacts {
  readonly formatVersion: number
  readonly sourceSchemaVersion: number
  readonly supportedFormatVersions: readonly number[]
  readonly maxSupportedSchemaVersion: number
  readonly requiredSections: readonly string[]
  readonly presentSections: readonly string[]
  readonly totalChecksumMatches: boolean
}

export interface PreflightDecision {
  readonly ready: boolean
  readonly blockers: readonly string[]
  /** Stable across retries of the SAME archive; never derived from time. */
  readonly idempotencyKey: string | null
}

export function evaluateArchivePreflight(
  facts: ArchiveManifestFacts,
  identity: { sourceWorkspaceId: string; packageChecksum: string },
): PreflightDecision {
  const blockers: string[] = []
  if (!facts.supportedFormatVersions.includes(facts.formatVersion)) {
    blockers.push('UNSUPPORTED_FORMAT_VERSION')
  }
  if (
    !Number.isSafeInteger(facts.sourceSchemaVersion) ||
    facts.sourceSchemaVersion > facts.maxSupportedSchemaVersion
  ) {
    blockers.push('UNSUPPORTED_SCHEMA_VERSION')
  }
  const present = new Set(facts.presentSections)
  for (const section of facts.requiredSections) {
    if (!present.has(section)) blockers.push(`MISSING_SECTION:${section}`)
  }
  if (!facts.totalChecksumMatches) blockers.push('CHECKSUM_MISMATCH')

  return {
    ready: blockers.length === 0,
    blockers,
    idempotencyKey:
      blockers.length === 0
        ? `migrate:${identity.sourceWorkspaceId}:${identity.packageChecksum}`
        : null,
  }
}
