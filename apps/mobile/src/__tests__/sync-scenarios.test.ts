// ============================================
// apps/mobile/src/__tests__/sync-scenarios.test.ts
//
// Mobile sync runner scenario test suite under unstable transport:
// Verifies client-side behavior for network drops, retries with stable batch IDs,
// and permanent rejection handling.
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

describe('Mobile Sync Runner: Integrity Scenarios (Chaos Transport)', () => {
  const DEVICE_ID = '77777777-6666-4555-8444-333333333333'

  beforeEach(async () => {
    _resetCachedDeviceIdForTesting()
    await AsyncStorage.clear()
    await AsyncStorage.setItem('hisabche_sync_device_id', DEVICE_ID)
    jest.clearAllMocks()
  })

  it('Scenario D: network timeout during push rejects and allows safe retry', async () => {
    jest.spyOn(apiClient, 'post').mockRejectedValueOnce(new Error('Network timeout (ETIMEDOUT)'))

    const entry = {
      clientId: 'mobile-outbox-001',
      entity: 'customer' as const,
      operation: 'create' as const,
      payload: { id: 'cust-1', name: 'Mobile Customer' },
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: 'pending' as const,
      lastError: null,
      userId: 'user-m-1',
      workspaceId: 'ws-m-1',
    }

    await expect(pushVersioned(entry)).rejects.toThrow('Network timeout (ETIMEDOUT)')
  })

  it('Scenario E: retry transmits the exact same mutation ID and persistent device ID', async () => {
    const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: { success: true } })

    const entry = {
      clientId: 'mobile-outbox-001',
      entity: 'customer' as const,
      operation: 'create' as const,
      payload: { id: 'cust-1', name: 'Mobile Customer' },
      createdAt: new Date().toISOString(),
      attempts: 1,
      status: 'pending' as const,
      lastError: 'Network timeout (ETIMEDOUT)',
      userId: 'user-m-1',
      workspaceId: 'ws-m-1',
    }

    await pushVersioned(entry)

    expect(postSpy).toHaveBeenCalledTimes(1)
    const [endpoint, body] = postSpy.mock.calls[0] as [
      string,
      { deviceId: string; batchId: string; mutations: Array<{ mutationId: string }> },
    ]
    expect(endpoint).toBe('/sync/push')
    expect(body.deviceId).toBe(DEVICE_ID)
    expect(body.mutations[0]?.mutationId).toBe('mobile-outbox-001')
  })

  it('Scenario F: server refusal on delete is bubbled for permanent queue resolution', async () => {
    const refusalErr = new Error('Deletes are not accepted through /sync/push') as Error & {
      status?: number
    }
    refusalErr.status = 400
    jest.spyOn(apiClient, 'post').mockRejectedValueOnce(refusalErr)

    const entry = {
      clientId: 'mobile-outbox-del',
      entity: 'customer' as const,
      operation: 'delete' as const,
      payload: { id: 'cust-del-1' },
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: 'pending' as const,
      lastError: null,
      userId: 'user-m-1',
      workspaceId: 'ws-m-1',
    }

    await expect(pushVersioned(entry)).rejects.toThrow(
      'Deletes are not accepted through /sync/push',
    )
  })
})
