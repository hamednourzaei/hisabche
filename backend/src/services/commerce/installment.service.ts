// ============================================
// backend/src/services/commerce/installment.service.ts
//
// Capability #123 — an installment plan on one invoice.
//
// A plan is a SCHEDULE: when the unpaid part of the invoice is due, in parts.
// It records no payment. Money is still recorded through the payments core and
// allocated to the invoice; how much of each installment is paid is DERIVED
// here from what the invoice still owes, oldest installment first. There is no
// second record of a payment to drift from the first.
//
// ⚠️ NO LATE FEE IS CHARGED HERE (#124). A fee is a shop's decision, made by a
// manager through late-fee.service.ts, which reads this plan and the policy.
//
// The split is the domain's (`planSchedule`); the write is one Postgres
// function (`installments_save`), which re-checks under a lock that the parts
// add up to what the invoice owes at that moment.
// ============================================

import { supabase } from '../../db'
import { BaseError } from '../../errors/base.error'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import type { TenancyContext } from '../tenancy.service'
import { daysBetween, planSchedule } from './installment.domain'

const MISSING_SCHEMA = new Set(['42703', '42P01', 'PGRST202', 'PGRST204', 'PGRST205'])

/** Refusals the database raises by name; each has a translation on the client. */
export const INSTALLMENT_ERROR_CODES = [
  'INSTALLMENT_INVOICE_NOT_FOUND',
  'INSTALLMENT_COUNT_INVALID',
  'INSTALLMENT_NOTHING_OWED',
  'INSTALLMENT_SUM_MISMATCH',
  'INSTALLMENT_LINES_INVALID',
] as const

export class InstallmentsNotConfiguredError extends BaseError {
  constructor() {
    super('INSTALLMENTS_MIGRATION_PENDING', 503)
    this.name = 'InstallmentsNotConfiguredError'
  }
}

export interface InstallmentLine {
  seq: number
  dueDate: string
  /** Major units of the invoice's currency. */
  amount: number
  paid: number
  remaining: number
  /** Whole days past the due date with something still unpaid; 0 otherwise. */
  daysLate: number
}

export interface InstallmentPlan {
  invoiceId: string
  currency: string
  /** What the invoice owes now (total − allocated), major units. */
  outstanding: number
  /** Empty = the invoice has no plan. */
  lines: InstallmentLine[]
  /** The next unpaid installment, or null when there is no plan or it is all paid. */
  nextDue: { seq: number; dueDate: string; remaining: number } | null
}

const today = () => new Date().toISOString().slice(0, 10)

export class InstallmentService {
  private async invoice(ctx: TenancyContext, invoiceId: string) {
    const { data, error } = await supabase
      .from('invoice_outstanding')
      .select('invoice_id, total, allocated, outstanding, currency, due_date, invoice_date')
      .eq('workspace_id', ctx.workspaceId)
      .eq('invoice_id', invoiceId)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to read the invoice', error)
    if (!data) throw new NotFoundError('Invoice')
    return data as {
      invoice_id: string
      outstanding: number | string | null
      currency: string | null
    }
  }

  async get(ctx: TenancyContext, invoiceId: string): Promise<InstallmentPlan> {
    const invoice = await this.invoice(ctx, invoiceId)
    const outstandingMinor = Math.max(0, Math.round((Number(invoice.outstanding) || 0) * 100))

    const { data, error } = await supabase
      .from('invoice_installments')
      .select('seq, due_date, amount_minor')
      .eq('workspace_id', ctx.workspaceId)
      .eq('invoice_id', invoiceId)
      .order('seq', { ascending: true })
    // «Not set up yet» and «failed» are different answers, and neither is «no plan».
    if (error) {
      if (MISSING_SCHEMA.has(error.code ?? '')) throw new InstallmentsNotConfiguredError()
      throw new DatabaseError('Failed to read the installment plan', error)
    }

    const rows = (data ?? []) as Array<{
      seq: number
      due_date: string
      amount_minor: number | string
    }>
    const plannedMinor = rows.reduce((sum, row) => sum + Number(row.amount_minor), 0)
    // Paid toward the plan = what the plan asked for, less what is still owed.
    // Never negative: a later credit note can leave more owed than planned.
    let paidLeft = Math.max(0, plannedMinor - outstandingMinor)
    const asOf = today()

    const lines: InstallmentLine[] = rows.map((row) => {
      const amountMinor = Number(row.amount_minor)
      const paidMinor = Math.min(amountMinor, paidLeft)
      paidLeft -= paidMinor
      const remainingMinor = amountMinor - paidMinor
      const dueDate = String(row.due_date).slice(0, 10)
      return {
        seq: row.seq,
        dueDate,
        amount: amountMinor / 100,
        paid: paidMinor / 100,
        remaining: remainingMinor / 100,
        // A paid installment is never late, however old it is.
        daysLate: remainingMinor > 0 ? Math.max(0, daysBetween(dueDate, asOf)) : 0,
      }
    })

    const next = lines.find((line) => line.remaining > 0) ?? null
    return {
      invoiceId,
      currency: invoice.currency ?? '',
      outstanding: outstandingMinor / 100,
      lines,
      nextDue: next ? { seq: next.seq, dueDate: next.dueDate, remaining: next.remaining } : null,
    }
  }

  /** Split what the invoice owes NOW into `count` monthly parts from `firstDueDate`. */
  async plan(
    ctx: TenancyContext,
    invoiceId: string,
    input: { count: number; firstDueDate: string },
  ): Promise<InstallmentPlan> {
    const invoice = await this.invoice(ctx, invoiceId)
    const totalMinor = Math.round((Number(invoice.outstanding) || 0) * 100)
    if (totalMinor <= 0) throw new ValidationError('INSTALLMENT_NOTHING_OWED')
    // A part smaller than one minor unit cannot be asked for.
    if (totalMinor < input.count) throw new ValidationError('INSTALLMENT_COUNT_INVALID')

    const schedule = planSchedule({
      totalMinor,
      count: input.count,
      firstDueDate: input.firstDueDate,
    })
    await this.save(
      ctx,
      invoiceId,
      schedule.map((line) => ({
        seq: line.seq,
        due_date: line.dueDate,
        amount_minor: line.amountMinor,
      })),
    )
    return this.get(ctx, invoiceId)
  }

  /** Remove the plan. The invoice is then due on its own due date again. */
  async clear(ctx: TenancyContext, invoiceId: string): Promise<InstallmentPlan> {
    await this.invoice(ctx, invoiceId)
    await this.save(ctx, invoiceId, [])
    return this.get(ctx, invoiceId)
  }

  private async save(ctx: TenancyContext, invoiceId: string, lines: unknown[]) {
    const { error } = await supabase.rpc('installments_save', {
      p_workspace_id: ctx.workspaceId,
      p_user_id: ctx.userId,
      p_invoice_id: invoiceId,
      p_lines: lines,
    })
    if (!error) return
    if (MISSING_SCHEMA.has(error.code ?? '')) throw new InstallmentsNotConfiguredError()
    const code = INSTALLMENT_ERROR_CODES.find((known) => (error.message ?? '').includes(known))
    if (code === 'INSTALLMENT_INVOICE_NOT_FOUND') throw new NotFoundError('Invoice')
    if (code) throw new ValidationError(code)
    throw new DatabaseError('Failed to save the installment plan', error)
  }
}

export const installmentService = new InstallmentService()
