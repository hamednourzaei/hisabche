// ============================================
// packages/ui/src/lib/brand-image-processor.ts
//
// Format-aware browser image processor for Business Brand Assets
// (PNG, JPEG, WebP, SVG) using native browser APIs only:
// - PNG: lossless preservation unless downscaling > target dimensions
// - JPEG: EXIF orientation normalization + metadata strip + controlled quality
// - WebP: alpha preservation + quality optimization (keeps original if smaller)
// - SVG: strict sanitization via @hisabche/validation without rasterizing
// ============================================

import {
  ALLOWED_BRAND_ASSET_MIME_TYPES,
  BRAND_ASSET_MIME_TO_EXT,
  BRAND_ASSET_TARGET_DIMENSIONS,
  MAX_BRAND_ASSET_DIMENSION,
  MAX_BRAND_ASSET_PIXELS,
  MAX_BRAND_ASSET_SVG_BYTES,
  MAX_BRAND_ASSET_UPLOAD_BYTES,
  sanitizeSvgBrandAsset,
  type BrandAssetErrorCode,
  type BrandAssetMimeType,
  type BrandAssetType,
} from '@hisabche/validation'

export interface ProcessedBrandAsset {
  readonly file: File
  readonly mimeType: BrandAssetMimeType
  readonly previewDataUrl: string
  readonly originalBytes: number
  readonly optimizedBytes: number
  readonly compressionRatio: number
  readonly originalWidth: number | null
  readonly originalHeight: number | null
  readonly outputWidth: number | null
  readonly outputHeight: number | null
  readonly processingMs: number
  readonly optimized: boolean
}

export class BrandImageProcessingError extends Error {
  public readonly code: BrandAssetErrorCode

  constructor(code: BrandAssetErrorCode, message: string) {
    super(message)
    this.name = 'BrandImageProcessingError'
    this.code = code
  }
}

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
}

function assertSupportedMime(type: string): BrandAssetMimeType {
  const normalized = type.split(';')[0]?.trim().toLowerCase() ?? ''
  if ((ALLOWED_BRAND_ASSET_MIME_TYPES as readonly string[]).includes(normalized)) {
    return normalized as BrandAssetMimeType
  }
  throw new BrandImageProcessingError(
    'INVALID_FILE_FORMAT',
    `Unsupported brand asset MIME type: ${normalized || 'unknown'}`,
  )
}

export function readFileAsDataUrl(file: Blob, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const reader = new FileReader()
    const onAbort = () => {
      try {
        reader.abort()
      } catch {
        // Ignore abort errors
      }
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    reader.onload = () => {
      signal?.removeEventListener('abort', onAbort)
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(
          new BrandImageProcessingError(
            'IMAGE_PROCESSING_FAILED',
            'FileReader result was not a string.',
          ),
        )
      }
    }
    reader.onerror = () => {
      signal?.removeEventListener('abort', onAbort)
      reject(new BrandImageProcessingError('CORRUPTED_IMAGE', 'Failed to read image file.'))
    }
    reader.onabort = () => {
      signal?.removeEventListener('abort', onAbort)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    reader.readAsDataURL(file)
  })
}

function fitDimensions(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number; scaled: boolean } {
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height, scaled: false }
  }
  const scale = Math.min(maxWidth / width, maxHeight / height)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scaled: true,
  }
}

async function decodeRasterImage(
  file: Blob,
): Promise<{
  width: number
  height: number
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
  cleanup: () => void
}> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
      cleanup: () => bitmap.close(),
    }
  }
  const url = URL.createObjectURL(file)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
        cleanup: () => URL.revokeObjectURL(url),
      })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new BrandImageProcessingError('CORRUPTED_IMAGE', 'Could not decode image payload.'))
    }
    img.src = url
  })
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality)
  })
}

