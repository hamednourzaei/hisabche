// ============================================
// backend/src/__tests__/offline-license-routes.test.ts
// Offline Licence Issuance, Revocation and Device Routes Tests
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import fastify, { FastifyInstance } from 'fastify'
import { generateOfflineLicenseKeyPair, verifyOfflineLicense } from '@hisabche/validation'
import { billingRoutes } from '../routes/billing.routes'

const WS_IRR = '11111111-1111-1111-1111-111111111111'
const WS_AFN = '22222222-2222-2222-2222-222222222222'
const USER_ID = '33333333-3333-3333-3333-333333333333'
const TEST_KEYPAIR = generateOfflineLicenseKeyPair()

// State for mock database
const dbState = {
  subscription: {
    plan: 'OFFLINE',
    status: 'active',
    period_end: '2027-10-20T00:00:00.000Z',
  } as { plan: string; status: string; period_end: string | null } | null,
  licenses: [] as Array<Record<string, unknown>>,
  devices: [] as Array<Record<string, unknown>>,
  events: [] as Array<Record<string, unknown>>,
  logs: [] as Array<Record<string, unknown>>,
}

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => {
      // The key table before offline-licence-keys-01 has run.
      if (table === 'offline_license_signing_keys') {
        return {
          select: () => ({
            is: () => ({
              maybeSingle: async () => ({
                data: null,
                error: { code: '42P01', message: 'relation does not exist' },
              }),
            }),
          }),
        }
      }
      if (table === 'subscriptions') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: dbState.subscription,
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'devices') {
        return {
          upsert: (payload: Record<string, unknown>) => {
            const existing = dbState.devices.find((d) => d.device_id === payload.device_id)
            if (existing) Object.assign(existing, payload)
            else dbState.devices.push(payload)
            return {
              select: () => ({
                single: async () => ({ data: payload, error: null }),
              }),
              data: payload,
              error: null,
            }
          },
          update: (payload: Record<string, unknown>) => ({
            eq: (col1: string, val1: unknown) => ({
              eq: (col2: string, val2: unknown) => {
                const target = dbState.devices.find((d) => d[col1] === val1 && d[col2] === val2)
                if (target) Object.assign(target, payload)
                return { error: null }
              },
            }),
          }),
          select: () => ({
            eq: (_col: string, val: unknown) => ({
              order: () => ({
                data: dbState.devices.filter((d) => d.workspace_id === val),
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'offline_licenses') {
        return {
          insert: (payload: Record<string, unknown>) => {
            dbState.licenses.push(payload)
            return { error: null }
          },
          update: (payload: Record<string, unknown>) => ({
            eq: (col1: string, val1: unknown) => ({
              eq: (col2: string, val2: unknown) => {
                const target = dbState.licenses.find((l) => l[col1] === val1 && l[col2] === val2)
                if (target) Object.assign(target, payload)
                return { error: null }
              },
            }),
          }),
          select: (cols: string) => ({
            eq: (_col: string, val: unknown) => {
              const filtered = dbState.licenses.filter((l) => l.workspace_id === val)
              if (cols === 'license_id') {
                return {
                  not: () => ({
                    data: filtered.filter((l) => l.revoked_at != null),
                    error: null,
                  }),
                }
              }
              return {
                order: () => ({
                  data: filtered,
                  error: null,
                }),
              }
            },
          }),
        }
      }
      if (table === 'subscription_events') {
        return {
          insert: (payload: Record<string, unknown>) => {
            dbState.events.push(payload)
            return { error: null }
          },
        }
      }
      if (table === 'license_logs') {
        return {
          insert: (payload: Record<string, unknown>) => {
            dbState.logs.push(payload)
            return { error: null }
          },
        }
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      }
    },
  },
}))

// Mock auth & tenancy middleware
vi.mock('../middleware/auth.middleware', () => ({
  authenticate: async (request: Record<string, unknown>) => {
    request.userId = USER_ID
  },
}))

vi.mock('../middleware/workspace.middleware', () => ({
  requireWorkspaceContext: async (request: Record<string, unknown>) => {
    const wsId = (request.headers as Record<string, string>)?.['x-workspace-id'] || WS_IRR
    request.tenancy = {
      workspaceId: wsId,
      role: 'owner',
      userId: USER_ID,
    }
  },
}))

describe('Offline Licence Endpoints', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    delete process.env.OFFLINE_LICENSE_PRIVATE_KEY
    delete process.env.OFFLINE_LICENSE_KEY_ID

    dbState.subscription = {
      plan: 'OFFLINE',
      status: 'active',
      period_end: '2027-10-20T00:00:00.000Z',
    }
    dbState.licenses = []
    dbState.devices = []
    dbState.events = []

    app = fastify()
    await app.register(billingRoutes)
    await app.ready()
  })

  it('POST /api/billing/offline-license returns 503 LICENSE_SIGNING_NOT_CONFIGURED when the key table is not migrated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/offline-license',
      payload: { label: 'POS Terminal 1' },
      headers: { 'x-workspace-id': WS_IRR },
    })

    expect(res.statusCode).toBe(503)
    const body = res.json()
    expect(body.code).toBe('LICENSE_SIGNING_NOT_CONFIGURED')
  })

  it('POST /api/billing/offline-license returns 403 OFFLINE_PLAN_REQUIRED when workspace plan is not OFFLINE', async () => {
    process.env.OFFLINE_LICENSE_PRIVATE_KEY = TEST_KEYPAIR.secretKeyHex
    dbState.subscription = {
      plan: 'FREE',
      status: 'active',
      period_end: null,
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/offline-license',
      payload: { label: 'Shop Desktop' },
      headers: { 'x-workspace-id': WS_IRR },
    })

    expect(res.statusCode).toBe(403)
    const body = res.json()
    expect(body.code).toBe('OFFLINE_PLAN_REQUIRED')
  })

  it('POST /api/billing/offline-license issues a valid cryptographically signed licence with configured key', async () => {
    process.env.OFFLINE_LICENSE_PRIVATE_KEY = TEST_KEYPAIR.secretKeyHex
    process.env.OFFLINE_LICENSE_KEY_ID = 'v1'

    const targetDeviceId = '44444444-4444-4444-4444-444444444444'

    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/offline-license',
      payload: {
        deviceId: targetDeviceId,
        label: 'Main Shop PC',
        features: ['invoice.create', 'reports.view'],
      },
      headers: { 'x-workspace-id': WS_IRR },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.license).toBeDefined()
    expect(body.license.signature).toBeDefined()
    expect(body.license.payload.workspace_id).toBe(WS_IRR)
    expect(body.license.payload.device_id).toBe(targetDeviceId)
    expect(body.license.payload.plan).toBe('OFFLINE')
    expect(body.license.payload.version).toBe(1)
    expect(body.license.payload.key_id).toBe('v1')

    // Verify licence cryptographically using noble validator
    const verifyRes = verifyOfflineLicense({
      license: body.license,
      publicKey: TEST_KEYPAIR.publicKey,
      workspaceId: WS_IRR,
      deviceId: targetDeviceId,
      now: '2026-11-01T00:00:00.000Z',
    })
    expect(verifyRes.valid).toBe(true)
    expect(verifyRes.verdict).toBe('VALID')

    // Device was registered
    expect(dbState.devices.some((d) => d.device_id === targetDeviceId)).toBe(true)
    // Subscription event was recorded
    expect(dbState.events.some((e) => e.event === 'licence_issued')).toBe(true)
  })

  it('POST /api/billing/devices/activate registers device successfully', async () => {
    const devId = '55555555-5555-5555-5555-555555555555'
    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/devices/activate',
      payload: { deviceId: devId, label: 'Warehouse Tablet' },
      headers: { 'x-workspace-id': WS_AFN },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.device.device_id).toBe(devId)
    expect(body.device.workspace_id).toBe(WS_AFN)
  })

  it('POST /api/billing/devices/:deviceId/release releases device from workspace', async () => {
    const devId = '66666666-6666-6666-6666-666666666666'
    dbState.devices.push({
      device_id: devId,
      workspace_id: WS_IRR,
      released_at: null,
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/billing/devices/${devId}/release`,
      headers: { 'x-workspace-id': WS_IRR },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.released_at).toBeDefined()
    expect(dbState.events.some((e) => e.event === 'device_released')).toBe(true)
  })

  it('POST /api/billing/offline-license/:licenseId/revoke and GET /api/billing/offline-license/revocations', async () => {
    const licId = '77777777-7777-7777-7777-777777777777'
    dbState.licenses.push({
      license_id: licId,
      workspace_id: WS_IRR,
      revoked_at: null,
    })

    const revokeRes = await app.inject({
      method: 'POST',
      url: `/api/billing/offline-license/${licId}/revoke`,
      headers: { 'x-workspace-id': WS_IRR },
    })
    expect(revokeRes.statusCode).toBe(200)
    expect(revokeRes.json().success).toBe(true)

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/billing/offline-license/revocations',
      headers: { 'x-workspace-id': WS_IRR },
    })
    expect(listRes.statusCode).toBe(200)
    expect(listRes.json().revocations).toContain(licId)
  })
})
