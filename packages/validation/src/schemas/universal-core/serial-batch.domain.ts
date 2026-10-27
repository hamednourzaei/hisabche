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

export type SerialStatus = 'in_stock' | 'sold' | 'returned' | 'defective'

export interface SerialRecord {
  readonly serialNumber: string
  readonly productId: string
  readonly status: SerialStatus
  readonly warehouseId?: string | null | undefined
  readonly soldInvoiceId?: string | null | undefined
}

export type SerialSaleValidation =
  | {
      readonly valid: true
      readonly serialNumber: string
    }
  | {
      readonly valid: false
      readonly serialNumber: string
      readonly error: 'SERIAL_ALREADY_SOLD' | 'SERIAL_NOT_IN_STOCK' | 'SERIAL_NOT_FOUND'
    }

/**
 * Validate that a serial number is available for sale.
 * Vector: sell S1 -> valid; sell S1 again -> refused; return S1 -> valid again.
 */
export function validateSerialSale(
  serial: SerialRecord | null | undefined,
  serialNumber: string,
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
