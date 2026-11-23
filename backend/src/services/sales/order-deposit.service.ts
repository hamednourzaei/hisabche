// ============================================
// backend/src/services/sales/order-deposit.service.ts
//
// Order Deposits (Made-to-order & Sales Order Pre-payments).
//
// P1 (V53 owner decision): a deposit is a LIABILITY to the customer, never
// revenue when it is received. The owner's table:
//
//   receipt            Dr cash / bank          Cr customer advances
//   applied to invoice Dr customer advances    Cr receivable
//   refund             Dr customer advances    Cr cash / bank
//
// The RECEIPT is booked here, through the ledger port, keyed by the deposit id,
// so a retried request cannot book the same money twice.
//
// APPLY and REFUND are NOT two statements from Node. supabase-js cannot open a
// transaction, and «post the entry, then update the status» leaves a posting
// with no settlement (or a settlement with no posting) when the second call
// dies. Both therefore live in docs/order-deposit-apply-refund-01-migration.sql
// as `order_deposit_apply` / `order_deposit_refund`: one transaction that locks
// the deposit, validates the invoice, writes the payment and its allocation
// through `payments_record`, posts the entry through
// `accounting_post_journal_entry`, records the audit row, and rolls the lot back
// on any failure.
//
// WHAT THIS FILE DOES, THEN: reads the deposit, resolves the chart of accounts
// by ROLE (never by a hard-coded code), converts nothing by hand — the database
// does that with the currency's own precision — calls the function, and maps its
// refusals onto HTTP.
//
// ⚠️ A DEPOSIT IS APPLICABLE ONLY WHEN ITS RECEIPT IS IN THE LEDGER. A receipt
// recorded while the chart of accounts could not express the entry is stored as
// `posting_status = 'pending_posting'`: an explicit, recoverable state, not a
// silent skip. `postReceipt` re-posts it idempotently and flips the flag.
// ============================================

import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  advanceDocumentFrom,
  advanceUsageOf,
  ledgerAmountOf,
  ledgerFractionDigitsOf,
  moneyAccountRole,
  tillMinorToMajor,
  validateApplyDeposit,
  validateRefundDeposit,
  type AccountRole,
  type AdvanceDocument,
  type AdvanceDocumentInput,
  type AdvanceUsageState,
  type OrderDepositRuleCode,
} from '@hisabche/validation'

import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { invalidateMoneyCaches } from '../../utils/money-cache'
import { logBusinessEvent } from '../event-log.service'
import { ledger } from '../accounting'
import { domainErrorCode } from '../accounting/accounting.repository'
import type { LedgerPort, LedgerPostingOutcome } from '../accounting/ledger.port'
import { baseCurrencyOf } from '../base-currency'
import type { TenancyContext } from '../tenancy.service'

/** A row of `order_deposits` as the database stores it (P1 migration 01 + apply/refund 01). */
export interface OrderDepositRow {
  id: string
  workspace_id: string
  order_id: string
  customer_id: string | null
  supplier_id?: string | null
  amount_minor: number
  payment_method: string
  applied_invoice_id: string | null
  /** The currency the deposit was taken in; NULL on rows written before the column existed. */
  currency: string | null
  /** `posted` | `pending_posting` | NULL (written before the column existed). */
  posting_status: string | null
  journal_entry_id: string | null
  /** session-deposit-01: what the document is. Absent before that migration = an order. */
  source_type?: DepositSourceType | null
  /** advances-02 */
  note?: string | null
  /** advances-03 */
  document?: AdvanceDocument | null
  created_at: string
}

/**
 * V54 5.4: a deposit is taken for a DOCUMENT — a sales order, or a booked
 * service session (بیعانه‌ی نوبت). The money is the same in both: Dr cash|bank
 * / Cr customer advances, applied later to the customer's invoice.
 */
export type DepositSourceType = 'sales_order' | 'service_session' | 'pre_sale' | 'pre_purchase'

/** advances-02: a pre-sale / pre-purchase is its OWN document (order_id = id). */
export const ADVANCE_KINDS = ['pre_sale', 'pre_purchase'] as const
export type AdvanceKind = (typeof ADVANCE_KINDS)[number]

function sourceTypeOf(raw: string | null | undefined): DepositSourceType {
  return raw === 'service_session' || raw === 'pre_sale' || raw === 'pre_purchase'
    ? raw
    : 'sales_order'
}

/** The money side of a deposit: what the customer owes us back, or what the supplier does. */
function advanceRole(kind: DepositSourceType): 'customer_advances' | 'supplier_advances' {
  return kind === 'pre_purchase' ? 'supplier_advances' : 'customer_advances'
}

export interface CreateOrderDepositInput {
  /** The client's own id, when it already recorded the receipt offline. */
  id?: string | undefined
  orderId: string
  customerId?: string | undefined
  supplierId?: string | undefined
  /** Integer minor units of the books currency — never a float major amount. */
  amountMinor: number
  paymentMethod?: string | undefined
  /** The ACCOUNTING day the money was taken. Defaults to today. */
  date?: string | undefined
  /** Default `sales_order`. The CALLER has checked that the document exists. */
  sourceType?: DepositSourceType | undefined
  /** advances-02: what was pre-sold / pre-bought, in the person's words. */
  note?: string | undefined
  /** advances-03: the priced lines (pre-sale / pre-purchase only). Totals are computed here. */
  document?: AdvanceDocumentInput | undefined
}

export interface CreatedOrderDeposit {
  deposit: OrderDepositRow
  posting: LedgerPostingOutcome
}

