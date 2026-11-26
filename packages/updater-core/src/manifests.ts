/**
 * Pure manifest definitions, runtime validators, and safe archive-entry
 * validator (zero external dependencies, never throws uncaught on malformed input).
 */

import type { SignatureMetadata } from './canonical-json'
import { isValidSemVer, isValidSemVerRange } from './semver'

export type UpdatePlatform = 'web' | 'windows' | 'android'
export type ReleaseChannel = 'development' | 'internal' | 'beta' | 'stable'
export type UpdateCriticality = 'optional' | 'recommended' | 'security' | 'mandatory'

export interface ArtifactRef {
  url: string
  sha256: string
  sizeBytes: number
  etag?: string | undefined
}

export interface CoreManifest {
  kind: 'core'
  id: string
  version: string
  channel: ReleaseChannel
  platforms: readonly UpdatePlatform[]
  minBootstrapVersion: string
  maxBootstrapVersion: string
  apiRange: string
  dbRange: string
  minLocalSchemaVersion: number
  maxLocalSchemaVersion: number
  moduleCompatibility: Readonly<Record<string, string>>
  requiredMigrations: readonly string[]
  artifact: ArtifactRef
  signature: SignatureMetadata
  releaseNotes: Readonly<{ fa: string; af: string; en: string }>
  criticality: UpdateCriticality
  minSupportedVersion: string
  rollbackTarget: string | null
  activationRequirements: {
    requiresRestart: boolean
    deferDuringFinancialOps: boolean
  }
  nativeFingerprint?: string | undefined
}

export interface ModuleManifest {
  kind: 'module'
  id: string
  version: string
  channel: ReleaseChannel
  dependencies: Readonly<Record<string, string>>
  optionalDependencies: Readonly<Record<string, string>>
  requiredCoreRange: string
  apiRange: string
  dbSchemaRange: string
  minLocalSchemaVersion: number
  platforms: readonly UpdatePlatform[]
  requiredCapabilities: readonly string[]
  requiredPermissions: readonly string[]
  offlineSupport: boolean
  artifact: ArtifactRef
  signature: SignatureMetadata
  migrationReferences: readonly string[]
  releaseNotes: Readonly<{ fa: string; af: string; en: string }>
  rollbackCompatibility: {
    supportsRollback: boolean
    rollbackTarget: string | null
    minRollbackCoreRange?: string | undefined
  }
}

export interface DataPackManifest {
  kind: 'data-pack'
  id: string
  version: string
  packType: 'i18n' | 'template' | 'report_schema' | 'help' | 'reference'
  schemaVersion: number
  nonExecutable: true
  platforms: readonly UpdatePlatform[]
  artifact: ArtifactRef
  signature: SignatureMetadata
}

export interface SignedHaltDirective {
  kind: 'halt-directive'
  releaseId: string
  layer: string
  targetVersion: string
  rollbackTarget: string | null
  reason: string
  signature: SignatureMetadata
}

export type ValidationResult<T> =
  { ok: true; value: T } | { ok: false; code: string; details: string }

const PLATFORMS_SET = new Set<string>(['web', 'windows', 'android'])
const CHANNELS_SET = new Set<string>(['development', 'internal', 'beta', 'stable'])
const SHA256_RE = /^[a-f0-9]{64}$/i
const WINDOWS_RESERVED_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
])

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function validateSignatureMeta(raw: unknown): SignatureMetadata | null {
  if (!isRecord(raw)) return null
  if (
    raw.role !== 'root' &&
    raw.role !== 'targets' &&
    raw.role !== 'snapshot' &&
    raw.role !== 'timestamp'
  ) {
    return null
  }
  if (typeof raw.keyId !== 'string' || raw.keyId.trim().length === 0) return null
  if (raw.algorithm !== 'ed25519') return null
  if (typeof raw.sigBase64 !== 'string' || raw.sigBase64.trim().length < 16) return null
  if (typeof raw.sequence !== 'number' || !Number.isInteger(raw.sequence) || raw.sequence < 1) {
    return null
  }
  if (typeof raw.signedAt !== 'string' || !Number.isFinite(Date.parse(raw.signedAt))) return null
  if (typeof raw.expiresAt !== 'string' || !Number.isFinite(Date.parse(raw.expiresAt))) return null
  return raw as unknown as SignatureMetadata
}

function validateArtifactRef(raw: unknown): ArtifactRef | null {
  if (!isRecord(raw)) return null
  if (typeof raw.url !== 'string' || !raw.url.startsWith('https://')) return null
  if (typeof raw.sha256 !== 'string' || !SHA256_RE.test(raw.sha256)) return null
  if (typeof raw.sizeBytes !== 'number' || !Number.isInteger(raw.sizeBytes) || raw.sizeBytes <= 0) {
    return null
  }
  return {
    url: raw.url,
    sha256: raw.sha256.toLowerCase(),
    sizeBytes: raw.sizeBytes,
    ...(typeof raw.etag === 'string' ? { etag: raw.etag } : {}),
  }
}

