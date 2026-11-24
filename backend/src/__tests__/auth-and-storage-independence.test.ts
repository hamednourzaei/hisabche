import { createHmac, createSign, generateKeyPairSync } from 'node:crypto'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  base64UrlEncode,
  jwtPayloadToUser,
  verifyJwtSignatureLocally,
} from '../middleware/jwt-verifier'
import { FakeDatabase, createFakeDb } from './helpers/fake-supabase'

const db = new FakeDatabase()
const mockUsers = new Map<string, { id: string; email: string }>()
let getUserBehavior: 'network_down' | 'explicit_revoke' = 'network_down'

vi.mock('../db', () => {
  const fake = createFakeDb(db, mockUsers)
  return {
    ...fake,
    supabase: {
      ...fake.supabase,
      auth: {
        getUser: async () => {
          if (getUserBehavior === 'network_down') {
            throw new Error('fetch failed: upstream auth unreachable')
          }
          return {
            data: { user: null },
            error: { message: 'Session revoked upstream', status: 401 },
          }
        },
      },
    },
  }
})

let authenticate: typeof import('../middleware/auth.middleware').authenticate
let MemoryStorageProvider: typeof import('../storage/storage-adapter').MemoryStorageProvider
let LocalFilesystemStorageProvider: typeof import('../storage/storage-adapter').LocalFilesystemStorageProvider
let S3CompatibleStorageProvider: typeof import('../storage/storage-adapter').S3CompatibleStorageProvider
let createStorageProviderFromEnv: typeof import('../storage/storage-adapter').createStorageProviderFromEnv
let getStorageProvider: typeof import('../storage/storage-adapter').getStorageProvider
let setStorageProvider: typeof import('../storage/storage-adapter').setStorageProvider

