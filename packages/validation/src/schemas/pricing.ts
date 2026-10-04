// ⚠️ SHARED: the server quotes with this and the invoice builder prices a picked
// product with this — one arithmetic, so a promotion cannot mean one thing on
// the screen and another on the server. Moved here from
// backend/src/services/commerce/pricing.domain.ts on 4 October 2026.
// ============================================
// Capability #19, #114, #115, #116, #117, #120 — pricing and promotion.
// Engine N1.
//
// ⚠️ WHAT THIS IS NOT: A SECOND PLACE THAT COMPUTES A LINE TOTAL.
//
// `computeInvoiceMoney` in `@hisabche/validation` owns the arithmetic of an
// invoice line, and it is the only place it happens. This module answers a
// question that happens BEFORE it: «what should this line be priced at?» — the
// base price, any price-list override, and any promotion that applies. It
// returns a NUMBER and the reasons behind it. The invoice math is untouched, and
// `applyPrice` deliberately produces exactly the shape `computeInvoiceMoney`
// already accepts, so there is nothing to re-derive downstream.
//
// ⚠️ WHY THE SERVER OWNS THE PRICE, WHICH IS THE POINT OF THE WHOLE ENGINE.
//
// Today a client sends `item.unitPrice` and the server takes it. The comment in
// `invoice.service.ts` about deriving money from the lines is true — the TOTAL is
// re-derived — but the PRICE is still the client's. A client that sends
// `unitPrice: 1` for a 5,000,000 item produces an invoice whose lines foot
// correctly and whose total is wrong, with nothing anywhere reporting an error.
//
// So every rule here has the same shape: the client asks «what is this priced at
// with this context», the server answers with a number and its reasons, and the
// client sends THAT. A price is not something a client gets to assert.
//
// ⚠️ PROMOTIONS ARE CAPPED, AND A CAP CANNOT BE OVERRIDDEN BY A RULE.
//
// `RulesEngine` already exists and can propose a 3% loyalty discount. What it
// deliberately cannot do is perform it — its own header says «a rule produces a
// DECISION, it never performs one». This module is where a proposal becomes a
// number, and the cap lives HERE: a promotion that would take a line below its
// floor is clamped and the reason says so. Without that, a badly-configured
// promotion sells below cost and the shop finds out at year-end.
//
// ⚠️ STACKING IS EXPLICIT, NOT ACCIDENTAL.
//
// Two promotions both applying is a policy question, not a sum. Stacking modes
// are declared per promotion: `exclusive` (the best single one wins — the usual
// default, because stacking a 10%-off-season with a 5%-loyalty on the same line
// is usually a mistake), `stacking` (they multiply, and the total is still
// capped). The default is `exclusive` because the failure of stacking is silent
// and the failure of not stacking is a conversation the shop can have.
// ============================================

import { z } from 'zod'

/** How a price is expressed. Matches the `CURRENCY_CODES` policy elsewhere. */
export type PricingCurrency = 'AFN' | 'USD' | 'PKR' | 'IRR' | 'IRT' | (string & {})

/** Which side of the trade this price is for. Direction decides the arithmetic. */
export type PriceKind = 'sale' | 'purchase'

export interface PriceRequest {
  productId: string
  kind: PriceKind
  /** The list the customer is being quoted, when one applies. */
  priceListId?: string | null
  /** The customer, for customer-specific lists and loyalty. */
  customerId?: string | null
  quantity: number
  /** What the invoice already says, so drift can be reported. */
  requestedUnitPrice?: number | undefined
}

/** Everything the engine knows about a product's pricing. */
export interface ProductPricing {
  productId: string
  /** The base price, the price on the product row. */
  baseUnitPrice: number
  /** Per-list overrides. Absent means the base price applies. */
  listPrices?: readonly { priceListId: string; unitPrice: number }[]
  /**
   * The floor below which no promotion may take the price. ⚠️ Optional, and
   * ABSENT MEANS NO FLOOR — not zero. A shop that has not configured a floor
   * gets promotions applied as written, because inventing a cost-based floor
   * from buy_price would silently clamp every promotion and nobody could say
   * why.
   */
  floorUnitPrice?: number | undefined
}

