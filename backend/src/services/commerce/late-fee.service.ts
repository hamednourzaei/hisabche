// ============================================
// backend/src/services/commerce/late-fee.service.ts
//
// Capability #124 — late payment fees.
//
// The RULE is the installment domain's (`overdueInstallments`): a fee is worked
// out on what is OVERDUE, not on the whole invoice; a paid installment is never
// late; a cap limits it. This file reads the rows, asks the rule, and — only
// when a manager says so — charges.
//
// ⚠️ NOTHING IS CHARGED AUTOMATICALLY. There is no job. `preview` shows what
// could be charged; `assess` is a person's decision.
//
// ⚠️ THE FEE IS AN ORDINARY SALE INVOICE, issued through `InvoiceService.create`
// — the same function every sale uses. The receivable and the ledger entry are
// that invoice's. Nothing here writes a journal line, a balance or a payment.
//
// ⚠️ CHARGED ONCE. An assessment row is written FIRST, under a unique index on
// (invoice, installment, period); the invoice is issued second with a key
// derived from that same triple. A double click, a retry, and a crash between
// the two steps all end with one row and one invoice: a row whose invoice was
// not issued is finished by the next call, never repeated.
//
// ⚠️ THE POLICY IS SNAPSHOTTED on each assessment, so a fee stays explainable
// after the policy changes.
//
// ⚠️ NO FEE ON A FEE. An invoice that is itself a late fee is never assessed.
// ============================================

import {
  buildLateFeePreview,
  createInvoiceSchema,
  FEE_LINE,
  lateFeePolicySchema,
  LATE_FEE_LANGUAGES,
  planLateFeeAssessment,
  type CreateInvoice,
  type LateFeeAssessmentRow,
  type LateFeeInvoiceFacts,
  type LateFeeLanguage,
  type LateFeePolicy,
  type LateFeePreview,
} from '@hisabche/validation'

export { LATE_FEE_LANGUAGES }
export type { LateFeeLanguage, LateFeePreview }

import { supabase } from '../../db'
import { BaseError } from '../../errors/base.error'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { sourceIdOf } from '../../utils/deterministic-id'
import { minor } from '../../utils/money'
import { InvoiceService } from '../invoice.service'
import type { TenancyContext } from '../tenancy.service'
import { InstallmentsNotConfiguredError, installmentService } from './installment.service'

const MISSING_SCHEMA = new Set(['42703', '42P01', 'PGRST204', 'PGRST205'])
const POLICY_COLUMNS =
  'is_enabled, basis, amount_minor, currency, percent, grace_days, max_share_percent, updated_at'
const ASSESSMENT_COLUMNS =
  'id, seq, period_no, due_date, days_late, overdue_minor, fee_minor, currency, fee_invoice_id, assessed_at'

export class LateFeesNotConfiguredError extends BaseError {
  constructor() {
    super('LATE_FEES_MIGRATION_PENDING', 503)
    this.name = 'LateFeesNotConfiguredError'
  }
}

type DbError = { code?: string; message: string }

function fail(error: DbError, what: string): never {
  if (MISSING_SCHEMA.has(error.code ?? '')) throw new LateFeesNotConfiguredError()
  throw new DatabaseError(what, error)
}

type InvoiceFacts = LateFeeInvoiceFacts

const today = () => new Date().toISOString().slice(0, 10)
const major = (hundredths: number | string) => Number(hundredths) / 100

export interface LateFeeInvoiceCreator {
  create: InvoiceService['create']
}

export class LateFeeService {
  constructor(private readonly invoices: LateFeeInvoiceCreator = new InvoiceService()) {}

  // ─── Policy ────────────────────────────────────────────────────────────────

