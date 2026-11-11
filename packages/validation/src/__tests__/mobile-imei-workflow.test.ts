import { describe, expect, it } from 'vitest'
import {
  markSerialReturned,
  markSerialSold,
  parseBulkImeis,
  resolveOfflineSerialSyncConflict,
  routeReturnedSerial,
  validateSerialSale,
  warrantyState,
  type SerialRecord,
} from '../index'

describe('8.3 Mobile Shop: IMEI Intake, Reservation Hold, Conflict & Warranty Handoff', () => {
  it('parses bulk IMEIs and flags duplicates clearly', () => {
    const parsed = parseBulkImeis(
      '356789012345671\n356789012345672, 356789012345671\n356789012345673',
    )
    expect(parsed.unique).toEqual(['356789012345671', '356789012345672', '356789012345673'])
    expect(parsed.duplicates).toEqual(['356789012345671'])
  })

  it('refuses reserved units for other buyers while allowing the holding customer', () => {
    const held: SerialRecord = {
      serialNumber: 'IMEI-001',
      productId: 'phone-1',
      status: 'reserved',
      reservedForCustomerId: 'cust-a',
    }
    expect(validateSerialSale(held, 'IMEI-001', 'cust-b')).toEqual({
      valid: false,
      serialNumber: 'IMEI-001',
      error: 'SERIAL_RESERVED_FOR_ANOTHER_CUSTOMER',
    })
    expect(validateSerialSale(held, 'IMEI-001', 'cust-a')).toEqual({
      valid: true,
      serialNumber: 'IMEI-001',
    })

    const sold = markSerialSold(held, 'inv-1')
    expect(validateSerialSale(sold, 'IMEI-001', 'cust-a')).toEqual({
      valid: false,
      serialNumber: 'IMEI-001',
      error: 'SERIAL_ALREADY_SOLD',
    })
  })

  it('routes offline duplicate IMEI sale conflicts to PENDING_REVIEW and handles returns by condition', () => {
    const conflict = resolveOfflineSerialSyncConflict({
      serialNumber: 'IMEI-001',
      serverStatus: 'sold',
      conflictingInvoiceId: 'inv-device-1',
    })
    expect(conflict).toMatchObject({
      serialNumber: 'IMEI-001',
      conflictState: 'PENDING_REVIEW',
      reason: 'DUPLICATE_OFFLINE_SERIAL_SALE',
    })

    const sold: SerialRecord = {
      serialNumber: 'IMEI-002',
      productId: 'phone-1',
      status: 'sold',
      soldInvoiceId: 'inv-2',
    }
    expect(routeReturnedSerial(sold, 'defective').status).toBe('returned')
    expect(routeReturnedSerial(sold, 'sealed').status).toBe('in_stock')
    expect(markSerialReturned(sold).status).toBe('in_stock')
    expect(warrantyState('2026-12-31', '2026-11-11')).toBe('active')
    expect(warrantyState(null, '2026-11-11')).toBe('unknown')
  })
})
