// ============================================
// backend/src/services/exchange/exchange.service.ts
//
// Money changer / صرافی (exchange-01; QA document §10, 10 Nov 2026).
//
// The rules are in @hisabche/validation (currency-exchange.ts) and in the
// database functions; this service reads, computes amounts with the shared
// convertAtRate (BigInt), and calls them.
//
// Core it uses, not beside it: the book currency (baseCurrencyOf), customers,
// the currency list. What it deliberately does NOT touch: the general ledger
// and the tills (see the migration's header — the ledger has no currency on
// its lines yet). Positions and spread are read from fx_trades alone.
// ============================================

import { createHash, randomBytes } from 'node:crypto'
import {
  convertAtRate,
  formatRate,
  parseRate,
  partnerBalances,
  payoutCodeFrom,
  positionsFrom,
  rateBoardRefusal,
  remittanceCreateRefusal,
  remittanceMoveRefusal,
  tradeRefusal,
  identityRequired,
  type FxRateBoardInput,
  type FxSettingsInput,
  type FxTradeCreateInput,
  type FxTradeRow,
  type RemittanceCreateInput,
  type RemittanceDirection,
  type RemittanceMoveInput,
  type RemittanceStatus,
} from '@hisabche/validation'
import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { selectAllPages } from '../../utils/fetch-all-pages'
import { baseCurrencyOf } from '../base-currency'
import type { TenancyContext } from '../tenancy.service'

const isNotReady = (error: { code?: string } | null) =>
  error?.code === '42P01' ||
  error?.code === 'PGRST205' ||
  error?.code === 'PGRST202' ||
  error?.code === '42883'

/** The payout code is never stored; its hash is, salted by the workspace. */
function hashCode(workspaceId: string, code: string): string {
  return createHash('sha256').update(`${workspaceId}:${code.trim()}`).digest('hex')
}

interface TradeDbRow {
  id: string
  number: number
  side: FxTradeRow['side']
  currency: string
  amount_minor: number | string
  rate_micro: number | string
  book_currency: string
  book_amount_minor: number | string
  customer_id: string | null
  id_full_name: string | null
  status: 'posted' | 'voided'
  void_reason: string | null
  note: string | null
  created_at: string
}

const TRADE_COLUMNS =
  'id, number, side, currency, amount_minor, rate_micro, book_currency, book_amount_minor, ' +
  'customer_id, id_full_name, status, void_reason, note, created_at'

function mapTrade(row: TradeDbRow) {
  return {
    id: row.id,
    number: Number(row.number),
    side: row.side,
    currency: row.currency,
    amountMinor: Number(row.amount_minor),
    rate: formatRate(BigInt(row.rate_micro)),
    bookCurrency: row.book_currency,
    bookAmountMinor: Number(row.book_amount_minor),
    customerId: row.customer_id,
    identityName: row.id_full_name,
    status: row.status,
    voidReason: row.void_reason,
    note: row.note,
    createdAt: row.created_at,
  }
}

const REMITTANCE_COLUMNS =
  'id, number, direction, counterparty, sender_name, sender_phone, receiver_name, receiver_phone, ' +
  'destination, currency, amount_minor, fee_minor, customer_id, status, cancel_reason, note, ' +
  'created_at, updated_at, paid_at'

export class ExchangeService {
  // ─── Settings ─────────────────────────────────────────────────────────────
  async settings(ctx: TenancyContext) {
    const bookCurrency = await baseCurrencyOf(ctx.workspaceId)
    const { data, error } = await supabase
      .from('fx_settings')
      .select('kyc_threshold_minor')
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()
    if (isNotReady(error)) return { ready: false, bookCurrency, kycThresholdMinor: null }
    if (error) throw new DatabaseError('Failed to read the exchange settings', error)
    const threshold = data?.kyc_threshold_minor
    return {
      ready: true,
      bookCurrency,
      kycThresholdMinor: threshold === null || threshold === undefined ? null : Number(threshold),
    }
  }

  async saveSettings(ctx: TenancyContext, input: FxSettingsInput) {
    const { error } = await supabase.from('fx_settings').upsert(
      {
        workspace_id: ctx.workspaceId,
        kyc_threshold_minor: input.kycThresholdMinor,
        updated_at: new Date().toISOString(),
        updated_by: ctx.userId,
      },
      { onConflict: 'workspace_id' },
    )
    if (isNotReady(error)) throw new ValidationError('FX_NOT_READY')
    if (error) throw new DatabaseError('Failed to save the exchange settings', error)
    return this.settings(ctx)
  }

