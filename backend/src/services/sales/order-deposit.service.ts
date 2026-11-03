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

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ledgerFractionDigitsOf,
  moneyAccountRole,
  tillMinorToMajor,
  validateApplyDeposit,
  validateRefundDeposit,
  type AccountRole,
  type OrderDepositRuleCode,
} from '@hisabche/validation'

import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { invalidateMoneyCaches } from '../../utils/money-cache'
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
  customer_id: string
  amount_minor: number
  payment_method: string
  applied_invoice_id: string | null
  /** The currency the deposit was taken in; NULL on rows written before the column existed. */
  currency: string | null
  /** `posted` | `pending_posting` | NULL (written before the column existed). */
  posting_status: string | null
  journal_entry_id: string | null
  created_at: string
}

export interface CreateOrderDepositInput {
  /** The client's own id, when it already recorded the receipt offline. */
  id?: string | undefined
  orderId: string
  customerId: string
  /** Integer minor units of the books currency — never a float major amount. */
  amountMinor: number
  paymentMethod?: string | undefined
  /** The ACCOUNTING day the money was taken. Defaults to today. */
  date?: string | undefined
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
  customerId: string
  currency: string | null
  paymentMethod: string
  postingStatus: string | null
  journalEntryId: string | null
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
    const rows = (data ?? []) as OrderDepositRow[]

    const deposits: CustomerDepositView[] = []
    for (const row of rows) {
      const { data: balance, error: balanceError } = await this.db.rpc('order_deposit_balance', {
        p_workspace_id: ctx.workspaceId,
        p_deposit_id: row.id,
      })
      // A balance that cannot be read is a failed read, not «zero left»: the
      // screen must not offer to refund money it could not count.
      if (balanceError) throw balanceError

      const view = balanceOf(balance)
      deposits.push({
        id: row.id,
        orderId: row.order_id,
        customerId: row.customer_id,
        currency: row.currency,
        paymentMethod: row.payment_method,
        postingStatus: row.posting_status,
        journalEntryId: row.journal_entry_id,
        createdAt: row.created_at,
        ...view,
        status: depositStatusOf(row.posting_status, view),
        pendingSync: false,
      })
    }
    return deposits
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
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
      throw new ValidationError('DEPOSIT_AMOUNT_INVALID')
    }

    // The currency is the BOOKS currency, decided by the server. It is stored on
    // the deposit so that an apply can later refuse an invoice in another one
    // instead of treating 100 dollars as 100 afghani.
    const currency = await this.booksCurrencyOf(ctx.workspaceId)

    const { data, error } = await this.db
      .from('order_deposits')
      .insert({
        ...(input.id ? { id: input.id } : {}),
        workspace_id: ctx.workspaceId,
        order_id: input.orderId,
        customer_id: input.customerId,
        amount_minor: input.amountMinor,
        payment_method: input.paymentMethod ?? 'cash',
        currency,
      })
      .select()
      .single()

    if (error) {
      // The same receipt delivered twice — a device retrying its queue after a
      // lost answer. The row is the one it already created, so the second
      // delivery answers with THAT: re-booking is idempotent (the ledger keys
      // the entry by the deposit id), and writing a second deposit would be a
      // liability the shop does not owe.
      if (error.code === '23505' && input.id) {
        const existing = await this.db
          .from('order_deposits')
          .select('*')
          .eq('workspace_id', ctx.workspaceId)
          .eq('id', input.id)
          .maybeSingle()
        if (existing.error) throw existing.error
        if (existing.data) {
          const replay = existing.data as OrderDepositRow
          // A retry must not re-send different money under the same id.
          if (
            replay.order_id !== input.orderId ||
            replay.customer_id !== input.customerId ||
            Number(replay.amount_minor) !== input.amountMinor
          ) {
            throw new ConflictError('DEPOSIT_IDEMPOTENCY_CONFLICT')
          }
          return this.recordReceiptState(ctx, replay, input.date)
        }
      }
      throw error
    }
    const deposit = data as OrderDepositRow

    return this.recordReceiptState(ctx, deposit, input.date)
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
    return this.recordReceiptState(ctx, deposit, date)
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
    const { accounts, missing } = await this.ledgerPort.ensureAccountsForRoles(ctx, [
      'customer_advances',
      moneyRole,
    ])
    if (missing.length > 0) {
      throw new ValidationError(`DEPOSIT_ACCOUNTS_MISSING:${missing.join(',')}`)
    }

    const { data, error } = await this.db.rpc('order_deposit_refund', {
      p_workspace_id: ctx.workspaceId,
      p_user_id: ctx.userId,
      p_deposit_id: depositId,
      p_amount_minor: input.amountMinor,
      p_fraction_digits: fractionDigits,
      p_entry_date: input.date ?? todayIso(),
      p_method: method,
      p_reason: input.reason,
      p_idempotency_key: input.idempotencyKey,
      p_advances_account_id: accounts.customer_advances,
      p_money_account_id: accounts[moneyRole],
      p_actor_role: ctx.role,
    })

    if (error) throw this.rpcError(error, 'refund the order deposit')
    await invalidateMoneyCaches(ctx.workspaceId)
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
    const amount = tillMinorToMajor(deposit.amount_minor, currency)
    const moneyRole = moneyAccountRole(deposit.payment_method)
    const needed: AccountRole[] = [moneyRole, 'customer_advances']

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
      description: `بیعانه سفارش ${deposit.order_id}`,
      reference: deposit.order_id,
      lines: [
        { accountId: accounts[moneyRole]!, debit: amount, credit: 0 },
        { accountId: accounts.customer_advances!, debit: 0, credit: amount },
      ],
    })
  }
}