export type PromotionKind = 'percentage' | 'fixed_amount' | 'bundle'

/** How a promotion combines with others on the same line. */
export type StackingMode = 'exclusive' | 'stacking'

export interface Promotion {
  id: string
  kind: PromotionKind
  /** `exclusive` by default — see the header. */
  stacking: StackingMode
  /** Percentage for `percentage`, an amount for `fixed_amount`. */
  value: number
  /** Null = applies to everything. Otherwise the products it covers. */
  productIds?: readonly string[] | null
  /** Null = applies to everyone. Otherwise the customers it covers. */
  customerIds?: readonly string[] | null
  /** Null = always. Otherwise a `YYYY-MM-DD` window. */
  validFrom?: string | null
  validTo?: string | null
  /** The lowest this promotion may take the price, independent of the floor. */
  minPriceAfter?: number | undefined
}

export type PricingRuleCode =
  /** The requested quantity is not usable for a price. */
  | 'PRICE_QUANTITY_INVALID'
  /** The product has no base price at all. */
  | 'PRICE_BASE_MISSING'
  /** A bundle promotion that names products the request does not cover. */
  | 'PROMO_BUNDLE_INCOMPLETE'

export interface AppliedPromotion {
  id: string
  kind: PromotionKind
  /** What it took off, in the same units as the price. */
  discountMinor: number
  /** True when the floor stopped it. The cap is never silent. */
  clampedByFloor: boolean
}

/** A price, and every reason it is that number. */
export interface PriceQuote {
  productId: string
  kind: PriceKind
  /** Minor units. The invoice engine takes minor units too, so nothing rounds twice. */
  unitPriceMinor: number
  baseUnitPriceMinor: number
  applied: AppliedPromotion[]
  /**
   * ⚠️ Set when `requestedUnitPrice` differed. A client sending a different
   * number is not an error here — but it IS a fact the server must be able to
   * see, or the first bug this engine prevents is the second one it misses.
   */
  driftFromRequest?: { requestedMinor: number; quotedMinor: number } | undefined
  problems: { code: PricingRuleCode; detail: string }[]
}

const toMinor = (value: number): number => Math.round((Number.isFinite(value) ? value : 0) * 100)
const fromMinor = (value: number): number => value / 100

/** Is this promotion live on `asOf`? An absent window means always. */
export function isLiveOn(promotion: Promotion, asOf: string): boolean {
  const day = asOf.slice(0, 10)
  if (promotion.validFrom && day < promotion.validFrom) return false
  if (promotion.validTo && day > promotion.validTo) return false
  return true
}

/**
 * Does this promotion cover this product and this customer?
 *
 * ⚠️ A CUSTOMER-ONLY PROMOTION DOES NOT COVER A WALK-IN.
 *
 * The first version read `if (promotion.customerIds && request.customerId) {…} else
 * { return true }`, which means: promotion is restricted to customers, request
 * has no customer → falls through to `true`. So every VIP discount applied to
 * every cash sale over the counter — which is precisely the population a
 * customer-restricted promotion is meant to exclude.
 *
 * The rule is: an absent `customerId` on the REQUEST satisfies nothing. It is not
 * evidence of membership, and a discount scoped to named customers must not fall
 * back to everyone.
 */
export function covers(promotion: Promotion, request: PriceRequest): boolean {
  if (promotion.productIds && !promotion.productIds.includes(request.productId)) return false

  if (promotion.customerIds) {
    if (!request.customerId) return false
    return promotion.customerIds.includes(request.customerId)
  }

  return true
}

/**
 * The base price for a request, before promotions.
 *
 * ⚠️ A PRICE LIST OVERRIDE BEATS THE BASE, and the list is chosen by the
 * request, never derived from the client. The product row is the fallback so a
 * shop with no price lists works exactly as it does today.
 */
