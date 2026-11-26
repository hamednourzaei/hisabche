import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BRAND_ASSET_BUCKET,
  BrandAssetError,
  BrandAssetService,
  validateAndInspectBrandAsset,
  verifyBrandAssetSignature,
} from '../services/brand-asset.service'
import { MemoryStorageProvider, SupabaseStorageProvider } from '../storage/storage-adapter'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { WorkspaceService } from '../services/workspace.service'

function makePngBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(28)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0)
  buf.writeUInt32BE(13, 8)
  buf.write('IHDR', 12, 'ascii')
  buf.writeUInt32BE(width, 16)
  buf.writeUInt32BE(height, 20)
  return buf
}

function makeJpegBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(15)
  buf[0] = 0xff
  buf[1] = 0xd8
  buf[2] = 0xff
  buf[3] = 0xe0
  buf.writeUInt16BE(4, 4)
  buf[8] = 0xff
  buf[9] = 0xc0
  buf.writeUInt16BE(7, 10)
  buf[12] = 8
  buf.writeUInt16BE(height, 13 - 1 + 0) // wait: place cleanly below
  const clean = Buffer.alloc(19)
  clean[0] = 0xff
  clean[1] = 0xd8
  clean[2] = 0xff
  clean[3] = 0xc0
  clean.writeUInt16BE(11, 4)
  clean[6] = 8
  clean.writeUInt16BE(height, 7)
  clean.writeUInt16BE(width, 9)
  return clean
}

function makeWebpVp8xBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(30)
  buf.write('RIFF', 0, 'ascii')
  buf.writeUInt32LE(22, 4)
  buf.write('WEBP', 8, 'ascii')
  buf.write('VP8X', 12, 'ascii')
  const wMinus1 = width - 1
  const hMinus1 = height - 1
  buf[24] = wMinus1 & 0xff
  buf[25] = (wMinus1 >> 8) & 0xff
  buf[26] = (wMinus1 >> 16) & 0xff
  buf[27] = hMinus1 & 0xff
  buf[28] = (hMinus1 >> 8) & 0xff
  buf[29] = (hMinus1 >> 16) & 0xff
  return buf
}

