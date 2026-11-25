// ============================================
// packages/validation/src/schemas/loyalty-and-credit.ts
//
// G01 (Gift Cards), G02 (Store Credit) & G65 (Loyalty Points)
// Pure shared domain rules — integer minor units for money, integer points,
// currency-scoped (never sum across currencies), workspace-isolated.
// ============================================

import { z } from 'zod'
import { currencyCodeSchema } from './common.schema'

export const giftCardIssueSchema = z.object({
  code: z.string().trim().min(4).max(40),
  currency: currencyCodeSchema,
  initialBalanceMinor: z.number().int().positive(),
  expiresAt: z.string().datetime().nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
})

export const giftCardRedeemSchema = z.object({
  code: z.string().trim().min(4).max(40),
  currency: currencyCodeSchema,
  amountMinor: z.number().int().positive(),
  invoiceId: z.string().uuid().nullable().optional(),
  idempotencyKey: z.string().trim().min(8).max(120),
})

export const storeCreditIssueSchema = z.object({
  customerId: z.string().uuid(),
  currency: currencyCodeSchema,
  amountMinor: z.number().int().positive(),
  sourceInvoiceId: z.string().uuid().nullable().optional(),
  reason: z.string().trim().min(2).max(200),
  idempotencyKey: z.string().trim().min(8).max(120),
})

export const loyaltyPointsMutationSchema = z.object({
  customerId: z.string().uuid(),
  kind: z.enum(['earn', 'redeem', 'adjust']),
  points: z
    .number()
    .int()
    .refine((v) => v !== 0, 'Points must be non-zero'),
  invoiceId: z.string().uuid().nullable().optional(),
  reason: z.string().trim().min(2).max(200),
  idempotencyKey: z.string().trim().min(8).max(120),
})

export interface GiftCardState {
  id: string
  workspaceId: string
  code: string
  currency: string
  balanceMinor: number
  isActive: boolean
  expiresAt: string | null
}

export type CreditRefusalCode =
  | 'GIFT_CARD_INACTIVE'
  | 'GIFT_CARD_EXPIRED'
  | 'GIFT_CARD_CURRENCY_MISMATCH'
  | 'GIFT_CARD_INSUFFICIENT_BALANCE'
  | 'LOYALTY_INSUFFICIENT_POINTS'

export function validateGiftCardRedemption(
  card: GiftCardState,
  amountMinor: number,
  currency: string,
  nowIso: string,
): CreditRefusalCode | null {
  if (!card.isActive) return 'GIFT_CARD_INACTIVE'
  if (card.expiresAt && card.expiresAt < nowIso) return 'GIFT_CARD_EXPIRED'
  if (card.currency !== currency) return 'GIFT_CARD_CURRENCY_MISMATCH'
  if (amountMinor <= 0 || card.balanceMinor < amountMinor) return 'GIFT_CARD_INSUFFICIENT_BALANCE'
  return null
}

export function applyLoyaltyDelta(
  currentBalance: number,
  kind: 'earn' | 'redeem' | 'adjust',
  points: number,
):
  | { ok: true; nextBalance: number; signedDelta: number }
  | { ok: false; refusal: CreditRefusalCode } {
  const signedDelta =
    kind === 'earn' ? Math.abs(points) : kind === 'redeem' ? -Math.abs(points) : points
  const nextBalance = currentBalance + signedDelta
  if (nextBalance < 0) {
    return { ok: false, refusal: 'LOYALTY_INSUFFICIENT_POINTS' }
  }
  return { ok: true, nextBalance, signedDelta }
}
