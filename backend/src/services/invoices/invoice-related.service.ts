// ============================================
// backend/src/services/invoices/invoice-related.service.ts
//
// H2 — the records an invoice is made of, reachable from the invoice.
//
// ---------------------------------------------------------------------------
// WHAT WAS MISSING
//
// The invoice detail page showed `paid_amount` as a number and stopped. There
// was no way to ask WHICH payments made it up, and no way to reach the journal
// entry the invoice produced — no endpoint returned either.
//
// That mattered more after Phase F: `paid_amount` became a projection of
// `SUM(payment_allocations)` maintained by trigger. When it looks wrong, the
// only way to find out why is to see the allocations behind it, and the app
// offered no route to them.
//
// ---------------------------------------------------------------------------
// ONE CALL, NOT THREE
//
// Payments and the journal entry are fetched together because they are opened
// together — a detail page that fires three requests renders in three stages
// and shows a settled invoice as unsettled for the first of them.
//
// ⚠️ THE INVOICE IS RESOLVED FIRST, AND ITS WORKSPACE IS THE FILTER. Every
// query below is scoped by `ctx.workspaceId`, never by an id taken from the
// request — `payment_allocations.invoice_id` is not itself proof that the
// caller may read the invoice.
// ============================================

import { supabase } from '../../db'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import type { TenancyContext } from '../tenancy.service'

export interface InvoicePaymentLink {
  paymentId: string
  allocationId: string
  /** Allocated to THIS invoice — not the payment's full amount. */
  amount: number
  date: string | null
  method: string | null
  reference: string | null
  status: string | null
}

export interface InvoiceJournalLink {
  id: string
  entryNumber: string | null
  date: string | null
  status: string | null
}

export interface InvoiceRelated {
  payments: InvoicePaymentLink[]
  /** `null` when the invoice was never posted, or is still awaiting approval. */
  journalEntry: InvoiceJournalLink | null
  /** Σ of the allocations below — what `paid_amount` is a cache of. */
  allocatedTotal: number
}

/**
 * G4 — does this error mean the table or column does not exist yet, rather
 * than that the query is wrong? Same tolerance the rest of the services use,
 * so this endpoint works against a database that has not had every migration
 * applied instead of failing the whole page.
 */
function isMissingRelation(error: { code?: string } | null): boolean {
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    error?.code === '42703' ||
    error?.code === 'PGRST204'
  )
}

export class InvoiceRelatedService {
  async get(ctx: TenancyContext, invoiceId: string): Promise<InvoiceRelated> {
    // Proves the invoice is readable in THIS workspace before anything else is
    // looked up by its id.
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id')
      .eq('id', invoiceId)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()

    if (invoiceError) throw new DatabaseError('Failed to load the invoice', invoiceError)
    if (!invoice) throw new NotFoundError('Invoice')

    const [payments, journalEntry] = await Promise.all([
      this.payments(ctx, invoiceId),
      this.journalEntry(ctx, invoiceId),
    ])

    return {
      payments,
      journalEntry,
      allocatedTotal: payments.reduce((sum, p) => sum + p.amount, 0),
    }
  }

  private async payments(ctx: TenancyContext, invoiceId: string): Promise<InvoicePaymentLink[]> {
    const { data, error } = await supabase
      .from('payment_allocations')
      .select(
        `id, amount, payment_id,
         payment:payments(id, payment_date, payment_method, reference, status)`,
      )
      .eq('workspace_id', ctx.workspaceId)
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: true })

    // A workspace whose database predates Phase F has no allocations. That is
    // an empty list, not an error — the page still renders the invoice.
    if (error) {
      if (isMissingRelation(error)) return []
      throw new DatabaseError('Failed to load the payments for this invoice', error)
    }

    return (data ?? []).map((row: Record<string, any>) => {
      // PostgREST returns an embedded to-one as an object, but as a
      // single-element ARRAY when it cannot prove the relationship is to-one
      // (a missing FK — gap 4 in the handoff). Both shapes are handled, or the
      // payment date silently renders blank on exactly the databases that have
      // the missing-FK problem.
      const payment = Array.isArray(row.payment) ? row.payment[0] : row.payment

      return {
        allocationId: String(row.id),
        paymentId: String(row.payment_id),
        amount: Number(row.amount) || 0,
        date: payment?.payment_date ?? null,
        method: payment?.payment_method ?? null,
        reference: payment?.reference ?? null,
        status: payment?.status ?? null,
      }
    })
  }

  private async journalEntry(
    ctx: TenancyContext,
    invoiceId: string,
  ): Promise<InvoiceJournalLink | null> {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('id, entry_number, date, status')
      .eq('workspace_id', ctx.workspaceId)
      .eq('source_type', 'invoice')
      .eq('source_id', invoiceId)
      .neq('status', 'cancelled')
      .maybeSingle()

    if (error) {
      if (isMissingRelation(error)) return null
      throw new DatabaseError('Failed to load the journal entry for this invoice', error)
    }
    if (!data) return null

    return {
      id: String(data.id),
      entryNumber: data.entry_number ?? null,
      date: data.date ?? null,
      status: data.status ?? null,
    }
  }
}
