// ============================================
// backend/src/__tests__/admin-infrastructure.test.ts
//
// Tests for Admin Infrastructure & Nginx Control Service and Routes.
// Verifies toggle state transitions, default values, audit logging,
// and validation enforcement.
// ============================================

import { describe, expect, it, beforeEach } from 'vitest'
import { adminInfrastructureService } from '../services/admin/admin-infrastructure.service'
import { updateInfrastructureSettingsSchema } from '@hisabche/validation'

describe('AdminInfrastructureService', () => {
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

  it('updates toggle states and updates timestamp and actor', async () => {
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
    expect(updated.rateLimitBurst).toBe(50) // preserved default
    expect(updated.updatedBy).toBe('admin@hisabche.test')
    expect(new Date(updated.updatedAt!).getTime()).toBeGreaterThan(0)
  })

  it('validates schema bounds and rejects invalid values', () => {
    // Negative or zero rate limit
    const invalidRps = updateInfrastructureSettingsSchema.safeParse({
      rateLimitRps: 0,
    })
    expect(invalidRps.success).toBe(false)

    // Excessive rate limit
    const excessiveRps = updateInfrastructureSettingsSchema.safeParse({
      rateLimitRps: 20000,
    })
    expect(excessiveRps.success).toBe(false)

    // Maintenance notice too long
    const longNotice = updateInfrastructureSettingsSchema.safeParse({
      maintenanceNotice: 'x'.repeat(300),
    })
    expect(longNotice.success).toBe(false)

    // Valid partial
    const valid = updateInfrastructureSettingsSchema.safeParse({
      rateLimitingEnabled: false,
    })
    expect(valid.success).toBe(true)
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
})
