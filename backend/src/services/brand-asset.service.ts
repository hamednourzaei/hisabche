// ============================================
// backend/src/services/brand-asset.service.ts
//
// Production-Grade Brand Asset Engine V1 (logo, stamp, signature):
// - Server-side magic-byte & dimension inspection (zero new deps)
// - Strict SVG sanitization (XSS / XXE / external-ref prevention)
// - Tenant-isolated object storage (business-assets/{workspaceId}/{type}/{id}/v1.{ext})
// - Failure-safe replacement (upload -> DB persist -> verify -> cache invalidate -> retire old)
// - Confirmed deletion with DB detach, cache invalidation, and orphan/cleanup telemetry
// - Structured observability logs (zero image bytes/Base64/secrets)
// ============================================

import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import {
  ALLOWED_BRAND_ASSET_MIME_TYPES,
  BRAND_ASSET_ERROR_TAXONOMY,
  BRAND_ASSET_META,
  BRAND_ASSET_MIME_TO_EXT,
  MAX_BRAND_ASSET_DIMENSION,
  MAX_BRAND_ASSET_PIXELS,
  MAX_BRAND_ASSET_SVG_BYTES,
  MAX_BRAND_ASSET_UPLOAD_BYTES,
  sanitizeSvgBrandAsset,
  type BrandAssetErrorCode,
  type BrandAssetMimeType,
  type BrandAssetType,
} from '@hisabche/validation'
import { supabase } from '../db'
import { BaseError } from '../errors/base.error'
import { DatabaseError } from '../errors/database.error'
import { clearCache } from '../middleware/cache.middleware'
import { getStorageProvider, type StorageProvider } from '../storage/storage-adapter'
import { WorkspaceService } from './workspace.service'

export const BRAND_ASSET_BUCKET = 'business-assets'

export class BrandAssetError extends BaseError {
  public readonly code: BrandAssetErrorCode
  public readonly retryable: boolean
  public readonly previousAssetIntact: boolean

  constructor(code: BrandAssetErrorCode, detail?: string) {
    const spec = BRAND_ASSET_ERROR_TAXONOMY[code]
    super(detail ?? code, spec.httpStatus, true)
    this.name = 'BrandAssetError'
    this.code = code
    this.retryable = spec.retryable
    this.previousAssetIntact = spec.previousAssetIntact
  }
}

export interface ParsedBrandAssetPayload {
  readonly mimeType: BrandAssetMimeType
  readonly buffer: Buffer
  readonly width: number | null
  readonly height: number | null
  readonly sha256: string
}

export interface BrandAssetUploadResult {
  readonly workspaceId: string
  readonly assetType: BrandAssetType
  readonly field: 'logoUrl' | 'stampUrl' | 'signatureUrl'
  readonly column: 'logo_url' | 'stamp_url' | 'signature_url'
  readonly url: string
  readonly objectPath: string
  readonly mimeType: BrandAssetMimeType
  readonly originalBytes: number
  readonly storedBytes: number
  readonly width: number | null
  readonly height: number | null
  readonly sha256: string
  readonly traceId: string
  readonly workspace: Record<string, unknown>
}

export interface BrandAssetDeleteResult {
  readonly workspaceId: string
  readonly assetType: BrandAssetType
  readonly deleted: boolean
  readonly storageCleaned: boolean
  readonly traceId: string
  readonly workspace: Record<string, unknown>
}

function getSigningSecret(): string {
  const directSecret =
    process.env.BRAND_ASSET_SIGNING_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    process.env.SUPABASE_JWT_SECRET?.trim() ||
    ''
  if (directSecret.length >= 16) return directSecret

  // Supabase projects using asymmetric ES256 JWKS may omit symmetric JWT_SECRET;
  // derive a domain-separated HMAC subkey from SUPABASE_SERVICE_KEY so signed URLs
  // stay functional without exposing or reusing the raw service credential.
  const serviceKey = process.env.SUPABASE_SERVICE_KEY?.trim() || ''
  if (serviceKey.length >= 16) {
    return createHmac('sha256', serviceKey).update('hisabche:brand-asset-hmac-v1').digest('hex')
  }

  if (process.env.NODE_ENV === 'production') {
    throw new BrandAssetError('STORAGE_NOT_CONFIGURED', 'Brand asset signing secret missing.')
  }
  return 'hisabche-dev-brand-asset-signing-secret'
}

