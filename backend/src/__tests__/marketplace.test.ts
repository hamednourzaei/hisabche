// ============================================
// The app marketplace — its rules as pure functions, the request shapes, a
// real Fastify answering refusals, and the wiring a unit test cannot see.
// The database side (versions, lifecycle, badges, exact counts) is proven in
// developer-platform-07.pg.test.ts.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Fastify from 'fastify'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  OAUTH_ERROR_CODES,
  appPricingSchema,
  appReviewSchema,
  appVersionSubmitSchema,
  oauthAppUpdateSchema,
} from '@hisabche/validation'

import {
  HEALTH_THRESHOLDS,
  appHealth,
  eventsForGrant,
  isCompatible,
  permissionDisclosure,
  riskFlags,
  scopeDiff,
} from '../services/oauth/oauth.domain'
import { OAuthError, check } from '../services/oauth/oauth.repository'
import { NotConfiguredError } from '../services/developer/developer.repository'
import { buildMarketplaceRoutes } from '../routes/marketplace.routes'

const SRC = join(__dirname, '..')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const read = (...p: string[]) => strip(readFileSync(join(SRC, ...p), 'utf8'))

describe('health — from exact counts, never guessed', () => {
  const base = { requests24h: 0, serverErrors24h: 0, deliveries24h: 0, failedDeliveries24h: 0 }

  it('no traffic is «no data», not «healthy»', () => {
    expect(appHealth(base).level).toBe('no_data')
  })

  it('a handful of requests is «low volume»: one failure in two is not a 50% outage', () => {
    expect(appHealth({ ...base, requests24h: 2, serverErrors24h: 1 }).level).toBe('low_volume')
  })

  it('the thresholds decide above the minimum sample, and the worse of API and webhooks wins', () => {
    const n = HEALTH_THRESHOLDS.minSample * 10
    expect(appHealth({ ...base, requests24h: n, serverErrors24h: 0 }).level).toBe('healthy')
    expect(appHealth({ ...base, requests24h: n, serverErrors24h: n * 0.1 }).level).toBe('degraded')
    expect(appHealth({ ...base, requests24h: n, serverErrors24h: n * 0.3 }).level).toBe('failing')
    expect(
      appHealth({
        requests24h: n,
        serverErrors24h: 0,
        deliveries24h: n,
        failedDeliveries24h: n * 0.5,
      }).level,
    ).toBe('failing')
  })
})

describe('webhook subscriptions follow the grant', () => {
  it('an event reaches the app only if the installer granted read access to its resource', () => {
    expect(eventsForGrant(['invoice.created', 'product.created'], ['read:products'])).toEqual([
      'product.created',
    ])
    expect(eventsForGrant(['order.paid', 'nonsense.event'], ['read:orders'])).toEqual([
      'order.paid',
    ])
    expect(eventsForGrant(['invoice.created'], [])).toEqual([])
  })
})

describe('versions, compatibility, disclosure', () => {
  it('only known API versions are compatible', () => {
    expect(isCompatible('v1')).toBe(true)
    expect(isCompatible('v2')).toBe(false)
  })

  it('an update says what it adds and what it drops', () => {
    expect(scopeDiff(['read:products'], ['read:products', 'read:invoices'])).toEqual({
      added: ['read:invoices'],
      removed: [],
    })
    expect(scopeDiff(['read:products', 'write:orders'], ['read:products'])).toEqual({
      added: [],
      removed: ['write:orders'],
    })
  })

  it('every scope is disclosed as reading or changing data', () => {
    expect(
      permissionDisclosure(['read:products', 'write:orders'], ['product.created']).scopes,
    ).toEqual([
      { scope: 'read:products', access: 'read' },
      { scope: 'write:orders', access: 'write' },
    ])
  })

  it('version numbers are MAJOR.MINOR.PATCH', () => {
    expect(appVersionSubmitSchema.safeParse({ version: '1.2.3', changelog: 'x' }).success).toBe(
      true,
    )
    for (const v of ['1.2', 'v1.2.3', '01.2.3', '1.2.3-beta']) {
      expect(appVersionSubmitSchema.safeParse({ version: v, changelog: 'x' }).success).toBe(false)
    }
    expect(appVersionSubmitSchema.safeParse({ version: '1.0.0', changelog: '' }).success).toBe(
      false,
    )
  })
})

