// ============================================
// backend/src/services/wallet/wallet.service.ts
//
// A business's wallet (docs/wallet-01-migration.sql). Per WORKSPACE, never per
// user. Every movement of money is ONE Postgres function call (CLAUDE.md
// rule 4); this file validates, calls, and maps the raised codes to HTTP.
//
// ⚠️ THE PLAN PRICE IS OURS. `payUpgrade` prices the plan with `priceOf`
// (plan-pricing.ts) — never with a number from the client (rule 3).
// ============================================

import { randomUUID } from 'node:crypto'

import { supabase } from '../../db'
import { BaseError } from '../../errors/base.error'
import { DatabaseError } from '../../errors/database.error'
import type { TenancyContext } from '../tenancy.service'
import { sniffImageType } from '../blog/blog.domain'
import { priceOf } from '../subscription-upgrade.service'

export const RECEIPT_BUCKET = 'wallet-receipts'
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024

export class WalletError extends BaseError {
  constructor(code: string, statusCode: number) {
    super(code, statusCode)
    this.name = 'WalletError'
  }
}

const RAISED = [
  'WALLET_INSUFFICIENT_FUNDS',
  'WALLET_CURRENCY_MISMATCH',
  'WALLET_PLAN_NOT_PRICED',
  'WALLET_TOPUP_DUPLICATE_REFERENCE',
  'WALLET_TOPUP_NOT_PENDING',
  'WALLET_TOPUP_NOT_FOUND',
  'WALLET_METHOD_UNAVAILABLE',
  'WALLET_CARD_LAST4_REQUIRED',
  'WALLET_PAID_AT_IN_FUTURE',
  'WALLET_NOTE_REQUIRED',
  'WALLET_AMOUNT_INVALID',
  'WALLET_CURRENCY_INVALID',
  'SUBSCRIPTION_ALREADY_ACTIVE',
  'UPGRADE_REQUEST_PENDING',
  'SUBSCRIPTION_NOT_FOUND',
] as const

const STATUS: Record<(typeof RAISED)[number], number> = {
  WALLET_INSUFFICIENT_FUNDS: 409,
  WALLET_CURRENCY_MISMATCH: 409,
  WALLET_PLAN_NOT_PRICED: 409,
  WALLET_TOPUP_DUPLICATE_REFERENCE: 409,
  WALLET_TOPUP_NOT_PENDING: 409,
  WALLET_TOPUP_NOT_FOUND: 404,
  WALLET_METHOD_UNAVAILABLE: 409,
  WALLET_CARD_LAST4_REQUIRED: 400,
  WALLET_PAID_AT_IN_FUTURE: 400,
  WALLET_NOTE_REQUIRED: 400,
  WALLET_AMOUNT_INVALID: 400,
  WALLET_CURRENCY_INVALID: 400,
  SUBSCRIPTION_ALREADY_ACTIVE: 409,
  UPGRADE_REQUEST_PENDING: 409,
  SUBSCRIPTION_NOT_FOUND: 404,
}

/** The tables or functions are absent: the migration has not run. */
function notConfigured(error: { code?: string } | null): boolean {
  return !!error && ['42P01', 'PGRST205', '42883', 'PGRST202'].includes(error.code ?? '')
}

/** A raised code from a wallet function, as an HTTP error; anything else is a 500. */
export function walletFailure(error: { code?: string; message?: string }, fallback: string): Error {
  if (notConfigured(error)) return new WalletError('WALLET_NOT_CONFIGURED', 503)
  const code = RAISED.find((c) => (error.message ?? '').includes(c))
  return code ? new WalletError(code, STATUS[code]) : new DatabaseError(fallback, error)
}