export function signBrandAssetPath(
  workspaceId: string,
  objectPath: string,
  expiresAtSec: number,
): string {
  const secret = getSigningSecret()
  return createHmac('sha256', secret)
    .update(`${workspaceId}:${objectPath}:${expiresAtSec}`)
    .digest('hex')
}

export function verifyBrandAssetSignature(
  workspaceId: string,
  objectPath: string,
  expiresAtSec: number,
  signature: string,
): boolean {
  if (!Number.isFinite(expiresAtSec) || Math.floor(Date.now() / 1000) > expiresAtSec) {
    return false
  }
  const expected = signBrandAssetPath(workspaceId, objectPath, expiresAtSec)
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(signature, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

function parsePngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (!buf.subarray(0, 8).equals(sig)) return null
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  return width > 0 && height > 0 ? { width, height } : null
}

function parseJpegDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) {
    return null
  }
  let offset = 2
  while (offset + 4 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset++
      continue
    }
    const marker = buf[offset + 1]!
    if (marker === 0xd9 || marker === 0xda) break
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }
    if (offset + 4 > buf.length) break
    const segmentLen = buf.readUInt16BE(offset + 2)
    if (segmentLen < 2 || offset + 2 + segmentLen > buf.length) break
    // SOF0, SOF1, SOF2, SOF3
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2 || marker === 0xc3) {
      if (offset + 9 <= buf.length) {
        const height = buf.readUInt16BE(offset + 5)
        const width = buf.readUInt16BE(offset + 7)
        return width > 0 && height > 0 ? { width, height } : null
      }
    }
    offset += 2 + segmentLen
  }
  return null
}

function parseWebpDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 30) return null
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') {
    return null
  }
  const chunkType = buf.toString('ascii', 12, 16)
  if (chunkType === 'VP8 ' && buf.length >= 30) {
    const width = buf.readUInt16LE(26) & 0x3fff
    const height = buf.readUInt16LE(28) & 0x3fff
    return width > 0 && height > 0 ? { width, height } : null
  }
  if (chunkType === 'VP8L' && buf.length >= 25) {
    const bits = buf.readUInt32LE(21)
    const width = (bits & 0x3fff) + 1
    const height = ((bits >> 14) & 0x3fff) + 1
    return width > 0 && height > 0 ? { width, height } : null
  }
  if (chunkType === 'VP8X' && buf.length >= 30) {
    const width = 1 + (buf[24]! | (buf[25]! << 8) | (buf[26]! << 16))
    const height = 1 + (buf[27]! | (buf[28]! << 8) | (buf[29]! << 16))
    return width > 0 && height > 0 ? { width, height } : null
  }
  return null
}

function detectActualMime(buf: Buffer): BrandAssetMimeType | null {
  if (parsePngDimensions(buf)) return 'image/png'
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }
  const head = buf.subarray(0, Math.min(buf.length, 512)).toString('utf8').trimStart()
  if (head.startsWith('<svg') || head.startsWith('<?xml')) {
    return 'image/svg+xml'
  }
  return null
}

