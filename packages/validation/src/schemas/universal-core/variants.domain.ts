// ============================================
// packages/validation/src/schemas/universal-core/variants.domain.ts
//
// G-05: PRODUCT VARIANTS (Size, Colour, Style, Capacity)
//
// Clothing, footwear, furniture, kitchenware, computer parts.
// A template product defines common title, brand, description, category.
// Variant rows hold specific combinations with their own SKU, barcode, price override.
// ============================================

export interface VariantAttribute {
  readonly name: string
  readonly value: string
}

export interface ProductVariant {
  readonly id: string
  readonly templateProductId: string
  readonly sku: string
  readonly barcode?: string | null | undefined
  readonly attributes: readonly VariantAttribute[]
  readonly priceOverrideMinor?: number | null | undefined
  readonly costOverrideMinor?: number | null | undefined
  readonly isActive: boolean
}

export interface TemplateProduct {
  readonly id: string
  readonly name: string
  readonly isTemplate: true
  readonly baseSellPriceMinor: number
  readonly baseBuyPriceMinor: number
  readonly unit: string
}

/**
 * Resolve the effective sell price of a variant.
 * If priceOverrideMinor is null or undefined, inherits from template.
 */
export function resolveVariantPrice(
  templatePriceMinor: number,
  variantOverrideMinor?: number | null,
): number {
  if (typeof variantOverrideMinor === 'number' && Number.isFinite(variantOverrideMinor)) {
    return variantOverrideMinor
  }
  return templatePriceMinor
}

/**
 * Build display title for a variant (e.g. "T-Shirt - Size: L, Color: Blue")
 */
export function formatVariantTitle(
  templateName: string,
  attributes: readonly VariantAttribute[],
): string {
  if (!attributes.length) return templateName
  const attrStr = attributes.map((a) => `${a.name}: ${a.value}`).join(', ')
  return `${templateName} (${attrStr})`
}

/**
 * Build a canonical attribute key for deduplication and lookups.
 * E.g. "color:blue|size:l"
 */