/** A receipt's real type, from its bytes — never from the name or the claim. */
export function sniffReceiptType(bytes: Buffer): string | null {
  if (bytes.length >= 5 && bytes.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf'
  const image = sniffImageType(bytes)
  return image && image !== 'image/avif' ? image : null
}

export interface WalletBalance {
  currency: string
  balanceMinor: number
}

export interface PaymentMethod {
  id: string
  kind: 'card_to_card' | 'foreign_currency'
  currency: string
  title: string
  instructions: string
  destination: string
  isActive: boolean
  sortOrder: number
}

export interface WalletTransaction {
  id: string
  currency: string
  amountMinor: number
  balanceAfter: number
  kind: 'topup' | 'adjustment' | 'subscription_payment'
  referenceType: string | null
  referenceId: string | null
  note: string | null
  createdAt: string
}

export interface TopupRequest {
  id: string
  workspaceId: string
  methodId: string
  currency: string
  amountMinor: number
  creditedAmountMinor: number | null
  payerReference: string
  cardLast4: string | null
  paidAt: string
  hasReceipt: boolean
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  memberNote: string | null
  adminNote: string | null
  createdAt: string
  decidedAt: string | null
}

const METHOD_COLUMNS = 'id, kind, currency, title, instructions, destination, is_active, sort_order'
const TX_COLUMNS =
  'id, currency, amount_minor, balance_after, kind, reference_type, reference_id, note, created_at'
const TOPUP_COLUMNS =
  'id, workspace_id, method_id, currency, amount_minor, credited_amount_minor, payer_reference, card_last4, paid_at, receipt_path, status, member_note, admin_note, created_at, decided_at'

const toMethod = (r: Record<string, unknown>): PaymentMethod => ({
  id: String(r.id),
  kind: r.kind as PaymentMethod['kind'],
  currency: String(r.currency),
  title: String(r.title),
  instructions: String(r.instructions ?? ''),
  destination: String(r.destination),
  isActive: r.is_active === true,
  sortOrder: Number(r.sort_order ?? 0),
})

const toTx = (r: Record<string, unknown>): WalletTransaction => ({
  id: String(r.id),
  currency: String(r.currency),
  amountMinor: Number(r.amount_minor),
  balanceAfter: Number(r.balance_after),
  kind: r.kind as WalletTransaction['kind'],
  referenceType: (r.reference_type as string | null) ?? null,
  referenceId: (r.reference_id as string | null) ?? null,
  note: (r.note as string | null) ?? null,
  createdAt: String(r.created_at),
})

const toTopup = (r: Record<string, unknown>): TopupRequest => ({
  id: String(r.id),
  workspaceId: String(r.workspace_id),
  methodId: String(r.method_id),
  currency: String(r.currency),
  amountMinor: Number(r.amount_minor),
  creditedAmountMinor: r.credited_amount_minor === null ? null : Number(r.credited_amount_minor),
  payerReference: String(r.payer_reference),
  cardLast4: (r.card_last4 as string | null) ?? null,
  paidAt: String(r.paid_at),
  // The storage path itself never leaves the server; the admin opens the
  // receipt through a short-lived signed URL.
  hasReceipt: Boolean(r.receipt_path),
  status: r.status as TopupRequest['status'],
  memberNote: (r.member_note as string | null) ?? null,
  adminNote: (r.admin_note as string | null) ?? null,
  createdAt: String(r.created_at),
  decidedAt: (r.decided_at as string | null) ?? null,
})

export class WalletService {
  // ─── The business ──────────────────────────────────────────────────────

  async overview(ctx: TenancyContext): Promise<{
    balances: WalletBalance[]
    methods: PaymentMethod[]
  }> {
    const [wallets, methods] = await Promise.all([
      supabase
        .from('wallets')
        .select('currency, balance_minor')
        .eq('workspace_id', ctx.workspaceId),
      supabase
        .from('wallet_payment_methods')
        .select(METHOD_COLUMNS)
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
    ])
    for (const r of [wallets, methods]) {
      if (r.error) throw walletFailure(r.error, 'Failed to read the wallet')
    }
    return {
      balances: (wallets.data ?? []).map((w) => ({
        currency: String(w.currency),
        balanceMinor: Number(w.balance_minor),
      })),
      methods: (methods.data ?? []).map(toMethod),
    }
  }

  async transactions(
    ctx: TenancyContext,
    before?: string | undefined,
  ): Promise<WalletTransaction[]> {
    let query = supabase
      .from('wallet_transactions')
      .select(TX_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(50)
    if (before) query = query.lt('created_at', before)
    const { data, error } = await query
    if (error) throw walletFailure(error, 'Failed to read the wallet history')
    return (data ?? []).map(toTx)
  }

  async topups(ctx: TenancyContext): Promise<TopupRequest[]> {
    const { data, error } = await supabase
      .from('wallet_topup_requests')
      .select(TOPUP_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw walletFailure(error, 'Failed to read top-up requests')
    return (data ?? []).map(toTopup)
  }

  async requestTopup(
    ctx: TenancyContext,
    input: {
      methodId: string
      amountMinor: number
      payerReference: string
      cardLast4?: string | null | undefined
      paidAt: string
      note?: string | undefined
      receipt?: { base64: string } | undefined
    },
  ): Promise<TopupRequest> {
    let receiptPath: string | null = null
    let receiptMime: string | null = null
    if (input.receipt) {
      const bytes = Buffer.from(input.receipt.base64, 'base64')
      if (bytes.length === 0) throw new WalletError('WALLET_RECEIPT_EMPTY', 400)
      if (bytes.length > RECEIPT_MAX_BYTES) throw new WalletError('WALLET_RECEIPT_TOO_LARGE', 413)
      receiptMime = sniffReceiptType(bytes)
      if (!receiptMime) throw new WalletError('WALLET_RECEIPT_TYPE', 415)
      // A random name inside the business's own folder: nothing guessable.
      receiptPath = `${ctx.workspaceId}/${randomUUID()}`
      const upload = await supabase.storage
        .from(RECEIPT_BUCKET)
        .upload(receiptPath, bytes, { contentType: receiptMime, upsert: false })
      if (upload.error) {
        if (/bucket not found/i.test(upload.error.message)) {
          throw new WalletError('WALLET_NOT_CONFIGURED', 503)
        }
        throw new DatabaseError('Failed to store the receipt', upload.error)
      }
    }

    const { data, error } = await supabase.rpc('create_wallet_topup_request', {
      p_workspace_id: ctx.workspaceId,
      p_user_id: ctx.userId,
      p_method_id: input.methodId,
      p_amount_minor: input.amountMinor,
      p_payer_reference: input.payerReference,
      p_card_last4: input.cardLast4 ?? null,
      p_paid_at: input.paidAt,
      p_receipt_path: receiptPath,
      p_receipt_mime: receiptMime,
      p_note: input.note ?? null,
    })
    if (error) {
      // The request was refused: the file has no row pointing at it. Removing
      // an orphan object is storage cleanup, not a compensating write of data.
      if (receiptPath) await supabase.storage.from(RECEIPT_BUCKET).remove([receiptPath])
      throw walletFailure(error, 'Failed to file the top-up request')
    }
    return toTopup(data as Record<string, unknown>)
  }

  async cancelTopup(ctx: TenancyContext, requestId: string): Promise<void> {
    const { error } = await supabase.rpc('cancel_wallet_topup', {
      p_request_id: requestId,
      p_workspace_id: ctx.workspaceId,
      p_user_id: ctx.userId,
    })
    if (error) throw walletFailure(error, 'Failed to withdraw the top-up request')
  }

  /**
   * Pay a plan from this business's wallet. The price is computed here from
   * the one price list; the function debits, files the request as 'wallet'
   * and activates it in one transaction. Returns the activated subscription id
   * (null on a replay) for the after-activation work (commission, caches).
   */
  async payUpgrade(
    ctx: TenancyContext,
    input: {
      currentPlan: string
      plan: 'pro' | 'enterprise'
      interval: 'month' | 'year'
      walletCurrency: string
      idempotencyKey: string | null
    },
  ): Promise<{
    requestId: string
    subscriptionId: string | null
    balanceAfter: number
    replayed: boolean
  }> {
    const { amountMinor, currency } = priceOf(input.plan, input.interval)
    if (amountMinor === null) throw new WalletError('WALLET_PLAN_NOT_PRICED', 409)
    const { data, error } = await supabase.rpc('wallet_pay_subscription_upgrade', {
      p_workspace_id: ctx.workspaceId,
      p_user_id: ctx.userId,
      p_current_plan: input.currentPlan,
      p_plan: input.plan,
      p_interval: input.interval,
      p_amount_minor: amountMinor,
      p_plan_currency: currency,
      p_wallet_currency: input.walletCurrency,
      p_idempotency_key: input.idempotencyKey,
    })
    if (error) throw walletFailure(error, 'Failed to pay from the wallet')
    const r = data as {
      request_id: string
      subscription_id: string | null
      balance_after: number
      replayed: boolean
    }
    return {
      requestId: r.request_id,
      subscriptionId: r.subscription_id,
      balanceAfter: Number(r.balance_after),
      replayed: r.replayed === true,
    }
  }

  // ─── Platform admin ─────────────────────────────────────────────────────

  async listMethods(): Promise<PaymentMethod[]> {
    const { data, error } = await supabase
      .from('wallet_payment_methods')
      .select(METHOD_COLUMNS)
      .order('sort_order', { ascending: true })
    if (error) throw walletFailure(error, 'Failed to read payment methods')
    return (data ?? []).map(toMethod)
  }

  async saveMethod(
    adminId: string,
    id: string | null,
    input: Omit<PaymentMethod, 'id'>,
  ): Promise<PaymentMethod> {
    const row = {
      kind: input.kind,
      currency: input.currency,
      title: input.title,
      instructions: input.instructions,
      destination: input.destination,
      is_active: input.isActive,
      sort_order: input.sortOrder,
      updated_at: new Date().toISOString(),
    }
    const query = id
      ? supabase.from('wallet_payment_methods').update(row).eq('id', id)
      : supabase.from('wallet_payment_methods').insert({ ...row, created_by: adminId })
    const { data, error } = await query.select(METHOD_COLUMNS).maybeSingle()
    if (error) throw walletFailure(error, 'Failed to save the payment method')
    if (!data) throw new WalletError('WALLET_METHOD_NOT_FOUND', 404)
    return toMethod(data as Record<string, unknown>)
  }

  async topupQueue(status: TopupRequest['status'] | 'all'): Promise<TopupRequest[]> {
    let query = supabase
      .from('wallet_topup_requests')
      .select(TOPUP_COLUMNS)
      .order('created_at', { ascending: true })
      .limit(200)
    if (status !== 'all') query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw walletFailure(error, 'Failed to read the top-up queue')
    return (data ?? []).map(toTopup)
  }

  /** A signed link to one receipt, valid five minutes. */
  async receiptUrl(requestId: string): Promise<string> {
    const { data, error } = await supabase
      .from('wallet_topup_requests')
      .select('receipt_path')
      .eq('id', requestId)
      .maybeSingle()
    if (error) throw walletFailure(error, 'Failed to read the top-up request')
    const path = (data as { receipt_path?: string | null } | null)?.receipt_path
    if (!path) throw new WalletError('WALLET_RECEIPT_NOT_FOUND', 404)
    const signed = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(path, 300)
    if (signed.error || !signed.data)
      throw new DatabaseError('Failed to sign the receipt url', signed.error)
    return signed.data.signedUrl
  }

  async approveTopup(
    adminId: string,
    requestId: string,
    creditedMinor: number | null,
    note: string | null,
  ): Promise<number> {
    const { data, error } = await supabase.rpc('approve_wallet_topup', {
      p_request_id: requestId,
      p_admin_id: adminId,
      p_credited_minor: creditedMinor,
      p_note: note,
    })
    if (error) throw walletFailure(error, 'Failed to approve the top-up')
    return Number(data)
  }

  async rejectTopup(adminId: string, requestId: string, note: string): Promise<void> {
    const { error } = await supabase.rpc('reject_wallet_topup', {
      p_request_id: requestId,
      p_admin_id: adminId,
      p_note: note,
    })
    if (error) throw walletFailure(error, 'Failed to reject the top-up')
  }

  async adjust(
    adminId: string,
    workspaceId: string,
    currency: string,
    amountMinor: number,
    note: string,
  ): Promise<number> {
    const { data, error } = await supabase.rpc('wallet_adjust', {
      p_workspace_id: workspaceId,
      p_currency: currency,
      p_amount_minor: amountMinor,
      p_admin_id: adminId,
      p_note: note,
    })
    if (error) throw walletFailure(error, 'Failed to adjust the wallet')
    return Number(data)
  }

  /** One business's wallet, for the admin: find it by name, then look inside. */
  async searchWorkspaces(
    q: string,
  ): Promise<Array<{ id: string; name: string; balances: WalletBalance[] }>> {
    const { data, error } = await supabase
      .from('workspaces')
      .select('id, name')
      .ilike('name', `%${q.replace(/[%_]/g, '')}%`)
      .order('name')
      .limit(20)
    if (error) throw new DatabaseError('Failed to search businesses', error)
    const ids = (data ?? []).map((w) => String(w.id))
    if (ids.length === 0) return []
    const wallets = await supabase
      .from('wallets')
      .select('workspace_id, currency, balance_minor')
      .in('workspace_id', ids)
    if (wallets.error) throw walletFailure(wallets.error, 'Failed to read wallets')
    return (data ?? []).map((w) => ({
      id: String(w.id),
      name: String(w.name),
      balances: (wallets.data ?? [])
        .filter((b) => b.workspace_id === w.id)
        .map((b) => ({ currency: String(b.currency), balanceMinor: Number(b.balance_minor) })),
    }))
  }

  async workspaceLedger(workspaceId: string): Promise<WalletTransaction[]> {
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select(TX_COLUMNS)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw walletFailure(error, 'Failed to read the wallet history')
    return (data ?? []).map(toTx)
  }
}

export const walletService = new WalletService()
