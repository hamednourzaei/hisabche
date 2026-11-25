// ============================================
// packages/validation/src/schemas/universal-core/imei-rma-vin.domain.ts
//
// Shared pure domain rules for:
//   - G45: IMEI Luhn validation & workspace/local blacklist check
//   - G44: RMA warranty/return disposition routing
//   - G47: Vehicle VIN normalization & 17-char validation
// ============================================

export function isValidImeiLuhn(raw: string): boolean {
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 15) return false
  let sum = 0
  for (let i = 0; i < 15; i += 1) {
    let d = Number(digits[i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

export interface ImeiBlacklistEntry {
  readonly imei: string
  readonly reason: string
  readonly reportedAt: string
}

export function checkImeiBlacklist(
  rawImei: string,
  blacklist: readonly ImeiBlacklistEntry[],
): { blocked: boolean; entry: ImeiBlacklistEntry | null; validLuhn: boolean } {
  const normalized = rawImei.replace(/\D/g, '')
  const validLuhn = isValidImeiLuhn(normalized)
  const hit = blacklist.find((b) => b.imei.replace(/\D/g, '') === normalized) ?? null
  return { blocked: hit !== null, entry: hit, validLuhn }
}

export type RmaCondition = 'defective_doa' | 'repairable' | 'damaged_customer' | 'sealed_resellable'
export type RmaResolution =
  'vendor_rma_claim' | 'repair_bench' | 'scrap_writeoff' | 'restock_sellable'

export function resolveRmaDisposition(
  condition: RmaCondition,
  underWarranty: boolean,
): RmaResolution {
  if (condition === 'sealed_resellable') return 'restock_sellable'
  if (condition === 'defective_doa' && underWarranty) return 'vendor_rma_claim'
  if (condition === 'repairable') return 'repair_bench'
  return 'scrap_writeoff'
}

export function normalizeVin(raw: string): { valid: boolean; vin: string } {
  const vin = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  // Standard ISO 3779 VIN: 17 chars, excluding I, O, Q
  const valid = /^[A-HJ-NPR-Z0-9]{17}$/.test(vin)
  return { valid, vin }
}