export interface ApplyDepositInput {
  invoiceId: string
  /** Integer minor units of the deposit's currency. */
  amountMinor: number
  /**
   * The caller's own key. A retry with the same key returns the first result;
   * the same key with a different request is refused as a conflict.
   */
  idempotencyKey: string
  date?: string | undefined
}

export interface RefundDepositInput {
  amountMinor: number
  idempotencyKey: string
  /** WHY the money goes back. Mandatory; the database also refuses an empty one. */
  reason: string
  method?: string | undefined
  date?: string | undefined
}

/** What is left of a deposit, as the database counts it (live payments only). */
export interface DepositBalanceView {
  amountMinor: number
  appliedMinor: number
  refundedMinor: number
  remainingMinor: number
}

export interface DepositApplication {
  replayed: boolean
  applicationId: string
  depositId: string
  invoiceId: string
  amountMinor: number
  currency: string
  paymentId: string
  journalEntryId: string | null
  balance: DepositBalanceView
}

export interface DepositRefund {
  replayed: boolean
  refundId: string
  depositId: string
  amountMinor: number
  currency: string
  method: string
  reason: string
  paymentId: string
  journalEntryId: string | null
  balance: DepositBalanceView
}

/**
 * One deposit as the customer screen reads it: the stored row plus what the
 * database says is left of it.
 *
 * `status` is DERIVED from the balance and the posting flag, never stored:
 *
 *   pending_posting  the receipt is not in the ledger yet, so nothing may be
 *                    applied or refunded from it (recoverable with /post)
 *   posting_unknown  the row predates `posting_status`: the receipt may or may
 *                    not be booked, and the screen says so instead of guessing
 *   fully_used       nothing remains — applied, refunded or both
 *   partially_used   some of it moved, some is still held
 *   available        untouched and posted
 */
export type DepositUsageStatus =
  'pending_posting' | 'posting_unknown' | 'available' | 'partially_used' | 'fully_used'

export interface CustomerDepositView extends DepositBalanceView {
  id: string
  orderId: string
  customerId: string | null
  supplierId?: string | null
  appliedInvoiceId: string | null
  currency: string | null
  paymentMethod: string
  postingStatus: string | null
  journalEntryId: string | null
  sourceType: DepositSourceType
  note: string | null
  /** advances-03: the lines it was taken for; null on an advance written without them. */
  document: AdvanceDocument | null
  /**
   * WP-05: how much of the money was applied or refunded — its own model,
   * beside (never instead of) the receipt state and the document status.
   * `null` = the applications or refunds could not be read.
   */
  usage: AdvanceUsageState | null
  status: DepositUsageStatus
  /** On the server nothing is waiting to be sent; the device fills this in. */
  pendingSync: boolean
  createdAt: string
}

/** Today as the ledger writes dates (YYYY-MM-DD). */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** The RPC answers snake_case rows; the rest of the server speaks camelCase. */
function balanceOf(raw: unknown): DepositBalanceView {
  const row = (raw ?? {}) as Record<string, unknown>
  return {
    amountMinor: Number(row.amount_minor ?? 0),
    appliedMinor: Number(row.applied_minor ?? 0),
    refundedMinor: Number(row.refunded_minor ?? 0),
    remainingMinor: Number(row.remaining_minor ?? 0),
  }
}

/**
 * What the customer screen calls this deposit.
 *
 * ⚠️ A NULL `posting_status` is NOT «posted» and NOT «pending»: the row was
 * written before the column existed, so whether the receipt is booked is
 * unknown. The database applies from it (it only refuses `pending_posting`),
 * but the screen must not claim it was booked.
 */
function depositStatusOf(
  postingStatus: string | null,
  balance: DepositBalanceView,
): DepositUsageStatus {
  if (postingStatus === 'pending_posting') return 'pending_posting'
  if (postingStatus !== 'posted') return 'posting_unknown'
  if (balance.remainingMinor <= 0) return 'fully_used'
  if (balance.appliedMinor > 0 || balance.refundedMinor > 0) return 'partially_used'
  return 'available'
}

function mapApplication(raw: unknown): DepositApplication {
  const row = (raw ?? {}) as Record<string, unknown>
  return {
    replayed: row.replayed === true,
    applicationId: String(row.application_id ?? ''),
    depositId: String(row.deposit_id ?? ''),
    invoiceId: String(row.invoice_id ?? ''),
    amountMinor: Number(row.amount_minor ?? 0),
    currency: String(row.currency ?? ''),
    paymentId: String(row.payment_id ?? ''),
    journalEntryId: row.journal_entry_id ? String(row.journal_entry_id) : null,
    balance: balanceOf(row.balance),
  }
}

function mapRefund(raw: unknown): DepositRefund {
  const row = (raw ?? {}) as Record<string, unknown>
  return {
    replayed: row.replayed === true,
    refundId: String(row.refund_id ?? ''),
    depositId: String(row.deposit_id ?? ''),
    amountMinor: Number(row.amount_minor ?? 0),
    currency: String(row.currency ?? ''),
    method: String(row.method ?? 'cash'),
    reason: String(row.reason ?? ''),
    paymentId: String(row.payment_id ?? ''),
    journalEntryId: row.journal_entry_id ? String(row.journal_entry_id) : null,
    balance: balanceOf(row.balance),
  }
}

/**
 * advances-02: what is still open, per side and currency, in minor units.
 * customer = money customers paid before their sale (orders, bookings,
 * pre-sales); supplier = money paid to suppliers before the goods.
 * Only posted receipts count; applications and refunds count while their
 * payment is posted — the same rule as `order_deposit_balance`.
 */
