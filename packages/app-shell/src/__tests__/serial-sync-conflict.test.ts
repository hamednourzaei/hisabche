jest.mock('@/shared/lib/api', () => ({ API_BASE_URL: 'http://localhost:3001', apiClient: {} }))
jest.mock('@/shared/lib/bridge', () => ({ bridge: {} }))

import { handleSerialSyncConflict } from '../features/sync/sync-engine'

describe('V61 §2.5 offline serial sync conflict', () => {
  it('flags duplicate offline serial sale as PENDING_REVIEW without overwriting', () => {
    const conflict = handleSerialSyncConflict({
      serialNumber: 'IMEI-999',
      conflictingInvoiceId: 'inv-server-1',
    })
    expect(conflict).toEqual({
      serialNumber: 'IMEI-999',
      conflictState: 'PENDING_REVIEW',
      reason: 'DUPLICATE_OFFLINE_SERIAL_SALE',
      serverStatus: 'sold',
      conflictingInvoiceId: 'inv-server-1',
    })
  })
})