describe('BrandAssetService — validation, transactions, isolation & deletion', () => {
  const WS_A = '11111111-1111-4111-8111-111111111111'
  const WS_B = '22222222-2222-4222-8222-222222222222'
  const ADMIN_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const MEMBER_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

  let storage: MemoryStorageProvider
  let dbState: Record<string, Record<string, unknown>>

  function makeMockWorkspaceService(): WorkspaceService {
    return {
      requireRole: vi.fn(async (userId: string, workspaceId: string) => {
        if (workspaceId !== WS_A || userId !== ADMIN_A) {
          throw new BrandAssetError('PERMISSION_DENIED', 'Access denied')
        }
      }),
      requireMember: vi.fn(async (userId: string, workspaceId: string) => {
        if (workspaceId !== WS_A || (userId !== ADMIN_A && userId !== MEMBER_A)) {
          throw new BrandAssetError('PERMISSION_DENIED', 'Access denied')
        }
      }),
      getWorkspace: vi.fn(async (_userId: string, workspaceId: string) => ({
        ...(dbState[workspaceId] ?? {
          id: workspaceId,
          logo_url: null,
          stamp_url: null,
          signature_url: null,
        }),
      })),
      updateWorkspace: vi.fn(
        async (_userId: string, workspaceId: string, patch: Record<string, unknown>) => {
          const row = dbState[workspaceId]!
          if ('logoUrl' in patch) row.logo_url = patch.logoUrl
          if ('stampUrl' in patch) row.stamp_url = patch.stampUrl
          if ('signatureUrl' in patch) row.signature_url = patch.signatureUrl
          return { ...row }
        },
      ),
    } as unknown as WorkspaceService
  }

  beforeEach(() => {
    storage = new MemoryStorageProvider()
    dbState = {
      [WS_A]: { id: WS_A, logo_url: null, stamp_url: null, signature_url: null },
      [WS_B]: { id: WS_B, logo_url: null, stamp_url: null, signature_url: null },
    }
  })

  it('inspects valid PNG, JPEG, WebP, and sanitized SVG payloads', () => {
    const png = validateAndInspectBrandAsset(makePngBuffer(512, 256), 'image/png')
    expect(png.width).toBe(512)
    expect(png.height).toBe(256)

    const jpg = validateAndInspectBrandAsset(makeJpegBuffer(800, 400), 'image/jpeg')
    expect(jpg.width).toBe(800)
    expect(jpg.height).toBe(400)

    const webp = validateAndInspectBrandAsset(makeWebpVp8xBuffer(640, 640), 'image/webp')
    expect(webp.width).toBe(640)
    expect(webp.height).toBe(640)

    const svg = validateAndInspectBrandAsset(
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'),
      'image/svg+xml',
    )
    expect(svg.mimeType).toBe('image/svg+xml')
  })

  it('rejects MIME spoofing, unsafe SVG XSS, and extreme pixel dimensions', () => {
    expect(() =>
      validateAndInspectBrandAsset(Buffer.from('<svg><rect/></svg>'), 'image/png'),
    ).toThrow(/SPOOFED_MIME_TYPE|does not match/i)

    expect(() =>
      validateAndInspectBrandAsset(
        Buffer.from('<svg onload="alert(1)"><rect/></svg>'),
        'image/svg+xml',
      ),
    ).toThrow(/event handler/i)

    expect(() => validateAndInspectBrandAsset(makePngBuffer(5000, 5000), 'image/png')).toThrow(
      /exceed/i,
    )
  })

  it('replaces an existing asset atomically, retires old object, and cleans orphan on DB failure', async () => {
    const svc = new BrandAssetService(makeMockWorkspaceService(), storage)

    const first = await svc.replaceBrandAsset({
      userId: ADMIN_A,
      workspaceId: WS_A,
      assetType: 'logo',
      fileBuffer: makePngBuffer(400, 400),
      declaredMimeType: 'image/png',
    })
    expect(first.objectPath.startsWith(`${BRAND_ASSET_BUCKET}/${WS_A}/logo/`)).toBe(true)
    expect(
      (await storage.list(BRAND_ASSET_BUCKET, `${BRAND_ASSET_BUCKET}/${WS_A}/logo/`)).length,
    ).toBe(1)

    // Second upload retires first object
    const second = await svc.replaceBrandAsset({
      userId: ADMIN_A,
      workspaceId: WS_A,
      assetType: 'logo',
      fileBuffer: makePngBuffer(500, 500),
      declaredMimeType: 'image/png',
    })
    const keysAfterReplace = await storage.list(
      BRAND_ASSET_BUCKET,
      `${BRAND_ASSET_BUCKET}/${WS_A}/logo/`,
    )
    expect(keysAfterReplace).toEqual([second.objectPath])

    // Simulate DB write failure on third upload -> previous stays intact & new orphan is cleaned
    const failingWs = makeMockWorkspaceService()
    ;(failingWs.updateWorkspace as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('DB down'),
    )
    const failingSvc = new BrandAssetService(failingWs, storage)
    await expect(
      failingSvc.replaceBrandAsset({
        userId: ADMIN_A,
        workspaceId: WS_A,
        assetType: 'logo',
        fileBuffer: makePngBuffer(600, 600),
        declaredMimeType: 'image/png',
      }),
    ).rejects.toThrow(/persist/i)

    expect(dbState[WS_A]!.logo_url).toBe(second.url)
    expect(await storage.list(BRAND_ASSET_BUCKET, `${BRAND_ASSET_BUCKET}/${WS_A}/logo/`)).toEqual([
      second.objectPath,
    ])
  })

  it('deletes asset cleanly and prevents cross-tenant access/path traversal', async () => {
    const svc = new BrandAssetService(makeMockWorkspaceService(), storage)
    const uploaded = await svc.replaceBrandAsset({
      userId: ADMIN_A,
      workspaceId: WS_A,
      assetType: 'stamp',
      fileBuffer: makePngBuffer(300, 300),
      declaredMimeType: 'image/png',
    })

    // Cross-tenant upload & read blocked
    await expect(
      svc.replaceBrandAsset({
        userId: ADMIN_A,
        workspaceId: WS_B,
        assetType: 'stamp',
        fileBuffer: makePngBuffer(300, 300),
        declaredMimeType: 'image/png',
      }),
    ).rejects.toThrow(/Access denied/i)

    await expect(
      svc.readBrandAssetContent({
        workspaceId: WS_B,
        objectPath: uploaded.objectPath,
      }),
    ).rejects.toThrow(/escapes workspace boundary/i)

    // Signed URL verifies only for matching workspace & unexpired timestamp
    const parsed = new URL(uploaded.url, 'https://hisabche.local')
    const sig = parsed.searchParams.get('sig')!
    const exp = Number(parsed.searchParams.get('exp'))
    expect(verifyBrandAssetSignature(WS_A, uploaded.objectPath, exp, sig)).toBe(true)
    expect(verifyBrandAssetSignature(WS_B, uploaded.objectPath, exp, sig)).toBe(false)

    // Confirmed delete clears DB & storage
    const del = await svc.deleteBrandAsset({
      userId: ADMIN_A,
      workspaceId: WS_A,
      assetType: 'stamp',
    })
    expect(del.deleted).toBe(true)
    expect(del.storageCleaned).toBe(true)
    expect(dbState[WS_A]!.stamp_url).toBeNull()
    expect(await storage.list(BRAND_ASSET_BUCKET, `${BRAND_ASSET_BUCKET}/${WS_A}/stamp/`)).toEqual(
      [],
    )
  })
})

