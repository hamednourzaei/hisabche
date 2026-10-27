// ============================================
// apps/mobile/src/__tests__/sync-runner-identity.test.ts
//
// Tests for mobile sync runner identity persistence (N-44):
// Verifies that pushVersioned awaits the persistent device ID from AsyncStorage
// and transmits both deviceId and stable batchId to /sync/push.
// ============================================

jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {},
    },
  },
}))

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(),
}))

import AsyncStorage from '@react-native-async-storage/async-storage'
import { _resetCachedDeviceIdForTesting } from '@hisabche/validation'
import { pushVersioned } from '../features/offline/sync-runner'
import { apiClient } from '../shared/lib/api'

describe('Mobile Sync Runner: Persistent Device ID', () => {
  beforeEach(async () => {
    _resetCachedDeviceIdForTesting()
    await AsyncStorage.clear()
    jest.clearAllMocks()
  })

  it('awaits the persistent device ID from AsyncStorage and pushes to /sync/push', async () => {
    const PERSISTED_DEVICE_ID = '99999999-8888-4444-8888-777777777777'
    await AsyncStorage.setItem('hisabche_sync_device_id', PERSISTED_DEVICE_ID)

    const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: { success: true } })

    const queueEntry = {
      clientId: 'outbox-mutation-1234',
      entity: 'customer' as const,
      operation: 'update' as const,
      payload: {
        id: 'cust-abc-1',
        name: 'Updated Name',
        version: 5,
      },
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: 'pending' as const,
      lastError: null,
      userId: 'user-1',
      workspaceId: 'ws-1',
    }

    await pushVersioned(queueEntry)

    expect(postSpy).toHaveBeenCalledTimes(1)
    interface PushBody {
      deviceId: string
      batchId: string
      mutations: Array<{ mutationId: string; expectedVersion: number }>
    }
    const [endpoint, body] = postSpy.mock.calls[0] as [string, PushBody]

    expect(endpoint).toBe('/sync/push')
    // Must contain the awaited persistent deviceId from AsyncStorage
    expect(body.deviceId).toBe(PERSISTED_DEVICE_ID)
    // Must contain a valid RFC4122 batchId derived from clientId
    expect(body.batchId).toBeDefined()
    expect(body.batchId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(body.mutations).toHaveLength(1)
    expect(body.mutations[0]?.mutationId).toBe('outbox-mutation-1234')
    expect(body.mutations[0]?.expectedVersion).toBe(5)
  })
})
