import { z } from 'zod'
import { currencyCodeSchema } from './common.schema'

export const createRfqSchema = z.object({
  title: z.string().trim().min(1).max(200),
})

export const quotationLineSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
  unit_price_minor: z.number().int().nonnegative(),
})

export const createQuotationSchema = z.object({
  supplier_id: z.string().uuid(),
  currency: currencyCodeSchema,
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  lead_time_days: z.number().int().nonnegative().default(0),
  lines: z.array(quotationLineSchema).min(1),
})

export const createPurchaseContractPriceSchema = z.object({
  contract_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  product_id: z.string().uuid(),
  agreed_unit_price_minor: z.number().int().nonnegative(),
  currency: currencyCodeSchema,
  valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  valid_to: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
})

export interface QuotationLike {
  id: string
  supplierId: string
  currency: string
  validUntil: string
  totalMinor: number
  lines: Array<{ productId: string; quantity: number; unitPriceMinor: number }>
}

export function compareSupplierQuotations(quotations: readonly QuotationLike[]) {
  const byTotal = [...quotations].sort((a, b) => a.totalMinor - b.totalMinor)
  const bestByLine = new Map<
    string,
    { quotationId: string; supplierId: string; unitPriceMinor: number }
  >()
  for (const q of quotations) {
    for (const l of q.lines) {
      const existing = bestByLine.get(l.productId)
      if (!existing || l.unitPriceMinor < existing.unitPriceMinor) {
        bestByLine.set(l.productId, {
          quotationId: q.id,
          supplierId: q.supplierId,
          unitPriceMinor: l.unitPriceMinor,
        })
      }
    }
  }
  return { byTotal, bestByLine: Object.fromEntries(bestByLine) }
}

export function canConvertQuotationToPo(
  quotation: { validUntil: string; status: string },
  todayIso: string,
): { ok: true } | { ok: false; code: 'QUOTATION_EXPIRED' | 'QUOTATION_NOT_OPEN' } {
  if (quotation.status !== 'submitted') {
    return { ok: false, code: 'QUOTATION_NOT_OPEN' }
  }
  if (quotation.validUntil.slice(0, 10) < todayIso.slice(0, 10)) {
    return { ok: false, code: 'QUOTATION_EXPIRED' }
  }
  return { ok: true }
}

export interface PurchaseContractPriceRule {
  productId: string
  agreedUnitPriceMinor: number
  currency: string
  validFrom: string
  validTo: string
}

export function resolvePurchaseContractPrice(
  rules: readonly PurchaseContractPriceRule[],
  productId: string,
  todayIso: string,
  enteredUnitPriceMinor?: number | null | undefined,
): { matched: boolean; defaultPriceMinor: number | null; deviationFlag: boolean } {
  const day = todayIso.slice(0, 10)
  const active = rules.find(
    (r) =>
      r.productId === productId && r.validFrom.slice(0, 10) <= day && r.validTo.slice(0, 10) >= day,
  )
  if (!active) {
    return { matched: false, defaultPriceMinor: null, deviationFlag: false }
  }
  const deviationFlag =
    enteredUnitPriceMinor !== null &&
    enteredUnitPriceMinor !== undefined &&
    enteredUnitPriceMinor !== active.agreedUnitPriceMinor
  return { matched: true, defaultPriceMinor: active.agreedUnitPriceMinor, deviationFlag }
}
