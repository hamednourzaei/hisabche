jest.mock('@/shared/lib/api', () => ({ API_BASE_URL: 'http://localhost:3001', apiClient: {} }))
jest.mock('@/shared/lib/bridge', () => ({ bridge: {} }))

import { handleBookingSyncConflict } from '../features/sync/sync-engine'

describe('V61 §2.8 offline resource capacity race', () => {
  it('flags overlapping offline booking on sync as PENDING_REVIEW without dropping or double-booking', () => {
    const conflict = handleBookingSyncConflict({
      bookingId: 'bk-device-2',
      resourceId: 'res-1',
      startAt: '2026-11-12T10:00:00Z',
      endAt: '2026-11-12T11:00:00Z',
    })
    expect(conflict).toEqual({
      bookingId: 'bk-device-2',
      resourceId: 'res-1',
      startAt: '2026-11-12T10:00:00Z',
      endAt: '2026-11-12T11:00:00Z',
      conflictState: 'PENDING_REVIEW',
      reason: 'RESOURCE_SLOT_OVERLAP',
    })
  })
})