export async function processBrandAssetFile(
  file: File,
  assetType: BrandAssetType,
  signal?: AbortSignal,
): Promise<ProcessedBrandAsset> {
  const start = nowMs()
  const mimeType = assertSupportedMime(file.type)
  const originalBytes = file.size

  if (originalBytes <= 0) {
    throw new BrandImageProcessingError('CORRUPTED_IMAGE', 'Empty image file.')
  }
  if (mimeType === 'image/svg+xml' && originalBytes > MAX_BRAND_ASSET_SVG_BYTES) {
    throw new BrandImageProcessingError('FILE_TOO_LARGE', 'SVG exceeds max size.')
  }
  if (originalBytes > MAX_BRAND_ASSET_UPLOAD_BYTES) {
    throw new BrandImageProcessingError('FILE_TOO_LARGE', 'File exceeds max upload size.')
  }

  if (mimeType === 'image/svg+xml') {
    const rawSvg = await file.text()
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const sanitized = sanitizeSvgBrandAsset(rawSvg)
    if (!sanitized.ok) {
      throw new BrandImageProcessingError(sanitized.code, sanitized.reason)
    }
    const cleanFile = new File([sanitized.sanitized], `${assetType}.svg`, {
      type: 'image/svg+xml',
      lastModified: Date.now(),
    })
    const previewDataUrl = await readFileAsDataUrl(cleanFile, signal)
    const processingMs = Math.max(1, Math.round(nowMs() - start))
    return {
      file: cleanFile,
      mimeType,
      previewDataUrl,
      originalBytes,
      optimizedBytes: cleanFile.size,
      compressionRatio: originalBytes > 0 ? Number((cleanFile.size / originalBytes).toFixed(3)) : 1,
      originalWidth: null,
      originalHeight: null,
      outputWidth: null,
      outputHeight: null,
      processingMs,
      optimized: cleanFile.size < originalBytes,
    }
  }

  const decoded = await decodeRasterImage(file).catch((err) => {
    if (err instanceof BrandImageProcessingError) throw err
    throw new BrandImageProcessingError('CORRUPTED_IMAGE', 'Invalid or corrupted image binary.')
  })

  try {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const { width: origW, height: origH } = decoded
    if (
      origW <= 0 ||
      origH <= 0 ||
      origW > MAX_BRAND_ASSET_DIMENSION ||
      origH > MAX_BRAND_ASSET_DIMENSION ||
      origW * origH > MAX_BRAND_ASSET_PIXELS
    ) {
      throw new BrandImageProcessingError(
        'DIMENSIONS_TOO_LARGE',
        `Image dimensions ${origW}x${origH} exceed safe limits.`,
      )
    }

    const target = BRAND_ASSET_TARGET_DIMENSIONS[assetType]
    const fitted = fitDimensions(origW, origH, target.maxWidth, target.maxHeight)

    let outputBlob: Blob = file
    let outputW = origW
    let outputH = origH
    let optimized = false

    const shouldReencode = fitted.scaled || mimeType === 'image/jpeg' || mimeType === 'image/webp'

    if (shouldReencode && typeof document !== 'undefined') {
      const canvas = document.createElement('canvas')
      canvas.width = fitted.width
      canvas.height = fitted.height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        decoded.draw(ctx, fitted.width, fitted.height)
        const quality =
          mimeType === 'image/jpeg' ? 0.9 : mimeType === 'image/webp' ? 0.88 : undefined
        const candidate = await canvasToBlob(canvas, mimeType, quality)
        if (
          candidate &&
          (fitted.scaled || candidate.size < originalBytes || mimeType === 'image/jpeg')
        ) {
          outputBlob = candidate
          outputW = fitted.width
          outputH = fitted.height
          optimized = candidate.size < originalBytes || fitted.scaled
        }
      }
    }

    const ext = BRAND_ASSET_MIME_TO_EXT[mimeType]
    const outputFile =
      outputBlob === file
        ? file
        : new File([outputBlob], `${assetType}.${ext}`, {
            type: mimeType,
            lastModified: Date.now(),
          })

    const previewDataUrl = await readFileAsDataUrl(outputFile, signal)
    const processingMs = Math.max(1, Math.round(nowMs() - start))

    return {
      file: outputFile,
      mimeType,
      previewDataUrl,
      originalBytes,
      optimizedBytes: outputFile.size,
      compressionRatio:
        originalBytes > 0 ? Number((outputFile.size / originalBytes).toFixed(3)) : 1,
      originalWidth: origW,
      originalHeight: origH,
      outputWidth: outputW,
      outputHeight: outputH,
      processingMs,
      optimized,
    }
  } finally {
    decoded.cleanup()
  }
}
