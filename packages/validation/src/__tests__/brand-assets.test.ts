import { describe, expect, it } from 'vitest'
import {
  ALLOWED_BRAND_ASSET_MIME_TYPES,
  BRAND_ASSET_ERROR_TAXONOMY,
  BRAND_ASSET_TARGET_DIMENSIONS,
  isBrandAssetType,
  sanitizeSvgBrandAsset,
} from '../brand-assets'

describe('brand-assets domain contract & SVG sanitizer', () => {
  it('supports PNG, JPEG, WebP, and SVG across target asset types', () => {
    expect(ALLOWED_BRAND_ASSET_MIME_TYPES).toEqual([
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/svg+xml',
    ])
    expect(isBrandAssetType('logo')).toBe(true)
    expect(isBrandAssetType('stamp')).toBe(true)
    expect(isBrandAssetType('signature')).toBe(true)
    expect(isBrandAssetType('avatar')).toBe(false)
    expect(BRAND_ASSET_TARGET_DIMENSIONS.signature.maxWidth).toBe(1200)
  })

  it('preserves safe vector SVG and strips XML declarations/comments', () => {
    const res = sanitizeSvgBrandAsset(
      '<?xml version="1.0"?><!-- logo --><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#000" /></svg>',
    )
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.sanitized).toBe(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#000" /></svg>',
      )
    }
  })

  it('rejects unsafe SVG payloads (script, event handler, XXE, foreignObject, external href)', () => {
    const vectors = [
      '<svg><script>alert(1)</script></svg>',
      '<svg onload="alert(1)"><rect width="10" height="10"/></svg>',
      '<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg>&xxe;</svg>',
      '<svg><foreignObject><body><script>x</script></body></foreignObject></svg>',
      '<svg><a href="javascript:alert(1)"><text>click</text></a></svg>',
      '<svg><image href="https://evil.example/track.png" /></svg>',
    ]
    for (const v of vectors) {
      const res = sanitizeSvgBrandAsset(v)
      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.code).toBe('UNSAFE_SVG_CONTENT')
      }
    }
  })

  it('defines complete machine-readable error taxonomy metadata', () => {
    expect(BRAND_ASSET_ERROR_TAXONOMY.SPOOFED_MIME_TYPE.httpStatus).toBe(400)
    expect(BRAND_ASSET_ERROR_TAXONOMY.SPOOFED_MIME_TYPE.previousAssetIntact).toBe(true)
    expect(BRAND_ASSET_ERROR_TAXONOMY.STORAGE_UNAVAILABLE.retryable).toBe(true)
    expect(BRAND_ASSET_ERROR_TAXONOMY.UNSAFE_SVG_CONTENT.previousAssetIntact).toBe(true)
  })
})
