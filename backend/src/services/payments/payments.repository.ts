// ============================================
// backend/src/services/payments/payments.repository.ts
//
// The only file in the payments core that knows Supabase and column names.
// ============================================

import { supabase } from '../../db'
import {
  IdempotencyUnavailableError,
  isMissingIdempotencySupport,
} from '../../utils/client-request'
import { ConflictError, DatabaseError } from '../../errors/database.error'
import type { TenancyContext } from '../tenancy.service'

import type { AllocationRequest, OpenInvoice, PartyType, PaymentDirection } from './payments.domain'
import type {
  PartyInvoiceRow,
  PartyLineRow,
  PartyPaymentRow,
  PartyReturnRow,
} from '@hisabche/validation'

const PAGE = 1000

/** Reads a query page by page until a short page; stops on the first error. */
async function readAll(
  label: string,
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: Record<string, any>[] | null; error: { message: string } | null }>,
): Promise<Record<string, any>[]> {
  const rows: Record<string, any>[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw new DatabaseError(`Failed to fetch ${label}`, error)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return rows
  }
}

/**
 * The sale returns of the given invoices, all pages. A database that has not
 * run docs/invoice-return-01-migration.sql has no `invoice_returns` table: that
 * is «no returns», not a failed statement.
 */
async function readSaleReturns(
  workspaceId: string,
  invoiceIds: readonly string[],
): Promise<Array<Omit<PartyReturnRow, 'currency'>>> {
  const rows: Array<Omit<PartyReturnRow, 'currency'>> = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('invoice_returns')
      .select('id, original_invoice_id, return_type, return_number, return_date, grand_total_minor')
      .eq('workspace_id', workspaceId)
      .eq('return_type', 'sale_return')
      .in('original_invoice_id', [...invoiceIds])
      .order('return_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') return []
      throw new DatabaseError('Failed to fetch party returns', error)
    }
    rows.push(...((data ?? []) as Array<Omit<PartyReturnRow, 'currency'>>))
    if (!data || data.length < PAGE) return rows
  }
}

export interface PaymentRow {
  id: string
  paymentNumber: string | null
  direction: PaymentDirection
  partyType: PartyType
  partyId: string | null
  amount: number
  currency: string
  method: string
  entryDate: string
  reference: string
  notes: string
  status: 'draft' | 'posted' | 'cancelled'
  journalEntryId: string | null
  createdAt: string | null
  allocations: Array<{ id: string; invoiceId: string; amount: number }>
}

export function domainErrorCode(error: unknown): string | null {
  const message = (error as { message?: string } | null)?.message ?? ''
  return /\b([A-Z][A-Z_]{6,})\b/.exec(message)?.[1] ?? null
}

function mapPayment(raw: Record<string, any>): PaymentRow {
  return {
    id: raw.id,
    paymentNumber: raw.payment_number ?? null,
    direction: raw.direction,
    partyType: raw.party_type,
    partyId: raw.party_id ?? null,
    amount: Number(raw.amount) || 0,
    currency: raw.currency ?? 'AFN',
    method: raw.method ?? 'cash',
    entryDate: String(raw.entry_date ?? '').slice(0, 10),
    reference: raw.reference ?? '',
    notes: raw.notes ?? '',
    status: raw.status ?? 'posted',
    journalEntryId: raw.journal_entry_id ?? null,
    createdAt: raw.created_at ?? null,
    allocations: (raw.allocations ?? []).map((a: Record<string, any>) => ({
      id: a.id,
      invoiceId: a.invoice_id,
      amount: Number(a.amount) || 0,
    })),
  }
}

const PAYMENT_COLUMNS = `
  id, payment_number, direction, party_type, party_id, amount, currency, method,
  entry_date, reference, notes, status, journal_entry_id, created_at,
  allocations:payment_allocations(id, invoice_id, amount)
`

export class PaymentsRepository {
  async listPayments(
    workspaceId: string,
    filters: { partyId?: string; direction?: PaymentDirection; limit?: number } = {},
  ): Promise<PaymentRow[]> {
    let query = supabase
      .from('payments')
      .select(PAYMENT_COLUMNS)
      .eq('workspace_id', workspaceId)
      .order('entry_date', { ascending: false })
      .limit(Math.min(filters.limit ?? 50, 200))

    if (filters.partyId) query = query.eq('party_id', filters.partyId)
    if (filters.direction) query = query.eq('direction', filters.direction)

    const { data, error } = await query
    if (error) throw new DatabaseError('Failed to fetch payments', error)
    return (data ?? []).map(mapPayment)
  }

