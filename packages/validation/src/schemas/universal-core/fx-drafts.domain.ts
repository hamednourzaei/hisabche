// ============================================
// packages/validation/src/schemas/universal-core/fx-drafts.domain.ts
//
// WP-07 — OFFLINE FX TRADE DRAFTS (money changer / صرافی).
//
// A draft is NOT a trade. It moves no cash, holds no currency position and
// creates no journal entry on the device. The server still owns the locked
// rate, the KYC gate, the position check and the GL posting; a draft only
// lets an agent WRITE a trade without signal and hand it to /api/exchange.
//
// One source of rules: the amount conversion reuses convertAtRate from
// currency-exchange.ts (the same BigInt engine the server uses), never a
// second /100 or floating-point conversion.
// ============================================

import { convertAtRate, parseRate } from '../currency-exchange'

export type FxDraftStatus = 'quoted' | 'pending' | 'cancelled' | 'settled'

/** The only transitions a local draft may make. The server owns the rest. */
export function fxDraftTransitionAllowed(from: FxDraftStatus, to: FxDraftStatus): boolean {
  if (from === 'quoted') return to === 'pending' || to === 'cancelled'
  if (from === 'pending') return to === 'settled'
  return false
}

/**
 * Book amount for an offline draft, from the LOCKED rate string.
 * `null` means the rate is not a valid decimal — the caller must refuse the
 * draft, never price it as zero.
 */
export function fxDraftBookAmountMinor(input: {
  readonly amountMinor: number
  readonly rate: string
  readonly currency: string
  readonly bookCurrency: string
}): number | null {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) return null
  const rateMicro = parseRate(input.rate.trim())
  if (rateMicro === null || rateMicro <= BigInt(0)) return null
  return convertAtRate(
    input.amountMinor,
    rateMicro,
    input.currency.toUpperCase(),
    input.bookCurrency.toUpperCase(),
  )
}

/**
 * A queued sell whose server position is unknown/short goes to PENDING_REVIEW,
 * never to a posted trade. Reuses the same rule the sync engine applies.
 */
export function fxDraftNeedsReview(
  serverHeldMinor: number | null,
  requestedMinor: number,
): boolean {
  return serverHeldMinor === null || serverHeldMinor < requestedMinor
}