export function validateAndInspectBrandAsset(
  rawBuffer: Buffer,
  declaredMimeType: string,
): ParsedBrandAssetPayload {
  const normalizedDeclared = declaredMimeType.split(';')[0]?.trim().toLowerCase() ?? ''
  if (!(ALLOWED_BRAND_ASSET_MIME_TYPES as readonly string[]).includes(normalizedDeclared)) {
    throw new BrandAssetError('INVALID_FILE_FORMAT', `Unsupported MIME type: ${normalizedDeclared}`)
  }

  if (rawBuffer.byteLength <= 0) {
    throw new BrandAssetError('CORRUPTED_IMAGE', 'Uploaded brand asset is empty.')
  }
  if (rawBuffer.byteLength > MAX_BRAND_ASSET_UPLOAD_BYTES) {
    throw new BrandAssetError(
      'FILE_TOO_LARGE',
      `Brand asset exceeds ${MAX_BRAND_ASSET_UPLOAD_BYTES} bytes.`,
    )
  }

  const declared = normalizedDeclared as BrandAssetMimeType
  const actual = detectActualMime(rawBuffer)
  if (!actual) {
    throw new BrandAssetError('CORRUPTED_IMAGE', 'Could not recognize a valid image header.')
  }
  if (actual !== declared) {
    throw new BrandAssetError(
      'SPOOFED_MIME_TYPE',
      `Declared MIME '${declared}' does not match actual binary format '${actual}'.`,
    )
  }

  if (actual === 'image/svg+xml') {
    if (rawBuffer.byteLength > MAX_BRAND_ASSET_SVG_BYTES) {
      throw new BrandAssetError('FILE_TOO_LARGE', 'SVG exceeds max allowed size.')
    }
    const sanitized = sanitizeSvgBrandAsset(rawBuffer.toString('utf8'))
    if (!sanitized.ok) {
      throw new BrandAssetError(sanitized.code, sanitized.reason)
    }
    const cleanBuf = Buffer.from(sanitized.sanitized, 'utf8')
    const sha256 = createHash('sha256').update(cleanBuf).digest('hex')
    return { mimeType: actual, buffer: cleanBuf, width: null, height: null, sha256 }
  }

  const dims =
    actual === 'image/png'
      ? parsePngDimensions(rawBuffer)
      : actual === 'image/jpeg'
        ? parseJpegDimensions(rawBuffer)
        : parseWebpDimensions(rawBuffer)

  if (!dims) {
    throw new BrandAssetError('CORRUPTED_IMAGE', `Invalid or truncated ${actual} image structure.`)
  }
  if (
    dims.width > MAX_BRAND_ASSET_DIMENSION ||
    dims.height > MAX_BRAND_ASSET_DIMENSION ||
    dims.width * dims.height > MAX_BRAND_ASSET_PIXELS
  ) {
    throw new BrandAssetError(
      'DIMENSIONS_TOO_LARGE',
      `Image dimensions ${dims.width}x${dims.height} exceed ${MAX_BRAND_ASSET_DIMENSION}px cap.`,
    )
  }

  const sha256 = createHash('sha256').update(rawBuffer).digest('hex')
  return {
    mimeType: actual,
    buffer: rawBuffer,
    width: dims.width,
    height: dims.height,
    sha256,
  }
}

export function extractBrandAssetPathFromUrl(urlValue: string | null | undefined): string | null {
  if (!urlValue) return null
  try {
    const parsed = new URL(urlValue, 'https://hisabche.local')
    const pathParam = parsed.searchParams.get('path')
    return pathParam && pathParam.startsWith(`${BRAND_ASSET_BUCKET}/`) ? pathParam : null
  } catch {
    return null
  }
}

export function buildSignedBrandAssetContentUrl(
  workspaceId: string,
  assetType: BrandAssetType,
  objectPath: string,
): string {
  // Long-lived signed retrieval token (30 days) for invoice & PDF rendering; workspace-scoped & HMAC-verified.
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
  const sig = signBrandAssetPath(workspaceId, objectPath, expiresAt)
  return `/api/workspaces/${workspaceId}/brand-assets/${assetType}/content?path=${encodeURIComponent(objectPath)}&exp=${expiresAt}&sig=${sig}`
}

export class BrandAssetService {
  private readonly workspaceSvc: WorkspaceService
  private readonly storageProviderOverride?: StorageProvider | undefined

  constructor(workspaceSvc = new WorkspaceService(), storageProvider?: StorageProvider) {
    this.workspaceSvc = workspaceSvc
    this.storageProviderOverride = storageProvider
  }

  private storage(): StorageProvider {
    return this.storageProviderOverride ?? getStorageProvider()
  }

  private logEvent(event: Record<string, unknown>): void {
    // Structured telemetry — never log Base64, binary buffers, tokens, or credentials.
    console.info(JSON.stringify({ subsystem: 'brand-asset-engine', ...event }))
  }

