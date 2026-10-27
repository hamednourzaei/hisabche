// ============================================
// packages/validation/src/__tests__/sync-identity.test.ts
//
// Tests for sync identity helper (N-44):
// 1. Async storage returning Promise: second call after simulated restart returns SAME id.
// 2. Two retries of same outbox entry produce same batchId.
// 3. Legacy non-UUID clientId maps deterministically to a valid RFC4122 UUID.
// 4. Sync storage still functions for synchronous environments.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import {
  _resetCachedDeviceIdForTesting,
  deriveStableBatchId,
  getPersistentDeviceId,
  getPersistentDeviceIdAsync,
  type AsyncDeviceIdStorage,
  type DeviceIdStorage,
} from '../schemas/sync-identity'

describe('N-44: Sync Identity & Mobile Storage Persistence', () => {
  beforeEach(() => {
    _resetCachedDeviceIdForTesting()
  })

  it('async storage whose getItem returns a Promise persists deviceId across restarts', async () => {
    const store = new Map<string, string>()

    const asyncStorage: AsyncDeviceIdStorage = {
      getItem: async (key: string) => {
        // Simulates async latency
        await new Promise((r) => setTimeout(r, 5))
        return store.get(key) ?? null
      },
      setItem: async (key: string, value: string) => {
        await new Promise((r) => setTimeout(r, 5))
        store.set(key, value)
      },
    }

    // First run (fresh install)
    const firstId = await getPersistentDeviceIdAsync(asyncStorage)
    expect(firstId).toBeDefined()
    expect(typeof firstId).toBe('string')
    expect(firstId.length).toBeGreaterThan(10)
    // Verify it was persisted to the async store
    expect(store.get('hisabche_sync_device_id')).toBe(firstId)

    // Simulate process restart by resetting in-memory cache
    _resetCachedDeviceIdForTesting()

    // Second run (restarted app)
    const secondId = await getPersistentDeviceIdAsync(asyncStorage)
    expect(secondId).toBe(firstId)
  })

  it('two retries of the same outbox entry produce the exact same batchId', () => {
    const outboxClientId = 'outbox-client-item-9941'
    const batchIdAttempt1 = deriveStableBatchId(outboxClientId)
    const batchIdAttempt2 = deriveStableBatchId(outboxClientId)

    expect(batchIdAttempt1).toBe(batchIdAttempt2)
    expect(batchIdAttempt1).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it('legacy non-UUID clientId maps deterministically to a valid RFC4122 UUID', () => {
    const legacyNumericId = '12345'
    const legacyPrefixId = 'txn_create_sale_554'

    const uuid1 = deriveStableBatchId(legacyNumericId)
    const uuid2 = deriveStableBatchId(legacyPrefixId)

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    expect(uuid1).toMatch(uuidRegex)
    expect(uuid2).toMatch(uuidRegex)

    // Deterministic: repeat produces exact same output
    expect(deriveStableBatchId(legacyNumericId)).toBe(uuid1)
    expect(deriveStableBatchId(legacyPrefixId)).toBe(uuid2)
  })

  it('sync storage works seamlessly for synchronous environments', () => {
    const store = new Map<string, string>()
    const syncStorage: DeviceIdStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    }

    const id1 = getPersistentDeviceId(syncStorage)
    expect(store.get('hisabche_sync_device_id')).toBe(id1)

    _resetCachedDeviceIdForTesting()

    const id2 = getPersistentDeviceId(syncStorage)
    expect(id2).toBe(id1)
  })
})
