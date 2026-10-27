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
