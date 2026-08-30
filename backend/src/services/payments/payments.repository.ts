// ============================================
// backend/src/services/payments/payments.repository.ts
//
// The only file in the payments core that knows Supabase and column names.
// ============================================

import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import type { TenancyContext } from '../tenancy.service'

import type { AllocationRequest, OpenInvoice, PartyType, PaymentDirection } from './payments.domain'

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
      .select('invoice_id, invoice_number, total, allocated, due_date, invoice_date, type')
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
  ): Promise<string> {
    const { data, error } = await supabase.rpc('payments_record', {
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

    if (error) throw error
    return data as string
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
  async partyMovements(workspaceId: string, partyType: PartyType, partyId: string) {
    const partyColumn = partyType === 'customer' ? 'customer_id' : 'supplier_id'

    const [invoices, payments] = await Promise.all([
      supabase
        .from('invoices')
        .select('id, invoice_number, type, total, date')
        .eq('workspace_id', workspaceId)
        .eq(partyColumn, partyId)
        .order('date', { ascending: true })
        .limit(1000),
      supabase
        .from('payments')
        .select('id, payment_number, direction, amount, entry_date')
        .eq('workspace_id', workspaceId)
        .eq('party_id', partyId)
        .eq('status', 'posted')
        .order('entry_date', { ascending: true })
        .limit(1000),
    ])

    if (invoices.error) throw new DatabaseError('Failed to fetch party invoices', invoices.error)
    if (payments.error) throw new DatabaseError('Failed to fetch party payments', payments.error)

    return { invoices: invoices.data ?? [], payments: payments.data ?? [] }
  }
}