export function canonicalAttributeKey(attributes: readonly VariantAttribute[]): string {
  return [...attributes]
    .map((a) => ({ name: a.name.trim().toLowerCase(), value: a.value.trim().toLowerCase() }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((a) => `${a.name}:${a.value}`)
    .join('|')
}

// ─── Binding a document line to a variant (V53 P2: legacy NULL) ──────────────────────────────
//
// A line of a NEW document names the variant it sells or buys. Historical lines keep `variant_id = NULL`
// and are never re-validated or re-mapped: no variant is ever invented for them.

export type VariantBindingCode =
  | 'VARIANT_REQUIRED'
  | 'VARIANT_NOT_FOUND'
  | 'VARIANT_WRONG_PRODUCT'
  | 'VARIANT_WRONG_WORKSPACE'
  | 'VARIANT_INACTIVE'
  | 'VARIANT_ON_PRODUCT_WITHOUT_VARIANTS'

export interface VariantBindingRow {
  readonly id: string
  readonly workspaceId: string
  readonly templateProductId: string
  readonly isActive: boolean
}

export type VariantBindingResult =
  | { readonly ok: true; readonly variantId: string | null }
  | { readonly ok: false; readonly code: VariantBindingCode }

/**
 * Decides whether a NEW line may carry `variantId` for `productId`.
 *
 * `variantsOfProduct` is every variant row of the product in ANY state (active or not) the caller read for
 * this workspace; an inactive one is found, then refused, so the reason is not "not found".
 *   • the product has active variants → one must be named (the parent alone is never sold: that is how a
 *     parent and its variants end up counted twice);
 *   • the variant must exist, belong to this product and this workspace, and be active;
 *   • a variant named on a product that has none is refused, never ignored.
 */
export function checkVariantBinding(input: {
  readonly workspaceId: string
  readonly productId: string
  readonly variantId: string | null | undefined
  readonly variantsOfProduct: readonly VariantBindingRow[]
  /** Variants anywhere in the workspace with the requested id, to tell "wrong product" from "not found". */
  readonly requestedVariant?: VariantBindingRow | null | undefined
}): VariantBindingResult {
  const { workspaceId, productId, variantId, variantsOfProduct, requestedVariant } = input
  const hasActiveVariants = variantsOfProduct.some((v) => v.isActive)

  if (!variantId) {
    return hasActiveVariants
      ? { ok: false, code: 'VARIANT_REQUIRED' }
      : { ok: true, variantId: null }
  }

  const found = variantsOfProduct.find((v) => v.id === variantId) ?? requestedVariant ?? null
  if (!found) return { ok: false, code: 'VARIANT_NOT_FOUND' }
  if (found.workspaceId !== workspaceId) return { ok: false, code: 'VARIANT_WRONG_WORKSPACE' }
  if (found.templateProductId !== productId) return { ok: false, code: 'VARIANT_WRONG_PRODUCT' }
  if (!found.isActive) return { ok: false, code: 'VARIANT_INACTIVE' }
  return { ok: true, variantId }
}

// ─── Selling a variant (V55 P2) ──────────────────────────────────────────────
//
// The product-level refusal lives in the costing core's locked consumption
// (`mayIssue` on product-keyed layers). The VARIANT-level one is this rule: a
// sale line that names a variant must be covered by the movements that name
// THAT variant, not by the product's total. Two lines of one document selling
// the same variant add up before the comparison, so «2 + 2 of the last 3» is
// refused even though each line alone would pass.
//
// The caller decides the POLICY (negative stock allowed or not) and calls this
// only in `block` mode — the same split `mayIssue` keeps between the policy
// question and the arithmetic question.

export interface VariantSaleDemand {
  readonly variantId: string
  readonly warehouseId: string | null
  readonly quantity: number
}

/**
 * Structural subset of `VariantStockRow` (variant-stock.ts), restated here so
 * this file stays import-free — variant-stock.ts imports THIS file.
 */
export interface VariantStockRowLike {
  readonly variantId: string
  readonly warehouseId: string | null
  readonly quantity: number
}

/**
 * Why a stock move or a sale was refused. Declared HERE (variant-stock.ts
 * re-exports it) because the sale rule below and the move rule there share it
 * and this file must stay import-free.
 */
export type VariantStockRefusal = 'VARIANT_STOCK_NOT_ENOUGH_UNASSIGNED' | 'VARIANT_STOCK_NOT_ENOUGH'

/**
 * Refuse when a demanded sale quantity exceeds what the variant's movements
 * say is on hand, in that warehouse (or in total when no warehouse is named).
 * Returns the shared `VARIANT_STOCK_NOT_ENOUGH` code; null means covered.
 */
export function checkVariantSalesAvailability(input: {
  readonly demands: readonly VariantSaleDemand[]
  readonly stock: readonly VariantStockRowLike[]
}): VariantStockRefusal | null {
  const totals = new Map<string, number>()
  for (const demand of input.demands) {
    if (!(demand.quantity > 0)) continue
    const key = `${demand.variantId}|${demand.warehouseId ?? ''}`
    totals.set(key, (totals.get(key) ?? 0) + demand.quantity)
  }

  for (const [key, demanded] of totals) {
    const separator = key.lastIndexOf('|')
    const variantId = key.slice(0, separator)
    const warehouseId = key.slice(separator + 1) || null
    const onHand = input.stock
      .filter((row) => row.variantId === variantId)
      .filter((row) => (warehouseId ? row.warehouseId === warehouseId : true))
      .reduce((sum, row) => sum + row.quantity, 0)
    if (demanded > onHand + 1e-9) return 'VARIANT_STOCK_NOT_ENOUGH'
  }
  return null
}

export interface VariantReservationHoldLike {
  readonly variantId: string | null
  readonly warehouseId: string
  readonly quantity: number
  readonly status: 'active' | 'settled' | 'released' | 'expired'
}

/**
 * Clothing ATP check (8.1): on-hand variant stock MINUS active, unexpired variant holds.
 * Uses the exact same rule as V58 stock_reservations (`onHand - activeReserved`) so a reserved
 * garment size/color cannot be sold twice across counter/online channels.
 */
export function checkVariantAtpAvailability(input: {
  readonly demands: readonly VariantSaleDemand[]
  readonly stock: readonly VariantStockRowLike[]
  readonly activeReservations: readonly VariantReservationHoldLike[]
}): VariantStockRefusal | null {
  const effectiveStock: VariantStockRowLike[] = [...input.stock]
  for (const hold of input.activeReservations) {
    if (hold.status !== 'active' || !hold.variantId || !(hold.quantity > 0)) continue
    effectiveStock.push({
      variantId: hold.variantId,
      warehouseId: hold.warehouseId,
      quantity: -hold.quantity,
    })
  }
  return checkVariantSalesAvailability({ demands: input.demands, stock: effectiveStock })
}

export interface ClothingVariantSummaryLine {
  readonly variantId: string
  readonly sku: string
  readonly attributes: readonly VariantAttribute[]
  readonly onHand: number
  readonly sold: number
  readonly revenueMinor: number | null
  readonly costMinor: number | null
}

export interface ClothingAttributeReportRow {
  readonly attributeName: string
  readonly attributeValue: string
  readonly onHand: number
  readonly sold: number
  /** Null when any included item lacks verified revenue or cost (unknown is not zero). */
  readonly marginMinor: number | null
}

/**
 * Clothing inventory & margin summary grouped by model attribute (size/colour/brand).
 * Unknown cost/revenue stays null — never defaulted to 0.
 */
export function summarizeVariantStockReport(
  lines: readonly ClothingVariantSummaryLine[],
  attributeName: string,
): ClothingAttributeReportRow[] {
  const grouped = new Map<
    string,
    { onHand: number; sold: number; revenue: number; cost: number; knownMargin: boolean }
  >()

  for (const line of lines) {
    const attr = line.attributes.find(
      (a) => a.name.trim().toLowerCase() === attributeName.trim().toLowerCase(),
    )
    const value = attr?.value.trim() || 'UNSPECIFIED'
    const acc = grouped.get(value) ?? {
      onHand: 0,
      sold: 0,
      revenue: 0,
      cost: 0,
      knownMargin: true,
    }
    acc.onHand += line.onHand
    acc.sold += line.sold
    if (line.revenueMinor === null || line.costMinor === null) {
      acc.knownMargin = false
    } else {
      acc.revenue += line.revenueMinor
      acc.cost += line.costMinor
    }
    grouped.set(value, acc)
  }

  return [...grouped.entries()].map(([attributeValue, acc]) => ({
    attributeName,
    attributeValue,
    onHand: acc.onHand,
    sold: acc.sold,
    marginMinor: acc.knownMargin ? acc.revenue - acc.cost : null,
  }))
}
