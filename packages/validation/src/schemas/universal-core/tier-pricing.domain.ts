// ============================================
// packages/validation/src/schemas/universal-core/tier-pricing.domain.ts
//
// WP-08 — QUANTITY-BREAK (TIERED) PRICING, SERVER AUTHORITATIVE.
//
// One quantity ladder decides the base unit price; the EXISTING quotePrice
// engine then owns floor, promotion and drift exactly as for every other line.
// This module never computes a line total and never applies a discount itself —
// it only answers «which unit price does this quantity earn?».
// ============================================

import {
  quotePrice,
  type PriceQuote,
  type PriceRequest,
  type ProductPricing,
  type Promotion,
} from '../pricing'

/** A quantity break: buying at least `minQty` units earns `unitPrice`. */
export interface QuantityBreak {
  readonly minQty: number
  /** Major-unit price, the same unit as `ProductPricing.baseUnitPrice`. */
  readonly unitPrice: number
}

export interface TieredQuoteResult extends PriceQuote {
  readonly tierMinQty: number | null
  readonly baseUnitPriceFromTier: boolean
}

/**
 * Select the best earned tier: the highest minQty not above `quantity`.
 * Returns null for an empty/invalid ladder — no silent zero price.
 */
export function tierUnitPrice(
  quantity: number,
  breaks: readonly QuantityBreak[],
): { minQty: number; unitPrice: number } | null {
  if (
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !Array.isArray(breaks) ||
    breaks.length === 0
  ) {
    return null
  }
  const valid = breaks.filter(
    (b) =>
      Number.isFinite(b.minQty) && b.minQty > 0 && Number.isFinite(b.unitPrice) && b.unitPrice > 0,
  )
  if (valid.length === 0) return null
  const earned = valid.filter((b) => quantity >= b.minQty).sort((a, b) => b.minQty - a.minQty)[0]
  return earned ? { minQty: earned.minQty, unitPrice: earned.unitPrice } : null
}

/**
 * Quote a line whose base price comes from a quantity break. The tier replaces
 * `baseUnitPrice` and every other rule (floor, promotions, drift) is delegated
 * to the one pricing engine. Client and server calling this with the same input
 * therefore get the same number.
 */
export function quoteTieredPrice(
  request: PriceRequest,
  base: ProductPricing,
  breaks: readonly QuantityBreak[],
  promotions: readonly Promotion[],
  asOf: string,
): TieredQuoteResult {
  const tier = tierUnitPrice(request.quantity, breaks)
  const pricing: ProductPricing = tier ? { ...base, baseUnitPrice: tier.unitPrice } : base
  const quote = quotePrice(request, pricing, promotions, asOf)
  return {
    ...quote,
    tierMinQty: tier ? tier.minQty : null,
    baseUnitPriceFromTier: tier !== null,
  }
}
