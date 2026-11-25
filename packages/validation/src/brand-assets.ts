// ============================================
// packages/validation/src/brand-assets.ts
//
// Shared contract for Business Brand Assets (logo, stamp, signature):
// - Supported MIME types & asset limits
// - Strict SVG sanitization (XSS / XXE / external-ref prevention)
// - Standardized Error Taxonomy & Retry/Safety metadata
// ============================================

export type BrandAssetType = 'logo' | 'stamp' | 'signature'
export type BrandAssetField = 'logoUrl' | 'stampUrl' | 'signatureUrl'
export type BrandAssetColumn = 'logo_url' | 'stamp_url' | 'signature_url'

export const BRAND_ASSET_TYPES = ['logo', 'stamp', 'signature'] as const

export const ALLOWED_BRAND_ASSET_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
] as const

export type BrandAssetMimeType = (typeof ALLOWED_BRAND_ASSET_MIME_TYPES)[number]

export const BRAND_ASSET_MIME_TO_EXT: Record<BrandAssetMimeType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

export const MAX_BRAND_ASSET_UPLOAD_BYTES = 2 * 1024 * 1024 // 2 MiB
export const MAX_BRAND_ASSET_SVG_BYTES = 256 * 1024 // 256 KiB
export const MAX_BRAND_ASSET_DIMENSION = 4096
export const MAX_BRAND_ASSET_PIXELS = 4096 * 4096 // 16.7 MP bomb guard

export const BRAND_ASSET_TARGET_DIMENSIONS: Record<
  BrandAssetType,
  { maxWidth: number; maxHeight: number }
> = {
  logo: { maxWidth: 1024, maxHeight: 1024 },
  stamp: { maxWidth: 1024, maxHeight: 1024 },
  signature: { maxWidth: 1200, maxHeight: 600 },
}

export const BRAND_ASSET_META: Record<
  BrandAssetType,
  { field: BrandAssetField; column: BrandAssetColumn }
> = {
  logo: { field: 'logoUrl', column: 'logo_url' },
  stamp: { field: 'stampUrl', column: 'stamp_url' },
  signature: { field: 'signatureUrl', column: 'signature_url' },
}

export type BrandAssetErrorCode =
  | 'INVALID_FILE_FORMAT'
  | 'SPOOFED_MIME_TYPE'
  | 'CORRUPTED_IMAGE'
  | 'UNSAFE_SVG_CONTENT'
  | 'FILE_TOO_LARGE'
  | 'DIMENSIONS_TOO_LARGE'
  | 'IMAGE_PROCESSING_FAILED'
  | 'STORAGE_NOT_CONFIGURED'
  | 'STORAGE_UNAVAILABLE'
  | 'UPLOAD_TIMEOUT'
  | 'NETWORK_INTERRUPTION'
  | 'AUTH_EXPIRED'
  | 'PERMISSION_DENIED'
  | 'WORKSPACE_NOT_FOUND'
  | 'WORKSPACE_SWITCHED'
  | 'MISSING_DATABASE_COLUMN'
  | 'MISSING_MIGRATION'
  | 'DATABASE_WRITE_FAILED'
  | 'DATABASE_READBACK_FAILED'
  | 'STORAGE_DELETE_FAILED'
  | 'CACHE_INVALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'INTERNAL_SERVER_ERROR'

export interface BrandAssetErrorSpec {
  readonly code: BrandAssetErrorCode
  readonly httpStatus: number
  readonly retryable: boolean
  readonly previousAssetIntact: boolean
  readonly requiresManualIntervention: boolean
  readonly i18nKey: string
}