  // ─── Rate board ───────────────────────────────────────────────────────────
  /** The latest buy/sell per currency, and when and by whom it was set. */
  async board(ctx: TenancyContext) {
    const { data, error } = await supabase
      .from('fx_rate_board')
      .select('currency, buy_rate_micro, sell_rate_micro, set_by, set_at')
      .eq('workspace_id', ctx.workspaceId)
      .order('set_at', { ascending: false })
      .limit(1000)
    if (isNotReady(error)) return { ready: false, rates: [] }
    if (error) throw new DatabaseError('Failed to read the rate board', error)
    const latest = new Map<string, (typeof data)[number]>()
    for (const row of data ?? [])
      if (!latest.has(row.currency as string)) latest.set(row.currency as string, row)
    return {
      ready: true,
      rates: [...latest.values()].map((row) => ({
        currency: row.currency as string,
        buyRate: formatRate(BigInt(row.buy_rate_micro as string | number)),
        sellRate: formatRate(BigInt(row.sell_rate_micro as string | number)),
        setBy: row.set_by as string,
        setAt: row.set_at as string,
      })),
    }
  }

  async setRate(ctx: TenancyContext, input: FxRateBoardInput) {
    const refusal = rateBoardRefusal(input)
    if (refusal) throw new ValidationError(refusal)
    const currency = input.currency.toUpperCase()
    if (currency === (await baseCurrencyOf(ctx.workspaceId))) {
      throw new ValidationError('FX_SAME_AS_BOOK_CURRENCY')
    }
    const { error } = await supabase.from('fx_rate_board').insert({
      workspace_id: ctx.workspaceId,
      currency,
      buy_rate_micro: String(parseRate(input.buyRate)),
      sell_rate_micro: String(parseRate(input.sellRate)),
      set_by: ctx.userId,
    })
    if (isNotReady(error)) throw new ValidationError('FX_NOT_READY')
    if (error) throw new DatabaseError('Failed to set the rate', error)
    return this.board(ctx)
  }

