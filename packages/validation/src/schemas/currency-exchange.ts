// ============================================
// packages/validation/src/schemas/currency-exchange.ts
//
// Money changer / صرافی (QA document §10, 10 Nov 2026).
//
//   • a rate board — the shop's buy and sell price for each currency, kept as
//     history; a trade copies the rate it used and is never re-priced;
//   • a trade — the shop BUYS foreign currency from a customer (pays book
//     currency) or SELLS it (receives book currency). Two-sided, one document;
//   • a position — how much of each currency the shop holds and at what
//     average cost, from the trades; selling more than is held is refused;
//   • realized spread — what each sale earned over the average cost;
//   • hawala / remittance — a transfer with a payout code and its own states;
//   • identity check (KYC) above a threshold the business sets (none by default).
//
// General-ledger integration (V59.1 / exchange-03-migration.sql):
//   Every FX lifecycle event (trade create, trade void, remittance payout,
//   and agent settlement) posts book-currency journal entries atomically
//   inside PostgreSQL via public.accounting_post_journal_entry() while
//   keeping foreign-currency positions exact inside fx_trades.
//
// Rates are decimals typed by a person («70.25» afghani per dollar). They are
// held as integer millionths (rate × 1 000 000) and every conversion is done
// in BigInt: a money changer's figures are large and a float is not exact.
// ============================================

import { z } from 'zod'
import { FRACTION_DIGITS } from '@hisabche/formatting'

export const RATE_SCALE = BigInt(1_000_000)

/** «70.25» → 70250000; at most 6 decimals; positive. Null when it is not a rate. */
export function parseRate(text: string): bigint | null {
  const clean = text
    .trim()
    .replace(/[٫,]/g, '.')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  const match = /^(\d{1,12})(?:\.(\d{1,6}))?$/.exec(clean)
  if (!match) return null
  const micro = BigInt(match[1]!) * RATE_SCALE + BigInt((match[2] ?? '').padEnd(6, '0') || '0')
  return micro > BigInt(0) ? micro : null
}

/** 70250000 → «70.25» (trailing zeros dropped). */
export function formatRate(micro: bigint): string {
  const whole = micro / RATE_SCALE
  const fraction = (micro % RATE_SCALE).toString().padStart(6, '0').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : `${whole}`
}

const rateText = z
  .string()
  .trim()
  .refine((v) => parseRate(v) !== null, { message: 'FX_RATE_INVALID' })

function digits(code: string): number {
  return (FRACTION_DIGITS as Record<string, number>)[code] ?? 2
}

/**
 * Foreign minor units × rate → book minor units, rounded half away from zero.
 * `amountMinor` USD cents at 70.25 AFN/USD → AFN (0 digits).
 */
export function convertAtRate(
  amountMinor: number,
  rateMicro: bigint,
  foreign: string,
  book: string,
): number {
  const numerator = BigInt(amountMinor) * rateMicro * BigInt(10) ** BigInt(digits(book))
  const denominator = BigInt(10) ** BigInt(digits(foreign)) * RATE_SCALE
  const half = denominator / BigInt(2)
  return Number((numerator + half) / denominator)
}

// ─── Rate board ──────────────────────────────────────────────────────────────

export const fxRateBoardSchema = z.object({
  currency: z.string().trim().length(3),
  /** What the shop pays for one unit (it buys). */
  buyRate: rateText,
  /** What the shop asks for one unit (it sells). */
  sellRate: rateText,
})
export type FxRateBoardInput = z.infer<typeof fxRateBoardSchema>

/** A board where the shop sells cheaper than it buys loses on every pair of trades. */
export function rateBoardRefusal(input: FxRateBoardInput): 'FX_RATE_SPREAD_NEGATIVE' | null {
  const buy = parseRate(input.buyRate)
  const sell = parseRate(input.sellRate)
  if (buy === null || sell === null) return null
  return sell < buy ? 'FX_RATE_SPREAD_NEGATIVE' : null
}

// ─── Identity (KYC) ──────────────────────────────────────────────────────────

export const FX_ID_TYPES = ['national_id', 'passport', 'driving_licence', 'other'] as const

export const fxIdentitySchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  idType: z.enum(FX_ID_TYPES),
  idNumber: z.string().trim().min(3).max(60),
})
export type FxIdentityInput = z.infer<typeof fxIdentitySchema>