export const BRAND_ASSET_ERROR_TAXONOMY: Record<BrandAssetErrorCode, BrandAssetErrorSpec> = {
  INVALID_FILE_FORMAT: {
    code: 'INVALID_FILE_FORMAT',
    httpStatus: 400,
    retryable: false,
    previousAssetIntact: true,
    requiresManualIntervention: false,
    i18nKey: 'settings.brandAssets.errors.invalidFormat',
  },
  SPOOFED_MIME_TYPE: {
    code: 'SPOOFED_MIME_TYPE',
    httpStatus: 400,
    retryable: false,
    previousAssetIntact: true,
    requiresManualIntervention: false,
    i18nKey: 'settings.brandAssets.errors.spoofedMime',
  },
  CORRUPTED_IMAGE: {
    code: 'CORRUPTED_IMAGE',
    httpStatus: 400,
    retryable: false,
    previousAssetIntact: true,
    requiresManualIntervention: false,
    i18nKey: 'settings.brandAssets.errors.corruptedImage',
  },
  UNSAFE_SVG_CONTENT: {
    code: 'UNSAFE_SVG_CONTENT',
    httpStatus: 400,
    retryable: false,
    previousAssetIntact: true,
    requiresManualIntervention: false,
    i18nKey: 'settings.brandAssets.errors.unsafeSvg',
  },
  FILE_TOO_LARGE: {
    code: 'FILE_TOO_LARGE',
    httpStatus: 413,
    retryable: false,
    previousAssetIntact: true,
    requiresManualIntervention: false,
    i18nKey: 'settings.brandAssets.errors.tooLarge',
  },
  DIMENSIONS_TOO_LARGE: {
    code: 'DIMENSIONS_TOO_LARGE',
    httpStatus: 400,
    retryable: false,
    previousAssetIntact: true,
    requiresManualIntervention: false,
    i18nKey: 'settings.brandAssets.errors.dimensionsTooLarge',
  },
  IMAGE_PROCESSING_FAILED: {
    code: 'IMAGE_PROCESSING_FAILED',
    httpStatus: 422,
    retryable: true,
    previousAssetIntact: true,
    requiresManualIntervention: false,
    i18nKey: 'settings.brandAssets.errors.processingFailed',
  },
  STORAGE_NOT_CONFIGURED: {
    code: 'STORAGE_NOT_CONFIGURED',
    httpStatus: 503,
    retryable: false,
    previousAssetIntact: true,
    requiresManualIntervention: true,
    i18nKey: 'settings.brandAssets.errors.storageUnavailable',
  },
  STORAGE_UNAVAILABLE: {
    code: 'STORAGE_UNAVAILABLE',
    httpStatus: 503,
    retryable: true,
    previousAssetIntact: true,
    requiresManualIntervention: false,
    i18nKey: 'settings.brandAssets.errors.storageUnavailable',
  },
  UPLOAD_TIMEOUT: {
    code: 'UPLOAD_TIMEOUT',
    httpStatus: 408,
    retryable: true,
    previousAssetIntact: true,
    requiresManualIntervention: false,
    i18nKey: 'settings.brandAssets.errors.networkError',
  },
  NETWORK_INTERRUPTION: {
    code: 'NETWORK_INTERRUPTION',
    httpStatus: 0,
    retryable: true,
    previousAssetIntact: true,
    requiresManualIntervention: false,
    i18nKey: 'settings.brandAssets.errors.networkError',
  },
  AUTH_EXPIRED: {
    code: 'AUTH_EXPIRED',
    httpStatus: 401,
    retryable: false,
    previousAssetIntact: true,
    requiresManualIntervention: true,
    i18nKey: 'settings.brandAssets.errors.authExpired',
  },
  PERMISSION_DENIED: {
    code: 'PERMISSION_DENIED',
    httpStatus: 403,
    retryable: false,
    previousAssetIntact: true,
    requiresManualIntervention: false,
    i18nKey: 'settings.brandAssets.errors.permissionDenied',
  },
  WORKSPACE_NOT_FOUND: {
    code: 'WORKSPACE_NOT_FOUND',
    httpStatus: 404,
    retryable: false,
    previousAssetIntact: true,
    requiresManualIntervention: false,
    i18nKey: 'settings.stampNoWorkspace',
  },
  WORKSPACE_SWITCHED: {
    code: 'WORKSPACE_SWITCHED',
    httpStatus: 409,
    retryable: false,
    previousAssetIntact: true,
    requiresManualIntervention: false,
    i18nKey: 'settings.brandAssets.errors.workspaceSwitched',
  },
  MISSING_DATABASE_COLUMN: {
    code: 'MISSING_DATABASE_COLUMN',
    httpStatus: 409,
    retryable: false,
    previousAssetIntact: true,
    requiresManualIntervention: true,
    i18nKey: 'settings.imageNotSupported',
  },
  MISSING_MIGRATION: {
    code: 'MISSING_MIGRATION',
    httpStatus: 409,
    retryable: false,
    previousAssetIntact: true,
    requiresManualIntervention: true,
    i18nKey: 'settings.imageNotSupported',
  },
  DATABASE_WRITE_FAILED: {
    code: 'DATABASE_WRITE_FAILED',
    httpStatus: 500,
    retryable: true,
    previousAssetIntact: true,
    requiresManualIntervention: false,
    i18nKey: 'settings.stampUploadFailed',
  },
  DATABASE_READBACK_FAILED: {
    code: 'DATABASE_READBACK_FAILED',
    httpStatus: 500,
    retryable: true,
    previousAssetIntact: true,
    requiresManualIntervention: false,
    i18nKey: 'settings.stampUploadFailed',
  },
  STORAGE_DELETE_FAILED: {
    code: 'STORAGE_DELETE_FAILED',
    httpStatus: 502,
    retryable: true,
    previousAssetIntact: false,
    requiresManualIntervention: true,
    i18nKey: 'settings.brandAssets.errors.deleteFailed',
  },
  CACHE_INVALIDATION_FAILED: {
    code: 'CACHE_INVALIDATION_FAILED',
    httpStatus: 500,
    retryable: true,
    previousAssetIntact: false,
    requiresManualIntervention: false,
    i18nKey: 'settings.stampUploadFailed',
  },
  RATE_LIMITED: {
    code: 'RATE_LIMITED',
    httpStatus: 429,
    retryable: true,
    previousAssetIntact: true,
    requiresManualIntervention: false,
    i18nKey: 'settings.brandAssets.errors.rateLimited',
  },
  INTERNAL_SERVER_ERROR: {
    code: 'INTERNAL_SERVER_ERROR',
    httpStatus: 500,
    retryable: true,
    previousAssetIntact: true,
    requiresManualIntervention: false,
    i18nKey: 'settings.stampUploadFailed',
  },
}

