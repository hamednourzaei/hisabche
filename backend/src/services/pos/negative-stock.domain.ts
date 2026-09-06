// ============================================
// backend/src/services/pos/negative-stock.domain.ts
//
// M2 — two tills, both offline, both right, and not enough stock.
//
// ---------------------------------------------------------------------------
// THE SCENARIO
//
//   Device A is offline. It believes stock is 5. It sells 4.
//   Device B is offline. It believes stock is 5. It sells 4.
//
// Both sales HAPPENED. Money changed hands twice, goods left the shelf twice,
// and a customer walked out with each. When the two devices sync, on-hand is
// −3.
//
// ---------------------------------------------------------------------------
// ⚠️ THE FOUR THINGS THAT ARE ABSOLUTELY FORBIDDEN (M2.4)
//
//   silent reject     — refusing the second sale erases money already taken
//   silent overwrite  — the later sale replacing the earlier loses one
//   silent delete     — same, with no record at all
//   silent correction — clamping stock to 0 hides that the shop oversold
//
// Every one of them is the same mistake: making the arithmetic tidy by
// destroying a record of something that really happened.
//
// So BOTH sales are recorded as financial events, on-hand is allowed to go
// negative (which Phase C already permits deliberately — «a negative on-hand
// is a real shortfall that has been recorded rather than clamped to zero»),
// and a CONFLICT is raised for a person to resolve.
//
// ---------------------------------------------------------------------------
// WHAT THIS MODULE IS, AND IS NOT
//
// It decides WHETHER a conflict is owed and describes it. It does not write
// stock, does not reject anything, and does not resolve anything — the whole
// point is that no code decides how an oversell is settled.
// ============================================

/** What a mutation did to one product, once it had been applied. */
export interface StockOutcome {
  productId: string
  /**
   * On-hand AFTER the movement was applied.
   *
   * Read back rather than predicted: the movement is applied by a trigger
   * over `stock_movements` (Phase C), and predicting the result in Node is
   * exactly the read-modify-write that phase removed.
   */
  onHandAfter: number
  /** What this mutation took. Positive — the direction is not carried here. */
  quantitySold: number
  /**
   * What the DEVICE believed when it made the sale, if it said.
   *
   * Evidence, not a control. A till that thought there were 5 and sold 4 acted
   * correctly on what it knew; recording that is what distinguishes an honest
   * oversell from a till selling stock it knew was not there.
   */
  deviceBelievedOnHand?: number | null | undefined
}

export interface NegativeStockBreach {
  productId: string
  /** The negative figure itself. Always < 0. */
  onHandAfter: number
  /** How many units were sold that the shop did not have. Always > 0. */
  shortfall: number
  quantitySold: number
  deviceBelievedOnHand: number | null
  /**
   * Did the device sell stock it already knew it did not have?
   *
   * `false` — the concurrent-offline case — is the honest one: the till acted
   * correctly on stale information. `true` means the sale was made against a
   * count the device itself said was insufficient, which is a different
   * problem and worth telling apart.
   */
  soldBeyondOwnBelief: boolean
}

/**
 * Which of these outcomes owe a conflict.
 *
 * ⚠️ ONLY A NEGATIVE ON-HAND QUALIFIES. Selling the last unit down to exactly
 * zero is a normal, correct sale — raising a conflict for it would bury the
 * real ones under a warning every time a shop sold out.
 */
export function detectBreaches(outcomes: readonly StockOutcome[]): NegativeStockBreach[] {
  const breaches: NegativeStockBreach[] = []

  for (const outcome of outcomes) {
    if (!(outcome.onHandAfter < 0)) continue

    const believed = outcome.deviceBelievedOnHand ?? null

    breaches.push({
      productId: outcome.productId,
      onHandAfter: outcome.onHandAfter,
      // The negative IS the shortfall: −3 on hand means three units were sold
      // that did not exist.
      shortfall: Math.abs(outcome.onHandAfter),
      quantitySold: outcome.quantitySold,
      deviceBelievedOnHand: believed,
      soldBeyondOwnBelief: believed !== null && outcome.quantitySold > believed,
    })
  }

  return breaches
}

/**
 * The conflict's identity.
 *
 * ⚠️ ONE MUTATION CAN OVERSELL SEVERAL PRODUCTS, so the mutation id alone is
 * not unique — `sync_conflicts` has a unique constraint on
 * `(workspace_id, mutation_id)` and a second product would silently overwrite
 * the first's row.
 *
 * Keyed by mutation AND product, which also gives replay-idempotency for free:
 * re-sending the same mutation upserts the same row rather than filing a
 * second conflict (M2.5).
 */
export function breachKey(mutationId: string, productId: string): string {
  return `${mutationId}:negative-stock:${productId}`
}

/**
 * The resolutions a person may choose.
 *
 * ⚠️ STATED, NOT IMPLEMENTED HERE. Each one is an existing action elsewhere in
 * the product, and two of them do not exist yet:
 *
 *   refund_sale       → needs a Credit Note. J3.4 STOP CONDITION: four product
 *                       decisions are undecided, so it was not built.
 *   replenish         → needs a purchase order. `/purchasing` has no create
 *                       form at all (open gap 11), though the endpoint exists.
 *   inventory_adjust  → EXISTS. L2's cycle count writes an ADJUSTMENT movement
 *                       priced from the cost layers.
 *
 * They are named here so the conflict can TELL the user their options honestly
 * — including which ones the product cannot yet carry out — rather than
 * offering three buttons where one works.
 */
export const NEGATIVE_STOCK_RESOLUTIONS = [
  { code: 'inventory_adjust', available: true, via: 'cycle count (L2)' },
  { code: 'refund_sale', available: false, via: 'credit note — not built (J3.4)' },
  { code: 'replenish', available: false, via: 'purchase order — no create form (gap 11)' },
] as const

export type NegativeStockResolution = (typeof NEGATIVE_STOCK_RESOLUTIONS)[number]['code']

/**
 * The divergence rows the conflict record carries.
 *
 * ⚠️ Shaped to fit `sync_conflicts.divergences` so this appears in `/conflicts`
 * with the UI that already exists (G2 — no second conflict surface). But the
 * SEMANTICS differ from a field divergence, and the fields say so:
 *
 * A normal conflict is «the server and the client disagree about this value».
 * This one is «both records are correct and together they broke an invariant».
 * There is no wrong side, which is exactly why no automatic resolution is
 * possible and why `financial` is always true.
 */
export function breachDivergences(breach: NegativeStockBreach) {
  return [
    {
      field: 'quantity',
      // What the shop actually has, now: a negative number.
      serverValue: breach.onHandAfter,
      // What the device thought it was selling from.
      clientValue: breach.deviceBelievedOnHand,
      // Always. Stock sold that did not exist is money and goods, and M2.4
      // forbids resolving it without a person.
      financial: true,
    },
    {
      field: 'shortfall',
      serverValue: breach.shortfall,
      clientValue: breach.quantitySold,
      financial: true,
    },
  ]
}
