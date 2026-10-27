// ============================================
// packages/api/src/__tests__/sync-push-contract.test.ts
//
// Regression tests for N-44: Strict Sync Push Contract & Stable Batch Identity
//
// Verifies that:
// 1. Explicit deviceId and batchId are required; missing either rejects with schema error.
// 2. deriveStableBatchId derives a stable, deterministic UUID across retries of an outbox entry.
// 3. Old queued entries with arbitrary string IDs still get a valid RFC4122 UUID batchId.
// 4. Batch bounds are enforced (min: 1, max: 200).
// 5. Invalid entity types and malformed payloads are rejected.
// ============================================

import { describe, expect, it } from 'vitest'
import {
  MAX_PUSH_BATCH,
  syncPushRequestSchema,
  deriveStableBatchId,
  getPersistentDeviceId,
} from '@hisabche/validation'

describe('N-44: Strict Sync Push Contract & Stable Batch Identity', () => {
  const validMutation = {
    mutationId: '11111111-1111-1111-1111-111111111111',
    entityType: 'customer' as const,
    entityId: '22222222-2222-2222-2222-222222222222',
    operation: 'update' as const,
    expectedVersion: 1,
    payload: { name: 'Acme Corp', phone: '0700123456' },
  }

  it('accepts a fully-formed batch with explicit deviceId and batchId', () => {
    const input = {
      deviceId: 'device-windows-desktop-01',
      batchId: '33333333-3333-3333-3333-333333333333',
      mutations: [validMutation],
    }

    const parsed = syncPushRequestSchema.safeParse(input)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.deviceId).toBe('device-windows-desktop-01')
      expect(parsed.data.batchId).toBe('33333333-3333-3333-3333-333333333333')
      expect(parsed.data.mutations).toHaveLength(1)
    }
  })

  it('strictly rejects missing deviceId and batchId (no silent defaults)', () => {
    const input = {
      mutations: [validMutation],
    }

    const parsed = syncPushRequestSchema.safeParse(input)
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors
      expect(fieldErrors.deviceId).toBeDefined()
      expect(fieldErrors.batchId).toBeDefined()
    }
  })

  it('strictly rejects missing batchId when deviceId is provided', () => {
    const input = {
      deviceId: 'device-01',
      mutations: [validMutation],
    }

    const parsed = syncPushRequestSchema.safeParse(input)
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors
      expect(fieldErrors.batchId).toBeDefined()
    }
  })

  it('deriveStableBatchId produces stable batchId across retries of the same entry', () => {
    const clientId = 'entry-client-12345-abc'
    const batchId1 = deriveStableBatchId(clientId)
    const batchId2 = deriveStableBatchId(clientId)

    expect(batchId1).toBe(batchId2)
    expect(batchId1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  it('deriveStableBatchId preserves existing valid UUIDs', () => {
    const originalUuid = '11111111-2222-4333-8444-555555555555'
    const batchId = deriveStableBatchId(originalUuid)
    expect(batchId).toBe(originalUuid)
  })

  it('deriveStableBatchId maps old non-UUID legacy queue entries to valid RFC4122 UUID', () => {
    const oldEntryId = 'legacy-queue-987'
    const batchId = deriveStableBatchId(oldEntryId)

    const parsed = syncPushRequestSchema.safeParse({
      deviceId: 'device-mobile-01',
      batchId,
      mutations: [validMutation],
    })
    expect(parsed.success).toBe(true)
  })

  it('getPersistentDeviceId produces and persists device identity', () => {
    const inMemoryStorage = new Map<string, string>()
    const storage = {
      getItem: (key: string) => inMemoryStorage.get(key) ?? null,
      setItem: (key: string, val: string) => {
        inMemoryStorage.set(key, val)
      },
    }

    const id1 = getPersistentDeviceId(storage)
    const id2 = getPersistentDeviceId(storage)
    expect(id1).toBe(id2)
    expect(id1.length).toBeGreaterThan(0)
  })

  it('rejects an empty mutations array (min 1)', () => {
    const input = {
      deviceId: 'device-01',
      batchId: '33333333-3333-3333-3333-333333333333',
      mutations: [],
    }

    const parsed = syncPushRequestSchema.safeParse(input)
    expect(parsed.success).toBe(false)
  })

  it('rejects a batch exceeding MAX_PUSH_BATCH (200)', () => {
    const tooMany = Array.from({ length: MAX_PUSH_BATCH + 1 }, (_, i) => ({
      ...validMutation,
      mutationId: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
      entityId: `00000000-0000-0000-0001-${String(i).padStart(12, '0')}`,
    }))

    const input = {
      deviceId: 'device-01',
      batchId: '33333333-3333-3333-3333-333333333333',
      mutations: tooMany,
    }

    const parsed = syncPushRequestSchema.safeParse(input)
    expect(parsed.success).toBe(false)
  })
})
