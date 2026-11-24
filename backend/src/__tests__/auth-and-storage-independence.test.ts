import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  base64UrlEncode,
  jwtPayloadToUser,
  verifyJwtSignatureLocally,
} from '../middleware/jwt-verifier'
import {
  MemoryStorageProvider,
  getStorageProvider,
  setStorageProvider,
} from '../storage/storage-adapter'

describe('Auth & Storage Independence', () => {
  const secret = 'super-secret-jwt-key-for-local-testing-12345'

  function createTestJwt(
    payload: Record<string, unknown>,
    signingSecret: string,
    header: Record<string, unknown> = { alg: 'HS256', typ: 'JWT' },
  ): string {
    const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)))
    const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)))
    const sig = createHmac('sha256', signingSecret).update(`${headerB64}.${payloadB64}`).digest()
    const sigB64 = base64UrlEncode(sig)
    return `${headerB64}.${payloadB64}.${sigB64}`
  }

  describe('Local JWT Verification (Zero-Network Auth)', () => {
    it('verifies a valid HS256 JWT and extracts user payload without network call', () => {
      const nowSeconds = Math.floor(Date.now() / 1000)
      const token = createTestJwt(
        {
          sub: 'user-uuid-1234-5678',
          email: 'test@hisabche.com',
          role: 'authenticated',
          exp: nowSeconds + 3600,
          iat: nowSeconds,
        },
        secret,
      )

      const result = verifyJwtSignatureLocally(token, secret)
      expect(result.valid).toBe(true)
      expect(result.payload?.sub).toBe('user-uuid-1234-5678')
      expect(result.payload?.email).toBe('test@hisabche.com')

      const user = jwtPayloadToUser(result.payload!)
      expect(user.id).toBe('user-uuid-1234-5678')
      expect(user.email).toBe('test@hisabche.com')
      expect(user.aud).toBe('authenticated')
    })

    it('rejects token with invalid signature (tampered payload or wrong secret)', () => {
      const nowSeconds = Math.floor(Date.now() / 1000)
      const token = createTestJwt(
        { sub: 'hacker-uuid', role: 'admin', exp: nowSeconds + 3600 },
        'wrong-secret',
      )

      const result = verifyJwtSignatureLocally(token, secret)
      expect(result.valid).toBe(false)
      expect(result.error).toMatch(/Invalid JWT signature/)
    })

    it('rejects expired token', () => {
      const nowSeconds = Math.floor(Date.now() / 1000)
      const token = createTestJwt({ sub: 'user-expired', exp: nowSeconds - 100 }, secret)

      const result = verifyJwtSignatureLocally(token, secret)
      expect(result.valid).toBe(false)
      expect(result.error).toMatch(/token is expired/)
    })

    it('rejects unsupported algorithm (e.g. none attack)', () => {
      const token = createTestJwt({ sub: 'user-attack' }, secret, { alg: 'none', typ: 'JWT' })

      const result = verifyJwtSignatureLocally(token, secret)
      expect(result.valid).toBe(false)
      expect(result.error).toMatch(/Unsupported JWT algorithm/)
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
  })
})