  // ─── Trades ───────────────────────────────────────────────────────────────
  async trades(ctx: TenancyContext, filters: { currency?: string } = {}) {
    let query = supabase
      .from('fx_trades')
      .select(TRADE_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })
      .limit(500)
    if (filters.currency) query = query.eq('currency', filters.currency.toUpperCase())
    const { data, error } = await query.returns<TradeDbRow[]>()
    if (isNotReady(error)) return { ready: false, trades: [] }
    if (error) throw new DatabaseError('Failed to read the trades', error)
    return { ready: true, trades: (data ?? []).map(mapTrade) }
  }

  async createTrade(
    ctx: TenancyContext,
    input: FxTradeCreateInput,
    clientRequestId: string | null,
  ) {
    const { bookCurrency, kycThresholdMinor, ready } = await this.settings(ctx)
    if (!ready) throw new ValidationError('FX_NOT_READY')
    const currency = input.currency.toUpperCase()
    const rateMicro = parseRate(input.rate)
    if (rateMicro === null) throw new ValidationError('FX_RATE_INVALID')
    const bookAmountMinor = convertAtRate(input.amountMinor, rateMicro, currency, bookCurrency)
    const refusal = tradeRefusal({
      trade: { ...input, currency },
      bookCurrency,
      bookAmountMinor,
      kycThresholdMinor,
    })
    if (refusal) throw new ValidationError(refusal)

    if (input.customerId) {
      const { data, error } = await supabase
        .from('customers')
        .select('id')
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', input.customerId)
        .maybeSingle()
      if (error) throw new DatabaseError('Failed to read the customer', error)
      if (!data) throw new ValidationError('FX_CUSTOMER_NOT_FOUND')
    }

    const { data: id, error } = await supabase.rpc('fx_trade_create', {
      p_workspace_id: ctx.workspaceId,
      p_user_id: ctx.userId,
      p_trade: {
        side: input.side,
        currency,
        amount_minor: input.amountMinor,
        rate_micro: String(rateMicro),
        book_currency: bookCurrency,
        book_amount_minor: bookAmountMinor,
        customer_id: input.customerId ?? null,
        id_full_name: input.identity?.fullName ?? null,
        id_type: input.identity?.idType ?? null,
        id_number: input.identity?.idNumber ?? null,
        note: input.note ?? null,
        client_request_id: clientRequestId,
      },
    })
    if (error && (error.message ?? '').includes('FX_POSITION_SHORT')) {
      throw new ConflictError('FX_POSITION_SHORT')
    }
    if (isNotReady(error)) throw new ValidationError('FX_NOT_READY')
    if (error) throw new DatabaseError('Failed to record the trade', error)

    const { data: row, error: readError } = await supabase
      .from('fx_trades')
      .select(TRADE_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id as string)
      .returns<TradeDbRow[]>()
      .single()
    if (readError || !row) throw new DatabaseError('Failed to read the trade back', readError)
    return mapTrade(row)
  }

  async voidTrade(ctx: TenancyContext, id: string, reason: string) {
    const { data, error } = await supabase.rpc('fx_trade_void', {
      p_workspace_id: ctx.workspaceId,
      p_trade_id: id,
      p_reason: reason,
      p_user_id: ctx.userId,
    })
    if (isNotReady(error)) throw new ValidationError('FX_NOT_READY')
    if (error) throw new DatabaseError('Failed to void the trade', error)
    if (data === 'not_found') throw new NotFoundError('Trade')
    if (data === 'would_go_short') throw new ConflictError('FX_VOID_WOULD_GO_SHORT')
    if (data === 'already_voided') throw new ConflictError('FX_ALREADY_VOIDED')
    return { id, status: 'voided' as const }
  }

  /**
   * What the shop holds of each currency, its average cost, what sales earned
   * above it — and what the exchange did to the book-currency cash (sales in,
   * purchases out), so the drawer can be reconciled by hand.
   */
  async positions(ctx: TenancyContext) {
    const bookCurrency = await baseCurrencyOf(ctx.workspaceId)
    const { data, error } = await selectAllPages<TradeDbRow, { message: string; code?: string }>(
      (from, to) =>
        supabase
          .from('fx_trades')
          .select(TRADE_COLUMNS)
          .eq('workspace_id', ctx.workspaceId)
          .eq('status', 'posted')
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)
          .returns<TradeDbRow[]>(),
    )
    if (isNotReady(error)) return { ready: false, bookCurrency, positions: [], bookCashMinor: 0 }
    if (error) throw new DatabaseError('Failed to read the trades', error)
    const rows: FxTradeRow[] = (data ?? []).map((row) => ({
      id: row.id,
      side: row.side,
      currency: row.currency,
      amountMinor: Number(row.amount_minor),
      rateMicro: BigInt(row.rate_micro),
      bookAmountMinor: Number(row.book_amount_minor),
      status: row.status,
      createdAt: row.created_at,
    }))
    const positions = positionsFrom(rows, bookCurrency).map((p) => ({
      ...p,
      averageRate: p.averageRateMicro === null ? null : formatRate(p.averageRateMicro),
      averageRateMicro: undefined,
    }))
    const bookCashMinor = rows.reduce(
      (sum, t) =>
        t.side === 'sell'
          ? sum + t.bookAmountMinor
          : t.side === 'buy'
            ? sum - t.bookAmountMinor
            : sum,
      0,
    )
    return { ready: true, bookCurrency, positions, bookCashMinor }
  }

  // ─── Remittances (hawala) ─────────────────────────────────────────────────
  async remittances(ctx: TenancyContext, filters: { status?: RemittanceStatus | 'open' } = {}) {
    let query = supabase
      .from('remittances')
      .select(REMITTANCE_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })
      .limit(500)
    if (filters.status === 'open') query = query.in('status', ['created', 'sent'])
    else if (filters.status) query = query.eq('status', filters.status)
    const { data, error } = await query.returns<Array<Record<string, unknown>>>()
    if (isNotReady(error)) return { ready: false, remittances: [] }
    if (error) throw new DatabaseError('Failed to read the remittances', error)
    return {
      ready: true,
      remittances: (data ?? []).map((row) => ({
        id: row.id as string,
        number: Number(row.number),
        direction: row.direction as RemittanceDirection,
        counterparty: row.counterparty as string,
        senderName: row.sender_name as string,
        senderPhone: (row.sender_phone as string | null) ?? null,
        receiverName: row.receiver_name as string,
        receiverPhone: (row.receiver_phone as string | null) ?? null,
        destination: (row.destination as string | null) ?? null,
        currency: row.currency as string,
        amountMinor: Number(row.amount_minor),
        feeMinor: Number(row.fee_minor),
        customerId: (row.customer_id as string | null) ?? null,
        status: row.status as RemittanceStatus,
        cancelReason: (row.cancel_reason as string | null) ?? null,
        note: (row.note as string | null) ?? null,
        createdAt: row.created_at as string,
        paidAt: (row.paid_at as string | null) ?? null,
      })),
    }
  }

  /** Per partner and currency, from the PAID remittances: positive = the partner owes the shop. */
  async partnerBalances(ctx: TenancyContext) {
    const { data, error } = await selectAllPages<
      {
        counterparty: string
        direction: RemittanceDirection
        status: RemittanceStatus
        currency: string
        amount_minor: number | string
      },
      { message: string; code?: string }
    >((from, to) =>
      supabase
        .from('remittances')
        .select('counterparty, direction, status, currency, amount_minor')
        .eq('workspace_id', ctx.workspaceId)
        .eq('status', 'paid')
        .order('id', { ascending: true })
        .range(from, to)
        .returns<
          Array<{
            counterparty: string
            direction: RemittanceDirection
            status: RemittanceStatus
            currency: string
            amount_minor: number | string
          }>
        >(),
    )
    if (isNotReady(error)) return { ready: false, balances: [] }
    if (error) throw new DatabaseError('Failed to read the remittances', error)
    return {
      ready: true,
      balances: partnerBalances(
        (data ?? []).map((row) => ({ ...row, amountMinor: Number(row.amount_minor) })),
      ),
    }
  }

  /**
   * The identity threshold is in book currency. A remittance in another
   * currency is converted at the board's BUY rate; with no rate on the board
   * the amount cannot be compared, so an identity is required (the safe side).
   */
  private async remittanceNeedsIdentity(
    ctx: TenancyContext,
    currency: string,
    amountMinor: number,
  ): Promise<boolean> {
    const { bookCurrency, kycThresholdMinor } = await this.settings(ctx)
    if (kycThresholdMinor === null) return false
    if (currency === bookCurrency) return identityRequired(kycThresholdMinor, amountMinor)
    const rate = (await this.board(ctx)).rates.find((r) => r.currency === currency)
    const micro = rate ? parseRate(rate.buyRate) : null
    if (micro === null) return true
    return identityRequired(
      kycThresholdMinor,
      convertAtRate(amountMinor, micro, currency, bookCurrency),
    )
  }

  async createRemittance(
    ctx: TenancyContext,
    input: RemittanceCreateInput,
    clientRequestId: string | null,
  ) {
    const refusal = remittanceCreateRefusal(input)
    if (refusal) throw new ValidationError(refusal)
    const currency = input.currency.toUpperCase()
    if (!input.identity && (await this.remittanceNeedsIdentity(ctx, currency, input.amountMinor))) {
      throw new ValidationError('FX_KYC_REQUIRED')
    }
    // Outgoing: the code is made here and shown ONCE. Incoming: typed from the partner.
    const code = input.direction === 'outgoing' ? payoutCodeFrom(randomBytes(4)) : input.payoutCode!
    const { data, error } = await supabase
      .from('remittances')
      .insert({
        workspace_id: ctx.workspaceId,
        direction: input.direction,
        counterparty: input.counterparty,
        sender_name: input.senderName,
        sender_phone: input.senderPhone ?? null,
        receiver_name: input.receiverName,
        receiver_phone: input.receiverPhone ?? null,
        destination: input.destination ?? null,
        currency,
        amount_minor: input.amountMinor,
        fee_minor: input.feeMinor,
        customer_id: input.customerId ?? null,
        id_full_name: input.identity?.fullName ?? null,
        id_type: input.identity?.idType ?? null,
        id_number: input.identity?.idNumber ?? null,
        payout_code_hash: hashCode(ctx.workspaceId, code),
        note: input.note ?? null,
        client_request_id: clientRequestId,
        created_by: ctx.userId,
      })
      .select('id, number')
      .single()
    if (error?.code === '23505' && clientRequestId) {
      // The same request again: it exists; the code was shown the first time.
      throw new ConflictError('REMITTANCE_ALREADY_RECORDED')
    }
    if (isNotReady(error)) throw new ValidationError('FX_NOT_READY')
    if (error || !data) throw new DatabaseError('Failed to record the remittance', error)
    return {
      id: data.id as string,
      number: Number(data.number),
      ...(input.direction === 'outgoing' ? { payoutCode: code } : {}),
    }
  }

  async moveRemittance(ctx: TenancyContext, id: string, input: RemittanceMoveInput) {
    const { data: current, error } = await supabase
      .from('remittances')
      .select('id, direction, status')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to read the remittance', error)
    if (!current) throw new NotFoundError('Remittance')
    const refusal = remittanceMoveRefusal(
      current.direction as RemittanceDirection,
      current.status as RemittanceStatus,
      input,
    )
    if (refusal) throw new ValidationError(refusal)

    const { data: result, error: moveError } = await supabase.rpc('remittance_move', {
      p_workspace_id: ctx.workspaceId,
      p_remittance_id: id,
      p_from: current.status,
      p_to: input.status,
      p_reason: input.reason ?? null,
      p_code_hash: input.payoutCode ? hashCode(ctx.workspaceId, input.payoutCode) : null,
      p_actor: ctx.userId,
    })
    if (moveError) throw new DatabaseError('Failed to move the remittance', moveError)
    if (result === 'wrong_code') throw new ValidationError('REMITTANCE_CODE_WRONG')
    if (result === 'not_found') throw new NotFoundError('Remittance')
    if (result !== 'moved_ok') throw new ConflictError('REMITTANCE_CHANGED')
    return { id, status: input.status }
  }
}