/**
 * The business's rule. `thresholdMinor = null` (the default) = no identity is
 * ever required — the law differs by country (QA document: «per حوزه قضایی»),
 * so the program does not pretend to know it.
 */
export const fxSettingsSchema = z.object({
  kycThresholdMinor: z.number().int().positive().max(1e15).nullable(),
})
export type FxSettingsInput = z.infer<typeof fxSettingsSchema>

/** At or above the threshold (in book currency) an identity is required. */
export function identityRequired(
  thresholdMinor: number | null | undefined,
  bookAmountMinor: number,
): boolean {
  return thresholdMinor != null && bookAmountMinor >= thresholdMinor
}

// ─── Trade ───────────────────────────────────────────────────────────────────

/**
 * `buy`  — the shop receives foreign currency and pays book currency.
 * `sell` — the shop gives foreign currency and receives book currency.
 * `opening` — what the shop held when it started using this, at its cost.
 */
export const FX_SIDES = ['buy', 'sell', 'opening'] as const
export type FxSide = (typeof FX_SIDES)[number]

export const fxTradeCreateSchema = z.object({
  side: z.enum(FX_SIDES),
  currency: z.string().trim().length(3),
  /** Foreign amount, minor units. */
  amountMinor: z.number().int().positive().max(1e15),
  rate: rateText,
  customerId: z.string().uuid().nullable().optional(),
  identity: fxIdentitySchema.nullable().optional(),
  note: z.string().trim().max(300).optional(),
  /** True when replaying a queued offline trade; short sells become pending_review. */
  offlineQueued: z.boolean().optional(),
})
export type FxTradeCreateInput = z.infer<typeof fxTradeCreateSchema>

export const fxVoidSchema = z.object({ reason: z.string().trim().min(3).max(300) })
export const fxTradeResolveReviewSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  reason: z.string().trim().min(3).max(300).optional(),
})
export type FxTradeResolveReviewInput = z.infer<typeof fxTradeResolveReviewSchema>

export const fxAgentSettleSchema = z.object({
  counterparty: z.string().trim().min(1).max(120),
  direction: z.enum(['collect', 'pay']),
  currency: z.string().trim().length(3),
  amountMinor: z.number().int().positive().max(1e15),
  rate: rateText.optional(),
  note: z.string().trim().max(300).optional(),
})
export type FxAgentSettleInput = z.infer<typeof fxAgentSettleSchema>

export type FxTradeRefusal =
  'FX_SAME_AS_BOOK_CURRENCY' | 'FX_KYC_REQUIRED' | 'FX_OPENING_HAS_NO_PARTY'

export function tradeRefusal(input: {
  readonly trade: FxTradeCreateInput
  readonly bookCurrency: string
  readonly bookAmountMinor: number
  readonly kycThresholdMinor: number | null
}): FxTradeRefusal | null {
  const { trade } = input
  if (trade.currency.toUpperCase() === input.bookCurrency.toUpperCase()) {
    return 'FX_SAME_AS_BOOK_CURRENCY'
  }
  if (trade.side === 'opening') {
    // An opening balance is the shop's own money: no customer, no ID.
    return trade.customerId || trade.identity ? 'FX_OPENING_HAS_NO_PARTY' : null
  }
  if (identityRequired(input.kycThresholdMinor, input.bookAmountMinor) && !trade.identity) {
    return 'FX_KYC_REQUIRED'
  }
  return null
}

// ─── Position and realized spread ────────────────────────────────────────────

export interface FxTradeRow {
  readonly id: string
  readonly side: FxSide
  readonly currency: string
  readonly amountMinor: number
  readonly rateMicro: bigint
  readonly bookAmountMinor: number
  readonly status: 'posted' | 'voided' | 'pending_review'
  readonly createdAt: string
}

export interface FxPosition {
  readonly currency: string
  /** Held now, foreign minor units. */
  readonly heldMinor: number
  /** Average cost per unit, millionths of book currency; null when nothing is held. */
  readonly averageRateMicro: bigint | null
  /** What the holding cost, book minor units. */
  readonly costMinor: number
  /** Sum over sales of (sale − average cost at the time), book minor units. */
  readonly realizedMinor: number
  readonly bought: number
  readonly sold: number
}

/**
 * Moving-average cost, in date order, posted trades only. A sale takes cost
 * out at the average of the moment; what it brought above that is realized.
 * A sale beyond the holding (possible only in data written before the
 * check) is costed at zero for the excess and named by `shortMinor`.
 */