describe('security review flags', () => {
  const version = {
    redirect_uris: ['https://app.example/cb'],
    requested_scopes: ['read:products', 'write:orders'] as string[],
    webhook_url: 'https://hooks.other.example/in',
  }

  it('names new scopes against the live version, write scopes, a foreign webhook host, an unverified publisher and open reports', () => {
    const flags = riskFlags({
      version,
      previous: { requested_scopes: ['read:products'] },
      publisherVerified: false,
      openReports: 2,
    })
    expect(flags).toEqual([
      { flag: 'NEW_SCOPES', detail: ['write:orders'] },
      { flag: 'WRITE_SCOPES', detail: ['write:orders'] },
      { flag: 'WEBHOOK_HOST_MISMATCH', detail: ['hooks.other.example'] },
      { flag: 'UNVERIFIED_PUBLISHER', detail: [] },
      { flag: 'OPEN_REPORTS', detail: ['2'] },
    ])
  })

  it('a first version: every scope is new; localhost is flagged', () => {
    const flags = riskFlags({
      version: { ...version, redirect_uris: ['http://localhost:3000/cb'], webhook_url: null },
      previous: null,
      publisherVerified: true,
      openReports: 0,
    })
    expect(flags.map((f) => f.flag)).toEqual(['NEW_SCOPES', 'WRITE_SCOPES', 'LOCALHOST_REDIRECT'])
  })
})

describe('request shapes', () => {
  it('a price is minor units and complete, or the app is free', () => {
    expect(appPricingSchema.safeParse({ model: 'free' }).success).toBe(true)
    expect(
      appPricingSchema.safeParse({
        model: 'paid',
        priceMinor: 50000,
        currency: 'AFN',
        interval: 'month',
      }).success,
    ).toBe(true)
    expect(
      appPricingSchema.safeParse({
        model: 'paid',
        priceMinor: 12.5,
        currency: 'AFN',
        interval: 'month',
      }).success,
    ).toBe(false)
    expect(
      appPricingSchema.safeParse({ model: 'paid', priceMinor: 100, currency: 'AFN' }).success,
    ).toBe(false)
    expect(appPricingSchema.safeParse({ model: 'free', priceMinor: 100 }).success).toBe(false)
  })

  it('a review is 1–5 whole stars', () => {
    expect(appReviewSchema.safeParse({ rating: 5 }).success).toBe(true)
    expect(appReviewSchema.safeParse({ rating: 0 }).success).toBe(false)
    expect(appReviewSchema.safeParse({ rating: 4.5 }).success).toBe(false)
  })

  it('a listing edit refuses what the publisher may not set: status, versions, counts', () => {
    expect(oauthAppUpdateSchema.safeParse({ status: 'published' }).success).toBe(false)
    expect(oauthAppUpdateSchema.safeParse({ publishedVersionId: 'x' }).success).toBe(false)
    expect(oauthAppUpdateSchema.safeParse({ slug: 'Bad Slug' }).success).toBe(false)
    expect(oauthAppUpdateSchema.safeParse({ webhookUrl: 'http://insecure.example' }).success).toBe(
      false,
    )
  })
})

describe('database refusals are named', () => {
  it.each([
    ['VERSION_NOT_NEWER', 409],
    ['VERSION_HAS_LOCALHOST', 409],
    ['LISTING_INCOMPLETE', 400],
    ['INSTALLATION_NOT_ACTIVE', 409],
  ])('%s → %i', (code, status) => {
    expect(() => check({ code: 'P0001', message: code })).toThrow(OAuthError)
    try {
      check({ code: 'P0001', message: code })
    } catch (err) {
      expect(err).toMatchObject({ code, statusCode: status })
    }
  })

  it('a taken slug is SLUG_TAKEN; the migration not run is «not configured»', () => {
    expect(() =>
      check({
        code: '23505',
        message: 'duplicate key value violates unique constraint "oauth_apps_slug_idx"',
      }),
    ).toThrow(expect.objectContaining({ code: 'SLUG_TAKEN' }))
    expect(() => check({ code: '42P01', message: 'relation does not exist' })).toThrow(
      NotConfiguredError,
    )
  })

  it('every code the services can throw has words in the UI list', () => {
    const sources = [
      read('services', 'oauth', 'oauth.service.ts'),
      read('services', 'oauth', 'marketplace.service.ts'),
      read('services', 'oauth', 'oauth.repository.ts'),
    ].join('\n')
    const thrown = new Set(
      [...sources.matchAll(/OAuthError\('([A-Z_]+)'/g)].map((m) => m[1] as string),
    )
    for (const m of sources.matchAll(/\['([A-Z_]+)', \d{3}\]/g)) thrown.add(m[1] as string)
    expect(thrown.size).toBeGreaterThan(20)
    expect(
      [...thrown].filter((c) => !(OAUTH_ERROR_CODES as readonly string[]).includes(c)),
    ).toEqual([])
  })
})

describe('routes', () => {
  const fake = {
    list: vi.fn(async () => []),
    report: vi.fn(async () => ({ id: 'r', duplicate: true })),
    saveReview: vi.fn(async () => {
      throw new OAuthError('REVIEW_NOT_INSTALLED', 403)
    }),
  }
  const app = Fastify()
  app.addHook('onRoute', (route) => {
    route.preHandler = async (request) => {
      ;(request as unknown as { tenancy: unknown }).tenancy = { workspaceId: 'ws', userId: 'u' }
    }
  })
  app.register(buildMarketplaceRoutes(fake as never))
  beforeAll(() => app.ready())
  afterAll(() => app.close())

  it('a refusal is its status and its code', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/marketplace/apps/00000000-0000-0000-0000-000000000001/review',
      payload: { rating: 5 },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ error: 'REVIEW_NOT_INSTALLED', code: 'REVIEW_NOT_INSTALLED' })
  })

  it('a second report while one is open is 200 with the same report, not a new one', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/marketplace/apps/00000000-0000-0000-0000-000000000001/report',
      payload: { reason: 'security' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().duplicate).toBe(true)
  })

  it('an unknown category is a 400, not an empty list', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/marketplace/apps?category=casino' })
    expect(res.statusCode).toBe(400)
  })
})

