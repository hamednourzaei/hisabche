// ============================================
// packages/validation/src/schemas/universal-core/pack-barcode.domain.ts
//
// G-16: PACK BARCODES & MULTI-UNIT SCANNING
//
// Scanning a wholesale case barcode adds the package unit quantity,
// converting directly to the base inventory unit.
// Vector: 2 cartons × 24 pieces = 48 pieces.
// ============================================

export interface PackBarcode {
  readonly barcode: string
  readonly productId: string
  readonly unitCode: string
  readonly conversionFactor: number // units per pack, e.g. 24
}

export interface PackScanResult {
  readonly productId: string
  readonly scannedUnit: string
  readonly packCount: number
  readonly baseQuantity: number
}

/**
 * Resolve scan result from a pack barcode.
 */
export function resolvePackScan(
  barcodeRecord: PackBarcode,
  scannedPacksCount: number = 1,
): PackScanResult {
  const count = Number.isFinite(scannedPacksCount) && scannedPacksCount > 0 ? scannedPacksCount : 1
  const baseQuantity = Math.round(count * barcodeRecord.conversionFactor)

  return {
    productId: barcodeRecord.productId,
    scannedUnit: barcodeRecord.unitCode,
    packCount: count,
    baseQuantity,
  }
}