export function positionsFrom(
  trades: readonly FxTradeRow[],
  /** The currency every `bookAmountMinor` is in; the average rate is expressed in it. */
  bookCurrency: string,
): Array<FxPosition & { shortMinor: number }> {
  const by = new Map<
    string,
    { held: bigint; cost: bigint; realized: bigint; bought: number; sold: number; short: bigint }
  >()
  const ordered = [...trades]
    .filter((t) => t.status === 'posted')
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
  for (const trade of ordered) {
    const key = trade.currency.toUpperCase()
    const entry = by.get(key) ?? {
      held: BigInt(0),
      cost: BigInt(0),
      realized: BigInt(0),
      bought: 0,
      sold: 0,
      short: BigInt(0),
    }
    const amount = BigInt(trade.amountMinor)
    const book = BigInt(trade.bookAmountMinor)
    if (trade.side === 'sell') {
      const covered = amount <= entry.held ? amount : entry.held
      const costOut = entry.held > BigInt(0) ? (entry.cost * covered) / entry.held : BigInt(0)
      entry.short += amount - covered
      entry.held -= covered
      entry.cost -= costOut
      entry.realized += book - costOut
      entry.sold += 1
    } else {
      entry.held += amount
      entry.cost += book
      entry.bought += 1
    }
    by.set(key, entry)
  }
  return [...by.entries()].map(([currency, e]) => ({
    currency,
    heldMinor: Number(e.held),
    // cost (book minor) per held (foreign minor) → rate in millionths.
    averageRateMicro:
      e.held > BigInt(0)
        ? (e.cost * RATE_SCALE * BigInt(10) ** BigInt(digits(currency))) /
          (e.held * BigInt(10) ** BigInt(digits(bookCurrency)))
        : null,
    costMinor: Number(e.cost),
    realizedMinor: Number(e.realized),
    bought: e.bought,
    sold: e.sold,
    shortMinor: Number(e.short),
  }))
}

// ─── Remittance (hawala) ─────────────────────────────────────────────────────

/**
 * outgoing — a customer hands money here; a partner pays it out elsewhere.
 * incoming — a partner tells us to pay someone here.
 */
export const REMITTANCE_DIRECTIONS = ['outgoing', 'incoming'] as const
export type RemittanceDirection = (typeof REMITTANCE_DIRECTIONS)[number]

export const REMITTANCE_STATUSES = ['created', 'sent', 'paid', 'cancelled'] as const
export type RemittanceStatus = (typeof REMITTANCE_STATUSES)[number]

export const REMITTANCE_MOVES: Readonly<
  Record<RemittanceDirection, Readonly<Record<RemittanceStatus, readonly RemittanceStatus[]>>>
> = {
  // Sent = the partner was told; paid = the partner confirmed the payout.
  outgoing: {
    created: ['sent', 'cancelled'],
    sent: ['paid', 'cancelled'],
    paid: [],
    cancelled: [],
  },
  // Paid here, against the code the partner gave.
  incoming: { created: ['paid', 'cancelled'], sent: [], paid: [], cancelled: [] },
}

export const remittanceCreateSchema = z.object({
  direction: z.enum(REMITTANCE_DIRECTIONS),
  /** The partner office / agent at the other end, as the shop names it. */
  counterparty: z.string().trim().min(1).max(120),
  senderName: z.string().trim().min(2).max(160),
  senderPhone: z.string().trim().max(40).optional(),
  receiverName: z.string().trim().min(2).max(160),
  receiverPhone: z.string().trim().max(40).optional(),
  destination: z.string().trim().max(120).optional(),
  currency: z.string().trim().length(3),
  amountMinor: z.number().int().positive().max(1e15),
  feeMinor: z.number().int().nonnegative().max(1e15).default(0),
  customerId: z.string().uuid().nullable().optional(),
  identity: fxIdentitySchema.nullable().optional(),
  /** incoming only: the code the partner gave; outgoing codes are made by the server. */
  payoutCode: z.string().trim().min(4).max(20).optional(),
  note: z.string().trim().max(300).optional(),
})
export type RemittanceCreateInput = z.infer<typeof remittanceCreateSchema>

