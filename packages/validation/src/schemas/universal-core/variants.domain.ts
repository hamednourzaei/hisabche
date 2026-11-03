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