export interface OpenAdvances {
  customer: Record<string, number>
  supplier: Record<string, number>
}

export function summarizeOpenAdvances(
  deposits: ReadonlyArray<{
    id: string
    amount_minor: number
    currency: string | null
    source_type?: string | null
    posting_status: string | null
  }>,
  used: ReadonlyArray<{ deposit_id: string; amount_minor: number }>,
): OpenAdvances {
  const usedBy = new Map<string, number>()
  for (const row of used) {
    usedBy.set(row.deposit_id, (usedBy.get(row.deposit_id) ?? 0) + Number(row.amount_minor))
  }
  const out: OpenAdvances = { customer: {}, supplier: {} }
  for (const deposit of deposits) {
    // An unbooked receipt or an unknown currency is not a figure to add.
    if (deposit.posting_status !== 'posted' || !deposit.currency) continue
    const open = Number(deposit.amount_minor) - (usedBy.get(deposit.id) ?? 0)
    if (open <= 0) continue
    const side = deposit.source_type === 'pre_purchase' ? out.supplier : out.customer
    side[deposit.currency] = (side[deposit.currency] ?? 0) + open
  }
  return out
}

export class OrderDepositService {
  constructor(
    private readonly db: SupabaseClient = supabase,
    private readonly ledgerPort: LedgerPort = ledger,
    private readonly booksCurrencyOf: (workspaceId: string) => Promise<string> = baseCurrencyOf,
  ) {}

  async getOrderDeposits(ctx: TenancyContext, orderId: string) {
    const { data, error } = await this.db
      .from('order_deposits')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('order_id', orderId)

    if (error) throw error
    return data ?? []
  }

  /**
   * Every deposit this customer paid, with what is left of each.
   *
   * The remainder is the DATABASE's count (`order_deposit_balance`), the same
   * function apply/refund validate against: a screen that added the rows up
   * itself would disagree with the refusal the user then gets.
   */
  async listCustomerDeposits(
    ctx: TenancyContext,
    customerId: string,
  ): Promise<CustomerDepositView[]> {
    const { data, error } = await this.db
      .from('order_deposits')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return this.viewsOf(ctx, (data ?? []) as OrderDepositRow[])
  }

  /** advances-02: the dashboard's open advances (three reads, summed here). */
  async openAdvances(ctx: TenancyContext): Promise<OpenAdvances> {
    type DepositFigures = Parameters<typeof summarizeOpenAdvances>[0]
    let rows: DepositFigures
    const deposits = await this.db
      .from('order_deposits')
      .select('id, amount_minor, currency, source_type, posting_status')
      .eq('workspace_id', ctx.workspaceId)
    if (!deposits.error) {
      rows = (deposits.data ?? []) as DepositFigures
    } else {
      // Before session-deposit-01 there is no source_type: every deposit is a customer's.
      if (deposits.error.code !== '42703' && deposits.error.code !== 'PGRST204') {
        throw deposits.error
      }
      const legacy = await this.db
        .from('order_deposits')
        .select('id, amount_minor, currency, posting_status')
        .eq('workspace_id', ctx.workspaceId)
      if (legacy.error) throw legacy.error
      rows = (legacy.data ?? []) as DepositFigures
    }
    const applied = await this.db
      .from('order_deposit_applications')
      .select('deposit_id, amount_minor, payments!inner(status)')
      .eq('workspace_id', ctx.workspaceId)
      .eq('payments.status', 'posted')
    if (applied.error) throw applied.error
    const refunded = await this.db
      .from('order_deposit_refunds')
      .select('deposit_id, amount_minor, payments!inner(status)')
      .eq('workspace_id', ctx.workspaceId)
      .eq('payments.status', 'posted')
    if (refunded.error) throw refunded.error
    return summarizeOpenAdvances(rows, [
      ...((applied.data ?? []) as Array<{ deposit_id: string; amount_minor: number }>),
      ...((refunded.data ?? []) as Array<{ deposit_id: string; amount_minor: number }>),
    ])
  }

  /**
   * advances-02: every pre-sale (or pre-purchase) of the workspace, newest
   * first, each with what is left of it — the same balance apply/refund check.
   */
  async listAdvances(ctx: TenancyContext, kind: AdvanceKind): Promise<CustomerDepositView[]> {
    const { data, error } = await this.db
      .from('order_deposits')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('source_type', kind)
      .order('created_at', { ascending: false })
    if (error) {
      // Before advances-02 there is no such kind (or column): none exist yet.
      if (error.code === '42703' || error.code === 'PGRST204') return []
      throw error
    }
    return this.viewsOf(ctx, (data ?? []) as OrderDepositRow[])
  }