export function basePriceFor(
  pricing: ProductPricing,
  request: PriceRequest,
): { minor: number; problems: { code: PricingRuleCode; detail: string }[] } {
  const problems: { code: PricingRuleCode; detail: string }[] = []

  if (!Number.isFinite(request.quantity) || request.quantity <= 0) {
    problems.push({ code: 'PRICE_QUANTITY_INVALID', detail: `${request.quantity}` })
    return { minor: 0, problems }
  }

  if (request.priceListId) {
    const override = pricing.listPrices?.find((l) => l.priceListId === request.priceListId)
    if (override) return { minor: toMinor(override.unitPrice), problems }
  }

  if (!Number.isFinite(pricing.baseUnitPrice)) {
    problems.push({ code: 'PRICE_BASE_MISSING', detail: pricing.productId })
    return { minor: 0, problems }
  }

  return { minor: toMinor(pricing.baseUnitPrice), problems }
}

/**
 * Quote a price: base, promotions, floor, and the reasons.
 *
 * ⚠️ The floor is applied LAST, after every discount, so no combination of
 * promotions can go under it. Applying it per-promotion would let a second
 * promotion push the price back below the floor that the first one honoured.
 */
export function quotePrice(
  request: PriceRequest,
  pricing: ProductPricing,
  promotions: readonly Promotion[],
  asOf: string,
): PriceQuote {
  const base = basePriceFor(pricing, request)
  const applicable = promotions.filter((p) => isLiveOn(p, asOf) && covers(p, request))

  const exclusive = applicable.filter((p) => p.stacking === 'exclusive')
  const stacking = applicable.filter((p) => p.stacking === 'stacking')

  let priceMinor = base.minor
  const applied: AppliedPromotion[] = []

  // ⚠️ Exclusive promotions compete and the BEST single one wins — the same
  // ladder rule `approval.domain` uses for amount thresholds. Applying them in
  // sequence would make the result depend on the order the shop happened to
  // type them in.
  if (exclusive.length > 0) {
    const winner = exclusive.reduce((best, candidate) =>
      discountOf(candidate, priceMinor) > discountOf(best, priceMinor) ? candidate : best,
    )
    const discount = discountOf(winner, priceMinor)
    if (discount > 0) {
      priceMinor -= discount
      applied.push({
        id: winner.id,
        kind: winner.kind,
        discountMinor: discount,
        clampedByFloor: false,
      })
    }
  }

  for (const promotion of stacking) {
    const discount = discountOf(promotion, priceMinor)
    if (discount <= 0) continue
    priceMinor -= discount
    applied.push({
      id: promotion.id,
      kind: promotion.kind,
      discountMinor: discount,
      clampedByFloor: false,
    })
  }

  // ⚠️ THE FLOOR, applied once, after everything.
  const floorMinor = pricing.floorUnitPrice === undefined ? null : toMinor(pricing.floorUnitPrice)
  const floor = floorMinor ?? null
  let clampedByFloor = false

  if (floor !== null && priceMinor < floor) {
    priceMinor = floor
    clampedByFloor = true
  }
  for (const promotion of promotions) {
    const min = promotion.minPriceAfter
    if (min === undefined) continue
    const minMinor = toMinor(min)
    if (priceMinor < minMinor) {
      priceMinor = minMinor
      clampedByFloor = true
    }
  }

  if (clampedByFloor && applied.length > 0) {
    // ⚠️ The cap is never silent. A promotion that did not apply in full is a
    // fact about the shop's configuration, and it belongs in the reasons.
    applied[applied.length - 1] = { ...applied[applied.length - 1]!, clampedByFloor: true }
  }

  const quote: PriceQuote = {
    productId: request.productId,
    kind: request.kind,
    unitPriceMinor: priceMinor,
    baseUnitPriceMinor: base.minor,
    applied,
    problems: base.problems,
  }

  if (request.requestedUnitPrice !== undefined) {
    const requested = toMinor(request.requestedUnitPrice)
    if (requested !== priceMinor) {
      quote.driftFromRequest = { requestedMinor: requested, quotedMinor: priceMinor }
    }
  }

  return quote
}

/** What one promotion takes off, never below zero. */
function discountOf(promotion: Promotion, priceMinor: number): number {
  const raw =
    promotion.kind === 'percentage'
      ? Math.round((priceMinor * promotion.value) / 100)
      : toMinor(promotion.value)
  return Math.max(0, Math.min(raw, priceMinor))
}

