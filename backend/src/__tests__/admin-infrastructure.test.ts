// ============================================
// backend/src/__tests__/admin-infrastructure.test.ts
//
// Tests for Admin Infrastructure & Nginx Control Service, Routes & Runtime Hooks.
// Verifies toggle state transitions, Postgres (`feature_flags`) persistence,
// default values, schema bounds, Nginx directive generation, Step-Up/RBAC HTTP
// authentication guards, and live Fastify runtime headers + 503 maintenance mode.
// ============================================

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import {
  buildNginxConfigDirectives,
  updateInfrastructureSettingsSchema,
} from '@hisabche/validation'
import { FakeDatabase, createFakeDb } from './helpers/fake-supabase'

process.env.ADMIN_ALLOWED_EMAILS = 'super@hisabche.com'

const db = new FakeDatabase()

const SUPER_ADMIN = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'super@hisabche.com',
}

const users = new Map<string, { id: string; email: string }>()

function tokenWithTotpAt(seconds: number): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const token = [
    b64({ alg: 'HS256' }),
    b64({
      sub: SUPER_ADMIN.id,
      aal: 'aal2',
      amr: [
        { method: 'password', timestamp: seconds - 600 },
        { method: 'totp', timestamp: seconds },
      ],
    }),
    'sig',
  ].join('.')
  users.set(token, { id: SUPER_ADMIN.id, email: SUPER_ADMIN.email })
  return token
}

vi.mock('../db', () => {
  const fake = createFakeDb(db, users)
  return {
    ...fake,
    supabase: {
      ...fake.supabase,
      auth: {
        ...fake.supabase.auth,
        admin: {
          signOut: async () => ({ error: null }),
        },
      },
    },
  }
})

let adminInfrastructureService: typeof import('../services/admin/admin-infrastructure.service').adminInfrastructureService
let INFRASTRUCTURE_FLAG_KEY: string
let app: FastifyInstance | null = null