function validatePlatforms(raw: unknown): UpdatePlatform[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const out: UpdatePlatform[] = []
  const seen = new Set<string>()
  for (const p of raw) {
    if (typeof p !== 'string' || !PLATFORMS_SET.has(p) || seen.has(p)) return null
    seen.add(p)
    out.push(p as UpdatePlatform)
  }
  return out
}

function validateRangeMap(raw: unknown): Record<string, string> | null {
  if (!isRecord(raw)) return null
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (!k.trim() || typeof v !== 'string' || !isValidSemVerRange(v)) return null
    out[k] = v
  }
  return out
}

export function validateCoreManifest(raw: unknown): ValidationResult<CoreManifest> {
  if (!isRecord(raw)) return { ok: false, code: 'MANIFEST_NOT_OBJECT', details: 'Expected object' }
  if (raw.kind !== 'core') return { ok: false, code: 'INVALID_KIND', details: 'Expected core' }
  if (typeof raw.id !== 'string' || !raw.id.trim()) {
    return { ok: false, code: 'INVALID_ID', details: 'Missing id' }
  }
  if (typeof raw.version !== 'string' || !isValidSemVer(raw.version)) {
    return { ok: false, code: 'INVALID_SEMVER', details: 'Invalid core version' }
  }
  if (typeof raw.channel !== 'string' || !CHANNELS_SET.has(raw.channel)) {
    return { ok: false, code: 'INVALID_CHANNEL', details: 'Invalid channel' }
  }
  const platforms = validatePlatforms(raw.platforms)
  if (!platforms) return { ok: false, code: 'INVALID_PLATFORMS', details: 'Invalid platforms' }
  if (
    typeof raw.minBootstrapVersion !== 'string' ||
    !isValidSemVer(raw.minBootstrapVersion) ||
    typeof raw.maxBootstrapVersion !== 'string' ||
    !isValidSemVer(raw.maxBootstrapVersion)
  ) {
    return { ok: false, code: 'INVALID_BOOTSTRAP_VERSION', details: 'Invalid bootstrap range' }
  }
  if (typeof raw.apiRange !== 'string' || !isValidSemVerRange(raw.apiRange)) {
    return { ok: false, code: 'INVALID_API_RANGE', details: 'Invalid apiRange' }
  }
  if (typeof raw.dbRange !== 'string' || !isValidSemVerRange(raw.dbRange)) {
    return { ok: false, code: 'INVALID_DB_RANGE', details: 'Invalid dbRange' }
  }
  const moduleCompatibility = validateRangeMap(raw.moduleCompatibility ?? {})
  if (!moduleCompatibility) {
    return { ok: false, code: 'INVALID_MODULE_COMPAT', details: 'Invalid moduleCompatibility' }
  }
  const artifact = validateArtifactRef(raw.artifact)
  if (!artifact) {
    return { ok: false, code: 'INVALID_ARTIFACT', details: 'Artifact must use HTTPS and sha256' }
  }
  const signature = validateSignatureMeta(raw.signature)
  if (!signature) return { ok: false, code: 'INVALID_SIGNATURE_META', details: 'Bad signature' }
  if (typeof raw.minSupportedVersion !== 'string' || !isValidSemVer(raw.minSupportedVersion)) {
    return { ok: false, code: 'INVALID_MIN_SUPPORTED', details: 'Invalid minSupportedVersion' }
  }
  if (
    raw.rollbackTarget !== null &&
    (typeof raw.rollbackTarget !== 'string' || !isValidSemVer(raw.rollbackTarget))
  ) {
    return { ok: false, code: 'INVALID_ROLLBACK_TARGET', details: 'Invalid rollbackTarget' }
  }
  if (!isRecord(raw.releaseNotes)) {
    return { ok: false, code: 'INVALID_RELEASE_NOTES', details: 'Missing releaseNotes' }
  }

  return {
    ok: true,
    value: raw as unknown as CoreManifest,
  }
}

