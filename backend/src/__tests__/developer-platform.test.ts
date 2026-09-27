// ============================================
// Developer platform — API keys and outbound webhooks.
//
//   1. The key rules: stored as a hash, recognisable by prefix, never wider
//      than the person who made it.
//   2. The route allowlist, on a real Fastify: a key opens only the routes its
//      scopes name, and a key is refused BEFORE it becomes its creator on a
//      route that only authenticates.
//   3. Webhook signatures: a receiver's check accepts ours and refuses a
//      replay, a forgery and a malformed header.
//   4. The delivery path with a fake repository and a fake network: signed,
//      outcome recorded, never able to fail the business write.
//   5. Source guards for the wiring a unit test cannot see.
// ============================================

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import Fastify from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  API_KEY_PATTERN,
  WEBHOOK_EVENTS,
  WEBHOOK_SIGNATURE_HEADER,
  apiKeyCreateSchema,
  signWebhookPayload,
  verifyWebhookSignature,
  webhookEndpointCreateSchema,
} from '@hisabche/validation'

import {
  API_ROUTE_SCOPES,
  checkWebhookUrl,
  decideRoute,
  displayPrefix,
  generateApiKey,
  hashApiKey,
  isPrivateAddress,
  looksLikeApiKey,
  narrowCapabilities,
  publicEventFor,
  webhookRetryDelaySeconds,
} from '../services/developer/developer.domain'

const cache = vi.hoisted(() => new Map<string, unknown>())
vi.mock('../utils/pagination', () => ({
  memoryCache: {
    get: async (k: string) => cache.get(k) ?? null,
    set: async (k: string, v: unknown) => void cache.set(k, v),
    getShared: async (k: string) => cache.get(k) ?? null,
    setShared: async (k: string, v: unknown) => void cache.set(k, v),
    invalidate: async (k: string) => void cache.delete(k),
  },
}))

const { createDeveloperService } = await import('../services/developer/developer.service')
const { NotConfiguredError } = await import('../services/developer/developer.repository')
type Repo = import('../services/developer/developer.repository').DeveloperRepository

const SRC = join(__dirname, '..')
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const read = (...p: string[]) => stripComments(readFileSync(join(SRC, ...p), 'utf8'))

// ─── 1. keys ─────────────────────────────────────────────────────────────────

describe('API keys', () => {
  it('a new key matches the published pattern and is 256 bits of randomness', () => {
    const a = generateApiKey()
    const b = generateApiKey()
    expect(a).toMatch(API_KEY_PATTERN)
    expect(looksLikeApiKey(a)).toBe(true)
    expect(a).not.toBe(b)
  })

  it('what is stored is a sha-256 hex digest, and the display prefix is not the key', () => {
    const key = generateApiKey()
    expect(hashApiKey(key)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashApiKey(key)).toBe(hashApiKey(key))
    expect(displayPrefix(key).length).toBe(16)
    expect(key.startsWith(displayPrefix(key))).toBe(true)
  })

  it('a Supabase JWT is not mistaken for a key', () => {
    expect(looksLikeApiKey('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sig')).toBe(false)
  })

  it('the create schema refuses UI scopes and an empty scope list', () => {
    expect(apiKeyCreateSchema.safeParse({ name: 'x', scopes: [] }).success).toBe(false)
    expect(apiKeyCreateSchema.safeParse({ name: 'x', scopes: ['ui:page'] }).success).toBe(false)
    expect(
      apiKeyCreateSchema.parse({ name: 'x', scopes: ['read:invoices', 'read:invoices'] }).scopes,
    ).toEqual(['read:invoices'])
  })

  it('narrowing keeps only what the creator holds AND the scopes allow; write implies read', () => {
    const owner = new Set([
      'invoice.read',
      'invoice.create',
      'customer.read',
      'customer.write',
      'ledger.post',
    ])
    expect([...narrowCapabilities(owner, ['read:invoices'])]).toEqual(['invoice.read'])
    expect([...narrowCapabilities(owner, ['write:customers'])].sort()).toEqual([
      'customer.read',
      'customer.write',
    ])
    // Nothing a person holds leaks through a key that did not ask for it.
    expect(narrowCapabilities(owner, ['read:products']).size).toBe(0)
  })
})

