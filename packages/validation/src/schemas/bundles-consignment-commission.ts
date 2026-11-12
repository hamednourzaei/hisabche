import { z } from 'zod'

export const bundleItemInputSchema = z.object({
  component_product_id: z.string().uuid(),
  quantity: z.number().positive(),
})

export const upsertBundleItemsSchema = z.object({
  items: z.array(bundleItemInputSchema).min(1),
})

export const createConsignmentLotSchema = z.object({
  direction: z.enum(['in', 'out']),
  party_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
  unit_agreed_price_minor: z.number().int().nonnegative(),
  currency: z.string().min(3).max(8),
})

export interface BundleComponentDef {
  componentProductId: string
  quantity: number
  unitCostMinor: number | null
}

export function expandBundleStockAndCost(
  bundleQty: number,
  components: readonly BundleComponentDef[],
): {
  movements: Array<{ productId: string; quantity: number }>
  totalCostMinor: number | null
} {
  const movements = components.map((c) => ({
    productId: c.componentProductId,
    quantity: Number((bundleQty * c.quantity).toFixed(4)),
  }))

  let totalCostMinor: number | null = 0
  for (const c of components) {
    if (c.unitCostMinor === null) {
      totalCostMinor = null
      break
    }
    totalCostMinor += Math.round(bundleQty * c.quantity * c.unitCostMinor)
  }
  return { movements, totalCostMinor }
}

export interface ConsignmentLotLike {
  direction: 'in' | 'out'
  quantity: number
  unitCostMinor: number | null
  unitAgreedPriceMinor: number
  status: 'open' | 'settled' | 'returned'
}

export function evaluateConsignmentValuationAndPayable(
  lot: ConsignmentLotLike,
  soldQty: number,
): { ownedInventoryValueMinor: number | null; supplierPayableMinor: number } {
  const remaining = Math.max(0, lot.quantity - soldQty)
  if (lot.direction === 'in') {
    // Consignment-in is supplier-owned: excluded from our inventory value (0 owned).
    return {
      ownedInventoryValueMinor: 0,
      supplierPayableMinor: Math.round(soldQty * lot.unitAgreedPriceMinor),
    }
  }
  // Consignment-out stays owned until sold.
  return {
    ownedInventoryValueMinor:
      lot.unitCostMinor === null ? null : Math.round(remaining * lot.unitCostMinor),
    supplierPayableMinor: 0,
  }
}

export interface SellerCommissionDoc {
  sellerEmployeeId: string
  kind: 'sale' | 'return'
  revenueMinor: number
  costMinor: number | null
  ratePercent: number
  basis: 'revenue' | 'margin'
}

export function computeSellerCommission(docs: readonly SellerCommissionDoc[]): number | null {
  let totalMinor = 0
  for (const d of docs) {
    const sign = d.kind === 'return' ? -1 : 1
    if (d.basis === 'margin') {
      if (d.costMinor === null) return null
      const margin = d.revenueMinor - d.costMinor
      totalMinor += sign * Math.round((margin * d.ratePercent) / 100)
    } else {
      totalMinor += sign * Math.round((d.revenueMinor * d.ratePercent) / 100)
    }
  }
  return totalMinor
}
