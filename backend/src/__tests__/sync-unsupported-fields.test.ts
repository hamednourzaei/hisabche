// ============================================
// backend/src/__tests__/sync-unsupported-fields.test.ts
//
// Proves Domain 3.1:
// - Sending customer `name` instead of `full_name` is rejected with UNSUPPORTED_FIELD
//   and never silently reported as `applied`.
// - Sending valid `full_name` with sync envelope metadata succeeds cleanly.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { upsertCustomer } = vi.hoisted(() => ({
  upsertCustomer: vi.fn(async () => ({ version: 2 })),
}))

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'sync_mutations') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
          insert: async () => ({ error: null }),
        }
      }
      if (table === 'customers') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: { id: 'cust-1', version: 2, sync_version: 10 },
                error: null,
              }),
            }),
          }),
          upsert: () => ({
            select: () => ({
              single: async () => ({
                data: { id: 'cust-1', version: 2, sync_version: 10 },
                error: null,
              }),
            }),
          }),
        }
      }
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: { sync_version: 10 }, error: null }),
              }),
            }),
          }),
        }),
      }
    },
    rpc: upsertCustomer,
  },
}))

const { SyncService } = await import('../services/sync.service')

describe('SyncService unknown field rejection (no silent data loss)', () => {
  const actor = {
    workspaceId: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    role: 'seller' as const,
    deviceId: 'device-1',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects customer payload with legacy `name` instead of `full_name`', async () => {
    const svc = new SyncService()
    const res = await svc.push(actor, [
      {
        mutationId: 'mut-legacy-name',
        entityType: 'customer',
        entityId: '33333333-3333-4333-8333-333333333333',
        operation: 'update',
        payload: { id: '33333333-3333-4333-8333-333333333333', name: 'Ahmad' },
        expectedVersion: 1,
      },
    ])

    expect(res.results).toHaveLength(1)
    expect(res.results[0]?.status).toBe('rejected')
    expect(res.results[0]?.errorCode).toBe('validation_failed')
    expect(res.results[0]?.errorMessage).toContain('UNSUPPORTED_FIELD')
    expect(res.results[0]?.errorMessage).toContain('name')
  })

  it('accepts customer payload with canonical `full_name` and envelope metadata', async () => {
    const svc = new SyncService()
    const res = await svc.push(actor, [
      {
        mutationId: 'mut-valid-fullname',
        entityType: 'customer',
        entityId: '33333333-3333-4333-8333-333333333333',
        operation: 'create',
        payload: {
          id: '33333333-3333-4333-8333-333333333333',
          full_name: 'Ahmad',
          workspace_id: actor.workspaceId,
          origin: 'local',
        },
      },
    ])

    expect(res.results).toHaveLength(1)
    expect(res.results[0]?.status).toBe('applied')
  })
})
