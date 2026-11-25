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

// ─── G60: Barcode Label Templates (ZPL / HTML) ───────────────────────────────

export interface BarcodeLabelInput {
  readonly barcode: string
  readonly title: string
  readonly priceLabel: string
  readonly sku?: string | undefined
  readonly variantLabel?: string | undefined
  readonly expiryDate?: string | undefined
}

function escapeZpl(value: string): string {
  return value
    .replace(/[\^~\\]/g, ' ')
    .trim()
    .slice(0, 64)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Builds a Zebra ZPL-II thermal label (50x30mm / 400x240 dots at 203dpi). */
export function buildBarcodeLabelZpl(input: BarcodeLabelInput): string {
  const title = escapeZpl(input.title)
  const price = escapeZpl(input.priceLabel)
  const barcode = escapeZpl(input.barcode)
  const meta = [input.sku, input.variantLabel, input.expiryDate].filter(Boolean).join(' · ')
  const lines = [
    '^XA',
    '^CI28',
    `^FO24,18^A0N,26,26^FD${title}^FS`,
    ...(meta ? [`^FO24,48^A0N,20,20^FD${escapeZpl(meta)}^FS`] : []),
    `^FO24,78^BY2,2,70^BCN,70,Y,N,N^FD${barcode}^FS`,
    `^FO24,182^A0N,28,28^FD${price}^FS`,
    '^XZ',
  ]
  return lines.join('\n')
}

/** Builds a self-contained HTML snippet for browser/Electron label printing. */
export function buildBarcodeLabelHtml(input: BarcodeLabelInput): string {
  const meta = [input.sku, input.variantLabel, input.expiryDate].filter(Boolean).join(' · ')
  return [
    '<div class="hisabche-barcode-label" style="width:50mm;padding:2mm;border:1px dashed #ccc;font-family:sans-serif">',
    `  <div style="font-size:11px;font-weight:700">${escapeHtml(input.title)}</div>`,
    meta ? `  <div style="font-size:9px;color:#555">${escapeHtml(meta)}</div>` : '',
    `  <div style="font-family:monospace;font-size:12px;margin:4px 0">*${escapeHtml(input.barcode)}*</div>`,
    `  <div style="font-size:12px;font-weight:700">${escapeHtml(input.priceLabel)}</div>`,
    '</div>',
  ]
    .filter(Boolean)
    .join('\n')
}