describe('the route allowlist', () => {
  it('a listed route is open to its scope, and a write scope also reads', () => {
    expect(decideRoute('GET', '/api/invoices/:id', ['read:invoices'])).toEqual({
      allowed: true,
      scope: 'read:invoices',
    })
    expect(decideRoute('GET', '/api/customers', ['write:customers']).allowed).toBe(true)
  })

  it('a read scope does not write', () => {
    expect(decideRoute('POST', '/api/customers', ['read:customers'])).toMatchObject({
      allowed: false,
      reason: 'SCOPE_MISSING',
      scope: 'write:customers',
    })
  })

  it('anything unlisted is closed, whatever the scopes', () => {
    const all = ['read:invoices', 'write:invoices', 'read:customers', 'write:customers'] as const
    for (const [method, url] of [
      ['DELETE', '/api/invoices/:id'],
      ['POST', '/api/invoices/:id/post-to-ledger'],
      ['POST', '/api/payments'],
      ['GET', '/api/developer/keys'],
      ['POST', '/api/developer/keys'],
      ['GET', '/api/workspaces'],
      ['GET', undefined],
    ] as const) {
      expect(decideRoute(method, url, [...all])).toMatchObject({
        allowed: false,
        reason: 'ROUTE_NOT_OPEN_TO_KEYS',
      })
    }
  })

  it('nothing that deletes, posts to the ledger, moves money or manages keys is listed', () => {
    for (const entry of Object.keys(API_ROUTE_SCOPES)) {
      expect(entry).not.toMatch(/^DELETE /)
      expect(entry).not.toMatch(/ledger|payments|developer|members|workspaces|billing/)
    }
  })
})

// ─── 2. on a real Fastify ────────────────────────────────────────────────────

const principal = vi.hoisted(() => ({
  current: null as null | { id: string; workspaceId: string; createdBy: string; scopes: string[] },
}))

vi.mock('../services/developer/developer.service', async () => {
  const actual = await vi.importActual<typeof import('../services/developer/developer.service')>(
    '../services/developer/developer.service',
  )
  return {
    ...actual,
    developerService: { authenticateKey: async () => principal.current },
  }
})

describe('authenticate with an API key', async () => {
  const { authenticate } = await import('../middleware/auth.middleware')
  const app = Fastify()
  const seen = vi.fn()
  const ok = async (request: { userId: string; apiKey?: unknown }) => {
    seen(request.userId, request.apiKey)
    return { ok: true }
  }
  app.get('/api/invoices', { preHandler: [authenticate] }, ok)
  app.post('/api/invoices', { preHandler: [authenticate] }, ok)
  app.delete('/api/invoices/:id', { preHandler: [authenticate] }, ok)
  // A route that only authenticates — profile, workspaces, billing are like this.
  app.get('/api/workspaces', { preHandler: [authenticate] }, ok)

  const KEY = generateApiKey()
  const call = (method: 'GET' | 'POST' | 'DELETE', url: string) =>
    app.inject({ method, url, headers: { authorization: `Bearer ${KEY}` } })

  beforeAll(() => app.ready())
  afterAll(() => app.close())
  beforeEach(() => {
    seen.mockReset()
    principal.current = {
      id: 'k1',
      workspaceId: 'ws-1',
      createdBy: 'user-1',
      scopes: ['read:invoices'],
    }
  })

  it('an unknown, revoked or expired key is 401', async () => {
    principal.current = null
    const res = await call('GET', '/api/invoices')
    expect(res.statusCode).toBe(401)
    expect(res.json().code).toBe('API_KEY_INVALID')
    expect(seen).not.toHaveBeenCalled()
  })

  it('a listed route runs as the key’s creator, with the key on the request', async () => {
    const res = await call('GET', '/api/invoices')
    expect(res.statusCode).toBe(200)
    expect(seen).toHaveBeenCalledWith('user-1', expect.objectContaining({ workspaceId: 'ws-1' }))
  })

  it('a route that only authenticates is refused — the key never becomes its creator there', async () => {
    const res = await call('GET', '/api/workspaces')
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('API_KEY_ROUTE_NOT_ALLOWED')
    expect(seen).not.toHaveBeenCalled()
  })

  it('a read key cannot write or delete', async () => {
    expect((await call('POST', '/api/invoices')).json().code).toBe('API_KEY_SCOPE_MISSING')
    expect((await call('DELETE', '/api/invoices/abc')).json().code).toBe(
      'API_KEY_ROUTE_NOT_ALLOWED',
    )
    expect(seen).not.toHaveBeenCalled()
  })
})

// ─── 3. signatures ───────────────────────────────────────────────────────────

