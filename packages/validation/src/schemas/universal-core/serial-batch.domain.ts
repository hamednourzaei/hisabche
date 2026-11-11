// ============================================
// packages/validation/src/schemas/universal-core/serial-batch.domain.ts
//
// G-10: SERIAL NUMBER & BATCH AT SALE
//
// Electronics, mobile phones, vehicles, medicines.
// An invoice line may carry serial number(s).
// Selling an already sold serial is strictly refused.
// Returns restore the serial to 'in_stock'.
// ============================================

export type SerialStatus = 'in_stock' | 'reserved' | 'sold' | 'returned' | 'defective' | 'scrapped'

export interface SerialRecord {
  readonly serialNumber: string
  readonly productId: string
  readonly status: SerialStatus
  readonly warehouseId?: string | null | undefined
  readonly soldInvoiceId?: string | null | undefined
  readonly reservedForCustomerId?: string | null | undefined
}

export type SerialSaleValidation =
  | {
      readonly valid: true
      readonly serialNumber: string
    }
  | {
      readonly valid: false
      readonly serialNumber: string
      readonly error:
        | 'SERIAL_ALREADY_SOLD'
        | 'SERIAL_NOT_IN_STOCK'
        | 'SERIAL_NOT_FOUND'
        | 'SERIAL_RESERVED_FOR_ANOTHER_CUSTOMER'
    }

/**
 * Validate that a serial number is available for sale.
 * Vector: sell S1 -> valid; sell S1 again -> refused; return S1 -> valid again.
 * A unit held for customer A may only be sold to customer A (unless released first).
 */
export function validateSerialSale(
  serial: SerialRecord | null | undefined,
  serialNumber: string,
  buyerCustomerId?: string | null,
): SerialSaleValidation {
  if (!serial) {
    return {
      valid: false,
      serialNumber,
      error: 'SERIAL_NOT_FOUND',
    }
  }

  if (serial.status === 'sold') {
    return {
      valid: false,
      serialNumber,
      error: 'SERIAL_ALREADY_SOLD',
    }
  }

  if (serial.status === 'reserved') {
    if (buyerCustomerId && serial.reservedForCustomerId === buyerCustomerId) {
      return { valid: true, serialNumber }
    }
    return {
      valid: false,
      serialNumber,
      error: 'SERIAL_RESERVED_FOR_ANOTHER_CUSTOMER',
    }
  }

  if (serial.status !== 'in_stock') {
    return {
      valid: false,
      serialNumber,
      error: 'SERIAL_NOT_IN_STOCK',
    }
  }

  return {
    valid: true,
    serialNumber,
  }
}

/** Parse pasted/scanned IMEIs (newline, comma, whitespace separated) with duplicate detection. */
export function parseBulkImeis(rawText: string): {
  readonly unique: string[]
  readonly duplicates: string[]
} {
  const tokens = rawText
    .split(/[\r\n,;|\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const seen = new Set<string>()
  const duplicates: string[] = []
  const unique: string[] = []
  for (const token of tokens) {
    if (seen.has(token)) {
      duplicates.push(token)
    } else {
      seen.add(token)
      unique.push(token)
    }
  }
  return { unique, duplicates }
}

/** Route returned phone/serial unit by physical condition. */
export function routeReturnedSerial(
  serial: SerialRecord,
  conditionCode: 'sealed' | 'opened' | 'used' | 'damaged' | 'defective' | 'incomplete',
): SerialRecord {
  if (conditionCode === 'sealed' || conditionCode === 'opened') {
    return { ...serial, status: 'in_stock', soldInvoiceId: null, reservedForCustomerId: null }
  }
  return { ...serial, status: 'returned', soldInvoiceId: null, reservedForCustomerId: null }
}

export interface OfflineSerialConflict {
  readonly serialNumber: string
  readonly conflictState: 'PENDING_REVIEW'
  readonly reason: 'DUPLICATE_OFFLINE_SERIAL_SALE'
  readonly serverStatus: SerialStatus
  readonly conflictingInvoiceId: string | null
}

/** Two offline/online devices sold the same IMEI -> never overwrite silently; flag PENDING_REVIEW. */
export function resolveOfflineSerialSyncConflict(input: {
  readonly serialNumber: string
  readonly serverStatus: SerialStatus
  readonly conflictingInvoiceId: string | null
}): OfflineSerialConflict | null {
  if (input.serverStatus !== 'sold') return null
  return {
    serialNumber: input.serialNumber,
    conflictState: 'PENDING_REVIEW',
    reason: 'DUPLICATE_OFFLINE_SERIAL_SALE',
    serverStatus: input.serverStatus,
    conflictingInvoiceId: input.conflictingInvoiceId,
  }
}

/**
 * Mark a serial as sold upon invoice completion.
 */
export function markSerialSold(serial: SerialRecord, invoiceId: string): SerialRecord {
  return {
    ...serial,
    status: 'sold',
    soldInvoiceId: invoiceId,
  }
}

/**
 * Mark a serial as returned, restoring it to sellable stock.
 */
export function markSerialReturned(serial: SerialRecord): SerialRecord {
  return {
    ...serial,
    status: 'in_stock',
    soldInvoiceId: null,
  }
}

export interface TraceableBatch {
  readonly batchNumber: string
  readonly productId: string
  readonly expiryDate: string // YYYY-MM-DD
  readonly remainingQuantity: number
}

/**
 * FEFO (First Expired, First Out) batch sorting for automatic allocation.
 */
export function sortBatchesFEFO(batches: readonly TraceableBatch[]): TraceableBatch[] {
  return [...batches]
    .filter((b) => b.remainingQuantity > 0)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
}