  async replaceBrandAsset(params: {
    userId: string
    workspaceId: string
    assetType: BrandAssetType
    fileBuffer: Buffer
    declaredMimeType: string
    originalBytes?: number | undefined
    processingDurationMs?: number | undefined
  }): Promise<BrandAssetUploadResult> {
    const traceId = randomUUID()
    const { userId, workspaceId, assetType } = params
    const meta = BRAND_ASSET_META[assetType]
    const originalBytes = params.originalBytes ?? params.fileBuffer.byteLength

    await this.workspaceSvc.requireRole(userId, workspaceId, 'admin')

    const parsed = validateAndInspectBrandAsset(params.fileBuffer, params.declaredMimeType)

    // Ensure signing configuration is valid BEFORE uploading to avoid orphaned objects.
    getSigningSecret()

    // Capture previous reference so we can retire it ONLY after DB replacement succeeds.
    const existingWorkspace = await this.workspaceSvc.getWorkspace(userId, workspaceId)
    const previousUrl = (existingWorkspace as Record<string, unknown>)[meta.column] as
      string | null | undefined
    const previousObjectPath = extractBrandAssetPathFromUrl(previousUrl)

    const assetId = randomUUID()
    const ext = BRAND_ASSET_MIME_TO_EXT[parsed.mimeType]
    const objectPath = `${BRAND_ASSET_BUCKET}/${workspaceId}/${assetType}/${assetId}/v1.${ext}`
    const uploadStart = Date.now()

    try {
      await this.storage().upload(BRAND_ASSET_BUCKET, objectPath, parsed.buffer, {
        contentType: parsed.mimeType,
        upsert: false,
        isPublic: false,
        maxBytes: MAX_BRAND_ASSET_UPLOAD_BYTES,
        expectedTenantPrefix: `${BRAND_ASSET_BUCKET}/${workspaceId}`,
        expectedSha256: parsed.sha256,
      })
    } catch (err) {
      const errorDetail = err instanceof Error ? err.message.slice(0, 240) : 'Storage upload failed'
      this.logEvent({
        traceId,
        workspaceId,
        assetType,
        operation: 'replace',
        originalBytes,
        optimizedBytes: parsed.buffer.byteLength,
        processingDurationMs: params.processingDurationMs ?? null,
        uploadDurationMs: Date.now() - uploadStart,
        providerOutcome: 'failed',
        dbOutcome: 'skipped',
        cleanupOutcome: 'not_needed',
        errorCode: 'STORAGE_UNAVAILABLE',
        errorDetail,
      })
      throw new BrandAssetError('STORAGE_UNAVAILABLE', errorDetail)
    }

    const uploadDurationMs = Date.now() - uploadStart
    const contentUrl = buildSignedBrandAssetContentUrl(workspaceId, assetType, objectPath)

    let updatedWorkspace: Record<string, unknown>
    try {
      updatedWorkspace = await this.workspaceSvc.updateWorkspace(userId, workspaceId, {
        [meta.field]: contentUrl,
      })
      const persistedValue = updatedWorkspace[meta.column]
      if (persistedValue !== contentUrl) {
        throw new BrandAssetError('DATABASE_READBACK_FAILED', 'Persisted brand asset URL mismatch.')
      }
    } catch (dbErr) {
      let cleanupOutcome = 'succeeded'
      try {
        await this.storage().delete(BRAND_ASSET_BUCKET, objectPath)
      } catch {
        cleanupOutcome = 'failed'
      }
      this.logEvent({
        traceId,
        workspaceId,
        assetType,
        operation: 'replace',
        originalBytes,
        optimizedBytes: parsed.buffer.byteLength,
        processingDurationMs: params.processingDurationMs ?? null,
        uploadDurationMs,
        providerOutcome: 'uploaded',
        dbOutcome: 'failed',
        cleanupOutcome,
      })
      if (dbErr instanceof BrandAssetError) throw dbErr
      if (dbErr instanceof DatabaseError && /migration/i.test(dbErr.message)) {
        throw new BrandAssetError('MISSING_MIGRATION', dbErr.message)
      }
      throw new BrandAssetError('DATABASE_WRITE_FAILED', 'Failed to persist brand asset reference.')
    }

    await clearCache(`workspace:${workspaceId}`)
    await clearCache('workspaces:*')

    let retireOutcome = 'none'
    if (previousObjectPath && previousObjectPath !== objectPath) {
      try {
        await this.storage().delete(BRAND_ASSET_BUCKET, previousObjectPath)
        retireOutcome = 'retired'
      } catch {
        retireOutcome = 'retire_failed'
      }
    }

    this.logEvent({
      traceId,
      workspaceId,
      assetType,
      operation: 'replace',
      originalBytes,
      optimizedBytes: parsed.buffer.byteLength,
      width: parsed.width,
      height: parsed.height,
      processingDurationMs: params.processingDurationMs ?? null,
      uploadDurationMs,
      providerOutcome: 'uploaded',
      dbOutcome: 'persisted',
      cleanupOutcome: retireOutcome,
    })

    return {
      workspaceId,
      assetType,
      field: meta.field,
      column: meta.column,
      url: contentUrl,
      objectPath,
      mimeType: parsed.mimeType,
      originalBytes,
      storedBytes: parsed.buffer.byteLength,
      width: parsed.width,
      height: parsed.height,
      sha256: parsed.sha256,
      traceId,
      workspace: updatedWorkspace,
    }
  }