export const remittanceMoveSchema = z.object({
  status: z.enum(['sent', 'paid', 'cancelled']),
  /** incoming → paid: the code the receiver shows. */
  payoutCode: z.string().trim().max(20).optional(),
  reason: z.string().trim().max(300).optional(),
})
export type RemittanceMoveInput = z.infer<typeof remittanceMoveSchema>

export function remittanceCreateRefusal(
  input: RemittanceCreateInput,
): 'REMITTANCE_CODE_REQUIRED' | 'REMITTANCE_CODE_NOT_YOURS' | null {
  if (input.direction === 'incoming' && !input.payoutCode) return 'REMITTANCE_CODE_REQUIRED'
  if (input.direction === 'outgoing' && input.payoutCode) return 'REMITTANCE_CODE_NOT_YOURS'
  return null
}

export function remittanceMoveRefusal(
  direction: RemittanceDirection,
  from: RemittanceStatus,
  input: RemittanceMoveInput,
):
  | 'REMITTANCE_MOVE_NOT_ALLOWED'
  | 'REMITTANCE_CANCEL_REASON_REQUIRED'
  | 'REMITTANCE_CODE_REQUIRED'
  | null {
  if (!REMITTANCE_MOVES[direction][from].includes(input.status))
    return 'REMITTANCE_MOVE_NOT_ALLOWED'
  if (input.status === 'cancelled' && !input.reason) return 'REMITTANCE_CANCEL_REASON_REQUIRED'
  if (direction === 'incoming' && input.status === 'paid' && !input.payoutCode) {
    return 'REMITTANCE_CODE_REQUIRED'
  }
  return null
}

/** Six digits, from a random source the caller provides (crypto on the server). */
export function payoutCodeFrom(random: Uint8Array): string {
  let n = 0
  for (const byte of random.slice(0, 4)) n = (n * 256 + byte) % 1_000_000
  return String(n).padStart(6, '0')
}

/**
 * Where the shop stands with each partner, per currency: what they still
 * owe us for incoming payouts we made, minus what we owe them for outgoing
 * ones they paid. Positive = the partner owes the shop.
 */
export function partnerBalances(
  rows: ReadonlyArray<{
    readonly counterparty: string
    readonly direction: RemittanceDirection
    readonly status: RemittanceStatus
    readonly currency: string
    readonly amountMinor: number
  }>,
  settlements: ReadonlyArray<{
    readonly counterparty: string
    readonly direction: 'collect' | 'pay'
    readonly currency: string
    readonly amountMinor: number
  }> = [],
): Array<{ counterparty: string; currency: string; balanceMinor: number }> {
  const totals = new Map<string, { counterparty: string; currency: string; balanceMinor: number }>()
  for (const row of rows) {
    if (row.status !== 'paid') continue
    const key = `${row.counterparty.trim().toLowerCase()}|${row.currency.toUpperCase()}`
    const entry = totals.get(key) ?? {
      counterparty: row.counterparty.trim(),
      currency: row.currency.toUpperCase(),
      balanceMinor: 0,
    }
    // We paid an incoming one: the partner owes us. They paid an outgoing one: we owe them.
    entry.balanceMinor += row.direction === 'incoming' ? row.amountMinor : -row.amountMinor
    totals.set(key, entry)
  }
  for (const s of settlements) {
    const key = `${s.counterparty.trim().toLowerCase()}|${s.currency.toUpperCase()}`
    const entry = totals.get(key) ?? {
      counterparty: s.counterparty.trim(),
      currency: s.currency.toUpperCase(),
      balanceMinor: 0,
    }
    // Collect reduces what partner owes us; pay reduces what we owe partner.
    entry.balanceMinor += s.direction === 'collect' ? -s.amountMinor : s.amountMinor
    totals.set(key, entry)
  }
  return [...totals.values()]
}

// ─── Cross-currency conversion, cashbox reconciliation & offline conflict ────

/**
 * Two-leg currency exchange via the business's book currency (`from -> book -> to`)
 * using exact BigInt rate arithmetic. Both `fromRateToBookMicro` and
 * `bookToTargetRateMicro` express book units per 1 foreign unit (matching the
 * workspace rate board). Returns null whenever a needed rate is missing/invalid
 * so unknown exchange rates are never coerced to zero.
 */
