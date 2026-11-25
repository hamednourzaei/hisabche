import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  resetInfraWebhookNoncesForTest,
  resolveNginxWebhookSecret,
  validateNginxDirectivesSafe,
  verifyInfrastructureWebhookRequest,
} from '../services/admin/admin-infrastructure.service'
import { LocalFilesystemStorageProvider, MemoryStorageProvider } from '../storage/storage-adapter'

describe('Infrastructure Webhook & Storage Provider Security (V75.1)', () => {
  const prevEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...prevEnv }
    resetInfraWebhookNoncesForTest()
  })

  it('fails closed when NGINX_RELOAD_WEBHOOK_SECRET is missing or short and blocks fallback secrets', () => {
    delete process.env.NGINX_RELOAD_WEBHOOK_SECRET
    process.env.JWT_SECRET = 'jwt-must-not-be-used-as-nginx-fallback-123'
    expect(() => resolveNginxWebhookSecret()).toThrow(/NGINX_RELOAD_WEBHOOK_SECRET/)

    process.env.NGINX_RELOAD_WEBHOOK_SECRET = 'short'
    expect(() => resolveNginxWebhookSecret()).toThrow(/NGINX_RELOAD_WEBHOOK_SECRET/)

    process.env.NGINX_RELOAD_WEBHOOK_SECRET = 'prod-nginx-webhook-secret-32chars!'
    expect(resolveNginxWebhookSecret()).toBe('prod-nginx-webhook-secret-32chars!')
  })

  it('verifies HMAC-SHA256 webhook requests with timestamp window and nonce replay protection', async () => {
    const secret = 'prod-nginx-webhook-secret-32chars!'
    const { createHmac } = await import('node:crypto')
    const body = JSON.stringify({ action: 'validate_and_reload' })
    const nowSec = 1_700_000_000
    const nonce = 'nonce-1'
    const sig = createHmac('sha256', secret).update(`t=${nowSec}.${nonce}.${body}`).digest('hex')

    const valid = verifyInfrastructureWebhookRequest({
      bodyJson: body,
      signatureHeader: sig,
      timestampHeader: String(nowSec),
      nonceHeader: nonce,
      secret,
      nowSeconds: nowSec + 5,
    })
    expect(valid.valid).toBe(true)

    // Replay with same nonce must fail
    const replay = verifyInfrastructureWebhookRequest({
      bodyJson: body,
      signatureHeader: sig,
      timestampHeader: String(nowSec),
      nonceHeader: nonce,
      secret,
      nowSeconds: nowSec + 6,
    })
    expect(replay.valid).toBe(false)
    expect(replay.reason).toBe('replay_nonce_detected')

    // Expired timestamp must fail
    const stale = verifyInfrastructureWebhookRequest({
      bodyJson: body,
      signatureHeader: sig,
      timestampHeader: String(nowSec - 1000),
      nonceHeader: 'nonce-2',
      secret,
      nowSeconds: nowSec,
    })
    expect(stale.valid).toBe(false)
    expect(stale.reason).toBe('timestamp_out_of_window')
  })

  it('rejects shell metacharacters or unsafe tokens in Nginx directives', () => {
    expect(() => validateNginxDirectivesSafe('limit_req zone=api_limit burst=50;')).not.toThrow()
    expect(() => validateNginxDirectivesSafe('`rm -rf /`')).toThrow(/Unsafe Nginx directive/)
    expect(() => validateNginxDirectivesSafe('$(id)')).toThrow(/Unsafe Nginx directive/)
  })

  it('fails closed in production when LocalFilesystemStorageProvider has no STORAGE_SIGNING_SECRET', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.STORAGE_SIGNING_SECRET
    delete process.env.JWT_SECRET

    expect(() => new LocalFilesystemStorageProvider(tmpdir())).toThrow(/STORAGE_SIGNING_SECRET/)
  })

  it('enforces tenant prefix isolation, path traversal checks, size/mime bounds, SHA-256 integrity, and TTL validation across storage providers', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hisabche-storage-'))
    try {
      const local = new LocalFilesystemStorageProvider(dir, 'test-signing-secret-1234567890')
      const mem = new MemoryStorageProvider()

      for (const provider of [local, mem]) {
        const payload = Buffer.from('invoice-pdf-bytes', 'utf8')
        const sha = createHash('sha256').update(payload).digest('hex')

        // Cross-tenant upload blocked
        await expect(
          provider.upload('invoices', 'ws-attacker/file.pdf', payload, {
            contentType: 'application/pdf',
            expectedTenantPrefix: 'ws-owner',
          }),
        ).rejects.toThrow(/Tenant isolation violation/)

        // Path traversal blocked
        await expect(
          provider.upload('invoices', '../etc/passwd', payload, {
            contentType: 'text/plain',
          }),
        ).rejects.toThrow(/Path traversal blocked/)

        // Oversized upload blocked
        await expect(
          provider.upload('invoices', 'ws-owner/big.pdf', Buffer.alloc(1024), {
            contentType: 'application/pdf',
            maxBytes: 100,
          }),
        ).rejects.toThrow(/exceeds max allowed size/)

        // Disallowed MIME blocked
        await expect(
          provider.upload('invoices', 'ws-owner/bad.html', payload, {
            contentType: 'text/html',
          }),
        ).rejects.toThrow(/Disallowed content-type/)

        // Corrupted checksum blocked
        await expect(
          provider.upload('invoices', 'ws-owner/inv.pdf', payload, {
            contentType: 'application/pdf',
            expectedSha256: '0'.repeat(64),
          }),
        ).rejects.toThrow(/SHA-256 integrity mismatch/)

        // Invalid TTL blocked
        await expect(provider.getSignedUrl('invoices', 'ws-owner/inv.pdf', 0)).rejects.toThrow(
          /positive finite number/,
        )

        // Valid upload + download + delete succeeds
        const uploaded = await provider.upload('invoices', 'ws-owner/inv.pdf', payload, {
          contentType: 'application/pdf',
          expectedTenantPrefix: 'ws-owner',
          expectedSha256: sha,
        })
        expect(uploaded.path).toBe('ws-owner/inv.pdf')
        const downloaded = await provider.download('invoices', 'ws-owner/inv.pdf')
        expect(downloaded.equals(payload)).toBe(true)
        await provider.delete('invoices', 'ws-owner/inv.pdf')
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
