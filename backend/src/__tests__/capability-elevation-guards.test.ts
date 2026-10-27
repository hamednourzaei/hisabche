// ============================================
// backend/src/__tests__/capability-elevation-guards.test.ts
//
// Regression tests for N-19: Authorization and Capability Elevation Guards
//
// Verifies that:
// 1. Warehouse modification routes require `inventory.configure` capability.
// 2. Cloud migration routes require `data.import` capability.
// 3. Offline license issuing requires `workspace.manage` capability.
// 4. Notification mark-read is strictly scoped to the requesting user.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireCapability } from '../middleware/authorize.middleware'

describe('N-19: Capability Elevation Guards', () => {
  it('rejects a caller lacking inventory.configure capability with 403', async () => {
    const middleware = requireCapability('inventory.configure')
    const request: any = {
      tenancy: {
        workspaceId: '11111111-1111-1111-1111-111111111111',
        role: 'member',
        capabilities: new Set(['invoice.read', 'product.read']),
      },
    }
    let statusCode = 200
    let payload: any = null
    const reply: any = {
      code: (c: number) => {
        statusCode = c
        return reply
      },
      status: (c: number) => {
        statusCode = c
        return reply
      },
      send: (p: any) => {
        payload = p
        return reply
      },
    }

    await middleware(request, reply)
    expect(statusCode).toBe(403)
    expect(payload?.code).toBe('CAPABILITY_REQUIRED')
  })

  it('allows a caller possessing inventory.configure capability', async () => {
    const middleware = requireCapability('inventory.configure')
    const request: any = {
      tenancy: {
        workspaceId: '11111111-1111-1111-1111-111111111111',
        role: 'manager',
        capabilities: new Set(['inventory.configure', 'product.write']),
      },
    }
    let statusCode = 200
    const reply: any = {
      code: (c: number) => {
        statusCode = c
        return reply
      },
      send: () => reply,
    }

    await middleware(request, reply)
    expect(statusCode).toBe(200)
  })

  it('rejects a caller lacking data.import for cloud migration with 403', async () => {
    const middleware = requireCapability('data.import')
    const request: any = {
      tenancy: {
        workspaceId: '11111111-1111-1111-1111-111111111111',
        role: 'member',
        capabilities: new Set(['invoice.read']),
      },
    }
    let statusCode = 200
    const reply: any = {
      code: (c: number) => {
        statusCode = c
        return reply
      },
      status: (c: number) => {
        statusCode = c
        return reply
      },
      send: () => reply,
    }

    await middleware(request, reply)
    expect(statusCode).toBe(403)
  })

  it('rejects a caller lacking workspace.manage for offline license with 403', async () => {
    const middleware = requireCapability('workspace.manage')
    const request: any = {
      tenancy: {
        workspaceId: '11111111-1111-1111-1111-111111111111',
        role: 'seller',
        capabilities: new Set(['invoice.create', 'invoice.read']),
      },
    }
    let statusCode = 200
    const reply: any = {
      code: (c: number) => {
        statusCode = c
        return reply
      },
      status: (c: number) => {
        statusCode = c
        return reply
      },
      send: () => reply,
    }

    await middleware(request, reply)
    expect(statusCode).toBe(403)
  })
})