export function crossExchangeAtRates(input: {
  readonly amountMinor: number
  readonly fromCurrency: string
  readonly toCurrency: string
  readonly bookCurrency: string
  readonly fromRateToBookMicro: bigint | null
  readonly bookToTargetRateMicro: bigint | null
}): {
  readonly intermediateBookMinor: number
  readonly targetMinor: number
  readonly effectiveCrossRateMicro: bigint
} | null {
  const from = input.fromCurrency.trim().toUpperCase()
  const to = input.toCurrency.trim().toUpperCase()
  const book = input.bookCurrency.trim().toUpperCase()
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) return null
  if (!input.fromRateToBookMicro || input.fromRateToBookMicro <= BigInt(0)) return null
  if (!input.bookToTargetRateMicro || input.bookToTargetRateMicro <= BigInt(0)) return null
  if (from === to) {
    return {
      intermediateBookMinor: convertAtRate(
        input.amountMinor,
        input.fromRateToBookMicro,
        from,
        book,
      ),
      targetMinor: input.amountMinor,
      effectiveCrossRateMicro: RATE_SCALE,
    }
  }

  const intermediateBookMinor = convertAtRate(
    input.amountMinor,
    input.fromRateToBookMicro,
    from,
    book,
  )

  // Convert book minor units to target minor units:
  // targetMinor = bookMinor * 10^digits(to) * RATE_SCALE / (bookToTargetRateMicro * 10^digits(book))
  const num = BigInt(intermediateBookMinor) * BigInt(10) ** BigInt(digits(to)) * RATE_SCALE
  const den = input.bookToTargetRateMicro * BigInt(10) ** BigInt(digits(book))
  const half = den / BigInt(2)
  const targetMinor = Number((num + half) / den)

  // Cross rate = fromRateToBookMicro / bookToTargetRateMicro scaled by RATE_SCALE
  const rateNum = input.fromRateToBookMicro * RATE_SCALE
  const rateHalf = input.bookToTargetRateMicro / BigInt(2)
  const effectiveCrossRateMicro = (rateNum + rateHalf) / input.bookToTargetRateMicro

  return {
    intermediateBookMinor,
    targetMinor,
    effectiveCrossRateMicro,
  }
}

export const fxCashboxReconcileSchema = z.object({
  currency: z.string().trim().length(3),
  countedMinor: z.number().int().nonnegative().max(1e15),
  note: z.string().trim().max(300).optional(),
})
export type FxCashboxReconcileInput = z.infer<typeof fxCashboxReconcileSchema>

export interface FxCashboxReconciliationResult {
  readonly currency: string
  readonly expectedMinor: number | null
  readonly countedMinor: number | null
  readonly varianceMinor: number | null
  readonly status: 'matched' | 'over' | 'short' | 'unknown'
}

/**
 * Reconciles physical foreign cashbox count against expected held position for
 * ONE currency. Missing values stay `null` (`status: 'unknown'`) and are never
 * converted into zero; currencies are never summed together.
 */
export function reconcileCurrencyCashbox(
  expectedMinor: number | null,
  countedMinor: number | null,
  currency: string,
): FxCashboxReconciliationResult {
  const code = currency.trim().toUpperCase()
  if (expectedMinor === null || countedMinor === null) {
    return {
      currency: code,
      expectedMinor,
      countedMinor,
      varianceMinor: null,
      status: 'unknown',
    }
  }
  const varianceMinor = countedMinor - expectedMinor
  return {
    currency: code,
    expectedMinor,
    countedMinor,
    varianceMinor,
    status: varianceMinor === 0 ? 'matched' : varianceMinor > 0 ? 'over' : 'short',
  }
}

export interface OfflineFxConflictResult {
  readonly localTradeId: string
  readonly resolution: 'APPLY' | 'PENDING_REVIEW'
  readonly reason: 'FX_OFFLINE_POSITION_SHORT' | null
  readonly shortfallMinor: number
}

/**
 * Offline FX rule: queued sell trades whose server position fell short before
 * sync must be marked `PENDING_REVIEW` rather than silently rejected or dropped.
 */
