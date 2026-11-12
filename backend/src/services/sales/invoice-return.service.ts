// ============================================
// backend/src/services/sales/invoice-return.service.ts
//
// Invoice Returns Service (Option 18 / Returns)
// Thin caller of the atomic Postgres function `invoice_return_create`.
// Ensures full atomic ledger reversal, restocking, cost recovery, and tenancy isolation.
//
// A return and the cash paid back for it are TWO events:
//   · `createReturn`  — the document: goods, tax, what the shop keeps (deductions), the credit
//   · `refundReturn`  — money leaving the till or the bank, recorded by the ONE payment core
// ============================================

import { fractionDigits, type KnownCurrency } from '@hisabche/formatting'
import {
  computeReturnDeductions,
  isReturnCondition,
  refundableMinor,
  returnRefundStatus,
  type ReturnCondition,
  type ReturnDeductionRequest,
  type ReturnLineRequest,
} from '@hisabche/validation'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { asReplay } from '../../utils/client-request'
import { invalidateMoneyCaches } from '../../utils/money-cache'
import { baseCurrencyOf } from '../base-currency'
import { logBusinessEvent } from '../event-log.service'
import type { RecordPaymentInput } from '../payments'
import type { TenancyContext } from '../tenancy.service'

interface ReturnRow {
  id: string
  original_invoice_id: string
  return_type: 'sale_return' | 'purchase_return'
  return_number: string
  return_date: string
  total_subtotal_minor: number | string
  total_discount_minor: number | string
  total_tax_minor: number | string
  grand_total_minor: number | string
  // invoice-return-05: absent on a database that has not run it
  reason_code?: string | null
  notes?: string | null
  deduction_minor?: number | string | null
  refunded_minor?: number | string | null
}

interface InvoiceMoney {
  id: string
  total?: number | string | null
  paid_amount?: number | string | null
  currency?: string | null
}

export type ReturnLineInput = ReturnLineRequest & {
  conditionCode?: ReturnCondition | undefined
}

export interface CreateReturnInput {
  originalInvoiceId: string
  returnType: 'sale_return' | 'purchase_return'
  returnNumber: string
  returnDate: string
  userId?: string | undefined
  clientRequestId?: string | null | undefined
  reasonCode?: string | undefined
  notes?: string | undefined
  deductions?: readonly ReturnDeductionRequest[] | undefined
  lines: readonly ReturnLineInput[]
}

export interface RefundReturnInput {
  /** MAJOR units of the invoice's currency. */
  amount: number
  method: 'cash' | 'bank'
  tillSessionId?: string | null | undefined
  entryDate?: string | undefined
  /** The caller's Idempotency-Key: the same key is the same refund, however often it is sent. */
  clientRequestId?: string | null | undefined
}

/** What the refund step needs from the payment core — a port, so the service is testable alone. */
export interface RefundPaymentPort {
  recordPayment(
    ctx: TenancyContext,
    input: RecordPaymentInput,
    options?: { clientRequestId?: string | null },
  ): Promise<{ id: string }>
}

const RETURN_REASONS = [
  'defective',
  'wrong_item',
  'customer_change_of_mind',
  'damaged_in_transit',
  'expired',
  'other',
] as const

const missingTable = (error: { code?: string } | null) =>
  error?.code === '42P01' || error?.code === 'PGRST205'

export class InvoiceReturnService {
  constructor(
    private readonly db: SupabaseClient = supabase,
    private readonly paymentsPort?: RefundPaymentPort,
  ) {}

  private async payments(): Promise<RefundPaymentPort> {
    if (this.paymentsPort) return this.paymentsPort
    // Loaded on first use: the payment core is the one authority over money, and this
    // service reaches it only to pay a refund — not at import time.
    const { payments } = await import('../payments')
    return payments
  }