  private async viewsOf(
    ctx: TenancyContext,
    rows: OrderDepositRow[],
  ): Promise<CustomerDepositView[]> {
    if (rows.length === 0) return []

    // ⚠️ THE BALANCE IS THE DATABASE'S, COUNTED ONCE FOR THE WHOLE PAGE.
    // WP-10 removed the per-row `order_deposit_balance` call (N+1) by summing
    // applications and refunds in Node — which put the figure a person reads
    // back into a second implementation, beside the one apply/refund refuse
    // against. `order_deposit_balances` does the same SQL arithmetic for every
    // id in one call.
    const balances = await this.balancesOf(
      ctx,
      rows.map((row) => row.id),
    )

    const deposits: CustomerDepositView[] = []
    for (const row of rows) {
      const balance = balances.get(row.id)
      if (!balance) {
        throw new DatabaseError(
          'Failed to read the deposit balance',
          new Error(`order_deposit_balances returned no row for deposit ${row.id}`),
        )
      }
      const view: DepositBalanceView = balance

      deposits.push({
        id: row.id,
        orderId: row.order_id,
        customerId: row.customer_id,
        supplierId: row.supplier_id ?? null,
        appliedInvoiceId: row.applied_invoice_id,
        currency: row.currency,
        paymentMethod: row.payment_method,
        postingStatus: row.posting_status,
        journalEntryId: row.journal_entry_id,
        sourceType: sourceTypeOf(row.source_type),
        note: row.note ?? null,
        document: row.document ?? null,
        createdAt: row.created_at,
        ...view,
        status: depositStatusOf(row.posting_status, view),
        usage: advanceUsageOf(view),
        pendingSync: false,
      })
    }
    return deposits
  }

  /**
   * The balance of every deposit in ONE database call — or, on a deployment
   * that has not run docs/order-deposit-balances-01-migration.sql yet, one
   * call per deposit to the older `order_deposit_balance`. Both answer with
   * the database's own arithmetic; Node never subtracts.
   */
  private async balancesOf(
    ctx: TenancyContext,
    depositIds: string[],
  ): Promise<Map<string, DepositBalanceView>> {
    const balances = new Map<string, DepositBalanceView>()

    const batched = await this.db.rpc('order_deposit_balances', {
      p_workspace_id: ctx.workspaceId,
      p_deposit_ids: depositIds,
    })
    if (!batched.error) {
      for (const raw of (batched.data ?? []) as unknown[]) {
        const row = (raw ?? {}) as Record<string, unknown>
        if (!row.deposit_id) continue
        balances.set(String(row.deposit_id), balanceOf(raw))
      }
      return balances
    }

    // PGRST202 / 42883: the batched function is not installed yet. The
    // fallback is deliberately slower and deliberately NOT a Node subtraction.
    const missing = batched.error.code === 'PGRST202' || batched.error.code === '42883'
    if (!missing) {
      throw new DatabaseError('Failed to read the deposit balances', batched.error)
    }
    for (const depositId of depositIds) {
      const single = await this.db.rpc('order_deposit_balance', {
        p_workspace_id: ctx.workspaceId,
        p_deposit_id: depositId,
      })
      if (single.error) throw new DatabaseError('Failed to read the deposit balance', single.error)
      balances.set(depositId, balanceOf(single.data))
    }
    return balances
  }

  /**
   * Record a deposit and book it as a liability.
   *
   * A zero, negative or fractional-minor amount is refused: a deposit of «-0.5
   * minor units» is not a rounding detail, it is a wrong request.
   */
  async createOrderDeposit(
    ctx: TenancyContext,
    input: CreateOrderDepositInput,
  ): Promise<CreatedOrderDeposit> {
    const kind = input.sourceType ?? 'sales_order'
    const isAdvance = kind === 'pre_sale' || kind === 'pre_purchase'
    if (
      !Number.isSafeInteger(input.amountMinor) ||
      input.amountMinor < 0 ||
      (!isAdvance && input.amountMinor === 0)
    ) {
      throw new ValidationError('DEPOSIT_AMOUNT_INVALID')
    }

    // The currency is the BOOKS currency, decided by the server. It is stored on
    // the deposit so that an apply can later refuse an invoice in another one
    // instead of treating 100 dollars as 100 afghani.
    const currency = await this.booksCurrencyOf(ctx.workspaceId)
    // An advance names itself as its document; the id is fixed BEFORE the
    // insert so a retry with the same id is the same advance.
    const id = input.id ?? (isAdvance ? randomUUID() : undefined)
    const note = input.note?.trim() ? input.note.trim().slice(0, 500) : undefined
    // advances-03: only an advance carries lines, and the server prices them.
    let document: AdvanceDocument | undefined
    if (input.document) {
      if (!isAdvance) throw new ValidationError('ADVANCE_DOCUMENT_NOT_ALLOWED')
      const built = advanceDocumentFrom(input.document, currency, input.amountMinor)
      if (!built.ok) throw new ValidationError(built.code)
      document = built.document
    }

    const customerId = kind === 'pre_purchase' ? null : (input.customerId ?? null)
    const supplierId =
      kind === 'pre_purchase' ? (input.supplierId ?? input.customerId ?? null) : null

    const { data, error } = await this.db
      .from('order_deposits')
      .insert({
        ...(id ? { id } : {}),
        workspace_id: ctx.workspaceId,
        order_id: isAdvance ? id : input.orderId,
        customer_id: customerId,
        ...(supplierId ? { supplier_id: supplierId } : {}),
        amount_minor: input.amountMinor,
        payment_method: input.paymentMethod ?? 'cash',
        currency,
        // Written only for a session: an order deposit keeps working on a
        // database that has not run session-deposit-01 yet.
        ...(kind !== 'sales_order' ? { source_type: kind } : {}),
        ...(note ? { note } : {}),
        ...(document ? { document } : {}),
      })
      .select()
      .single()

    if (error) {
      // advances-03 not run: the column for the lines is missing.
      if (document && (error.code === '42703' || error.code === 'PGRST204')) {
        throw new ConflictError('ADVANCE_DOCUMENT_NOT_CONFIGURED')
      }
      if (kind !== 'sales_order' && (error.code === '42703' || error.code === 'PGRST204')) {
        throw new ConflictError(
          isAdvance ? 'ADVANCES_NOT_CONFIGURED' : 'SESSION_DEPOSIT_NOT_CONFIGURED',
        )
      }
      // advances-02 not run: the CHECK knows only orders and sessions.
      if (isAdvance && error.code === '23514') throw new ConflictError('ADVANCES_NOT_CONFIGURED')
      // The same receipt delivered twice — a device retrying its queue after a
      // lost answer. The row is the one it already created, so the second
      // delivery answers with THAT: re-booking is idempotent (the ledger keys
      // the entry by the deposit id), and writing a second deposit would be a
      // liability the shop does not owe.
      if (error.code === '23505' && id) {
        const existing = await this.db
          .from('order_deposits')
          .select('*')
          .eq('workspace_id', ctx.workspaceId)
          .eq('id', id)
          .maybeSingle()
        if (existing.error) throw existing.error
        if (existing.data) {
          const replay = existing.data as OrderDepositRow
          // A retry must not re-send different money under the same id.
          //
          // The party is compared in its NORMALISED form. A pre_purchase row
          // stores `customer_id = NULL` and `supplier_id = <id>`, while the
          // request carries `customerId: undefined`; comparing the raw fields
          // made a legitimate retry look like a conflict (`null !== undefined`)
          // and, worse, let a retry naming a DIFFERENT supplier pass because the
          // supplier column was never compared at all.
          const replayCustomer = replay.customer_id ?? null
          const replaySupplier = replay.supplier_id ?? null
          if (
            (!isAdvance && replay.order_id !== input.orderId) ||
            replayCustomer !== customerId ||
            replaySupplier !== supplierId ||
            Number(replay.amount_minor) !== input.amountMinor
          ) {
            throw new ConflictError('DEPOSIT_IDEMPOTENCY_CONFLICT')
          }
          return this.recorded(ctx, await this.recordReceiptState(ctx, replay, input.date))
        }
      }
      throw error
    }
    const deposit = data as OrderDepositRow

    if (isAdvance && input.amountMinor === 0) {
      const { data: updated, error: updateErr } = await this.db
        .from('order_deposits')
        .update({ posting_status: 'posted' })
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', deposit.id)
        .select()
        .single()
      if (updateErr) throw updateErr
      return this.recorded(ctx, {
        deposit: updated as OrderDepositRow,
        posting: { status: 'skipped', reason: 'missing_accounts', missing: [] },
      })
    }

    return this.recorded(ctx, await this.recordReceiptState(ctx, deposit, input.date))
  }