  /** The payment a keyed request already recorded, in this workspace. */
  async paymentIdByClientRequestId(workspaceId: string, key: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('payments')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('client_request_id', key)
      .maybeSingle()
    if (error) {
      if (isMissingIdempotencySupport(error)) throw new IdempotencyUnavailableError('payment')
      throw new DatabaseError('Failed to look up the request', error)
    }
    return (data as { id: string } | null)?.id ?? null
  }

  async getPayment(workspaceId: string, id: string): Promise<PaymentRow | null> {
    const { data, error } = await supabase
      .from('payments')
      .select(PAYMENT_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch payment', error)
    return data ? mapPayment(data) : null
  }

  /**
   * The invoices a party still owes on.
   *
   * Read from `invoice_outstanding`, which subtracts the allocations from the
   * total. Reading `paid_amount` instead would trust a cached number that a
   * plain invoice PATCH can set to anything.
   */
  async openInvoicesFor(
    workspaceId: string,
    partyType: PartyType,
    partyId: string,
  ): Promise<OpenInvoice[]> {
    const partyColumn = partyType === 'customer' ? 'customer_id' : 'supplier_id'
    const invoiceType = partyType === 'customer' ? 'sale' : 'purchase'

    const { data, error } = await supabase
      .from('invoice_outstanding')
      .select(
        'invoice_id, invoice_number, total, allocated, due_date, invoice_date, type, currency',
      )
      .eq('workspace_id', workspaceId)
      .eq(partyColumn, partyId)
      .eq('type', invoiceType)
      .gt('outstanding', 0)
      .order('due_date', { ascending: true })

    if (error) throw new DatabaseError('Failed to fetch open invoices', error)

    return (data ?? []).map((row) => ({
      invoiceId: row.invoice_id,
      invoiceNumber: row.invoice_number ?? '',
      total: Number(row.total) || 0,
      allocated: Number(row.allocated) || 0,
      dueDate: String(row.due_date ?? '').slice(0, 10),
      invoiceDate: String(row.invoice_date ?? '').slice(0, 10),
      currency: row.currency ? String(row.currency) : null,
    }))
  }

  /**
   * Open invoices addressed BY ID, with the party each one belongs to.
   *
   * ---------------------------------------------------------------------
   * T9 — WHY THIS EXISTS ALONGSIDE `openInvoicesFor`
   *
   * `openInvoicesFor` answers «what does this customer still owe», which is
   * the right question when a shopkeeper says «he paid me 500». It cannot
   * answer «settle THIS invoice», because it filters by party — and a cash
   * sale to a walk-in has `customer_id IS NULL`, so `.eq('customer_id', null)`
   * matches nothing and the allocation is refused as unknown.
   *
   * That is why recording payment at invoice creation had no working path,
   * and why `paid_amount` was being written directly instead — the defect
   * behind «مبلغ پرداخت‌شده با مجموع پرداخت‌ها یکی نیست».
   *
   * ⚠️ `customerId` / `supplierId` COME BACK ON PURPOSE. The caller must
   * check that an invoice addressed by id actually belongs to the party being
   * credited. Without that check, an explicit allocation could apply one
   * customer's money to another customer's debt — inside the same workspace,
   * so RLS would never see it.
   */
  /**
   * The rate each of these invoices was booked at (books currency per one unit
   * of its own). Null = this database keeps no rate on invoices
   * (invoice-exchange-rate-01 not run). An invoice with none contributes NaN,
   * which the caller reads as «no single rate».
   */
  async invoiceExchangeRates(
    workspaceId: string,
    invoiceIds: readonly string[],
  ): Promise<number[] | null> {
    const unique = [...new Set(invoiceIds.filter(Boolean))]
    if (unique.length === 0) return []
    const { data, error } = await supabase
      .from('invoices')
      .select('id, exchange_rate')
      .eq('workspace_id', workspaceId)
      .in('id', unique)
    if (error) {
      if (['42703', 'PGRST204'].includes(error.code ?? '')) return null
      throw new DatabaseError('Failed to read the rate of the settled invoices', error)
    }
    return ((data ?? []) as Array<{ exchange_rate?: number | string | null }>).map((row) =>
      Number(row.exchange_rate),
    )
  }

  /**
   * The rate each of these invoices was booked at, by invoice. An invoice in
   * the books currency (or made before rates were kept) is absent from the
   * map. null = this database keeps no rate on invoices at all.
   */
  async invoiceRatesById(
    workspaceId: string,
    invoiceIds: readonly string[],
  ): Promise<Map<string, number> | null> {
    const unique = [...new Set(invoiceIds.filter(Boolean))]
    if (unique.length === 0) return new Map()
    const { data, error } = await supabase
      .from('invoices')
      .select('id, exchange_rate')
      .eq('workspace_id', workspaceId)
      .in('id', unique)
    if (error) {
      if (['42703', 'PGRST204'].includes(error.code ?? '')) return null
      throw new DatabaseError('Failed to read the rate of the settled invoices', error)
    }
    const rates = new Map<string, number>()
    for (const row of (data ?? []) as Array<{
      id: string
      exchange_rate?: number | string | null
    }>) {
      const rate = Number(row.exchange_rate)
      if (rate > 0 && Number.isFinite(rate)) rates.set(row.id, rate)
    }
    return rates
  }

  async openInvoicesByIds(
    workspaceId: string,
    invoiceIds: readonly string[],
  ): Promise<
    Array<OpenInvoice & { customerId: string | null; supplierId: string | null; type: string }>
  > {
    const unique = [...new Set(invoiceIds.filter(Boolean))]
    if (unique.length === 0) return []

    const { data, error } = await supabase
      .from('invoice_outstanding')
      .select(
        'invoice_id, invoice_number, total, allocated, due_date, invoice_date, type, customer_id, supplier_id, currency',
      )
      // The tenancy boundary. An id from another workspace simply does not
      // come back, so it is reported as unknown rather than settled.
      .eq('workspace_id', workspaceId)
      .in('invoice_id', unique)
      .gt('outstanding', 0)

    if (error) throw new DatabaseError('Failed to fetch invoices for allocation', error)

    return (data ?? []).map((row) => ({
      invoiceId: row.invoice_id,
      invoiceNumber: row.invoice_number ?? '',
      total: Number(row.total) || 0,
      allocated: Number(row.allocated) || 0,
      dueDate: String(row.due_date ?? '').slice(0, 10),
      invoiceDate: String(row.invoice_date ?? '').slice(0, 10),
      customerId: row.customer_id ?? null,
      supplierId: row.supplier_id ?? null,
      type: String(row.type ?? ''),
      currency: row.currency ? String(row.currency) : null,
    }))
  }

  /** Every open invoice in the workspace, for the aging report. */
  async allOpenInvoices(workspaceId: string, invoiceType: 'sale' | 'purchase') {
    const { data, error } = await supabase
      .from('invoice_outstanding')
      .select(
        'invoice_id, invoice_number, total, allocated, due_date, invoice_date, customer_id, supplier_id',
      )
      .eq('workspace_id', workspaceId)
      .eq('type', invoiceType)
      .gt('outstanding', 0)

    if (error) throw new DatabaseError('Failed to fetch open invoices', error)

    return (data ?? []).map((row) => ({
      invoiceId: row.invoice_id,
      invoiceNumber: row.invoice_number ?? '',
      total: Number(row.total) || 0,
      allocated: Number(row.allocated) || 0,
      dueDate: String(row.due_date ?? '').slice(0, 10),
      invoiceDate: String(row.invoice_date ?? '').slice(0, 10),
      partyId: (invoiceType === 'sale' ? row.customer_id : row.supplier_id) ?? null,
    }))
  }

  async recordPayment(
    ctx: TenancyContext,
    payment: {
      paymentNumber: string | null
      direction: PaymentDirection
      partyType: PartyType
      partyId: string | null
      amount: number
      currency: string
      method: string
      entryDate: string
      reference: string
      notes: string
    },
    allocations: AllocationRequest[],
    clientRequestId: string | null = null,
    /** The till this cash enters or leaves, and by how much in ITS currency. */
    till: { sessionId: string; amountMinor: number } | null = null,
    /** What a bank or money changer kept, in the payment's currency. */
    fee: number | null = null,
  ): Promise<{ id: string; replayed: boolean }> {
    // Keyed: the wrapper calls `payments_record` and stamps the key in the
    // same transaction (docs/offline-idempotency-migration.sql).
    // At a till: one more wrapper, which checks the till is open and writes
    // payment, allocations and till in ONE transaction
    // (docs/till-payments-01-migration.sql).
    // With a fee: the widest wrapper, which takes the till too (or none) and
    // stamps the fee in the same transaction
    // (docs/opening-capital-and-fees-01-migration.sql).
    const fn = fee
      ? 'payments_record_with_fee'
      : till
        ? 'payments_record_at_till'
        : clientRequestId
          ? 'payments_record_keyed'
          : 'payments_record'
    const { data, error } = await supabase.rpc(fn, {
      ...(fee
        ? {
            p_client_request_id: clientRequestId,
            p_session_id: till?.sessionId ?? null,
            p_till_amount_minor: till?.amountMinor ?? null,
            p_fee_amount: fee,
          }
        : till
          ? {
              p_client_request_id: clientRequestId,
              p_session_id: till.sessionId,
              p_till_amount_minor: till.amountMinor,
            }
          : clientRequestId
            ? { p_client_request_id: clientRequestId }
            : {}),
      p_workspace_id: ctx.workspaceId,
      p_user_id: ctx.userId,
      p_payment: {
        payment_number: payment.paymentNumber,
        direction: payment.direction,
        party_type: payment.partyType,
        party_id: payment.partyId,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        entry_date: payment.entryDate,
        reference: payment.reference,
        notes: payment.notes,
        status: 'posted',
      },
      p_allocations: allocations.map((a) => ({ invoice_id: a.invoiceId, amount: a.amount })),
    })

    // The function is not there: the migration has not been run. Said as
    // that — recording the payment WITHOUT its till would be a silent lie.
    if (error && fee && ['PGRST202', '42883'].includes(error.code ?? '')) {
      throw new ConflictError('PAYMENT_FEE_NOT_CONFIGURED')
    }
    if (error && till && ['PGRST202', '42883'].includes(error.code ?? '')) {
      throw new ConflictError('PAYMENT_TILL_NOT_CONFIGURED')
    }
    if (error) throw error
    if (clientRequestId || till || fee) {
      // payments_record_keyed / _at_till answer { payment_id, replayed }.
      const keyed = (data ?? {}) as { payment_id?: string; replayed?: boolean }
      if (!keyed.payment_id) throw new DatabaseError('Keyed payment returned no id', null)
      return { id: keyed.payment_id, replayed: keyed.replayed === true }
    }
    return { id: data as string, replayed: false }
  }

  /** The fee stored on a payment; 0 when none, or when this database keeps none. */
  async feeOf(workspaceId: string, paymentId: string): Promise<number> {
    const { data, error } = await supabase
      .from('payments')
      .select('fee_amount')
      .eq('workspace_id', workspaceId)
      .eq('id', paymentId)
      .maybeSingle()
    if (error) {
      if (['42703', 'PGRST204'].includes(error.code ?? '')) return 0
      throw new DatabaseError('Failed to read the fee of the payment', error)
    }
    return Number((data as { fee_amount?: number | string | null } | null)?.fee_amount) || 0
  }

  async cancelPayment(ctx: TenancyContext, paymentId: string): Promise<{ unallocated: number }> {
    const { data, error } = await supabase.rpc('payments_cancel', {
      p_workspace_id: ctx.workspaceId,
      p_payment_id: paymentId,
    })

    if (error) throw error
    return { unallocated: Number((data as Record<string, unknown>)?.unallocated) || 0 }
  }

  async attachJournalEntry(workspaceId: string, paymentId: string, entryId: string) {
    const { error } = await supabase
      .from('payments')
      .update({ journal_entry_id: entryId, updated_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId)
      .eq('id', paymentId)

    if (error) throw new DatabaseError('Failed to link the payment to its journal entry', error)
  }

  async lastPaymentSequence(workspaceId: string, year: number): Promise<number> {
    const { data, error } = await supabase
      .from('payments')
      .select('payment_number')
      .eq('workspace_id', workspaceId)
      .like('payment_number', `PMT-${year}-%`)
      .order('payment_number', { ascending: false })
      .limit(1)

    if (error) throw new DatabaseError('Failed to read payment numbering', error)

    const match = /^PMT-\d{4}-(\d{6})$/.exec((data?.[0]?.payment_number as string) ?? '')
    return match ? Number(match[1]) : 0
  }

  /** Movements that make up a party's ledger: their invoices and payments. */
  /**
   * Every invoice and posted payment of one party — ALL of them.
   *
   * ⚠️ PAGED, NOT `.limit(1000)`. The statement used to read the first 1000
   * rows and build a running balance from them: a party past that point got a
   * wrong closing balance with no error (CLAUDE.md pattern 4). Pages of 1000
   * are read until one comes back short.
   *
   * ⚠️ Cancelled invoices are excluded: a cancelled bill is not debt.
   */
  async partyMovements(workspaceId: string, partyType: PartyType, partyId: string) {
    const partyColumn = partyType === 'customer' ? 'customer_id' : 'supplier_id'

    const [invoices, payments] = await Promise.all([
      readAll('party invoices', (from, to) =>
        supabase
          .from('invoices')
          .select('id, invoice_number, type, status, total, paid_amount, date, due_date, currency')
          .eq('workspace_id', workspaceId)
          .eq(partyColumn, partyId)
          .neq('status', 'cancelled')
          .order('date', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
      ),
      readAll('party payments', (from, to) =>
        supabase
          .from('payments')
          .select('id, payment_number, direction, amount, entry_date, currency, method, reference')
          .eq('workspace_id', workspaceId)
          .eq('party_id', partyId)
          .eq('status', 'posted')
          .order('entry_date', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
      ),
    ])

    // Sale returns of this customer's invoices. They credit the customer in the
    // ledger, so the statement and the balance must see them.
    const returns =
      partyType === 'customer'
        ? await this.returnsOfInvoices(workspaceId, invoices as PartyInvoiceRow[])
        : []

    // Only customers carry an opening balance (customers.opening_balance).
    let openingBalance = 0
    if (partyType === 'customer') {
      const { data, error } = await supabase
        .from('customers')
        .select('opening_balance')
        .eq('workspace_id', workspaceId)
        .eq('id', partyId)
        .maybeSingle()
      if (error) throw new DatabaseError('Failed to fetch opening balance', error)
      openingBalance = Number(data?.opening_balance) || 0
    }

    return {
      invoices: invoices as PartyInvoiceRow[],
      payments: payments as PartyPaymentRow[],
      returns,
      openingBalance,
    }
  }

  /**
   * The sale returns of the given invoices, each carrying its invoice's
   * currency. A database without the returns migration answers «none».
   */
  async returnsOfInvoices(
    workspaceId: string,
    invoices: readonly { id: string; currency?: string | number | null | undefined }[],
  ): Promise<PartyReturnRow[]> {
    const currencyOf = new Map<string, string>(
      invoices.map((invoice) => [invoice.id, String(invoice.currency ?? '')]),
    )
    const ids = [...currencyOf.keys()]
    const returns: PartyReturnRow[] = []
    for (let i = 0; i < ids.length; i += 200) {
      const rows = await readSaleReturns(workspaceId, ids.slice(i, i + 200))
      for (const row of rows) {
        returns.push({ ...row, currency: currencyOf.get(row.original_invoice_id) ?? '' })
      }
    }
    return returns
  }

  /** A customer's sale returns, wherever the caller has no invoice list yet (the balance). */
  async saleReturnsOfCustomer(workspaceId: string, customerId: string): Promise<PartyReturnRow[]> {
    const invoices = await readAll('customer invoices for returns', (from, to) =>
      supabase
        .from('invoices')
        .select('id, currency')
        .eq('workspace_id', workspaceId)
        .eq('customer_id', customerId)
        .eq('type', 'sale')
        .neq('status', 'cancelled')
        .order('id', { ascending: true })
        .range(from, to),
    )
    return this.returnsOfInvoices(workspaceId, invoices as Array<{ id: string; currency?: string }>)
  }

  /** Every line of the given invoices, in chunks of ids and pages of rows. */
  async invoiceLines(workspaceId: string, invoiceIds: string[]) {
    const lines: Record<string, any>[] = []
    for (let i = 0; i < invoiceIds.length; i += 200) {
      const chunk = invoiceIds.slice(i, i + 200)
      lines.push(
        ...(await readAll('invoice lines', (from, to) =>
          supabase
            .from('invoice_items')
            .select('invoice_id, product_id, product_name, unit, unit_label, quantity, total_price')
            .eq('workspace_id', workspaceId)
            .in('invoice_id', chunk)
            .order('id', { ascending: true })
            .range(from, to),
        )),
      )
    }
    return lines as PartyLineRow[]
  }
}