  async getReturns(workspaceId: string, originalInvoiceId: string) {
    // Fail closed: verify invoice belongs to workspace first
    const { data: inv, error: invErr } = await this.db
      .from('invoices')
      .select('id, total, paid_amount, currency')
      .eq('id', originalInvoiceId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (invErr) throw new DatabaseError('Failed to verify invoice ownership', invErr)
    if (!inv) throw new NotFoundError('Invoice')

    const { data, error } = await this.db
      .from('invoice_returns')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('original_invoice_id', originalInvoiceId)
      .order('return_date', { ascending: false })

    if (error) throw new DatabaseError('Failed to fetch returns', error)
    return this.present(workspaceId, (data ?? []) as ReturnRow[], inv as InvoiceMoney)
  }

  /**
   * ⚠️ NOT A PostgREST EMBED. `invoice_return_lines.return_id` has no foreign key, so
   * `select('*, lines:invoice_return_lines(*)')` answered PGRST200 and the invoice page
   * could never list its returns. The lines, the deductions and the pending refunds are
   * read with their own queries and joined here; the rows leave in camelCase.
   */
  private async present(workspaceId: string, rows: ReturnRow[], invoice: InvoiceMoney) {
    if (rows.length === 0) return []
    const ids = rows.map((row) => row.id)

    const { data: lines, error } = await this.db
      .from('invoice_return_lines')
      .select('*')
      .eq('workspace_id', workspaceId)
      .in('return_id', ids)
    if (error) throw new DatabaseError('Failed to fetch return lines', error)

    // Both are new in invoice-return-05: a database without them has none to show.
    const deductions = await this.readOptional(workspaceId, 'invoice_return_deductions', ids)
    const refunds = await this.readOptional(workspaceId, 'invoice_return_refunds', ids)

    const group = <T extends { return_id: string }>(list: T[]) => {
      const byReturn = new Map<string, T[]>()
      for (const item of list)
        byReturn.set(item.return_id, [...(byReturn.get(item.return_id) ?? []), item])
      return byReturn
    }
    const linesBy = group((lines ?? []) as Array<{ return_id: string }>)
    const deductionsBy = group(deductions as Array<{ return_id: string }>)
    const refundsBy = group(
      refunds as Array<{ return_id: string; status: string; amount_minor: number | string }>,
    )

    const digits = this.digitsOf(invoice.currency)
    const factor = 10 ** digits
    const toMinor = (value: number | string | null | undefined) =>
      Math.round((Number(value) || 0) * factor)
    const num = (value: number | string | null | undefined) => Number(value) || 0

    // The invoice-level split — several returns on one invoice (older data) share one debt.
    const saleRows = rows.filter((row) => row.return_type === 'sale_return')
    const credited = saleRows.reduce((sum, row) => sum + num(row.grand_total_minor), 0)
    const refunded = saleRows.reduce((sum, row) => sum + num(row.refunded_minor), 0)
    const pendingOf = (id: string) =>
      (refundsBy.get(id) ?? [])
        .filter((refund) => refund.status === 'pending')
        .reduce((sum, refund) => sum + num(refund.amount_minor), 0)
    const pendingAll = saleRows.reduce((sum, row) => sum + pendingOf(row.id), 0)
    const invoiceRefundable = refundableMinor({
      netCreditMinor: credited,
      invoiceTotalMinor: toMinor(invoice.total),
      invoicePaidMinor: toMinor(invoice.paid_amount),
      refundedMinor: refunded,
      pendingMinor: pendingAll,
    })

    return rows.map((row) => {
      const credit = num(row.grand_total_minor)
      const refundedHere = num(row.refunded_minor)
      const pendingHere = pendingOf(row.id)
      const isSale = row.return_type === 'sale_return'
      const refundable = isSale
        ? Math.min(invoiceRefundable, Math.max(0, credit - refundedHere - pendingHere))
        : 0
      return {
        id: row.id,
        originalInvoiceId: row.original_invoice_id,
        returnType: row.return_type,
        returnNumber: row.return_number,
        returnDate: row.return_date,
        reasonCode: row.reason_code ?? null,
        notes: row.notes ?? null,
        totalSubtotalMinor: num(row.total_subtotal_minor),
        totalDiscountMinor: num(row.total_discount_minor),
        totalTaxMinor: num(row.total_tax_minor),
        deductionMinor: num(row.deduction_minor),
        // What the return CREDITS the customer: goods + tax - what the shop keeps.
        grandTotalMinor: credit,
        refundedMinor: refundedHere,
        pendingRefundMinor: pendingHere,
        refundableMinor: refundable,
        refundStatus: isSale
          ? returnRefundStatus({
              netCreditMinor: credit,
              invoiceTotalMinor: toMinor(invoice.total),
              invoicePaidMinor: toMinor(invoice.paid_amount),
              refundedMinor: refundedHere,
            })
          : 'not_due',
        deductions: (deductionsBy.get(row.id) ?? []).map((entry) => {
          const item = entry as unknown as Record<string, unknown>
          return {
            reason: String(item.reason_code),
            mode: String(item.mode),
            percent:
              item.percent === null || item.percent === undefined ? null : Number(item.percent),
            amountMinor: num(item.amount_minor as number | string),
            note: item.note === null || item.note === undefined ? '' : String(item.note),
          }
        }),
        lines: (linesBy.get(row.id) ?? []).map((entry) => {
          const line = entry as unknown as Record<string, unknown>
          return {
            id: line.id,
            originalLineId: line.original_line_id,
            productId: line.product_id,
            quantity: Number(line.quantity) || 0,
            restockChoice: line.restock_choice,
            reasonCode: line.reason_code,
            conditionCode: line.condition_code ?? null,
            subtotalMinor: num(line.subtotal_minor as number | string),
            discountMinor: num(line.discount_minor as number | string),
            taxMinor: num(line.tax_minor as number | string),
            totalMinor: num(line.total_minor as number | string),
          }
        }),
      }
    })
  }

  private async readOptional(workspaceId: string, table: string, returnIds: readonly string[]) {
    const { data, error } = await this.db
      .from(table)
      .select('*')
      .eq('workspace_id', workspaceId)
      .in('return_id', [...returnIds])
    if (error) {
      if (missingTable(error)) return []
      throw new DatabaseError(`Failed to fetch ${table}`, error)
    }
    return (data ?? []) as Array<Record<string, unknown> & { return_id: string }>
  }

  private digitsOf(currency: string | null | undefined): number {
    return currency ? (fractionDigits(currency as KnownCurrency) ?? 2) : 2
  }

  /** What the caller sent, checked before anything reaches the database (the RPC checks it again). */
  private validate(input: CreateReturnInput, digits: number) {
    const lines = input.lines ?? []
    if (!Array.isArray(lines) || lines.length === 0)
      throw new ValidationError('RETURN_LINES_REQUIRED')
    const seen = new Set<string>()
    for (const line of lines) {
      if (!line.originalLineId) throw new ValidationError('RETURN_LINES_REQUIRED')
      if (!(Number(line.returnQuantity) > 0)) throw new ValidationError('RETURN_QUANTITY_INVALID')
      if (seen.has(line.originalLineId)) throw new ValidationError('RETURN_LINE_DUPLICATE')
      seen.add(line.originalLineId)
      if (line.conditionCode !== undefined && !isReturnCondition(line.conditionCode)) {
        throw new ValidationError('INVALID_RETURN_CONDITION')
      }
    }
    if (
      input.reasonCode !== undefined &&
      !(RETURN_REASONS as readonly string[]).includes(input.reasonCode)
    ) {
      throw new ValidationError('INVALID_RETURN_REASON')
    }
    if ((input.deductions?.length ?? 0) > 0) {
      if (input.returnType !== 'sale_return')
        throw new ValidationError('RETURN_DEDUCTION_NOT_ALLOWED')
      try {
        // Shape only — the net base is the database's to know. A base no deduction can exceed.
        computeReturnDeductions(Number.MAX_SAFE_INTEGER, input.deductions, digits)
      } catch (error) {
        throw new ValidationError(
          error instanceof Error ? error.message : 'RETURN_DEDUCTION_INVALID',
        )
      }
    }
  }

  async createReturn(workspaceId: string, input: CreateReturnInput) {
    if (!workspaceId) throw new ValidationError('ACCOUNTING_WORKSPACE_REQUIRED')

    // Idempotency check: the same key is the same return — answer with the one that exists.
    const existing = await this.findByKey(workspaceId, input.clientRequestId)
    if (existing) {
      const [replayed] = await this.replayOf(workspaceId, existing)
      return asReplay(replayed as object)
    }

    // Fail closed: verify invoice belongs to workspace first and read currency for precision
    const { data: inv, error: invErr } = await this.db
      .from('invoices')
      .select('id, currency')
      .eq('id', input.originalInvoiceId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (invErr) throw new DatabaseError('Failed to verify invoice ownership', invErr)
    if (!inv) throw new NotFoundError('Invoice')

    const p_fraction_digits = this.digitsOf(inv.currency)
    this.validate(input, p_fraction_digits)

    // One return per invoice. The idempotent replay above already answered a retry of
    // the same request, so anything reaching here with an existing return is a second,
    // different one — the same goods would come back twice.
    const { count: existingReturns, error: countErr } = await this.db
      .from('invoice_returns')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('original_invoice_id', input.originalInvoiceId)
    if (countErr) throw new DatabaseError('Failed to check existing returns', countErr)
    if ((existingReturns ?? 0) > 0) throw new ConflictError('INVOICE_ALREADY_RETURNED')

    // Package Returns: Fail-closed guard (NEEDS_OWNER_DECISION)
    // Entitlement return / cash refund for prepaid packages is intentionally deferred pending owner policy.
    const originalLineIds = input.lines.map((l) => l.originalLineId)
    const { data: invItems } = await this.db
      .from('invoice_items')
      .select('id, product_id')
      .eq('workspace_id', workspaceId)
      .in('id', originalLineIds)

    if (invItems && invItems.length > 0) {
      const prodIds = [
        ...new Set(invItems.map((it: { product_id?: string }) => it.product_id).filter(Boolean)),
      ]
      if (prodIds.length > 0) {
        const { data: prods } = await this.db
          .from('products')
          .select('id, offering_type')
          .eq('workspace_id', workspaceId)
          .in('id', prodIds)

        const hasPackage = (prods ?? []).some(
          (p: { offering_type?: string | null }) => p.offering_type === 'package',
        )
        if (hasPackage) {
          throw new ValidationError(
            'PACKAGE_RETURNS_NOT_SUPPORTED_NEEDS_OWNER_DECISION: Package returns are currently deferred and require owner decision on prorated consumption policy.',
          )
        }
      }
    }

    const deductions = (input.deductions ?? []).map((entry) => ({
      reason: entry.reason,
      mode: entry.mode,
      ...(entry.mode === 'percent' ? { percent: entry.percent } : { amount: entry.amount }),
      ...(entry.note ? { note: entry.note } : {}),
    }))

    // Call atomic Postgres function with exact minor unit factor. The deductions argument is
    // sent only when there are some, so a plain return still works on a database that has not
    // run invoice-return-05 yet.
    const { data, error } = await this.db.rpc('invoice_return_create', {
      p_workspace_id: workspaceId,
      p_user_id: input.userId ?? null,
      p_fraction_digits,
      p_return: {
        originalInvoiceId: input.originalInvoiceId,
        returnType: input.returnType,
        returnNumber: input.returnNumber,
        returnDate: input.returnDate,
        ...(input.reasonCode ? { reasonCode: input.reasonCode } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
        // Stored with the return by the function itself, so a retry cannot fall between the two.
        ...(input.clientRequestId ? { clientRequestId: input.clientRequestId } : {}),
      },
      p_lines: input.lines.map((l) => ({
        originalLineId: l.originalLineId,
        quantity: l.returnQuantity,
        restockChoice: l.restockChoice ?? 'restock',
        reasonCode: l.reasonCode ?? 'return',
        ...(l.conditionCode ? { conditionCode: l.conditionCode } : {}),
      })),
      ...(deductions.length > 0 ? { p_deductions: deductions } : {}),
    })

    if (error) {
      const msg = error.message ?? ''
      // The function does not exist: docs/invoice-return-01-migration.sql has not
      // been applied to this database. Say so instead of a bare 500.
      if (
        error.code === 'PGRST202' ||
        error.code === '42883' ||
        /could not find the function|function .* does not exist/i.test(msg)
      ) {
        throw new DatabaseError(
          deductions.length > 0
            ? 'RETURN_MIGRATION_05_REQUIRED: apply docs/invoice-return-05-core-migration.sql'
            : 'RETURN_FUNCTION_MISSING: apply docs/invoice-return-01-migration.sql',
          error,
        )
      }
      // The one-per-invoice trigger (invoice-return-04) caught a concurrent second return.
      if (msg.includes('INVOICE_ALREADY_RETURNED')) {
        // …unless the «second» is the SAME request arriving twice at once: then the first one's
        // return is the answer, and it is already there.
        const twin = await this.findByKey(workspaceId, input.clientRequestId)
        if (twin) {
          const [replayed] = await this.replayOf(workspaceId, twin)
          return asReplay(replayed as object)
        }
        throw new ConflictError('INVOICE_ALREADY_RETURNED')
      }
      if (msg.includes('INVOICE_NOT_FOUND')) throw new NotFoundError('Invoice')
      if (msg.includes('INVOICE_LINE_NOT_FOUND')) throw new NotFoundError('Invoice line')
      if (msg.includes('RETURN_QUANTITY_EXCEEDS_ORIGINAL')) {
        throw new ConflictError('RETURN_QUANTITY_EXCEEDS_ORIGINAL')
      }
      if (msg.includes('RETURN_ACCOUNTS_MISSING')) {
        throw new ConflictError(msg)
      }
      if (
        msg.includes('ACCOUNTING_WORKSPACE_REQUIRED') ||
        msg.includes('INVALID_RETURN_PARAMETERS') ||
        msg.includes('INVALID_FRACTION_DIGITS') ||
        msg.includes('INVALID_RETURN_CONDITION') ||
        msg.includes('RETURN_DEDUCTION_')
      ) {
        throw new ValidationError(msg)
      }
      if (msg.includes('JOURNAL_ENTRY_UNBALANCED')) {
        throw new ConflictError('JOURNAL_ENTRY_UNBALANCED')
      }
      throw new DatabaseError(msg, error)
    }

    // Invalidate financial and dashboard caches
    await invalidateMoneyCaches(workspaceId)

    // V61 §2.5: Restore exact batches for restocked batch-tracked lines
    if (data && typeof data === 'object' && 'id' in data) {
      const restocked = input.lines.filter(
        (l) => (l.restockChoice ?? 'restock') === 'restock' && l.returnQuantity > 0,
      )
      if (restocked.length > 0) {
        const { data: itemRows } = await this.db
          .from('invoice_items')
          .select('id, product_id')
          .eq('workspace_id', workspaceId)
          .in(
            'id',
            restocked.map((l) => l.originalLineId),
          )
        const productByLine = new Map<string, string>(
          (itemRows ?? [])
            .filter((r: { id: string; product_id: string | null }) => Boolean(r.product_id))
            .map((r: { id: string; product_id: string }) => [r.id, r.product_id]),
        )
        const linesWithProduct = restocked
          .map((l) => ({
            productId: productByLine.get(l.originalLineId),
            quantity: l.returnQuantity,
          }))
          .filter((l): l is { productId: string; quantity: number } => Boolean(l.productId))

        if (linesWithProduct.length > 0) {
          const { traceabilityService } = await import('../traceability/traceability.service')
          await traceabilityService.restoreBatchesForReturn(
            { workspaceId },
            {
              originalInvoiceId: input.originalInvoiceId,
              returnId: String((data as { id: string }).id),
              entryDate: input.returnDate,
              lines: linesWithProduct,
            },
          )
        }
      }
    }

    // The invoice's own history is where a person looks for «who returned this, and why».
    if (input.userId && data && typeof data === 'object' && 'id' in data) {
      const made = data as { id: string; grandTotalMinor?: number; deductionMinor?: number }
      void logBusinessEvent({
        userId: input.userId,
        workspaceId,
        entityType: 'invoice',
        entityId: input.originalInvoiceId,
        action: 'invoice_returned',
        title: `مرجوعی ${input.returnNumber} ثبت شد`,
        metadata: {
          returnId: made.id,
          returnNumber: input.returnNumber,
          returnType: input.returnType,
          reasonCode: input.reasonCode ?? null,
          lines: input.lines.length,
          creditMinor: made.grandTotalMinor ?? null,
          deductionMinor: made.deductionMinor ?? 0,
          deductions: (input.deductions ?? []).map((entry) => entry.reason),
        },
        notify: false,
      })
    }

    return data
  }

  /** The return this Idempotency-Key already made, if any. A database without the column has none. */
  private async findByKey(
    workspaceId: string,
    key: string | null | undefined,
  ): Promise<ReturnRow | null> {
    if (!key) return null
    const { data, error } = await this.db
      .from('invoice_returns')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('client_request_id', key)
      .maybeSingle()
    if (error) {
      // 42703: invoice-return-05 has not run — no key has ever been stored, so none can match.
      if (error.code === '42703' || missingTable(error)) return null
      throw new DatabaseError('Failed to look up the request', error)
    }
    return (data as ReturnRow | null) ?? null
  }

  private async replayOf(workspaceId: string, row: ReturnRow) {
    const { data: inv } = await this.db
      .from('invoices')
      .select('id, total, paid_amount, currency')
      .eq('id', row.original_invoice_id)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    return this.present(
      workspaceId,
      [row],
      (inv ?? { id: row.original_invoice_id }) as InvoiceMoney,
    )
  }

  /**
   * Pay back, in cash or by bank, part or all of the credit a sale return created.
   *
   * Three steps, in this order, so that no step can be left half-true:
   *   1. RESERVE under a lock — the cap is checked and the amount set aside, so two
   *      people refunding the same return cannot both be told «yes».
   *   2. PAY through the payment core (money OUT to the customer). Its idempotency key is the
   *      reservation, so a retry never pays twice.
   *   3. SETTLE — the reservation becomes a paid refund and the return's counter moves once.
   * If the payment is refused the reservation is released; if settling fails after the
   * payment, the reservation stays pending (it still counts against the cap) and the error
   * says so — a refund that was paid is never silently forgotten.
   */
  async refundReturn(
    ctx: TenancyContext,
    invoiceId: string,
    returnId: string,
    input: RefundReturnInput,
  ) {
    const workspaceId = ctx.workspaceId
    if (input.method !== 'cash' && input.method !== 'bank') {
      throw new ValidationError('INVALID_REFUND_METHOD')
    }
    if (!(Number(input.amount) > 0) || !Number.isFinite(Number(input.amount))) {
      throw new ValidationError('INVALID_REFUND_AMOUNT')
    }

    const { data: ret, error: retErr } = await this.db
      .from('invoice_returns')
      .select('id, return_type, return_number, original_invoice_id')
      .eq('id', returnId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (retErr) throw new DatabaseError('Failed to read the return', retErr)
    if (!ret || ret.original_invoice_id !== invoiceId) throw new NotFoundError('Return')
    if (ret.return_type !== 'sale_return') throw new ConflictError('REFUND_NOT_ALLOWED')

    const { data: inv, error: invErr } = await this.db
      .from('invoices')
      .select('id, customer_id, currency, exchange_rate')
      .eq('id', invoiceId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (invErr) throw new DatabaseError('Failed to read the invoice', invErr)
    if (!inv) throw new NotFoundError('Invoice')

    const digits = this.digitsOf(inv.currency)
    const amountMinor = Math.round(Number(input.amount) * 10 ** digits)
    if (amountMinor <= 0) throw new ValidationError('INVALID_REFUND_AMOUNT')

    const reserved = await this.db.rpc('invoice_return_refund_reserve', {
      p_workspace_id: workspaceId,
      p_user_id: ctx.userId ?? null,
      p_fraction_digits: digits,
      p_return_id: returnId,
      p_amount_minor: amountMinor,
      p_method: input.method,
      p_client_request_id: input.clientRequestId ?? null,
    })
    if (reserved.error) throw this.refundError(reserved.error)
    const reservation = reserved.data as {
      id: string
      status?: string
      paymentId?: string | null
      replayed?: boolean
    }
    const refundId = reservation.id

    // The same key again: a refund that already PAID answers with its payment and pays nothing.
    if (reservation.replayed && reservation.status === 'paid' && reservation.paymentId) {
      return { refundId, paymentId: reservation.paymentId, amountMinor, replayed: true }
    }

    const bookCurrency = await baseCurrencyOf(workspaceId)
    const currency = inv.currency ? String(inv.currency) : bookCurrency
    const rate = Number(inv.exchange_rate)

    let paymentId: string
    try {
      const payments = await this.payments()
      const payment = await payments.recordPayment(
        ctx,
        {
          direction: 'out',
          partyType: 'customer',
          partyId: inv.customer_id ?? null,
          amount: Number(input.amount),
          currency,
          // A return is undone at the rate the invoice was booked at, so paying it back
          // creates no exchange difference of its own.
          ...(currency !== bookCurrency && rate > 0 ? { exchangeRate: rate } : {}),
          method: input.method === 'cash' ? 'cash' : 'transfer',
          entryDate: input.entryDate,
          reference: String(ret.return_number),
          notes: `بازپرداخت مرجوعی ${ret.return_number}`,
          ...(input.method === 'cash' && input.tillSessionId
            ? { tillSessionId: input.tillSessionId }
            : {}),
        },
        { clientRequestId: refundId },
      )
      paymentId = payment.id
    } catch (cause) {
      // Nothing was paid: give the reserved room back, then say why.
      await this.db.rpc('invoice_return_refund_fail', {
        p_workspace_id: workspaceId,
        p_refund_id: refundId,
      })
      throw cause
    }

    const settled = await this.db.rpc('invoice_return_refund_settle', {
      p_workspace_id: workspaceId,
      p_refund_id: refundId,
      p_payment_id: paymentId,
    })
    if (settled.error) {
      throw new DatabaseError(
        `REFUND_PAID_NOT_SETTLED: payment ${paymentId} was recorded; the reservation ${refundId} is still pending`,
        settled.error,
      )
    }

    await invalidateMoneyCaches(workspaceId)

    if (ctx.userId) {
      void logBusinessEvent({
        userId: ctx.userId,
        workspaceId,
        entityType: 'invoice',
        entityId: invoiceId,
        action: 'return_refunded',
        title: `بازپرداخت مرجوعی ${ret.return_number} پرداخت شد`,
        metadata: {
          returnId,
          refundId,
          paymentId,
          amountMinor,
          method: input.method,
          tillSessionId: input.method === 'cash' ? (input.tillSessionId ?? null) : null,
        },
        notify: false,
      })
    }
    return { refundId, paymentId, amountMinor, replayed: false }
  }

  private refundError(error: PostgrestError) {
    const msg = error.message ?? ''
    if (
      error.code === 'PGRST202' ||
      error.code === '42883' ||
      /could not find the function|function .* does not exist/i.test(msg)
    ) {
      return new DatabaseError(
        'REFUND_MIGRATION_05_REQUIRED: apply docs/invoice-return-05-core-migration.sql',
        error,
      )
    }
    if (msg.includes('REFUND_EXCEEDS_REFUNDABLE')) return new ConflictError(msg)
    if (msg.includes('IDEMPOTENCY_KEY_PAYLOAD_MISMATCH')) return new ConflictError(msg)
    if (msg.includes('RETURN_NOT_FOUND')) return new NotFoundError('Return')
    if (msg.includes('INVOICE_NOT_FOUND')) return new NotFoundError('Invoice')
    if (msg.includes('REFUND_NOT_ALLOWED')) return new ConflictError('REFUND_NOT_ALLOWED')
    if (msg.includes('INVALID_REFUND_') || msg.includes('INVALID_FRACTION_DIGITS')) {
      return new ValidationError(msg)
    }
    return new DatabaseError(msg, error)
  }
}
