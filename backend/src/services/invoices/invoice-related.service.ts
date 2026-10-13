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
  /** The till this cash went into or came out of; null = none was named. */
  tillSessionId: string | null
  /** The till's name; null when it has none (or no till). */
  tillLabel: string | null
  /** What a bank or money changer kept, in the payment's currency; null = none. */
  feeAmount: number | null
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
/**
 * ONLY «the table is not there» (a database before Phase F).
 *
 * ⚠️ It used to include 42703 (undefined column) and PGRST204. The payments
 * read below asked for `payment_date` / `payment_method` — columns that never
 * existed (they are `entry_date` / `method`) — so every invoice page answered
 * «هنوز پرداختی ثبت نشده» beside a paid invoice, and the drift warning said
 * the stored paid amount did not match «the payments». A wrong column is a
 * bug to surface, not an old database to excuse.
 */
function isMissingRelation(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
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
         payment:payments(id, payment_number, entry_date, method, reference, status)`,
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

    const extras = await this.paymentExtras(
      ctx,
      (data ?? []).map((row: Record<string, any>) => String(row.payment_id)),
    )

    return (data ?? []).map((row: Record<string, any>) => {
      const extra = extras.get(String(row.payment_id))
      // PostgREST returns an embedded to-one as an object, but as a
      // single-element ARRAY when it cannot prove the relationship is to-one
      // (a missing FK — gap 4 in the handoff). Both shapes are handled, or the
      // payment date silently renders blank on exactly the databases that have
      // the missing-FK problem.
      const payment = Array.isArray(row.payment) ? row.payment[0] : row.payment

      return {
        allocationId: String(row.id),
        paymentId: String(row.payment_id),
        tillSessionId: extra?.tillSessionId ?? null,
        tillLabel: extra?.tillLabel ?? null,
        feeAmount: extra?.feeAmount ?? null,
        amount: Number(row.amount) || 0,
        date: payment?.entry_date ?? null,
        method: payment?.method ?? null,
        reference: payment?.reference ?? null,
        status: payment?.status ?? null,
      }
    })
  }

  /**
   * The till and the fee of each payment — columns of two later migrations,
   * so they are read APART from the payments themselves: a database without
   * them still lists the payments, with these simply absent.
   */
  private async paymentExtras(
    ctx: TenancyContext,
    paymentIds: string[],
  ): Promise<
    Map<
      string,
      { tillSessionId: string | null; tillLabel: string | null; feeAmount: number | null }
    >
  > {
    const found = new Map<
      string,
      { tillSessionId: string | null; tillLabel: string | null; feeAmount: number | null }
    >()
    const unique = [...new Set(paymentIds.filter(Boolean))]
    if (unique.length === 0) return found

    const missing = (error: { code?: string } | null) =>
      error?.code === '42703' || error?.code === 'PGRST204'

    const tills = await supabase
      .from('payments')
      .select('id, pos_session_id')
      .eq('workspace_id', ctx.workspaceId)
      .in('id', unique)
    if (tills.error && !missing(tills.error)) {
      throw new DatabaseError('Failed to load the tills of these payments', tills.error)
    }
    for (const row of (tills.data ?? []) as Array<{ id: string; pos_session_id: string | null }>) {
      found.set(row.id, {
        tillSessionId: row.pos_session_id ?? null,
        tillLabel: null,
        feeAmount: null,
      })
    }

    const fees = await supabase
      .from('payments')
      .select('id, fee_amount')
      .eq('workspace_id', ctx.workspaceId)
      .in('id', unique)
    if (fees.error && !missing(fees.error)) {
      throw new DatabaseError('Failed to load the fees of these payments', fees.error)
    }
    for (const row of (fees.data ?? []) as Array<{
      id: string
      fee_amount: number | string | null
    }>) {
      const fee = Number(row.fee_amount)
      const entry = found.get(row.id) ?? { tillSessionId: null, tillLabel: null, feeAmount: null }
      found.set(row.id, { ...entry, feeAmount: fee > 0 ? fee : null })
    }

    const sessionIds = [
      ...new Set([...found.values()].map((entry) => entry.tillSessionId).filter(Boolean)),
    ] as string[]
    if (sessionIds.length === 0) return found

    const labels = await supabase
      .from('pos_sessions')
      .select('id, label')
      .eq('workspace_id', ctx.workspaceId)
      .in('id', sessionIds)
    // No name column yet: the till is still said, without a name.
    if (labels.error && !missing(labels.error)) {
      throw new DatabaseError('Failed to load the names of these tills', labels.error)
    }
    const nameOf = new Map(
      ((labels.data ?? []) as Array<{ id: string; label: string | null }>).map((row) => [
        row.id,
        row.label?.trim() || null,
      ]),
    )
    for (const [id, entry] of found) {
      if (entry.tillSessionId) {
        found.set(id, { ...entry, tillLabel: nameOf.get(entry.tillSessionId) ?? null })
      }
    }
    return found
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