  /**
   * Recovery for a receipt that was recorded but not booked.
   *
   * Idempotent by construction: `postDocument` keys the entry by the deposit id,
   * so calling this twice returns the first entry (`already_posted`) and writes
   * nothing new. The flag then says `posted` and the deposit becomes applicable.
   */
  async postReceipt(
    ctx: TenancyContext,
    orderId: string,
    depositId: string,
    date?: string,
  ): Promise<CreatedOrderDeposit> {
    const deposit = await this.requireDeposit(ctx, orderId, depositId)
    const posted = await this.recordReceiptState(ctx, deposit, date)
    // Only the FIRST write is an event. `already_posted` means a retry asked
    // for the same entry and the ledger returned it; logging that again would
    // fill the activity feed with duplicates of one action.
    if (posted.posting.status === 'posted') {
      this.logDeposit(ctx, posted.deposit, 'receipt_posted')
    }
    return posted
  }

  /**
   * The activity/audit row for a deposit that was just recorded.
   *
   * Fire-and-forget on purpose: the money is already stored and booked, and a
   * logging failure must never turn a recorded receipt into an HTTP error.
   * `notify: false` — the person who just took the money does not need a bell
   * for their own action.
   */
  private recorded(ctx: TenancyContext, created: CreatedOrderDeposit): CreatedOrderDeposit {
    this.logDeposit(ctx, created.deposit, `${sourceTypeOf(created.deposit.source_type)}_recorded`)
    return created
  }

  private logDeposit(ctx: TenancyContext, deposit: OrderDepositRow, action: string): void {
    const kind = sourceTypeOf(deposit.source_type)
    const isAdvance = kind === 'pre_sale' || kind === 'pre_purchase'
    const title =
      action === 'receipt_posted'
        ? isAdvance
          ? 'دریافت پیش‌پرداخت قطعی شد'
          : 'دریافت بیعانه قطعی شد'
        : kind === 'pre_sale'
          ? 'پیش‌فروش ثبت شد'
          : kind === 'pre_purchase'
            ? 'پیش‌خرید ثبت شد'
            : kind === 'service_session'
              ? 'بیعانه جلسه ثبت شد'
              : 'بیعانه ثبت شد'
    logBusinessEvent({
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      entityType: isAdvance ? 'advance' : 'deposit',
      entityId: deposit.id,
      action,
      title,
      metadata: {
        kind,
        amountMinor: Number(deposit.amount_minor),
        currency: deposit.currency,
        postingStatus: deposit.posting_status,
      },
      notify: false,
      branchId: null,
    }).catch((err) => console.error('[OrderDepositService] logBusinessEvent failed:', err))
  }