describe('SupabaseStorageProvider & production signing secret resilience', () => {
  it('auto-creates a missing private bucket on Bucket not found and caches ensured state', async () => {
    let bucketExists = false
    const uploadCalls: string[] = []
    const createBucket = vi.fn(async (_name: string, _opts: { public: boolean }) => {
      bucketExists = true
      return { data: { name: _name }, error: null }
    })
    const fakeSupabase = {
      storage: {
        createBucket,
        from: (bucket: string) => ({
          upload: async (path: string) => {
            uploadCalls.push(`${bucket}/${path}`)
            if (!bucketExists) {
              return { data: null, error: { message: 'Bucket not found' } }
            }
            return { data: { path }, error: null }
          },
        }),
      },
    } as unknown as SupabaseClient

    const provider = new SupabaseStorageProvider(fakeSupabase)
    const objectPath = `${BRAND_ASSET_BUCKET}/11111111-1111-4111-8111-111111111111/stamp/asset-1/v1.png`
    const first = await provider.upload(BRAND_ASSET_BUCKET, objectPath, makePngBuffer(100, 100), {
      contentType: 'image/png',
      upsert: false,
      isPublic: false,
      expectedTenantPrefix: `${BRAND_ASSET_BUCKET}/11111111-1111-4111-8111-111111111111`,
    })
    expect(first.path).toBe(objectPath)
    expect(createBucket).toHaveBeenCalledTimes(1)
    expect(createBucket).toHaveBeenCalledWith(BRAND_ASSET_BUCKET, { public: false })
    expect(uploadCalls).toHaveLength(2)

    // Subsequent upload hits no extra createBucket call
    const secondPath = `${BRAND_ASSET_BUCKET}/11111111-1111-4111-8111-111111111111/stamp/asset-2/v1.png`
    await provider.upload(BRAND_ASSET_BUCKET, secondPath, makePngBuffer(100, 100), {
      contentType: 'image/png',
      isPublic: false,
    })
    expect(createBucket).toHaveBeenCalledTimes(1)
  })

  it('uses SUPABASE_JWT_SECRET / SUPABASE_SERVICE_KEY in production and fails closed before upload if no secret exists', async () => {
    const prevNodeEnv = process.env.NODE_ENV
    const prevBrandSecret = process.env.BRAND_ASSET_SIGNING_SECRET
    const prevJwtSecret = process.env.JWT_SECRET
    const prevSupaJwtSecret = process.env.SUPABASE_JWT_SECRET
    const prevSupaServiceKey = process.env.SUPABASE_SERVICE_KEY

    const WS = '11111111-1111-4111-8111-111111111111'
    const ADMIN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const mem = new MemoryStorageProvider()
    const wsSvc = {
      requireRole: vi.fn(async () => {}),
      requireMember: vi.fn(async () => {}),
      getWorkspace: vi.fn(async () => ({
        id: WS,
        logo_url: null,
        stamp_url: null,
        signature_url: null,
      })),
      updateWorkspace: vi.fn(async (_u: string, _w: string, patch: Record<string, unknown>) => ({
        id: WS,
        stamp_url: patch.stampUrl ?? null,
      })),
    } as unknown as WorkspaceService
    const svc = new BrandAssetService(wsSvc, mem)

    try {
      process.env.NODE_ENV = 'production'
      delete process.env.BRAND_ASSET_SIGNING_SECRET
      delete process.env.JWT_SECRET
      delete process.env.SUPABASE_JWT_SECRET
      delete process.env.SUPABASE_SERVICE_KEY

      // Fails closed before writing to storage when no secret exists at all
      await expect(
        svc.replaceBrandAsset({
          userId: ADMIN,
          workspaceId: WS,
          assetType: 'stamp',
          fileBuffer: makePngBuffer(120, 120),
          declaredMimeType: 'image/png',
        }),
      ).rejects.toThrow(/signing secret missing/i)
      expect(await mem.list(BRAND_ASSET_BUCKET)).toEqual([])

      // Succeeds when SUPABASE_SERVICE_KEY (ES256 JWKS deployment) is set
      process.env.SUPABASE_SERVICE_KEY = 'supabase-service-role-key-at-least-16-chars'
      const uploaded = await svc.replaceBrandAsset({
        userId: ADMIN,
        workspaceId: WS,
        assetType: 'stamp',
        fileBuffer: makePngBuffer(120, 120),
        declaredMimeType: 'image/png',
      })
      const parsed = new URL(uploaded.url, 'https://hisabche.local')
      expect(
        verifyBrandAssetSignature(
          WS,
          uploaded.objectPath,
          Number(parsed.searchParams.get('exp')),
          parsed.searchParams.get('sig')!,
        ),
      ).toBe(true)
    } finally {
      process.env.NODE_ENV = prevNodeEnv
      if (prevBrandSecret !== undefined) process.env.BRAND_ASSET_SIGNING_SECRET = prevBrandSecret
      else delete process.env.BRAND_ASSET_SIGNING_SECRET
      if (prevJwtSecret !== undefined) process.env.JWT_SECRET = prevJwtSecret
      else delete process.env.JWT_SECRET
      if (prevSupaJwtSecret !== undefined) process.env.SUPABASE_JWT_SECRET = prevSupaJwtSecret
      else delete process.env.SUPABASE_JWT_SECRET
      if (prevSupaServiceKey !== undefined) process.env.SUPABASE_SERVICE_KEY = prevSupaServiceKey
      else delete process.env.SUPABASE_SERVICE_KEY
    }
  })

  it('allows signed GET /brand-assets/:type/content without Authorization header while rejecting unsigned or forged requests', async () => {
    const { buildServer } = await import('../index')
    const { getStorageProvider, setStorageProvider } = await import('../storage/storage-adapter')
    const prevStorage = getStorageProvider()
    const mem = new MemoryStorageProvider()
    setStorageProvider(mem)
    const app = await buildServer()

    const WS = '85488f9e-cb75-488e-a14e-068821d486a3'
    const objectPath = `${BRAND_ASSET_BUCKET}/${WS}/logo/5a293704-250f-4fbf-b3b2-552294e4ec04/v1.png`
    const png = makePngBuffer(64, 64)
    await mem.upload(BRAND_ASSET_BUCKET, objectPath, png, {
      contentType: 'image/png',
      upsert: false,
      expectedTenantPrefix: `${BRAND_ASSET_BUCKET}/${WS}`,
    })

    const { buildSignedBrandAssetContentUrl } = await import('../services/brand-asset.service')
    const signedUrl = buildSignedBrandAssetContentUrl(WS, 'logo', objectPath)

    try {
      // Valid signed URL works from <img> / CSS url() with no bearer header
      const okRes = await app.inject({ method: 'GET', url: signedUrl })
      expect(okRes.statusCode).toBe(200)
      expect(okRes.headers['content-type']).toBe('image/png')
      expect(okRes.rawPayload.equals(png)).toBe(true)

      // Forged signature is rejected with 403 (not bypassed)
      const badSigRes = await app.inject({
        method: 'GET',
        url: signedUrl.replace(/sig=[0-9a-f]+/, 'sig=deadbeef'),
      })
      expect(badSigRes.statusCode).toBe(403)

      // Unsigned content request without bearer JWT is rejected with 401 by global auth hook
      const unsignedRes = await app.inject({
        method: 'GET',
        url: `/api/workspaces/${WS}/brand-assets/logo/content?path=${encodeURIComponent(objectPath)}`,
      })
      expect(unsignedRes.statusCode).toBe(401)
    } finally {
      setStorageProvider(prevStorage)
      await app.close()
    }
  }, 20_000)
})