describe('webhook signatures', () => {
  const secret = 'whsec_' + 'x'.repeat(43)
  const body = JSON.stringify({ id: 'e1', type: 'invoice.created' })
  const now = 1_790_000_000

  it('a receiver accepts what we sign', async () => {
    const header = await signWebhookPayload(secret, body, now)
    expect(header).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/)
    expect(await verifyWebhookSignature(secret, body, header, now + 10)).toEqual({
      valid: true,
      timestamp: now,
    })
  })

  it('a replay after the tolerance is refused', async () => {
    const header = await signWebhookPayload(secret, body, now)
    expect(await verifyWebhookSignature(secret, body, header, now + 301)).toEqual({
      valid: false,
      reason: 'expired',
    })
  })

  it('a changed body, another secret, or a moved timestamp is refused', async () => {
    const header = await signWebhookPayload(secret, body, now)
    expect((await verifyWebhookSignature(secret, body + ' ', header, now)).valid).toBe(false)
    expect(
      (await verifyWebhookSignature('other-secret-other-secret-00000', body, header, now)).valid,
    ).toBe(false)
    const moved = header.replace(`t=${now}`, `t=${now + 1}`)
    expect(await verifyWebhookSignature(secret, body, moved, now)).toEqual({
      valid: false,
      reason: 'mismatch',
    })
  })

  it('a missing or malformed header is refused as malformed', async () => {
    expect(await verifyWebhookSignature(secret, body, null, now)).toEqual({
      valid: false,
      reason: 'malformed',
    })
    expect(await verifyWebhookSignature(secret, body, 't=abc,v1=zz', now)).toEqual({
      valid: false,
      reason: 'malformed',
    })
  })
})

// ─── SSRF ────────────────────────────────────────────────────────────────────

describe('where a webhook may point', () => {
  it.each([
    'http://example.com/hook',
    'https://localhost/hook',
    'https://127.0.0.1/hook',
    'https://10.0.0.5/hook',
    'https://169.254.169.254/latest/meta-data',
    'https://[::1]/hook',
    'https://[::ffff:192.168.1.1]/hook',
    'https://db.internal/hook',
    'https://user:pass@example.com/hook',
  ])('refuses %s', (url) => {
    expect(checkWebhookUrl(url).ok).toBe(false)
  })

  it('accepts a public https URL', () => {
    expect(checkWebhookUrl('https://hooks.example.com/hisabche')).toEqual({
      ok: true,
      host: 'hooks.example.com',
    })
  })

  it('private ranges are private; public ones are not', () => {
    for (const a of [
      '100.64.0.1',
      '172.16.0.1',
      '192.168.0.1',
      '0.0.0.0',
      '224.0.0.1',
      'fd00::1',
      'fe80::1',
    ])
      expect(isPrivateAddress(a)).toBe(true)
    for (const a of ['8.8.8.8', '1.1.1.1', '2606:4700::1111'])
      expect(isPrivateAddress(a)).toBe(false)
  })

  it('the create schema requires https', () => {
    const r = webhookEndpointCreateSchema.safeParse({
      url: 'http://x.com',
      events: ['invoice.created'],
    })
    expect(r.success).toBe(false)
  })
})

// ─── 4. the service ──────────────────────────────────────────────────────────

function fakeRepo(overrides: Partial<Repo> = {}): Repo {
  const base = {
    enqueueEvent: vi.fn(async () => 1),
    claimDeliveries: vi.fn(async () => []),
    secretsFor: vi.fn(async () => new Map([['ep1', 'whsec_' + 's'.repeat(43)]])),
    endpointUrls: vi.fn(async () => new Map([['ep1', 'https://hooks.example.com/x']])),
    completeDelivery: vi.fn(async () => true),
    failDelivery: vi.fn(async () => 'pending'),
    insertKey: vi.fn(async (row: Record<string, unknown>) => ({ id: 'k1', ...row })),
    findLiveKeyByHash: vi.fn(async () => null),
    touchKey: vi.fn(async () => undefined),
    revokeKey: vi.fn(async () => ({ key_hash: 'h' })),
  }
  return { ...base, ...overrides } as unknown as Repo
}

const delivery = {
  id: 'd1',
  workspace_id: 'ws-1',
  endpoint_id: 'ep1',
  event_id: 'e1',
  event_type: 'invoice.created',
  payload: { id: 'e1', type: 'invoice.created' },
  status: 'delivering' as const,
  attempts: 1,
  max_attempts: 8,
  next_attempt_at: '',
  last_status_code: null,
  last_error: null,
  created_at: '',
  delivered_at: null,
}