export function validateModuleManifest(raw: unknown): ValidationResult<ModuleManifest> {
  if (!isRecord(raw)) return { ok: false, code: 'MANIFEST_NOT_OBJECT', details: 'Expected object' }
  if (raw.kind !== 'module') return { ok: false, code: 'INVALID_KIND', details: 'Expected module' }
  if (typeof raw.id !== 'string' || !/^[a-z0-9][a-z0-9-_]{1,63}$/.test(raw.id)) {
    return { ok: false, code: 'INVALID_MODULE_ID', details: 'Invalid module id' }
  }
  if (typeof raw.version !== 'string' || !isValidSemVer(raw.version)) {
    return { ok: false, code: 'INVALID_SEMVER', details: 'Invalid module version' }
  }
  if (typeof raw.channel !== 'string' || !CHANNELS_SET.has(raw.channel)) {
    return { ok: false, code: 'INVALID_CHANNEL', details: 'Invalid channel' }
  }
  const deps = validateRangeMap(raw.dependencies ?? {})
  const optDeps = validateRangeMap(raw.optionalDependencies ?? {})
  if (!deps || !optDeps) {
    return {
      ok: false,
      code: 'INVALID_DEPENDENCY_RANGE',
      details: 'Invalid dependency SemVer range',
    }
  }
  if (deps[raw.id] !== undefined || optDeps[raw.id] !== undefined) {
    return { ok: false, code: 'SELF_DEPENDENCY', details: 'Module cannot depend on itself' }
  }
  if (typeof raw.requiredCoreRange !== 'string' || !isValidSemVerRange(raw.requiredCoreRange)) {
    return { ok: false, code: 'INVALID_CORE_RANGE', details: 'Invalid requiredCoreRange' }
  }
  if (typeof raw.apiRange !== 'string' || !isValidSemVerRange(raw.apiRange)) {
    return { ok: false, code: 'INVALID_API_RANGE', details: 'Invalid apiRange' }
  }
  if (typeof raw.dbSchemaRange !== 'string' || !isValidSemVerRange(raw.dbSchemaRange)) {
    return { ok: false, code: 'INVALID_DB_RANGE', details: 'Invalid dbSchemaRange' }
  }
  const platforms = validatePlatforms(raw.platforms)
  if (!platforms) return { ok: false, code: 'INVALID_PLATFORMS', details: 'Invalid platforms' }
  const artifact = validateArtifactRef(raw.artifact)
  if (!artifact) {
    return { ok: false, code: 'INVALID_ARTIFACT', details: 'Artifact must use HTTPS and sha256' }
  }
  const signature = validateSignatureMeta(raw.signature)
  if (!signature) return { ok: false, code: 'INVALID_SIGNATURE_META', details: 'Bad signature' }

  return { ok: true, value: raw as unknown as ModuleManifest }
}

export interface ArchiveEntryInput {
  path: string
  type: 'file' | 'directory' | 'symlink' | 'hardlink'
  uncompressedBytes: number
  compressedBytes?: number | undefined
}

export interface ArchivePolicyOptions {
  maxTotalBytes: number
  maxEntryBytes: number
  maxCompressionRatio: number
  maxPathLength: number
  nonExecutableOnly?: boolean | undefined
}

export const DEFAULT_ARCHIVE_POLICY: ArchivePolicyOptions = {
  maxTotalBytes: 64 * 1024 * 1024,
  maxEntryBytes: 16 * 1024 * 1024,
  maxCompressionRatio: 50,
  maxPathLength: 200,
}

const EXECUTABLE_EXTS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.exe',
  '.dll',
  '.bat',
  '.cmd',
  '.ps1',
  '.sh',
  '.so',
])

export function validateArchiveEntries(
  entries: readonly ArchiveEntryInput[],
  policy: ArchivePolicyOptions = DEFAULT_ARCHIVE_POLICY,
): ValidationResult<readonly ArchiveEntryInput[]> {
  let totalBytes = 0
  const seenLowerPaths = new Set<string>()

  for (const entry of entries) {
    if (entry.type === 'symlink' || entry.type === 'hardlink') {
      return { ok: false, code: 'ARCHIVE_SYMLINK_REJECTED', details: entry.path }
    }
    const p = entry.path
    if (!p || p.length > policy.maxPathLength) {
      return { ok: false, code: 'ARCHIVE_PATH_TOO_LONG', details: p }
    }
    if (p.includes('\0') || p.includes('\\') || p.startsWith('/') || /^[A-Za-z]:/.test(p)) {
      return { ok: false, code: 'ARCHIVE_ABSOLUTE_OR_UNSAFE_PATH', details: p }
    }
    const segments = p.split('/')
    for (const seg of segments) {
      if (!seg || seg === '.' || seg === '..') {
        return { ok: false, code: 'ARCHIVE_PATH_TRAVERSAL', details: p }
      }
      const base = seg.split('.')[0]!.toUpperCase()
      if (WINDOWS_RESERVED_NAMES.has(base)) {
        return { ok: false, code: 'ARCHIVE_WINDOWS_RESERVED_NAME', details: p }
      }
    }
    const lower = p.toLowerCase()
    if (seenLowerPaths.has(lower)) {
      return { ok: false, code: 'ARCHIVE_CASE_COLLISION', details: p }
    }
    seenLowerPaths.add(lower)

    if (entry.uncompressedBytes < 0 || entry.uncompressedBytes > policy.maxEntryBytes) {
      return { ok: false, code: 'ARCHIVE_ENTRY_OVERSIZED', details: p }
    }
    if (
      entry.compressedBytes !== undefined &&
      entry.compressedBytes > 0 &&
      entry.uncompressedBytes / entry.compressedBytes > policy.maxCompressionRatio
    ) {
      return { ok: false, code: 'ARCHIVE_DECOMPRESSION_BOMB', details: p }
    }
    totalBytes += entry.uncompressedBytes
    if (totalBytes > policy.maxTotalBytes) {
      return { ok: false, code: 'ARCHIVE_TOTAL_OVERSIZED', details: String(totalBytes) }
    }
    if (policy.nonExecutableOnly && entry.type === 'file') {
      const dot = lower.lastIndexOf('.')
      const ext = dot >= 0 ? lower.slice(dot) : ''
      if (EXECUTABLE_EXTS.has(ext)) {
        return { ok: false, code: 'DATA_PACK_EXECUTABLE_FORBIDDEN', details: p }
      }
    }
  }

  return { ok: true, value: entries }
}