/**
 * Apply quotes to invoice items.
 *
 * ⚠️ A LINE WITH NO QUOTE COMES BACK UNPRICED, not at zero.
 *
 * The first version wrote `unitPrice: quote ? … : 0`, which makes an unpriced
 * line FREE rather than obviously wrong — the invoice foots, the total is
 * plausible, and the shop gave the goods away. A zero price is the one number
 * here that is both plausible and catastrophic, so it is never a fallback.
 *
 * The caller gets `null` and must decide: refuse the line, or ask again.
 */
export function applyPrice(
  items: readonly {
    productId: string
    quantity: number
    requestedUnitPrice?: number | undefined
  }[],
  quotes: readonly PriceQuote[],
): {
  productId: string
  quantity: number
  unitPrice: number | null
  reason?: 'NO_QUOTE'
}[] {
  return items.map((item) => {
    const quote = quotes.find((q) => q.productId === item.productId)
    if (!quote) {
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: null,
        reason: 'NO_QUOTE' as const,
      }
    }
    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: fromMinor(quote.unitPriceMinor),
    }
  })
}

// ─── What a person may save ─────────────────────────────────────────────────
//
// ⚠️ `bundle` IS NOT SAVABLE. The engine carries the kind, but pricing a
// bundle needs the whole basket and this quotes one line; saving one would
// store a promotion that silently behaves as a fixed amount.

export const SAVABLE_PROMOTION_KINDS = ['percentage', 'fixed_amount'] as const

const isoDayOrNull = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .default(null)

export const promotionInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    kind: z.enum(SAVABLE_PROMOTION_KINDS),
    /** Percent (0–100] for `percentage`; an amount in `currency` for `fixed_amount`. */
    value: z.number().positive(),
    /** Required for `fixed_amount`: an amount without a currency is not an amount. */
    currency: z.string().trim().length(3).nullable().default(null),
    stacking: z.enum(['exclusive', 'stacking']).default('exclusive'),
    /** Null = every product. An empty list is refused: it would cover nothing. */
    productIds: z.array(z.string().uuid()).min(1).max(500).nullable().default(null),
    /** Null = every customer, walk-ins included. A list excludes walk-ins. */
    customerIds: z.array(z.string().uuid()).min(1).max(500).nullable().default(null),
    validFrom: isoDayOrNull,
    validTo: isoDayOrNull,
  })
  .superRefine((value, ctx) => {
    if (value.kind === 'percentage' && value.value > 100) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'PROMOTION_PERCENT_OVER_100' })
    }
    if (value.kind === 'fixed_amount' && !value.currency) {
      ctx.addIssue({ code: 'custom', path: ['currency'], message: 'PROMOTION_CURRENCY_REQUIRED' })
    }
    if (value.validFrom && value.validTo && value.validFrom > value.validTo) {
      ctx.addIssue({ code: 'custom', path: ['validTo'], message: 'PROMOTION_WINDOW_INVERTED' })
    }
  })

export type PromotionInput = z.infer<typeof promotionInputSchema>

/** A saved promotion as the API returns it. */
export interface SavedPromotion extends PromotionInput {
  id: string
  isActive: boolean
  createdAt: string
}

/**
 * The saved promotions that can price a line in `currency`, as the engine's
 * own `Promotion`.
 *
 * ⚠️ A fixed amount in another currency is LEFT OUT, not converted: «50 off»
 * saved in dollars is not 50 afghani off.
 */
export function promotionsFor(saved: readonly SavedPromotion[], currency: string): Promotion[] {
  return saved
    .filter((promotion) => promotion.isActive)
    .filter((promotion) => promotion.kind === 'percentage' || promotion.currency === currency)
    .map((promotion) => ({
      id: promotion.id,
      kind: promotion.kind,
      stacking: promotion.stacking,
      value: promotion.value,
      productIds: promotion.productIds,
      customerIds: promotion.customerIds,
      validFrom: promotion.validFrom,
      validTo: promotion.validTo,
    }))
}