  private logDepositAction(
    ctx: TenancyContext,
    deposit: OrderDepositRow,
    action: string,
    extraMeta?: Record<string, unknown>,
  ): void {
    const kind = sourceTypeOf(deposit.source_type)
    const isAdvance = kind === 'pre_sale' || kind === 'pre_purchase'
    const title = action.includes('applied')
      ? isAdvance
        ? 'اعمال پیش‌پرداخت به فاکتور'
        : 'اعمال بیعانه به فاکتور'
      : action.includes('refunded')
        ? isAdvance
          ? 'استرداد پیش‌پرداخت'
          : 'استرداد بیعانه'
        : action
    logBusinessEvent({
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      entityType: isAdvance ? 'advance' : 'deposit',
      entityId: deposit.id,
      action,
      title,
      metadata: {
        kind,
        currency: deposit.currency,
        ...extraMeta,
      },
      notify: false,
      branchId: null,
    }).catch((err) => console.error('[OrderDepositService] logBusinessEvent failed:', err))
  }

  /**
   * Apply part or all of a deposit to a FINAL invoice, atomically.
   *
   * The database decides: same workspace, same customer, same currency, a
   * posted receivable to credit, a real remaining balance on both sides. This
   * method only supplies the chart of accounts and the currency precision.
   */
  async applyDeposit(
    ctx: TenancyContext,
    orderId: string,
    depositId: string,
    input: ApplyDepositInput,
  ): Promise<DepositApplication> {
    const deposit = await this.requireDeposit(ctx, orderId, depositId)
    const fractionDigits = this.fractionDigitsOf(deposit)

    this.assertNoProblems(
      validateApplyDeposit({
        invoiceId: input.invoiceId,
        amountMinor: input.amountMinor,
        idempotencyKey: input.idempotencyKey,
        fractionDigits,
      }),
    )

    if (sourceTypeOf(deposit.source_type) === 'pre_purchase') {
      const supplier = await this.ledgerPort.ensureAccountsForRoles(ctx, [
        'supplier_advances',
        'payable',
      ])
      if (supplier.missing.length > 0) {
        throw new ValidationError(`DEPOSIT_ACCOUNTS_MISSING:${supplier.missing.join(',')}`)
      }
      const applied = await this.db.rpc('supplier_advance_apply', {
        p_workspace_id: ctx.workspaceId,
        p_user_id: ctx.userId,
        p_deposit_id: depositId,
        p_invoice_id: input.invoiceId,
        p_amount_minor: input.amountMinor,
        p_fraction_digits: fractionDigits,
        p_entry_date: input.date ?? todayIso(),
        p_idempotency_key: input.idempotencyKey,
        p_advances_account_id: supplier.accounts.supplier_advances,
        p_payable_account_id: supplier.accounts.payable,
        p_actor_role: ctx.role,
      })
      if (applied.error) throw this.rpcError(applied.error, 'apply the supplier advance')
      await invalidateMoneyCaches(ctx.workspaceId)
      this.logDepositAction(ctx, deposit, 'advance_applied', {
        invoiceId: input.invoiceId,
        amountMinor: input.amountMinor,
      })
      return mapApplication(applied.data)
    }

    const { accounts, missing } = await this.ledgerPort.ensureAccountsForRoles(ctx, [
      'customer_advances',
      'receivable',
    ])
    if (missing.length > 0) {
      throw new ValidationError(`DEPOSIT_ACCOUNTS_MISSING:${missing.join(',')}`)
    }

    const { data, error } = await this.db.rpc('order_deposit_apply', {
      p_workspace_id: ctx.workspaceId,
      p_user_id: ctx.userId,
      p_deposit_id: depositId,
      p_invoice_id: input.invoiceId,
      p_amount_minor: input.amountMinor,
      p_fraction_digits: fractionDigits,
      p_entry_date: input.date ?? todayIso(),
      p_idempotency_key: input.idempotencyKey,
      p_advances_account_id: accounts.customer_advances,
      p_receivable_account_id: accounts.receivable,
      p_actor_role: ctx.role,
    })

    if (error) throw this.rpcError(error, 'apply the order deposit')
    await invalidateMoneyCaches(ctx.workspaceId)
    this.logDepositAction(ctx, deposit, 'deposit_applied', {
      invoiceId: input.invoiceId,
      amountMinor: input.amountMinor,
    })
    return mapApplication(data)
  }