  async deleteBrandAsset(params: {
    userId: string
    workspaceId: string
    assetType: BrandAssetType
  }): Promise<BrandAssetDeleteResult> {
    const traceId = randomUUID()
    const { userId, workspaceId, assetType } = params
    const meta = BRAND_ASSET_META[assetType]

    await this.workspaceSvc.requireRole(userId, workspaceId, 'admin')

    const existingWorkspace = await this.workspaceSvc.getWorkspace(userId, workspaceId)
    const previousUrl = (existingWorkspace as Record<string, unknown>)[meta.column] as
      string | null | undefined
    const previousObjectPath = extractBrandAssetPathFromUrl(previousUrl)

    let updatedWorkspace: Record<string, unknown>
    try {
      updatedWorkspace = await this.workspaceSvc.updateWorkspace(userId, workspaceId, {
        [meta.field]: null,
      })
      if (updatedWorkspace[meta.column] !== null && updatedWorkspace[meta.column] !== undefined) {
        throw new BrandAssetError(
          'DATABASE_READBACK_FAILED',
          'Brand asset column remained non-null.',
        )
      }
    } catch (dbErr) {
      this.logEvent({
        traceId,
        workspaceId,
        assetType,
        operation: 'delete',
        dbOutcome: 'failed',
        cleanupOutcome: 'skipped',
      })
      if (dbErr instanceof BrandAssetError) throw dbErr
      if (dbErr instanceof DatabaseError && /migration/i.test(dbErr.message)) {
        throw new BrandAssetError('MISSING_MIGRATION', dbErr.message)
      }
      throw new BrandAssetError('DATABASE_WRITE_FAILED', 'Failed to clear brand asset reference.')
    }

    await clearCache(`workspace:${workspaceId}`)
    await clearCache('workspaces:*')

    let storageCleaned = true
    if (previousObjectPath) {
      try {
        await this.storage().delete(BRAND_ASSET_BUCKET, previousObjectPath)
      } catch {
        storageCleaned = false
      }
    }

    this.logEvent({
      traceId,
      workspaceId,
      assetType,
      operation: 'delete',
      dbOutcome: 'persisted_null',
      cleanupOutcome: previousObjectPath ? (storageCleaned ? 'deleted' : 'delete_failed') : 'none',
    })

    return {
      workspaceId,
      assetType,
      deleted: true,
      storageCleaned,
      traceId,
      workspace: updatedWorkspace,
    }
  }

  async readBrandAssetContent(params: {
    workspaceId: string
    objectPath: string
  }): Promise<{ buffer: Buffer; mimeType: BrandAssetMimeType }> {
    const cleanPrefix = `${BRAND_ASSET_BUCKET}/${params.workspaceId}/`
    if (!params.objectPath.startsWith(cleanPrefix) || params.objectPath.includes('..')) {
      throw new BrandAssetError('PERMISSION_DENIED', 'Brand asset path escapes workspace boundary.')
    }
    const ext = params.objectPath.split('.').pop()?.toLowerCase() ?? 'png'
    const mimeType: BrandAssetMimeType =
      ext === 'svg'
        ? 'image/svg+xml'
        : ext === 'jpg' || ext === 'jpeg'
          ? 'image/jpeg'
          : ext === 'webp'
            ? 'image/webp'
            : 'image/png'

    const buffer = await this.storage().download(BRAND_ASSET_BUCKET, params.objectPath)
    return { buffer, mimeType }
  }
}

export async function verifyWorkspaceAssetRecordExists(workspaceId: string): Promise<boolean> {
  const { data } = await supabase
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .maybeSingle()
  return Boolean(data)
}