describe('wiring', () => {
  const routes = read('routes', 'marketplace.routes.ts')
  const service = read('services', 'oauth', 'oauth.service.ts')
  const market = read('services', 'oauth', 'marketplace.service.ts')

  const guardOf = (method: string, path: string) => {
    const at = routes.indexOf(`fastify.${method}(\n      '${path}'`)
    expect(at, `${method} ${path}`).toBeGreaterThan(-1)
    return /preHandler: (\w+)/.exec(routes.slice(at, at + 200))?.[1]
  }

  it('browsing and reporting: any member; reviewing, publishing, analytics: workspace.manage; platform: admin', () => {
    expect(guardOf('get', '/api/marketplace/apps')).toBe('member')
    expect(guardOf('get', '/api/marketplace/apps/:app')).toBe('member')
    expect(guardOf('post', '/api/marketplace/apps/:app/report')).toBe('member')
    expect(guardOf('put', '/api/marketplace/apps/:app/review')).toBe('manage')
    expect(guardOf('put', '/api/developer/publisher')).toBe('manage')
    expect(guardOf('get', '/api/developer/apps/:id/stats')).toBe('manage')
    expect(guardOf('post', '/api/admin/app-publishers/:workspaceId/verification')).toBe('admin')
    expect(guardOf('post', '/api/admin/app-reviews/:id/visibility')).toBe('admin')
  })

  it('registered, and never open to an API key', async () => {
    expect(read('index.ts')).toContain('await server.register(marketplaceRoutes)')
    const { API_ROUTE_SCOPES } = await import('../services/developer/developer.domain')
    expect(
      Object.keys(API_ROUTE_SCOPES).filter((k) =>
        /marketplace|publisher|app-|oauth|installed-apps/.test(k),
      ),
    ).toEqual([])
  })

  it('install, update and uninstall each go through ONE path', () => {
    expect(service).toContain("rpc('install_oauth_app'")
    expect(service).toContain("rpc('update_app_installation'")
    // Uninstall is revoking the key — the trigger ends the installation.
    const uninstall = service.slice(service.indexOf('async uninstall('))
    expect(uninstall.slice(0, 400)).toContain('developer.revokeKey(ctx, inst.key_id)')
    expect(service).not.toMatch(/from\('app_installations'\)\s*\.(insert|update|delete)/)
  })

  it('a changed key stops being served from the cache at once', () => {
    const update = service.slice(service.indexOf('async applyUpdate('))
    expect(update.slice(0, 1200)).toContain('developer.forgetKeys([plan.keyHash])')
    const suspend = service.slice(service.indexOf('async setAppStatus('))
    expect(suspend).toContain('developer.forgetKeys(')
  })

  it('a review needs an installation and is never the publisher’s own', () => {
    const save = market.slice(market.indexOf('async saveReview('))
    expect(save.indexOf("'REVIEW_OWN_APP'")).toBeLessThan(save.indexOf('.upsert('))
    expect(save.indexOf("'REVIEW_NOT_INSTALLED'")).toBeLessThan(save.indexOf('.upsert('))
  })

  it('reviews are shown without the reviewing business’s name', () => {
    const detail = market.slice(
      market.indexOf('async detail('),
      market.indexOf('async saveReview('),
    )
    expect(detail).not.toContain('workspaceNames(')
    expect(detail).toContain('mine: r.workspace_id === ctx.workspaceId')
  })
})