  /**
   * Refund part or all of an UNUSED deposit, atomically.
   *
   * Independent of any invoice: this is money going back, so the entry is
   * Dr customer advances / Cr cash | bank and no allocation is written.
   */
  async refundDeposit(
    ctx: TenancyContext,
    orderId: string,
    depositId: string,
    input: RefundDepositInput,
  ): Promise<DepositRefund> {
    const deposit = await this.requireDeposit(ctx, orderId, depositId)
    const fractionDigits = this.fractionDigitsOf(deposit)
    const method = input.method ?? deposit.payment_method ?? 'cash'

    this.assertNoProblems(
      validateRefundDeposit({
        amountMinor: input.amountMinor,
        idempotencyKey: input.idempotencyKey,
        fractionDigits,
        reason: input.reason,
      }),
    )

    const moneyRole = moneyAccountRole(method)
    const kind = sourceTypeOf(deposit.source_type)
    const { accounts, missing } = await this.ledgerPort.ensureAccountsForRoles(ctx, [
      advanceRole(kind),
      moneyRole,
    ])
    if (missing.length > 0) {
      throw new ValidationError(`DEPOSIT_ACCOUNTS_MISSING:${missing.join(',')}`)
    }

    // The supplier side: money comes BACK in (Dr cash / Cr supplier advances).
    const fn = kind === 'pre_purchase' ? 'supplier_advance_refund' : 'order_deposit_refund'
    const { data, error } = await this.db.rpc(fn, {
      p_workspace_id: ctx.workspaceId,
      p_user_id: ctx.userId,
      p_deposit_id: depositId,
      p_amount_minor: input.amountMinor,
      p_fraction_digits: fractionDigits,
      p_entry_date: input.date ?? todayIso(),
      p_method: method,
      p_reason: input.reason,
      p_idempotency_key: input.idempotencyKey,
      p_advances_account_id: accounts[advanceRole(kind)],
      p_money_account_id: accounts[moneyRole],
      p_actor_role: ctx.role,
    })

    if (error) throw this.rpcError(error, 'refund the order deposit')
    await invalidateMoneyCaches(ctx.workspaceId)
    this.logDepositAction(
      ctx,
      deposit,
      kind === 'pre_purchase' ? 'advance_refunded' : 'deposit_refunded',
      {
        amountMinor: input.amountMinor,
        reason: input.reason,
      },
    )
    return mapRefund(data)
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  /** The deposit, scoped to this workspace AND this order. Missing = 404. */
  private async requireDeposit(
    ctx: TenancyContext,
    orderId: string,
    depositId: string,
  ): Promise<OrderDepositRow> {
    const { data, error } = await this.db
      .from('order_deposits')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('order_id', orderId)
      .eq('id', depositId)
      .maybeSingle()

    if (error) throw error
    if (!data) throw new NotFoundError('Order deposit')
    return data as OrderDepositRow
  }

  /**
   * The precision the ledger must use for this deposit's currency.
   *
   * A NULL currency is UNKNOWN (the row predates the column) and so is a code
   * this build does not know: neither is guessed as two decimals.
   */
  private fractionDigitsOf(deposit: OrderDepositRow): number {
    const digits = ledgerFractionDigitsOf(deposit.currency)
    if (digits === null) throw new ValidationError('DEPOSIT_CURRENCY_UNKNOWN')
    return digits
  }

  private assertNoProblems(problems: readonly OrderDepositRuleCode[]): void {
    const first = problems[0]
    if (first) throw new ValidationError(first)
  }

  /**
   * A refusal from the database function, mapped onto HTTP.
   *
   * `DEPOSIT_NOT_FOUND` is a 404; every other `DEPOSIT_*` code describes the
   * STATE at the moment of the call (balance spent, invoice not final, receipt
   * not booked), so it is a 409 the client can explain rather than a 400 that
   * blames the request. Anything else is a real failure and stays a 500.
   */
  private rpcError(error: unknown, action: string): Error {
    const code = domainErrorCode(error)
    if (code === 'DEPOSIT_NOT_FOUND') return new NotFoundError('Order deposit')
    // The function answers the same code for a missing invoice and one in
    // another workspace, deliberately — from this workspace's point of view
    // there is no such invoice, and that is a 404.
    if (code === 'DEPOSIT_INVOICE_NOT_FOUND') return new NotFoundError('Invoice')
    // A malformed refund reason is the REQUEST's fault, not the state's: the
    // client can fix it and retry, so it is a 400 like the wire schema's.
    if (code === 'DEPOSIT_REFUND_REASON_REQUIRED' || code === 'DEPOSIT_REFUND_REASON_TOO_LONG') {
      return new ValidationError(code)
    }
    // DEPOSIT_REFUND_NOT_POSTED belongs here: the state is wrong, the request
    // is fine, and the money did not move.
    if (code?.startsWith('DEPOSIT_')) return new ConflictError(code)
    return new DatabaseError(`Failed to ${action}`, error)
  }

  /**
   * Book the receipt and record what happened to it.
   *
   * `posted` means an entry exists; `pending_posting` is the explicit,
   * recoverable state for a chart of accounts that could not express it yet.
   * Nothing is dropped, and the caller is told which accounts are missing.
   */
  private async recordReceiptState(
    ctx: TenancyContext,
    deposit: OrderDepositRow,
    date: string | undefined,
  ): Promise<CreatedOrderDeposit> {
    const currency = deposit.currency ?? (await this.booksCurrencyOf(ctx.workspaceId))
    const posting = await this.bookReceipt(ctx, deposit, date, currency)
    const journalEntryId = posting.status === 'skipped' ? null : posting.entryId
    const postingStatus = posting.status === 'skipped' ? 'pending_posting' : 'posted'

    const { data, error } = await this.db
      .from('order_deposits')
      .update({
        currency,
        posting_status: postingStatus,
        journal_entry_id: journalEntryId,
      })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', deposit.id)
      .select()
      .single()

    if (error) throw error
    return { deposit: data as OrderDepositRow, posting }
  }

  /**
   * Finalize an advance into a real, posted sale or purchase invoice.
   * Defect 3 & 4: Automatically moves stock and creates journal entries via InvoiceService.create().
   */
  async finalizeAdvance(ctx: TenancyContext, advanceId: string) {
    const advance = await this.requireDeposit(ctx, advanceId, advanceId)
    const kind = sourceTypeOf(advance.source_type)
    if (kind !== 'pre_sale' && kind !== 'pre_purchase') {
      throw new ValidationError('ADVANCE_KIND_REQUIRED')
    }

    if (advance.applied_invoice_id) {
      const { InvoiceService } = await import('../invoice.service')
      const invoiceService = new InvoiceService()
      const invoice = await invoiceService.getById(advance.applied_invoice_id, ctx)
      return { invoice, advance }
    }

    const isPurchase = kind === 'pre_purchase'
    const { InvoiceService } = await import('../invoice.service')
    const invoiceService = new InvoiceService()

    const rawLines = advance.document?.lines ?? []
    // ⚠️ MINOR → MAJOR WITH THE DEPOSIT'S OWN PRECISION. This was `/ 100`,
    // which is only right for a two-decimal currency: AFN has none, so a
    // 2,000 AFN advance became a 20 AFN invoice line. An unknown currency is a
    // refusal, never «assume two decimals».
    const currency = advance.currency?.trim() ? advance.currency : null
    if (!currency) throw new ValidationError('DEPOSIT_CURRENCY_UNKNOWN')
    const digits = this.fractionDigitsOf(advance)
    const majorOf = (minor: number): number => {
      if (minor === 0) return 0
      const amount = ledgerAmountOf(minor, digits)
      if (amount === null) throw new ValidationError('DEPOSIT_CURRENCY_PRECISION_UNSUPPORTED')
      return amount
    }
    const items = rawLines.map((line, idx) => ({
      productName: line.name || `Line ${idx + 1}`,
      quantity: line.quantity,
      unitPrice: line.unitPriceMinor
        ? majorOf(line.unitPriceMinor)
        : majorOf(line.totalMinor) / Math.max(1, line.quantity),
      productId: line.productId ?? undefined,
    }))

    const partyId = isPurchase ? advance.supplier_id || advance.customer_id : advance.customer_id

    // ⚠️ ONE KEY FOR THIS ADVANCE, NOT A FRESH UUID PER ATTEMPT. The invoice
    // creation and the settlement are two calls, so a failure between them
    // used to leave an invoice and an unapplied advance — and a retry made a
    // SECOND invoice. With the advance's own key both halves replay, so a
    // retry converges on one invoice, one payment, one application.
    const finalizeKey = `advance-finalize:${advance.id}`
    const invoice = await invoiceService.create(
      ctx,
      {
        type: isPurchase ? 'purchase' : 'sale',
        customerId: isPurchase ? undefined : (partyId ?? undefined),
        supplierId: isPurchase ? (partyId ?? undefined) : undefined,
        items:
          items.length > 0
            ? items
            : [
                {
                  productName: advance.note || (isPurchase ? 'پیش‌خرید' : 'پیش‌فروش'),
                  quantity: 1,
                  unitPrice: advance.amount_minor > 0 ? majorOf(advance.amount_minor) : 0,
                },
              ],
        currency: currency as (typeof import('@hisabche/validation').CURRENCY_CODES)[number],
        paymentMethod: 'credit',
      },
      null,
      { clientRequestId: finalizeKey },
    )

    if (advance.amount_minor > 0) {
      await this.applyDeposit(ctx, advance.order_id, advance.id, {
        invoiceId: invoice.id,
        amountMinor: advance.amount_minor,
        idempotencyKey: finalizeKey,
      })
    }

    await this.db
      .from('order_deposits')
      .update({ applied_invoice_id: invoice.id })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', advance.id)

    await invalidateMoneyCaches(ctx.workspaceId)
    this.logDepositAction(ctx, advance, 'advance_finalized', { invoiceId: invoice.id })

    const updatedAdvance = await this.requireDeposit(ctx, advanceId, advanceId)
    return { invoice, advance: updatedAdvance }
  }

  /**
   * Dr cash|bank, Cr customer advances — the money is held, not earned.
   *
   * The amount is converted from the stored minor units with the workspace's
   * own fraction digits: a 0-decimal and a 2-decimal currency both post the
   * figure the person actually paid.
   */
  private async bookReceipt(
    ctx: TenancyContext,
    deposit: OrderDepositRow,
    date: string | undefined,
    currency: string,
  ): Promise<LedgerPostingOutcome> {
    if (deposit.amount_minor <= 0) {
      return { status: 'skipped', reason: 'missing_accounts', missing: [] }
    }
    const amount = tillMinorToMajor(deposit.amount_minor, currency)
    const moneyRole = moneyAccountRole(deposit.payment_method)
    const kind = sourceTypeOf(deposit.source_type)
    const advance = advanceRole(kind)
    const needed: AccountRole[] = [moneyRole, advance]

    const { accounts, missing } = await this.ledgerPort.ensureAccountsForRoles(ctx, needed)
    if (missing.length > 0) {
      console.warn(
        `[OrderDeposits] deposit ${deposit.id} recorded but not booked: no account for ${missing.join(', ')}`,
      )
      return { status: 'skipped', reason: 'missing_accounts', missing }
    }

    return this.ledgerPort.postDocument(ctx, {
      sourceType: 'order_deposit',
      sourceId: deposit.id,
      date: date ?? todayIso(),
      description:
        kind === 'service_session'
          ? `بیعانه نوبت ${deposit.order_id}`
          : kind === 'pre_sale'
            ? `پیش‌فروش ${deposit.order_id}`
            : kind === 'pre_purchase'
              ? `پیش‌خرید ${deposit.order_id}`
              : `بیعانه سفارش ${deposit.order_id}`,
      reference: deposit.order_id,
      // A pre-purchase is money OUT: Dr supplier advances / Cr cash|bank.
      // Everything else is money IN: Dr cash|bank / Cr customer advances.
      lines:
        kind === 'pre_purchase'
          ? [
              { accountId: accounts[advance]!, debit: amount, credit: 0 },
              { accountId: accounts[moneyRole]!, debit: 0, credit: amount },
            ]
          : [
              { accountId: accounts[moneyRole]!, debit: amount, credit: 0 },
              { accountId: accounts[advance]!, debit: 0, credit: amount },
            ],
    })
  }
}