describe('Auth & Storage Independence', () => {
  const secret = 'super-secret-jwt-key-for-local-testing-12345'

  beforeAll(async () => {
    const authMod = await import('../middleware/auth.middleware')
    authenticate = authMod.authenticate
    const storageMod = await import('../storage/storage-adapter')
    MemoryStorageProvider = storageMod.MemoryStorageProvider
    LocalFilesystemStorageProvider = storageMod.LocalFilesystemStorageProvider
    S3CompatibleStorageProvider = storageMod.S3CompatibleStorageProvider
    createStorageProviderFromEnv = storageMod.createStorageProviderFromEnv
    getStorageProvider = storageMod.getStorageProvider
    setStorageProvider = storageMod.setStorageProvider
  })

  afterEach(() => {
    delete process.env.JWT_EXPECTED_ISSUER
    delete process.env.JWT_EXPECTED_AUDIENCE
    getUserBehavior = 'network_down'
  })

  function createHmacJwt(
    payload: Record<string, unknown>,
    signingSecret: string,
    alg: 'HS256' | 'HS384' | 'HS512' | 'none' = 'HS256',
  ): string {
    const header = { alg, typ: 'JWT' }
    const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)))
    const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)))
    const hashAlg = alg === 'HS512' ? 'sha512' : alg === 'HS384' ? 'sha384' : 'sha256'
    const sig = createHmac(hashAlg, signingSecret).update(`${headerB64}.${payloadB64}`).digest()
    return `${headerB64}.${payloadB64}.${base64UrlEncode(sig)}`
  }

  function createAsymmetricJwt(
    payload: Record<string, unknown>,
    privateKeyPem: string,
    alg: 'RS256' | 'ES256',
  ): string {
    const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify({ alg, typ: 'JWT' })))
    const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)))
    const data = `${headerB64}.${payloadB64}`
    const sig =
      alg === 'RS256'
        ? createSign('RSA-SHA256').update(data).sign(privateKeyPem)
        : createSign('SHA256').update(data).sign({ key: privateKeyPem, dsaEncoding: 'ieee-p1363' })
    return `${data}.${base64UrlEncode(sig)}`
  }

  describe('Local JWT Verification (Zero-Network Auth)', () => {
    it('verifies valid HS256, HS384, and HS512 JWTs and enforces strict mandatory claims', () => {
      const nowSeconds = Math.floor(Date.now() / 1000)
      for (const alg of ['HS256', 'HS384', 'HS512'] as const) {
        const token = createHmacJwt(
          {
            sub: 'user-uuid-1234-5678',
            email: 'test@hisabche.com',
            aud: 'authenticated',
            iss: 'https://auth.hisabche.test/auth/v1',
            exp: nowSeconds + 3600,
            nbf: nowSeconds - 10,
            iat: nowSeconds - 10,
          },
          secret,
          alg,
        )

        const result = verifyJwtSignatureLocally(token, secret, {
          expectedIssuer: 'https://auth.hisabche.test/auth/v1',
          expectedAudience: 'authenticated',
          nowSeconds,
        })
        expect(result.valid).toBe(true)
        expect(result.algorithm).toBe(alg)
        expect(result.payload?.sub).toBe('user-uuid-1234-5678')

        const user = jwtPayloadToUser(result.payload!)
        expect(user.id).toBe('user-uuid-1234-5678')
        expect(user.email).toBe('test@hisabche.com')
        expect(user.aud).toBe('authenticated')
      }
    })

    it('verifies RS256 and ES256 asymmetric tokens and blocks PEM HMAC algorithm confusion', () => {
      const nowSeconds = Math.floor(Date.now() / 1000)

      const rsaKeys = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      })
      const rsaToken = createAsymmetricJwt(
        { sub: 'rsa-user', exp: nowSeconds + 600, aud: 'authenticated' },
        rsaKeys.privateKey,
        'RS256',
      )
      const rsaRes = verifyJwtSignatureLocally(rsaToken, '', {
        publicKeyPem: rsaKeys.publicKey,
        expectedAudience: 'authenticated',
        nowSeconds,
      })
      expect(rsaRes.valid).toBe(true)
      expect(rsaRes.algorithm).toBe('RS256')

      // Algorithm confusion attack: signing HS256 using public PEM string must fail
      const confusedToken = createHmacJwt(
        { sub: 'attacker', exp: nowSeconds + 600 },
        rsaKeys.publicKey,
        'HS256',
      )
      const confusedRes = verifyJwtSignatureLocally(confusedToken, rsaKeys.publicKey, {
        nowSeconds,
      })
      expect(confusedRes.valid).toBe(false)

      const ecKeys = generateKeyPairSync('ec', {
        namedCurve: 'P-256',
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      })
      const ecToken = createAsymmetricJwt(
        { sub: 'ec-user', exp: nowSeconds + 600, iss: 'hisabche-edge' },
        ecKeys.privateKey,
        'ES256',
      )
      const ecRes = verifyJwtSignatureLocally(ecToken, '', {
        publicKeyPem: ecKeys.publicKey,
        expectedIssuer: 'hisabche-edge',
        nowSeconds,
      })
      expect(ecRes.valid).toBe(true)
      expect(ecRes.algorithm).toBe('ES256')
    })

    it('rejects tampered signature, missing exp, exp=0, future nbf, wrong iss/aud, missing sub, and alg=none', () => {
      const nowSeconds = Math.floor(Date.now() / 1000)

      expect(
        verifyJwtSignatureLocally(
          createHmacJwt({ sub: 'hacker', exp: nowSeconds + 3600 }, 'wrong-secret'),
          secret,
          { nowSeconds },
        ).valid,
      ).toBe(false)

      expect(
        verifyJwtSignatureLocally(
          createHmacJwt({ sub: 'expired', exp: nowSeconds - 10 }, secret),
          secret,
          {
            nowSeconds,
          },
        ).error,
      ).toMatch(/expired/)

      // exp: 0 must be rejected, never skipped by truthy checks
      expect(
        verifyJwtSignatureLocally(createHmacJwt({ sub: 'zero-exp', exp: 0 }, secret), secret, {
          nowSeconds,
        }).error,
      ).toMatch(/expired/)

      // Missing exp must fail closed
      expect(
        verifyJwtSignatureLocally(createHmacJwt({ sub: 'no-exp' }, secret), secret, {
          nowSeconds,
        }).error,
      ).toMatch(/Missing mandatory JWT exp/)

      // Missing sub must fail closed
      expect(
        verifyJwtSignatureLocally(
          createHmacJwt({ sub: '', exp: nowSeconds + 300 }, secret),
          secret,
          {
            nowSeconds,
          },
        ).error,
      ).toMatch(/Missing mandatory JWT sub/)

      // Premature nbf must be rejected
      expect(
        verifyJwtSignatureLocally(
          createHmacJwt({ sub: 'early', exp: nowSeconds + 600, nbf: nowSeconds + 60 }, secret),
          secret,
          { nowSeconds },
        ).error,
      ).toMatch(/not yet active/)

      // Wrong iss / aud must be rejected
      const wrongClaims = createHmacJwt(
        { sub: 'u1', exp: nowSeconds + 600, iss: 'evil-issuer', aud: 'other-app' },
        secret,
      )
      expect(
        verifyJwtSignatureLocally(wrongClaims, secret, {
          expectedIssuer: 'https://hisabche.com/auth/v1',
          nowSeconds,
        }).error,
      ).toMatch(/issuer/)
      expect(
        verifyJwtSignatureLocally(wrongClaims, secret, {
          expectedAudience: 'authenticated',
          nowSeconds,
        }).error,
      ).toMatch(/audience/)

      // alg: none attack rejected
      expect(
        verifyJwtSignatureLocally(
          createHmacJwt({ sub: 'attack', exp: nowSeconds + 600 }, secret, 'none'),
          secret,
          { nowSeconds },
        ).error,
      ).toMatch(/Unsupported JWT algorithm/)
    })

    it('wires verifyJwtSignatureLocally into authenticate() when upstream is down, without bypassing explicit revocations', async () => {
      const nowSeconds = Math.floor(Date.now() / 1000)
      const activeSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET!
      const expectedIssuer = `${process.env.SUPABASE_URL!.replace(/\/$/, '')}/auth/v1`
      process.env.JWT_EXPECTED_AUDIENCE = 'authenticated'

      const makeReply = () => {
        const res = {
          statusCode: 200,
          body: null as unknown,
          status(code: number) {
            this.statusCode = code
            return this
          },
          send(payload: unknown) {
            this.body = payload
            return this
          },
        }
        return res
      }

      // 1. Token missing `iss` must be rejected by authenticate() offline fallback
      getUserBehavior = 'network_down'
      const missingIssuerToken = createHmacJwt(
        {
          sub: 'aaaaaaaa-1111-4111-8111-111111111111',
          aud: 'authenticated',
          exp: nowSeconds + 600,
          iat: nowSeconds - 5,
        },
        activeSecret,
      )
      const missingIssReq = { headers: { authorization: `Bearer ${missingIssuerToken}` } } as never
      const missingIssReply = makeReply()
      await authenticate(missingIssReq, missingIssReply as never)
      expect(missingIssReply.statusCode).toBe(401)

      // 2. Upstream outage + valid iss/aud/exp/iat -> local cryptographic verification authenticates user
      const validOfflineToken = createHmacJwt(
        {
          sub: 'aaaaaaaa-1111-4111-8111-111111111111',
          email: 'offline@hisabche.com',
          iss: expectedIssuer,
          aud: 'authenticated',
          exp: nowSeconds + 600,
          iat: nowSeconds - 5,
        },
        activeSecret,
      )
      const okReq = { headers: { authorization: `Bearer ${validOfflineToken}` } } as never
      const okReply = makeReply()
      await authenticate(okReq, okReply as never)
      expect(okReply.statusCode).toBe(200)
      expect((okReq as { userId: string }).userId).toBe('aaaaaaaa-1111-4111-8111-111111111111')

      // 3. Upstream online explicit 401 revocation -> local fallback MUST NOT override it
      getUserBehavior = 'explicit_revoke'
      const revokedToken = createHmacJwt(
        {
          sub: 'bbbbbbbb-2222-4222-8222-222222222222',
          iss: expectedIssuer,
          aud: 'authenticated',
          exp: nowSeconds + 600,
          iat: nowSeconds - 5,
        },
        activeSecret,
      )
      const revokedReq = { headers: { authorization: `Bearer ${revokedToken}` } } as never
      const revokedReply = makeReply()
      await authenticate(revokedReq, revokedReply as never)
      expect(revokedReply.statusCode).toBe(401)
    })
  })

  describe('Storage Provider Abstraction (S3/MinIO/Memory)', () => {
    it('allows pluggable storage provider and performs basic file operations', async () => {
      const memProvider = new MemoryStorageProvider()
      setStorageProvider(memProvider)

      const active = getStorageProvider()
      expect(active.name).toBe('memory')

      const fileData = Buffer.from('PDF invoice content for invoice #INV-999')
      const uploadResult = await active.upload('pdf-cache', 'invoices/inv-999.pdf', fileData, {
        contentType: 'application/pdf',
      })

      expect(uploadResult.path).toBe('invoices/inv-999.pdf')

      const downloaded = await active.download('pdf-cache', 'invoices/inv-999.pdf')
      expect(downloaded.toString()).toBe('PDF invoice content for invoice #INV-999')

      const list = await active.list('pdf-cache', 'invoices/')
      expect(list).toContain('invoices/inv-999.pdf')

      await active.delete('pdf-cache', 'invoices/inv-999.pdf')
      await expect(active.download('pdf-cache', 'invoices/inv-999.pdf')).rejects.toThrow(
        /not found/,
      )
    })

    it('supports LocalFilesystemStorageProvider with atomic writes, path-traversal defense, and signed URLs', async () => {
      const { mkdtempSync, rmSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { tmpdir } = await import('node:os')
      const tempRoot = mkdtempSync(join(tmpdir(), 'hisabche-storage-test-'))

      try {
        const disk = new LocalFilesystemStorageProvider(
          tempRoot,
          'disk-signing-secret-123456',
          'https://cdn.hisabche.test',
        )
        const payload = Buffer.from('Receipt #REC-101')
        const putRes = await disk.upload('receipts', '2026/rec-101.txt', payload)
        expect(putRes.path).toBe('2026/rec-101.txt')

        const readBack = await disk.download('receipts', '2026/rec-101.txt')
        expect(readBack.toString()).toBe('Receipt #REC-101')

        const listed = await disk.list('receipts', '2026/')
        expect(listed).toEqual(['2026/rec-101.txt'])

        const signedUrl = await disk.getSignedUrl('receipts', '2026/rec-101.txt', 120)
        const parsed = new URL(signedUrl)
        const exp = Number(parsed.searchParams.get('exp'))
        const sig = parsed.searchParams.get('sig')!
        expect(disk.verifySignedToken('receipts', '2026/rec-101.txt', exp, sig)).toBe(true)
        expect(disk.verifySignedToken('receipts', '2026/other.txt', exp, sig)).toBe(false)

        // Path traversal attempts must fail closed
        await expect(disk.upload('receipts', '../escape.txt', payload)).rejects.toThrow(
          /Path traversal blocked/,
        )
        await expect(disk.download('receipts', '../../etc/passwd')).rejects.toThrow(
          /Path traversal blocked/,
        )

        await disk.delete('receipts', '2026/rec-101.txt')
        expect(await disk.list('receipts')).toEqual([])
      } finally {
        rmSync(tempRoot, { recursive: true, force: true })
      }
    })

    it('signs AWS SigV4 requests, presigned URLs, and parses ListObjectsV2 XML in S3CompatibleStorageProvider', async () => {
      const requests: Array<{ url: string; method: string; headers: Record<string, string> }> = []
      const objects = new Map<string, Buffer>()

      const mockFetch: typeof fetch = async (input, init) => {
        const urlStr = typeof input === 'string' ? input : input.toString()
        const method = init?.method ?? 'GET'
        const headers = (init?.headers ?? {}) as Record<string, string>
        requests.push({ url: urlStr, method, headers })

        const parsed = new URL(urlStr)
        if (method === 'PUT') {
          objects.set(parsed.pathname, Buffer.from(init?.body as Uint8Array))
          return new Response(null, { status: 200 })
        }
        if (method === 'GET' && parsed.searchParams.get('list-type') === '2') {
          const xml =
            '<?xml version="1.0" encoding="UTF-8"?><ListBucketResult>' +
            [...objects.keys()]
              .map((k) => `<Contents><Key>${k.replace(/^\/[^/]+\//, '')}</Key></Contents>`)
              .join('') +
            '</ListBucketResult>'
          return new Response(xml, { status: 200 })
        }
        if (method === 'GET') {
          const data = objects.get(parsed.pathname)
          return data
            ? new Response(new Uint8Array(data), { status: 200 })
            : new Response(null, { status: 404 })
        }
        if (method === 'DELETE') {
          objects.delete(parsed.pathname)
          return new Response(null, { status: 204 })
        }
        return new Response(null, { status: 405 })
      }

      const s3 = new S3CompatibleStorageProvider({
        endpoint: 'https://s3.ir-thr-at1.arvanstorage.ir',
        region: 'ir-thr-at1',
        accessKeyId: 'AKIAEXAMPLE123',
        secretAccessKey: 'super-secret-s3-key-abcdef',
        forcePathStyle: true,
        publicBaseUrl: 'https://cdn.arvan.hisabche.test',
        fetchImpl: mockFetch,
      })

      const up = await s3.upload('invoices', '2026/inv-42.pdf', Buffer.from('PDF-BYTES'), {
        contentType: 'application/pdf',
        isPublic: true,
      })
      expect(up.publicUrl).toBe('https://cdn.arvan.hisabche.test/invoices/2026/inv-42.pdf')
      expect(requests[0]?.headers.Authorization).toMatch(
        /^AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE123\/\d{8}\/ir-thr-at1\/s3\/aws4_request, SignedHeaders=.*Signature=[0-9a-f]{64}$/,
      )

      const fetched = await s3.download('invoices', '2026/inv-42.pdf')
      expect(fetched.toString()).toBe('PDF-BYTES')

      const list = await s3.list('invoices', '2026/')
      expect(list).toEqual(['2026/inv-42.pdf'])

      const presigned = await s3.getSignedUrl('invoices', '2026/inv-42.pdf', 300)
      const presignedUrl = new URL(presigned)
      expect(presignedUrl.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256')
      expect(presignedUrl.searchParams.get('X-Amz-Expires')).toBe('300')
      expect(presignedUrl.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/)

      await s3.delete('invoices', '2026/inv-42.pdf')

      process.env.STORAGE_PROVIDER = 'memory'
      expect(createStorageProviderFromEnv().name).toBe('memory')
      delete process.env.STORAGE_PROVIDER
    })
  })
})
