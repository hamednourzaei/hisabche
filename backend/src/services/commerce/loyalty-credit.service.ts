// ============================================
// backend/src/services/commerce/loyalty-credit.service.ts
//
// G01 (Gift Cards), G02 (Store Credit) & G65 (Loyalty Points)
// Workspace-isolated, idempotent, integer minor units, currency-separated.
// ============================================

import {
  applyLoyaltyDelta,
  giftCardIssueSchema,
  giftCardRedeemSchema,
  loyaltyPointsMutationSchema,
  storeCreditIssueSchema,
  validateGiftCardRedemption,
} from '@hisabche/validation'
import { supabase } from '../../db'
import { BaseError } from '../../errors/base.error'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { selectAllPages } from '../../utils/fetch-all-pages'
import type { TenancyContext } from '../tenancy.service'

const MISSING_SCHEMA = new Set(['42703', '42P01', 'PGRST204', 'PGRST205'])

export class LoyaltyCreditNotConfiguredError extends BaseError {
  constructor() {
    super('LOYALTY_CREDIT_MIGRATION_PENDING', 503)
    this.name = 'LoyaltyCreditNotConfiguredError'
  }
}

type DbError = { code?: string; message: string }

function fail(err: DbError, msg: string): never {
  if (MISSING_SCHEMA.has(err.code ?? '')) throw new LoyaltyCreditNotConfiguredError()
  if (err.code === '23505') throw new ValidationError('DUPLICATE_CODE_OR_KEY')
  throw new DatabaseError(msg, err)
}

export class LoyaltyCreditService {
  async listGiftCards(ctx: TenancyContext) {
    const res = await selectAllPages<Record<string, unknown>, DbError>((from, to) =>
      supabase
        .from('gift_cards')
        .select(
          'id, code, currency, initial_balance_minor, balance_minor, customer_id, is_active, expires_at, created_at',
        )
        .eq('workspace_id', ctx.workspaceId)
        .order('created_at', { ascending: false })
        .range(from, to),
    )
    if (res.error) fail(res.error, 'Failed to list gift cards')
    return res.data ?? []
  }

  async issueGiftCard(ctx: TenancyContext, raw: unknown) {
    const input = giftCardIssueSchema.parse(raw)
    const { data, error } = await supabase
      .from('gift_cards')
      .insert({
        workspace_id: ctx.workspaceId,
        code: input.code.toUpperCase(),
        currency: input.currency,
        initial_balance_minor: input.initialBalanceMinor,
        balance_minor: input.initialBalanceMinor,
        customer_id: input.customerId ?? null,
        is_active: true,
        expires_at: input.expiresAt ?? null,
        created_by: ctx.userId,
      })
      .select('id, code, currency, initial_balance_minor, balance_minor, is_active, expires_at')
      .single()
    if (error) fail(error, 'Failed to issue gift card')
    return data
  }

  async redeemGiftCard(ctx: TenancyContext, raw: unknown) {
    const input = giftCardRedeemSchema.parse(raw)
    const normalizedCode = input.code.toUpperCase()

    // Idempotency check
    const existingTx = await supabase
      .from('gift_card_transactions')
      .select('id, gift_card_id, amount_minor, currency')
      .eq('workspace_id', ctx.workspaceId)
      .eq('idempotency_key', input.idempotencyKey)
      .maybeSingle()
    if (existingTx.error) fail(existingTx.error, 'Failed to check gift card idempotency')
    if (existingTx.data) {
      return { idempotentReplay: true, transaction: existingTx.data }
    }

    const { data: card, error } = await supabase
      .from('gift_cards')
      .select('id, workspace_id, code, currency, balance_minor, is_active, expires_at')
      .eq('workspace_id', ctx.workspaceId)
      .eq('code', normalizedCode)
      .maybeSingle()
    if (error) fail(error, 'Failed to load gift card')
    if (!card) throw new NotFoundError('GiftCard')

    const row = card as {
      id: string
      workspace_id: string
      code: string
      currency: string
      balance_minor: number
      is_active: boolean
      expires_at: string | null
    }
    const refusal = validateGiftCardRedemption(
      {
        id: row.id,
        workspaceId: row.workspace_id,
        code: row.code,
        currency: row.currency,
        balanceMinor: Number(row.balance_minor),
        isActive: row.is_active,
        expiresAt: row.expires_at,
      },
      input.amountMinor,
      input.currency,
      new Date().toISOString(),
    )
    if (refusal) throw new ValidationError(refusal)

    const nextBalance = Number(row.balance_minor) - input.amountMinor
    const upd = await supabase
      .from('gift_cards')
      .update({ balance_minor: nextBalance, updated_at: new Date().toISOString() })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', row.id)
      .gte('balance_minor', input.amountMinor)
      .select('id, code, currency, balance_minor')
      .maybeSingle()
    if (upd.error) fail(upd.error, 'Failed to update gift card balance')
    if (!upd.data) throw new ValidationError('GIFT_CARD_INSUFFICIENT_BALANCE')

    const tx = await supabase
      .from('gift_card_transactions')
      .insert({
        workspace_id: ctx.workspaceId,
        gift_card_id: row.id,
        kind: 'redeem',
        amount_minor: -input.amountMinor,
        currency: input.currency,
        invoice_id: input.invoiceId ?? null,
        idempotency_key: input.idempotencyKey,
        created_by: ctx.userId,
      })
      .select('id, gift_card_id, amount_minor, currency')
      .single()
    if (tx.error) fail(tx.error, 'Failed to record gift card transaction')
    return { idempotentReplay: false, card: upd.data, transaction: tx.data }
  }

