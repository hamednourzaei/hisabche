// ============================================
// packages/validation/src/schemas/tax-return.domain.ts
//
// OPTION 29: AFGHANISTAN REVENUE DEPARTMENT (ARD) RETURN FORMATS
//
// Generates official ARD Business Receipts Tax (BRT) and Wage Withholding formats.
// Integer minor units, Solar Hijri / Gregorian date mapping.
// ============================================

export interface ArdBrtReturnRow {
  readonly tin: string
  readonly businessName: string
  readonly quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'
  readonly solarYear: number
  readonly grossReceiptsMinor: number
  readonly exemptReceiptsMinor: number
  readonly taxableReceiptsMinor: number
  readonly brtRatePercent: number // typically 2% or 4%
  readonly brtOwedMinor: number
}

/**
 * Format ARD BRT quarterly filing dataset.
 */
export function formatArdBrtReturn(input: {
  tin: string
  businessName: string
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'
  solarYear: number
  grossReceiptsMinor: number
  exemptReceiptsMinor: number
  brtRatePercent?: number
}): ArdBrtReturnRow {
  const rate = input.brtRatePercent ?? 4 // Default 4% standard BRT
  const taxable = Math.max(0, input.grossReceiptsMinor - input.exemptReceiptsMinor)
  const brtOwed = Math.round((taxable * rate) / 100)

  return {
    tin: input.tin,
    businessName: input.businessName,
    quarter: input.quarter,
    solarYear: input.solarYear,
    grossReceiptsMinor: input.grossReceiptsMinor,
    exemptReceiptsMinor: input.exemptReceiptsMinor,
    taxableReceiptsMinor: taxable,
    brtRatePercent: rate,
    brtOwedMinor: brtOwed,
  }
}