  /** The saved policy, or null when the business has never set one (= no fee). */
  async policy(ctx: TenancyContext): Promise<LateFeePolicy | null> {
    const { data, error } = await supabase
      .from('late_fee_policies')
      .select(POLICY_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()
    if (error) fail(error, 'Failed to read the late fee policy')
    if (!data) return null
    const row = data as {
      is_enabled: boolean
      basis: 'per_period' | 'percentage'
      amount_minor: number | string | null
      currency: string | null
      percent: number | string | null
      grace_days: number
      max_share_percent: number | string
      updated_at: string
    }
    return {
      isEnabled: row.is_enabled,
      basis: row.basis,
      amount: row.amount_minor === null ? null : major(row.amount_minor),
      currency: row.currency,
      percent: row.percent === null ? null : Number(row.percent),
      graceDays: row.grace_days,
      maxSharePercent: Number(row.max_share_percent),
      updatedAt: row.updated_at,
    }
  }

  async savePolicy(ctx: TenancyContext, raw: unknown): Promise<LateFeePolicy> {
    const input = lateFeePolicySchema.parse(raw)
    const fixed = input.basis === 'per_period'
    const amountMinor = fixed ? minor(input.amount ?? 0) : null
    // 0.004 is a positive number and zero hundredths.
    if (fixed && !(amountMinor! > 0)) throw new ValidationError('LATE_FEE_AMOUNT_REQUIRED')

    const { error } = await supabase.from('late_fee_policies').upsert(
      {
        workspace_id: ctx.workspaceId,
        is_enabled: input.isEnabled,
        basis: input.basis,
        // Each basis keeps only its own fields, whatever was sent with it.
        amount_minor: amountMinor,
        currency: fixed ? input.currency!.toUpperCase() : null,
        percent: fixed ? null : input.percent,
        grace_days: input.graceDays,
        max_share_percent: input.maxSharePercent,
        updated_by: ctx.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id' },
    )
    if (error) fail(error, 'Failed to save the late fee policy')
    const saved = await this.policy(ctx)
    if (!saved) throw new DatabaseError('Failed to read the late fee policy back', {})
    return saved
  }

  // ─── One invoice ───────────────────────────────────────────────────────────

  /** What is overdue on the invoice, what the policy asks for, and what was charged. */
  async preview(ctx: TenancyContext, invoiceId: string): Promise<LateFeePreview> {
    const invoice = await this.invoice(ctx, invoiceId)
    const policy = await this.policy(ctx)
    const assessments = await this.assessments(ctx, invoiceId)
    const isFeeInvoice =
      invoice.type === 'sale' && invoice.status !== 'cancelled'
        ? await this.isFeeInvoice(ctx, invoiceId)
        : false
    return buildLateFeePreview({
      invoice,
      policy,
      assessments,
      plannedLines: await this.plannedLines(ctx, invoice),
      isFeeInvoice,
      asOf: today(),
    })
  }

  /**
   * Charge what the preview says can be charged, and finish any assessment
   * whose fee invoice was not issued. Returns the invoice as it now stands.
   */
  async assess(
    ctx: TenancyContext,
    invoiceId: string,
    language: LateFeeLanguage,
  ): Promise<LateFeePreview> {
    const preview = await this.preview(ctx, invoiceId)
    const work = planLateFeeAssessment(preview)
    if ('refusal' in work) throw new ValidationError(work.refusal)
    const invoice = await this.invoice(ctx, invoiceId)
    const policy = preview.policy!

    for (const row of work.unfinished) await this.issue(ctx, invoice, language, row)

    for (const line of work.chargeable) {
      const { data, error } = await supabase
        .from('late_fee_assessments')
        .insert({
          workspace_id: ctx.workspaceId,
          invoice_id: invoiceId,
          seq: line.seq,
          period_no: line.periodNo,
          due_date: line.dueDate,
          days_late: line.daysLate,
          overdue_minor: line.overdueMinor,
          fee_minor: line.feeMinor,
          currency: invoice.currency,
          policy,
          assessed_by: ctx.userId,
        })
        .select('id')
        .single()
      if (error) {
        // Someone else charged this period a moment ago: theirs stands.
        if (error.code === '23505') continue
        fail(error, 'Failed to record the late fee')
      }
      await this.issue(ctx, invoice, language, {
        id: String((data as { id: string }).id),
        seq: line.seq,
        periodNo: line.periodNo,
        feeMinor: line.feeMinor,
      })
    }

    return this.preview(ctx, invoiceId)
  }

  /** Issue the fee invoice for one assessment and point the assessment at it. */
  private async issue(
    ctx: TenancyContext,
    invoice: InvoiceFacts,
    language: LateFeeLanguage,
    assessment: { id: string; seq: number; periodNo: number; feeMinor: number },
  ) {
    const fee = major(assessment.feeMinor)
    const body = createInvoiceSchema.parse({
      type: 'sale',
      date: `${today()}T00:00:00.000Z`,
      customerId: invoice.customerId,
      currency: invoice.currency,
      items: [
        {
          productName: FEE_LINE[language](invoice.invoiceNumber, assessment.seq),
          quantity: 1,
          unitPrice: fee,
          totalPrice: fee,
        },
      ],
      subtotal: fee,
      total: fee,
      paidAmount: 0,
      reference: invoice.invoiceNumber,
    }) as CreateInvoice

    const created = (await this.invoices.create(ctx, body, null, {
      // The same key for the same (invoice, installment, period), always: a
      // retried call gets back the invoice the first attempt created.
      clientRequestId: sourceIdOf(
        ctx.workspaceId,
        'late_fee',
        invoice.id,
        String(assessment.seq),
        String(assessment.periodNo),
      ),
    })) as { id?: string } | null
    if (!created?.id) throw new DatabaseError('The late fee invoice was not created', {})

    const { error } = await supabase
      .from('late_fee_assessments')
      .update({ fee_invoice_id: created.id })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', assessment.id)
      .is('fee_invoice_id', null)
    if (error) fail(error, 'Failed to link the late fee invoice')
  }

  // ─── Reads ─────────────────────────────────────────────────────────────────

  private async invoice(ctx: TenancyContext, invoiceId: string): Promise<InvoiceFacts> {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, type, status, customer_id, currency, due_date')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', invoiceId)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to read the invoice', error)
    if (!data) throw new NotFoundError('Invoice')

    const owed = await supabase
      .from('invoice_outstanding')
      .select('total, allocated')
      .eq('workspace_id', ctx.workspaceId)
      .eq('invoice_id', invoiceId)
      .maybeSingle()
    if (owed.error) throw new DatabaseError('Failed to read what the invoice owes', owed.error)
    if (!owed.data) throw new NotFoundError('Invoice')

    const row = data as Record<string, unknown>
    return {
      id: String(row.id),
      invoiceNumber: String(row.invoice_number ?? ''),
      type: String(row.type ?? ''),
      status: String(row.status ?? ''),
      customerId: (row.customer_id as string | null) ?? null,
      currency: String(row.currency ?? ''),
      dueDate: row.due_date ? String(row.due_date).slice(0, 10) : null,
      totalMinor: minor(Number((owed.data as { total: unknown }).total) || 0),
      allocatedMinor: minor(Number((owed.data as { allocated: unknown }).allocated) || 0),
    }
  }

  /** The installments of the plan; none before the installments migration. */
  private async plannedLines(ctx: TenancyContext, invoice: InvoiceFacts) {
    try {
      return (await installmentService.get(ctx, invoice.id)).lines
    } catch (error) {
      // Before the installments migration no invoice has a plan — which is true.
      if (!(error instanceof InstallmentsNotConfiguredError)) throw error
      return []
    }
  }

  private async assessments(
    ctx: TenancyContext,
    invoiceId: string,
  ): Promise<LateFeeAssessmentRow[]> {
    const { data, error } = await supabase
      .from('late_fee_assessments')
      .select(ASSESSMENT_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('invoice_id', invoiceId)
      .order('assessed_at', { ascending: true })
    if (error) fail(error, 'Failed to read the late fees charged')
    return (data ?? []) as LateFeeAssessmentRow[]
  }

  private async isFeeInvoice(ctx: TenancyContext, invoiceId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('late_fee_assessments')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId)
      .eq('fee_invoice_id', invoiceId)
    if (error) fail(error, 'Failed to check the invoice')
    return (count ?? 0) > 0
  }
}

export const lateFeeService = new LateFeeService()