describe('the event path', () => {
  it('an event outside the catalogue writes nothing', async () => {
    const repo = fakeRepo()
    const svc = createDeveloperService(repo, vi.fn())
    expect(
      await svc.emitEvent({
        workspaceId: 'ws',
        entityType: 'leave',
        action: 'created',
        entityId: 'x',
      }),
    ).toBe(0)
    expect(repo.enqueueEvent).not.toHaveBeenCalled()
  })

  it('a catalogue event is enqueued with a thin envelope', async () => {
    const repo = fakeRepo()
    const svc = createDeveloperService(repo, vi.fn())
    await svc.emitEvent({
      workspaceId: 'ws',
      entityType: 'invoice',
      action: 'posted_to_ledger',
      entityId: 'inv1',
    })
    const [, , type, payload] = vi.mocked(repo.enqueueEvent).mock.calls[0]!
    expect(type).toBe('invoice.posted')
    expect(payload).toMatchObject({
      type: 'invoice.posted',
      data: { resource: 'invoice', id: 'inv1' },
      apiVersion: 1,
    })
    expect(Object.keys((payload as { data: object }).data).sort()).toEqual(['id', 'resource'])
  })

  it('never throws — an integration cannot fail an invoice', async () => {
    const svc = createDeveloperService(
      fakeRepo({ enqueueEvent: vi.fn(async () => Promise.reject(new Error('db down'))) }),
      vi.fn(),
    )
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(
      svc.emitEvent({ workspaceId: 'ws', entityType: 'invoice', action: 'created', entityId: 'x' }),
    ).resolves.toBe(0)
    spy.mockRestore()
  })

  it('before the migration it is silent', async () => {
    const svc = createDeveloperService(
      fakeRepo({ enqueueEvent: vi.fn(async () => Promise.reject(new NotConfiguredError())) }),
      vi.fn(),
    )
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await svc.emitEvent({
      workspaceId: 'ws',
      entityType: 'invoice',
      action: 'created',
      entityId: 'x',
    })
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('every public event maps from a real business event name', () => {
    const produced = new Set(
      [
        ['invoice', 'created'],
        ['invoice', 'updated'],
        ['invoice', 'cancelled'],
        ['invoice', 'deleted'],
        ['invoice', 'posted_to_ledger'],
        ['invoice', 'payment_recorded'],
        ['customer', 'created'],
        ['product', 'created'],
      ].map(([e, a]) => publicEventFor(e!, a!)),
    )
    expect([...produced].sort()).toEqual([...WEBHOOK_EVENTS].sort())
  })
})

describe('delivery', () => {
  it('signs the exact body it sends, and records success', async () => {
    const post = vi.fn(async () => ({ status: 204, error: null }))
    const repo = fakeRepo({ claimDeliveries: vi.fn(async () => [delivery]) })
    const svc = createDeveloperService(repo, post)
    expect(await svc.drainWebhooks()).toEqual({ sent: 1, failed: 0 })
    const [url, body, headers] = post.mock.calls[0] as unknown as [
      string,
      string,
      Record<string, string>,
    ]
    expect(url).toBe('https://hooks.example.com/x')
    const verdict = await verifyWebhookSignature(
      'whsec_' + 's'.repeat(43),
      body,
      headers[WEBHOOK_SIGNATURE_HEADER],
    )
    expect(verdict.valid).toBe(true)
    expect(headers['Hisabche-Event-Id']).toBe('e1')
    expect(repo.completeDelivery).toHaveBeenCalledWith('d1', expect.any(String), 204)
  })

  it('a non-2xx is a failed attempt with backoff, never a success', async () => {
    const repo = fakeRepo({ claimDeliveries: vi.fn(async () => [{ ...delivery, attempts: 3 }]) })
    const svc = createDeveloperService(
      repo,
      vi.fn(async () => ({ status: 301, error: 'HTTP 301' })),
    )
    expect(await svc.drainWebhooks()).toEqual({ sent: 0, failed: 1 })
    expect(repo.completeDelivery).not.toHaveBeenCalled()
    expect(repo.failDelivery).toHaveBeenCalledWith(
      'd1',
      expect.any(String),
      'HTTP 301',
      301,
      webhookRetryDelaySeconds(3),
    )
  })

  it('backoff doubles and is capped at six hours', () => {
    expect(webhookRetryDelaySeconds(1)).toBe(60)
    expect(webhookRetryDelaySeconds(2)).toBe(120)
    expect(webhookRetryDelaySeconds(20)).toBe(6 * 3600)
  })
})

describe('creating a key', () => {
  const ctx = (caps: string[]) => ({
    workspaceId: 'ws-1',
    userId: 'user-1',
    role: 'manager' as const,
    capabilities: new Set(caps),
  })

  it('returns the plain key once, and stores only its hash', async () => {
    const repo = fakeRepo()
    const svc = createDeveloperService(repo, vi.fn())
    const out = await svc.createKey(ctx(['invoice.read']), {
      name: 'shop',
      scopes: ['read:invoices'],
    })
    expect(out.secret).toMatch(API_KEY_PATTERN)
    const row = vi.mocked(repo.insertKey).mock.calls[0]![0]
    expect(row.key_hash).toBe(hashApiKey(out.secret))
    expect(JSON.stringify(row)).not.toContain(out.secret)
  })

  it('a person cannot mint a key wider than themselves', async () => {
    const repo = fakeRepo()
    const svc = createDeveloperService(repo, vi.fn())
    const out = await svc.createKey(ctx(['invoice.read']), {
      name: 'shop',
      scopes: ['read:invoices', 'write:products'],
    })
    expect(vi.mocked(repo.insertKey).mock.calls[0]![0].scopes).toEqual(['read:invoices'])
    expect(out.refused.map((r) => r.scope)).toEqual(['write:products'])
    await expect(
      svc.createKey(ctx([]), { name: 'nothing', scopes: ['write:products'] }),
    ).rejects.toMatchObject({ code: 'NO_SCOPE_GRANTED' })
  })

  it('revoking clears the shared auth cache for that key', async () => {
    cache.set('apikey:h', { principal: { id: 'k1' }, expiresAt: null })
    const svc = createDeveloperService(fakeRepo(), vi.fn())
    await svc.revokeKey(ctx(['workspace.manage']), 'k1')
    expect(cache.has('apikey:h')).toBe(false)
  })
})

// ─── 5. wiring ───────────────────────────────────────────────────────────────

describe('wiring', () => {
  const routeFiles = readdirSync(join(SRC, 'routes')).filter((f) => f.endsWith('.ts'))
  const routes = routeFiles.map((f) => read('routes', f)).join('\n')

  it.each(Object.keys(API_ROUTE_SCOPES))('%s exists and runs requireWorkspaceContext', (entry) => {
    const [method, path] = entry.split(' ') as [string, string]
    const accountingPath = path.replace(/^\/api\/accounting/, '')
    const pattern = new RegExp(
      `fastify\\.${method.toLowerCase()}\\(\\s*'(${path.replace(/[/:]/g, '\\$&')}|${accountingPath.replace(/[/:]/g, '\\$&')})',[\\s\\S]{0,400}?requireWorkspaceContext`,
    )
    expect(pattern.test(routes)).toBe(true)
  })

  it('authenticate decides the route before the key becomes its creator', () => {
    const auth = read('middleware', 'auth.middleware.ts')
    const body = auth.slice(auth.indexOf('async function authenticateApiKey'))
    expect(body.indexOf('decideRoute(')).toBeGreaterThan(0)
    expect(body.indexOf('decideRoute(')).toBeLessThan(
      body.indexOf('request.userId = principal.createdBy'),
    )
    expect(auth).toContain('if (looksLikeApiKey(token)) return authenticateApiKey(')
  })

  it('the workspace middleware pins the key’s workspace and narrows capabilities', () => {
    const ws = read('middleware', 'workspace.middleware.ts')
    expect(ws).toContain('API_KEY_WORKSPACE_MISMATCH')
    expect(ws).toContain('key ? key.workspaceId : requested')
    expect(ws).toContain('narrowCapabilities(')
  })

  it('every business event reaches the webhook path from the one choke point', () => {
    expect(read('services', 'event-log.service.ts')).toContain('developerService.emitEvent(')
  })

  it('the poller drains webhooks', () => {
    const plugin = read('plugins', 'job-scheduler.plugin.ts')
    expect(plugin).toContain('setInterval(() => void pollWebhooks()')
  })

  it('the developer routes are for workspace managers and registered', () => {
    const dev = read('routes', 'developer.routes.ts')
    expect(dev).toContain("requireCapability('workspace.manage')")
    expect((dev.match(/preHandler: guard/g) ?? []).length).toBe(
      (dev.match(/fastify\.(get|post|patch|delete)\(/g) ?? []).length,
    )
    expect(read('index.ts')).toContain('server.register(developerRoutes)')
  })
})
