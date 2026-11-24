// ============================================
// backend/src/__tests__/admin-infrastructure.test.ts
//
// Tests for Admin Infrastructure & Nginx Control Service, Routes & Runtime Hooks.
// Verifies toggle state transitions, default values, schema bounds, Nginx
// directive generation, authentication guards, and live Fastify runtime headers.
// ============================================

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import {
  buildNginxConfigDirectives,
  updateInfrastructureSettingsSchema,
} from '@hisabche/validation'
import { adminInfrastructureService } from '../services/admin/admin-infrastructure.service'

describe('AdminInfrastructureService & Runtime Enforcement', () => {
  let app: FastifyInstance | null = null

  beforeAll(async () => {
    const { buildServer } = await import('../index')
    app = await buildServer({ testRuntime: true })
    await app.ready()
  })

  afterAll(async () => {
    adminInfrastructureService.resetToDefaults()
    if (app) await app.close()
  })

  beforeEach(() => {
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
    expect(settings.updatedBy).toBe('system')
  })

  it('updates toggle states, renders matching Nginx directives, and tracks actor metadata', async () => {
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

    const nginxBlock = buildNginxConfigDirectives(updated)
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

  it('rejects unauthenticated requests to infrastructure control endpoints over HTTP', async () => {
    const getRes = await app!.inject({
      method: 'GET',
      url: '/api/admin/infrastructure/settings',
    })
    expect(getRes.statusCode).toBe(401)

    const putRes = await app!.inject({
      method: 'PUT',
      url: '/api/admin/infrastructure/settings',
      payload: { rateLimitingEnabled: false },
    })
    expect(putRes.statusCode).toBe(401)
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