describe('AdminInfrastructureService & Runtime Enforcement', () => {
  beforeAll(async () => {
    db.seed('admin_accounts', [
      {
        id: 'acc-infra-1',
        user_id: SUPER_ADMIN.id,
        email: SUPER_ADMIN.email,
        role: 'SUPER',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])

    const serviceMod = await import('../services/admin/admin-infrastructure.service')
    adminInfrastructureService = serviceMod.adminInfrastructureService
    const modeMod = await import('../runtime/maintenance-mode')
    INFRASTRUCTURE_FLAG_KEY = modeMod.INFRASTRUCTURE_FLAG_KEY

    const { buildServer } = await import('../index')
    app = await buildServer({ testRuntime: true })
    await app.ready()
  })

  afterAll(async () => {
    adminInfrastructureService.resetToDefaults()
    if (app) await app.close()
  })

  beforeEach(() => {
    db.tables.set('feature_flags', [])
    db.tables.set('admin_security_events', [])
    adminInfrastructureService.resetToDefaults()
  })

  it('initializes with production-grade default infrastructure settings', () => {
    const settings = adminInfrastructureService.getSettings()

    expect(settings.nginxProxyEnabled).toBe(true)
    expect(settings.rateLimitingEnabled).toBe(true)
    expect(settings.rateLimitRps).toBe(100)
    expect(settings.rateLimitBurst).toBe(50)
    expect(settings.cacheBypassEnabled).toBe(false)
    expect(settings.cacheBypassHeader).toBe('X-Hisabche-Bypass-Cache')
    expect(settings.maintenanceMode).toBe(false)
    expect(settings.maintenanceNotice).toBe('')
    expect(settings.wsCompressionEnabled).toBe(true)
    expect(settings.upstreamHealthCheck).toBe(true)
    expect(settings.hstsEnabled).toBe(true)
    expect(settings.hstsMaxAge).toBe(31536000)
    expect(settings.edgeControlMode).toBe('fastify_runtime_only')
    expect(settings.updatedBy).toBe('system')
  })

  it('rolls back persisted settings and maintenance state if external Nginx reload webhook fails', async () => {
    await adminInfrastructureService.updateSettings(
      { nginxProxyEnabled: true, maintenanceMode: false },
      'ops@hisabche.test',
    )

    process.env.NGINX_RELOAD_WEBHOOK_URL = 'https://nginx-reloader.internal/reload'
    adminInfrastructureService.setReloadFetchForTest(async () => {
      return new Response('nginx -t syntax error', { status: 500 })
    })

    try {
      await expect(
        adminInfrastructureService.updateSettings(
          { maintenanceMode: true, maintenanceNotice: 'Should roll back' },
          'ops@hisabche.test',
        ),
      ).rejects.toThrow(/Nginx reload webhook failed.*rolled back/)

      // Both in-memory state and DB row reverted cleanly
      expect(adminInfrastructureService.getSettings().maintenanceMode).toBe(false)
      const rows = (db.tables.get('feature_flags') ?? []).filter(
        (r) => r.key === INFRASTRUCTURE_FLAG_KEY,
      )
      expect(JSON.parse(String(rows[0]?.description)).maintenanceMode).toBe(false)
    } finally {
      delete process.env.NGINX_RELOAD_WEBHOOK_URL
      adminInfrastructureService.setReloadFetchForTest(null)
    }
  })

  it('updates toggle states, persists in feature_flags, renders Nginx directives, and reloads across resets', async () => {
    const updated = await adminInfrastructureService.updateSettings(
      {
        nginxProxyEnabled: false,
        cacheBypassEnabled: true,
        maintenanceMode: true,
        maintenanceNotice: 'Scheduled database indexing maintenance',
        rateLimitRps: 200,
      },
      'admin@hisabche.test',
    )

    expect(updated.nginxProxyEnabled).toBe(false)
    expect(updated.cacheBypassEnabled).toBe(true)
    expect(updated.maintenanceMode).toBe(true)
    expect(updated.maintenanceNotice).toBe('Scheduled database indexing maintenance')
    expect(updated.rateLimitRps).toBe(200)
    expect(updated.rateLimitBurst).toBe(50)
    expect(updated.updatedBy).toBe('admin@hisabche.test')
    expect(new Date(updated.updatedAt!).getTime()).toBeGreaterThan(0)

    const savedRows = (db.tables.get('feature_flags') ?? []).filter(
      (r) => r.key === INFRASTRUCTURE_FLAG_KEY,
    )
    expect(savedRows).toHaveLength(1)
    expect(savedRows[0]?.is_enabled).toBe(false)

    // Simulate fresh stateless process reloading settings from Postgres
    adminInfrastructureService.resetToDefaults()
    expect(adminInfrastructureService.getSettings().maintenanceMode).toBe(false)

    const reloaded = await adminInfrastructureService.loadSettings()
    expect(reloaded.nginxProxyEnabled).toBe(false)
    expect(reloaded.cacheBypassEnabled).toBe(true)
    expect(reloaded.maintenanceMode).toBe(true)
    expect(reloaded.maintenanceNotice).toBe('Scheduled database indexing maintenance')

    const nginxBlock = buildNginxConfigDirectives(reloaded)
    expect(nginxBlock).toContain('set $hisabche_proxy_mode "direct";')
    expect(nginxBlock).toContain('set $hisabche_cache_bypass "1";')
    expect(nginxBlock).toContain('Target 200 req/s')
    expect(nginxBlock).toContain('set $hisabche_maintenance 1;')
  })

  it('validates schema bounds and rejects invalid values', () => {
    expect(updateInfrastructureSettingsSchema.safeParse({ rateLimitRps: 0 }).success).toBe(false)
    expect(updateInfrastructureSettingsSchema.safeParse({ rateLimitRps: 20000 }).success).toBe(
      false,
    )
    expect(
      updateInfrastructureSettingsSchema.safeParse({ maintenanceNotice: 'x'.repeat(300) }).success,
    ).toBe(false)
    expect(
      updateInfrastructureSettingsSchema.safeParse({ rateLimitingEnabled: false }).success,
    ).toBe(true)
  })

  it('resets to defaults cleanly', async () => {
    await adminInfrastructureService.updateSettings(
      { maintenanceMode: true, nginxProxyEnabled: false },
      'ops@hisabche.test',
    )
    expect(adminInfrastructureService.getSettings().maintenanceMode).toBe(true)

    adminInfrastructureService.resetToDefaults()
    const reset = adminInfrastructureService.getSettings()
    expect(reset.maintenanceMode).toBe(false)
    expect(reset.nginxProxyEnabled).toBe(true)
    expect(reset.updatedBy).toBe('system')
  })

  it('enforces auth + step-up on /api/admin/infrastructure/settings and persists authenticated writes', async () => {
    const unauthGet = await app!.inject({
      method: 'GET',
      url: '/api/admin/infrastructure/settings',
    })
    expect(unauthGet.statusCode).toBe(401)

    const unauthPut = await app!.inject({
      method: 'PUT',
      url: '/api/admin/infrastructure/settings',
      payload: { rateLimitingEnabled: false },
    })
    expect(unauthPut.statusCode).toBe(401)

    const totpSeconds = Math.floor(Date.now() / 1000)
    const token = tokenWithTotpAt(totpSeconds)

    const noStepUpPut = await app!.inject({
      method: 'PUT',
      url: '/api/admin/infrastructure/settings',
      headers: { authorization: `Bearer ${token}` },
      payload: { rateLimitingEnabled: false },
    })
    expect(noStepUpPut.statusCode).toBe(403)
    expect(noStepUpPut.json().code).toBe('ADMIN_STEP_UP_REQUIRED')

    const validPut = await app!.inject({
      method: 'PUT',
      url: '/api/admin/infrastructure/settings',
      headers: {
        authorization: `Bearer ${token}`,
        'x-admin-step-up-timestamp': String(totpSeconds),
      },
      payload: {
        rateLimitingEnabled: false,
        cacheBypassEnabled: true,
        rateLimitRps: 250,
      },
    })
    expect(validPut.statusCode).toBe(200)
    expect(validPut.json().rateLimitingEnabled).toBe(false)
    expect(validPut.json().cacheBypassEnabled).toBe(true)
    expect(validPut.json().rateLimitRps).toBe(250)
    expect(validPut.json().updatedBy).toBe(SUPER_ADMIN.email)

    const validGet = await app!.inject({
      method: 'GET',
      url: '/api/admin/infrastructure/settings',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(validGet.statusCode).toBe(200)
    expect(validGet.json().rateLimitingEnabled).toBe(false)
    expect(validGet.json().rateLimitRps).toBe(250)
  })

  it('enforces runtime proxy, rate-limit, cache-bypass, HSTS, and maintenance toggles on real HTTP requests', async () => {
    await adminInfrastructureService.updateSettings(
      {
        nginxProxyEnabled: false,
        rateLimitingEnabled: false,
        cacheBypassEnabled: true,
        hstsEnabled: true,
        maintenanceMode: true,
        maintenanceNotice: 'Planned maintenance window',
      },
      'ops@hisabche.test',
    )

    const healthRes = await app!.inject({ method: 'GET', url: '/api/health' })
    expect(healthRes.statusCode).toBe(200)
    expect(healthRes.headers['x-hisabche-edge-proxy']).toBe('direct')
    expect(healthRes.headers['x-hisabche-rate-limit']).toBe('disabled')
    expect(healthRes.headers['x-hisabche-cache-bypass']).toBe('1')
    expect(healthRes.headers['cache-control']).toBe('no-store')
    expect(healthRes.headers['strict-transport-security']).toContain('max-age=31536000')

    // Non-admin write receives 503 SERVICE_READ_ONLY with custom maintenance notice
    const blockedWrite = await app!.inject({
      method: 'POST',
      url: '/api/invoices',
      payload: {},
    })
    expect(blockedWrite.statusCode).toBe(503)
    expect(blockedWrite.json()).toMatchObject({
      error: 'SERVICE_READ_ONLY',
      reason: 'maintenance',
      message: 'Planned maintenance window',
    })
  })
})