  async getStoreCreditBalances(ctx: TenancyContext, customerId: string) {
    const res = await selectAllPages<{ currency: string; amount_minor: number }, DbError>(
      (from, to) =>
        supabase
          .from('store_credit_ledger')
          .select('currency, amount_minor')
          .eq('workspace_id', ctx.workspaceId)
          .eq('customer_id', customerId)
          .range(from, to),
    )
    if (res.error) fail(res.error, 'Failed to read store credit')
    const byCurrency: Record<string, number> = {}
    for (const row of res.data ?? []) {
      byCurrency[row.currency] = (byCurrency[row.currency] ?? 0) + Number(row.amount_minor)
    }
    return { customerId, balancesByCurrency: byCurrency }
  }

  async issueStoreCredit(ctx: TenancyContext, raw: unknown) {
    const input = storeCreditIssueSchema.parse(raw)
    const existing = await supabase
      .from('store_credit_ledger')
      .select('id, customer_id, currency, amount_minor, reason')
      .eq('workspace_id', ctx.workspaceId)
      .eq('idempotency_key', input.idempotencyKey)
      .maybeSingle()
    if (existing.error) fail(existing.error, 'Failed to check store credit idempotency')
    if (existing.data) return { idempotentReplay: true, entry: existing.data }

    const { data, error } = await supabase
      .from('store_credit_ledger')
      .insert({
        workspace_id: ctx.workspaceId,
        customer_id: input.customerId,
        currency: input.currency,
        amount_minor: input.amountMinor,
        source_invoice_id: input.sourceInvoiceId ?? null,
        reason: input.reason,
        idempotency_key: input.idempotencyKey,
        created_by: ctx.userId,
      })
      .select('id, customer_id, currency, amount_minor, reason')
      .single()
    if (error) fail(error, 'Failed to issue store credit')
    return { idempotentReplay: false, entry: data }
  }

  async getLoyaltyBalance(ctx: TenancyContext, customerId: string) {
    const res = await selectAllPages<{ points_delta: number }, DbError>((from, to) =>
      supabase
        .from('loyalty_points_ledger')
        .select('points_delta')
        .eq('workspace_id', ctx.workspaceId)
        .eq('customer_id', customerId)
        .range(from, to),
    )
    if (res.error) fail(res.error, 'Failed to read loyalty points')
    const balance = (res.data ?? []).reduce((sum, r) => sum + Number(r.points_delta), 0)
    return { customerId, pointsBalance: balance }
  }

  async mutateLoyaltyPoints(ctx: TenancyContext, raw: unknown) {
    const input = loyaltyPointsMutationSchema.parse(raw)
    const existing = await supabase
      .from('loyalty_points_ledger')
      .select('id, customer_id, kind, points_delta, reason')
      .eq('workspace_id', ctx.workspaceId)
      .eq('idempotency_key', input.idempotencyKey)
      .maybeSingle()
    if (existing.error) fail(existing.error, 'Failed to check loyalty idempotency')
    if (existing.data) return { idempotentReplay: true, entry: existing.data }

    const { pointsBalance } = await this.getLoyaltyBalance(ctx, input.customerId)
    const outcome = applyLoyaltyDelta(pointsBalance, input.kind, input.points)
    if (!outcome.ok) throw new ValidationError(outcome.refusal)

    const { data, error } = await supabase
      .from('loyalty_points_ledger')
      .insert({
        workspace_id: ctx.workspaceId,
        customer_id: input.customerId,
        kind: input.kind,
        points_delta: outcome.signedDelta,
        invoice_id: input.invoiceId ?? null,
        reason: input.reason,
        idempotency_key: input.idempotencyKey,
        created_by: ctx.userId,
      })
      .select('id, customer_id, kind, points_delta, reason')
      .single()
    if (error) fail(error, 'Failed to mutate loyalty points')
    return { idempotentReplay: false, pointsBalance: outcome.nextBalance, entry: data }
  }
}

export const loyaltyCreditService = new LoyaltyCreditService()