export type SvgSanitizationResult =
  | { ok: true; sanitized: string; byteLength: number }
  | { ok: false; code: 'UNSAFE_SVG_CONTENT' | 'CORRUPTED_IMAGE' | 'FILE_TOO_LARGE'; reason: string }

const FORBIDDEN_SVG_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /<!DOCTYPE\b/i, reason: 'DOCTYPE declarations are not allowed in SVG assets.' },
  { pattern: /<!ENTITY\b/i, reason: 'XML ENTITY declarations are not allowed in SVG assets.' },
  { pattern: /<\s*script\b/i, reason: 'Script elements are forbidden in SVG assets.' },
  { pattern: /<\s*foreignObject\b/i, reason: 'Embedded HTML foreignObject is forbidden in SVG.' },
  {
    pattern: /<\s*(?:iframe|object|embed|applet|audio|video|link|meta|base)\b/i,
    reason: 'Active or external HTML elements are forbidden in SVG.',
  },
  { pattern: /\bon[a-z]+\s*=/i, reason: 'Inline event handler attributes are forbidden in SVG.' },
  {
    pattern: /(?:javascript|vbscript|data\s*:\s*text\/html)\s*:/i,
    reason: 'Executable URI schemes are forbidden in SVG.',
  },
  {
    pattern: /(?:href|xlink:href|src)\s*=\s*["']\s*(?:https?:|\/\/)/i,
    reason: 'External resource references are forbidden in SVG.',
  },
  {
    pattern: /expression\s*\(|@import\b|url\s*\(\s*["']?\s*(?:https?:|\/\/|javascript:)/i,
    reason: 'Unsafe CSS active rules or external URLs are forbidden in SVG.',
  },
]

/**
 * Strictly validate and normalize an SVG brand asset without rasterizing it.
 * Rejects scripts, event handlers, XXE/DOCTYPE, foreignObject, and external refs.
 */
export function sanitizeSvgBrandAsset(rawSvg: string): SvgSanitizationResult {
  if (typeof rawSvg !== 'string') {
    return { ok: false, code: 'CORRUPTED_IMAGE', reason: 'SVG payload must be text.' }
  }
  const trimmed = rawSvg.replace(/^\uFEFF/, '').trim()
  if (!trimmed || trimmed.includes('\0')) {
    return {
      ok: false,
      code: 'CORRUPTED_IMAGE',
      reason: 'SVG payload is empty or contains null bytes.',
    }
  }

  // Strip XML declaration and comments before pattern inspection so obfuscated tokens cannot hide.
  const withoutDeclAndComments = trimmed
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim()

  const byteLen = new TextEncoder().encode(withoutDeclAndComments).byteLength
  if (byteLen > MAX_BRAND_ASSET_SVG_BYTES) {
    return {
      ok: false,
      code: 'FILE_TOO_LARGE',
      reason: `SVG exceeds ${MAX_BRAND_ASSET_SVG_BYTES} bytes.`,
    }
  }

  for (const { pattern, reason } of FORBIDDEN_SVG_PATTERNS) {
    if (pattern.test(withoutDeclAndComments)) {
      return { ok: false, code: 'UNSAFE_SVG_CONTENT', reason }
    }
  }

  if (!/^<svg\b[^>]*>[\s\S]*<\/svg>$/i.test(withoutDeclAndComments)) {
    return {
      ok: false,
      code: 'CORRUPTED_IMAGE',
      reason: 'SVG must have a single <svg>...</svg> root.',
    }
  }

  return {
    ok: true,
    sanitized: withoutDeclAndComments,
    byteLength: byteLen,
  }
}

export function isBrandAssetType(value: string): value is BrandAssetType {
  return value === 'logo' || value === 'stamp' || value === 'signature'
}