export function resolveOfflineFxConflict(input: {
  readonly localTradeId: string
  readonly requestedSide: FxSide
  readonly requestedAmountMinor: number
  readonly serverHeldMinor: number | null
}): OfflineFxConflictResult {
  if (input.requestedSide !== 'sell') {
    return {
      localTradeId: input.localTradeId,
      resolution: 'APPLY',
      reason: null,
      shortfallMinor: 0,
    }
  }
  if (input.serverHeldMinor === null) {
    return {
      localTradeId: input.localTradeId,
      resolution: 'PENDING_REVIEW',
      reason: 'FX_OFFLINE_POSITION_SHORT',
      shortfallMinor: input.requestedAmountMinor,
    }
  }
  if (input.serverHeldMinor < input.requestedAmountMinor) {
    return {
      localTradeId: input.localTradeId,
      resolution: 'PENDING_REVIEW',
      reason: 'FX_OFFLINE_POSITION_SHORT',
      shortfallMinor: input.requestedAmountMinor - input.serverHeldMinor,
    }
  }
  return {
    localTradeId: input.localTradeId,
    resolution: 'APPLY',
    reason: null,
    shortfallMinor: 0,
  }
}

export interface ExchangeCurrencySummary {
  readonly currency: string
  readonly buyCount: number
  readonly sellCount: number
  readonly buyVolumeMinor: number
  readonly sellVolumeMinor: number
  readonly heldMinor: number
  readonly realizedBookMinor: number
  readonly shortMinor: number
}

export interface OpenRemittanceCurrencySummary {
  readonly currency: string
  readonly openCount: number
  readonly openAmountMinor: number
}

/**
 * Exchange summary strictly grouped per currency — multi-currency volumes and
 * remittance totals are never summed into one mixed number.
 */
export function summarizeExchangeOperations(input: {
  readonly trades: readonly FxTradeRow[]
  readonly bookCurrency: string
  readonly remittances: ReadonlyArray<{
    readonly counterparty: string
    readonly direction: RemittanceDirection
    readonly status: RemittanceStatus
    readonly currency: string
    readonly amountMinor: number
  }>
  readonly cashboxVariances?: ReadonlyArray<{
    readonly currency: string
    readonly varianceMinor: number | null
  }>
  readonly pendingReviewCount?: number
}) {
  const positions = positionsFrom(input.trades, input.bookCurrency)
  const volByCurrency = new Map<
    string,
    { buyCount: number; sellCount: number; buyVolumeMinor: number; sellVolumeMinor: number }
  >()
  for (const t of input.trades) {
    if (t.status !== 'posted') continue
    const code = t.currency.toUpperCase()
    const entry = volByCurrency.get(code) ?? {
      buyCount: 0,
      sellCount: 0,
      buyVolumeMinor: 0,
      sellVolumeMinor: 0,
    }
    if (t.side === 'sell') {
      entry.sellCount += 1
      entry.sellVolumeMinor += t.amountMinor
    } else if (t.side === 'buy') {
      entry.buyCount += 1
      entry.buyVolumeMinor += t.amountMinor
    }
    volByCurrency.set(code, entry)
  }

  const currencies: ExchangeCurrencySummary[] = positions.map((pos) => {
    const vol = volByCurrency.get(pos.currency) ?? {
      buyCount: 0,
      sellCount: 0,
      buyVolumeMinor: 0,
      sellVolumeMinor: 0,
    }
    return {
      currency: pos.currency,
      buyCount: vol.buyCount,
      sellCount: vol.sellCount,
      buyVolumeMinor: vol.buyVolumeMinor,
      sellVolumeMinor: vol.sellVolumeMinor,
      heldMinor: pos.heldMinor,
      realizedBookMinor: pos.realizedMinor,
      shortMinor: pos.shortMinor,
    }
  })

  const openMap = new Map<
    string,
    { currency: string; openCount: number; openAmountMinor: number }
  >()
  for (const r of input.remittances) {
    if (r.status !== 'created' && r.status !== 'sent') continue
    const code = r.currency.toUpperCase()
    const item = openMap.get(code) ?? { currency: code, openCount: 0, openAmountMinor: 0 }
    item.openCount += 1
    item.openAmountMinor += r.amountMinor
    openMap.set(code, item)
  }

  const unreconciledCurrencies = (input.cashboxVariances ?? [])
    .filter((c) => c.varianceMinor === null || c.varianceMinor !== 0)
    .map((c) => c.currency.toUpperCase())

  return {
    currencies,
    openRemittancesByCurrency: [...openMap.values()] satisfies OpenRemittanceCurrencySummary[],
    partnerBalances: partnerBalances(input.remittances),
    pendingReviewCount: input.pendingReviewCount ?? 0,
    unreconciledCurrencies,
  }
}
